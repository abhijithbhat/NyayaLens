import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { DEFAULT_MODEL_CASCADE } from '@/lib/models';
import { Type } from '@google/genai';
import { Clause, ParsedDocument, ParseApiResponse } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { errorResponse } from '@/lib/apiError';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

export async function POST(request: NextRequest): Promise<NextResponse<any>> {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return errorResponse('EMPTY_DOCUMENT', 'No file was uploaded or the uploaded file is empty.', 400);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse(
        'FILE_TOO_LARGE',
        `File size exceeds the 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
        400
      );
    }

    // MIME type check
    const mimeType = file.type || '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return errorResponse(
        'INVALID_FILE_TYPE',
        `Unsupported file type "${mimeType || 'unknown'}". Please upload a PDF or image (PNG, JPEG, WebP).`,
        400
      );
    }

    const bytes = await file.arrayBuffer();

    // Validate PDF magic bytes if PDF is claimed
    if (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const header = Buffer.from(bytes.slice(0, 5)).toString('utf-8');
      if (!header.startsWith('%PDF-')) {
        return errorResponse(
          'CORRUPTED_FILE',
          'The uploaded file is corrupted or not a valid PDF document (missing PDF header).',
          400
        );
      }
    }

    const base64Data = Buffer.from(bytes).toString('base64');

    const ai = getGeminiClient();
    let rawOutput = '';
    let lastError: Error | null = null;

    for (const model of DEFAULT_MODEL_CASCADE) {
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
      return errorResponse('SCHEMA_MISMATCH', 'Gemini response could not be parsed as valid JSON.', 422);
    }

    if (!Array.isArray(parsedClauses) || parsedClauses.length === 0) {
      return errorResponse(
        'INSUFFICIENT_CONTENT',
        'Not enough legal content to analyze. The document contains no recognizable contractual terms or clauses.',
        422
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
      return errorResponse(
        'INSUFFICIENT_CONTENT',
        'Not enough legal content to analyze. No readable text clauses could be extracted from the document.',
        422
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
    const rawMsg = error instanceof Error ? error.message : 'Unknown server error';
    const isServiceDown =
      rawMsg.includes('503') ||
      rawMsg.includes('UNAVAILABLE') ||
      rawMsg.includes('high demand') ||
      rawMsg.includes('Failed to generate') ||
      rawMsg.includes('temporarily');

    const userMessage = isServiceDown
      ? 'AI services are temporarily unavailable. Please try again in a few moments.'
      : `Ingestion failed: ${rawMsg}`;

    return errorResponse(
      isServiceDown ? 'SERVICE_UNAVAILABLE' : 'API_ERROR',
      userMessage,
      isServiceDown ? 503 : 500
    );
  }
}
