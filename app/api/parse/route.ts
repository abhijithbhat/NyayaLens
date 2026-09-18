import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';
import { Clause, ParsedDocument, ParseApiResponse } from '@/lib/types';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
].filter(Boolean) as string[];

const PARSE_PROMPT = `
You are an expert legal document parser.
Analyze this legal document and segment it completely into individual clauses.
Each clause represents one distinct obligation, term, provision, condition, right, or specification in the document.

Rules:
1. Every clause must have:
   - id: sequential identifier (e.g. "clause-1", "clause-2", etc.)
   - sectionNumber: section/clause numbering from document if present (e.g. "1.1", "Clause 4", "Section 2"), or omit/empty if not present.
   - heading: short concise descriptive heading (3-6 words) summarizing the provision.
   - rawText: the exact verbatim text of the clause copied directly from the document without paraphrasing, omitting words, or summarizing.
   - category: strictly one of ["Payment", "Termination", "Liability", "Deposit", "Notice", "Other"].
2. Categorization guidelines:
   - "Payment": rent, salary, fee, consideration, interest, taxes, due dates, penalty fees.
   - "Termination": cancellation, end of term, expiry, breach, grounds for termination.
   - "Liability": indemnification, damages, repairs, losses, representations, warranties, negligence.
   - "Deposit": security deposit, advance amount, retention, refund conditions, deductions.
   - "Notice": written notice period, delivery address, communication method, cure periods.
   - "Other": jurisdiction, dispute resolution, governing law, recitals, definitions, general miscellaneous terms.
3. Complete coverage: do not skip any operational provisions, obligations, or covenants in the document.
`;

const responseSchema = {
  type: Type.ARRAY,
  description: 'List of all extracted legal clauses',
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: 'Unique sequential clause identifier (e.g. clause-1, clause-2)',
      },
      sectionNumber: {
        type: Type.STRING,
        description: 'Section or clause number from the document if available',
      },
      heading: {
        type: Type.STRING,
        description: 'Short descriptive heading summarizing the clause',
      },
      rawText: {
        type: Type.STRING,
        description: 'Verbatim raw text of the clause extracted from the source document',
      },
      category: {
        type: Type.STRING,
        enum: ['Payment', 'Termination', 'Liability', 'Deposit', 'Notice', 'Other'],
        description: 'Category of the legal obligation',
      },
    },
    required: ['id', 'heading', 'rawText', 'category'],
  },
};

export async function POST(request: NextRequest): Promise<NextResponse<ParseApiResponse>> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'EMPTY_DOCUMENT',
          message: 'No file was uploaded or the uploaded file is empty.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds the 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
        },
        { status: 400 }
      );
    }

    // MIME type check
    const mimeType = file.type || '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'INVALID_FILE_TYPE',
          message: `Unsupported file type "${mimeType || 'unknown'}". Please upload a PDF or image (PNG, JPEG, WebP).`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    const ai = getGeminiClient();
    let rawOutput = '';
    let lastError: Error | null = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: PARSE_PROMPT,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        if (response.text) {
          rawOutput = response.text.trim();
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    if (!rawOutput) {
      throw lastError || new Error('No response generated by Gemini model.');
    }

    let parsedClauses: Clause[] = [];
    try {
      parsedClauses = JSON.parse(rawOutput);
    } catch {
      return NextResponse.json(
        {
          status: 'error',
          code: 'SCHEMA_MISMATCH',
          message: 'Gemini response could not be parsed as valid JSON.',
        },
        { status: 422 }
      );
    }

    if (!Array.isArray(parsedClauses) || parsedClauses.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'EMPTY_DOCUMENT',
          message: 'The document could not be parsed into recognizable legal clauses or is empty.',
        },
        { status: 422 }
      );
    }

    // Validate schema conformance on each item
    const validClauses: Clause[] = parsedClauses.map((c, index) => ({
      id: c.id || `clause-${index + 1}`,
      sectionNumber: c.sectionNumber || undefined,
      heading: c.heading || `Clause ${index + 1}`,
      rawText: c.rawText || '',
      category: c.category || 'Other',
    })).filter((c) => c.rawText.trim().length > 0);

    if (validClauses.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'EMPTY_DOCUMENT',
          message: 'No readable text clauses could be extracted from the document.',
        },
        { status: 422 }
      );
    }

    const documentRecord: ParsedDocument = {
      id: crypto.randomUUID(),
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      clauses: validClauses,
    };

    return NextResponse.json({
      status: 'success',
      data: documentRecord,
    });
  } catch (error: unknown) {
    console.error('Parse API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      {
        status: 'error',
        code: 'API_ERROR',
        message: `Ingestion failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
