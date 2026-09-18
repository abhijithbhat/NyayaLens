import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';
import { Clause, ParsedDocument, AnalyzedClause, SimplifyApiResponse, RiskSeverity } from '@/lib/types';
import { lexicalOverlapCheck, llmJudgeCheck } from '@/lib/verify';

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
].filter(Boolean) as string[];

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: 'Clear, concise, plain-language explanation of what this clause means for the reader (1-2 sentences)',
    },
    risk: {
      type: Type.OBJECT,
      properties: {
        severity: {
          type: Type.STRING,
          enum: ['none', 'low', 'medium', 'high'],
          description: 'Risk severity level for the signer/tenant/employee',
        },
        reason: {
          type: Type.STRING,
          description: 'One-line reason explaining the risk assessment',
        },
      },
      required: ['severity', 'reason'],
    },
  },
  required: ['explanation', 'risk'],
};

interface RawAnalysisGeneration {
  explanation: string;
  risk: {
    severity: RiskSeverity;
    reason: string;
  };
}

async function generateClauseAnalysis(clause: Clause): Promise<RawAnalysisGeneration> {
  const prompt = `
You are an expert AI legal co-pilot helping an ordinary Indian citizen understand a legal agreement.
Analyze the following legal clause:

HEADING: ${clause.heading || 'Clause'}
CATEGORY: ${clause.category}
SECTION: ${clause.sectionNumber || 'N/A'}

SOURCE CLAUSE TEXT:
"""
${clause.rawText}
"""

Instructions:
1. "explanation": Write a direct, clear plain-language explanation of what this clause requires, grants, or forbids.
   - Ground every single fact strictly in the source text.
   - If numbers, fees, percentages, or timeframes are specified in the source, cite them faithfully. Do NOT invent or extrapolate numbers.
2. "risk":
   - "severity": "none" | "low" | "medium" | "high".
     * "high": unilateral forfeiture, immediate eviction without notice, unreasonable penalties, one-sided liabilities.
     * "medium": mandatory non-negotiable deductions, lock-in commitments, restricted activities.
     * "low": standard payment schedules, routine utility bills, standard notice requirements.
     * "none": standard recitals, standard jurisdiction clauses.
   - "reason": A single crisp sentence explaining why this level was assigned.
`;

  const ai = getGeminiClient();
  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: analysisResponseSchema,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as RawAnalysisGeneration;
        return {
          explanation: parsed.explanation || '',
          risk: {
            severity: parsed.risk?.severity || 'low',
            reason: parsed.risk?.reason || '',
          },
        };
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errStr = String(err);
      if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
        await new Promise((r) => setTimeout(r, 15000));
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
      continue;
    }
  }

  throw lastError || new Error(`Failed to generate clause analysis for ${clause.id}`);
}

async function processClause(clause: Clause): Promise<AnalyzedClause> {
  try {
    // 1. Generate explanation and risk assessment
    const generated = await generateClauseAnalysis(clause);

    // 2. Formulate the claim to verify against the source text
    const claimToVerify = generated.explanation;

    // 3. Gate 1: Lexical and numerical overlap check
    const lexicalPassed = lexicalOverlapCheck(claimToVerify, clause.rawText);

    let llmJudgePassed = false;
    let confidence = 0;
    let judgeDetails = '';

    // 4. Gate 2: LLM-Judge verification (only evaluated if Gate 1 passes)
    if (lexicalPassed) {
      try {
        const judgeResult = await llmJudgeCheck(claimToVerify, clause.rawText);
        confidence = judgeResult.confidence;
        judgeDetails = judgeResult.reason;
        llmJudgePassed = judgeResult.verified && judgeResult.confidence >= 0.65;
      } catch (judgeErr) {
        judgeDetails = `Judge call failed: ${judgeErr instanceof Error ? judgeErr.message : String(judgeErr)}`;
        llmJudgePassed = false;
      }
    } else {
      judgeDetails = 'Failed Gate 1 (Lexical/Numerical grounding check: key terms or figures not found in source text).';
    }

    // 5. Dual-Gate Decision
    const bothPassed = lexicalPassed && llmJudgePassed;

    if (bothPassed) {
      return {
        ...clause,
        analysis: {
          clauseId: clause.id,
          explanation: generated.explanation,
          risk: {
            severity: generated.risk.severity,
            reason: generated.risk.reason,
          },
          verification: {
            status: 'verified',
            lexicalPassed: true,
            llmJudgePassed: true,
            confidence,
            details: judgeDetails,
          },
        },
      };
    } else {
      // Abstention: Never show an unverified claim
      return {
        ...clause,
        analysis: {
          clauseId: clause.id,
          explanation: '', // Do NOT invent or display unverified claims
          risk: {
            severity: 'medium', // Flag for human attention
            reason: 'Unverified claim: The generated explanation could not be strictly grounded in the clause text. Manual reading required.',
          },
          verification: {
            status: 'needs_review',
            lexicalPassed,
            llmJudgePassed,
            confidence,
            details: judgeDetails,
          },
        },
      };
    }
  } catch (err) {
    return {
      ...clause,
      analysis: {
        clauseId: clause.id,
        explanation: '',
        risk: {
          severity: 'medium',
          reason: 'Error processing clause. Please consult original text.',
        },
        verification: {
          status: 'needs_review',
          lexicalPassed: false,
          llmJudgePassed: false,
          confidence: 0,
          details: err instanceof Error ? err.message : 'Processing failure',
        },
      },
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SimplifyApiResponse>> {
  try {
    const body = await request.json();
    let clauses: Clause[] = [];
    let documentId: string | undefined = undefined;

    if (body.document && Array.isArray(body.document.clauses)) {
      clauses = body.document.clauses;
      documentId = body.document.id;
    } else if (Array.isArray(body.clauses)) {
      clauses = body.clauses;
      documentId = body.id;
    } else if (body.id && body.rawText) {
      clauses = [body as Clause];
    } else {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid request body. Expected { document: ParsedDocument } or { clauses: Clause[] }.',
        },
        { status: 400 }
      );
    }

    if (clauses.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No clauses provided for simplification and verification.',
        },
        { status: 400 }
      );
    }

    // Process clauses in controlled batches of 2 with pacing to stay within free-tier rate limits
    const analyzedClauses: AnalyzedClause[] = [];
    const BATCH_SIZE = 2;

    for (let i = 0; i < clauses.length; i += BATCH_SIZE) {
      const batch = clauses.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((c) => processClause(c)));
      analyzedClauses.push(...results);
      if (i + BATCH_SIZE < clauses.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const verifiedCount = analyzedClauses.filter((c) => c.analysis.verification.status === 'verified').length;
    const needsReviewCount = analyzedClauses.filter((c) => c.analysis.verification.status === 'needs_review').length;
    const highRiskCount = analyzedClauses.filter((c) => c.analysis.risk.severity === 'high').length;

    return NextResponse.json({
      status: 'success',
      data: {
        documentId,
        analyzedClauses,
        summary: {
          totalClauses: analyzedClauses.length,
          verifiedCount,
          needsReviewCount,
          highRiskCount,
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      {
        status: 'error',
        message: `Simplification pipeline failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
