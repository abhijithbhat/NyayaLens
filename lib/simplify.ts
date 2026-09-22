import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';
import { Clause, AnalyzedClause, RiskSeverity, Language } from '@/lib/types';
import { lexicalOverlapCheck, batchLlmJudgeCheck, BatchJudgeItem } from '@/lib/verify';

const CANDIDATE_MODELS = Array.from(
  new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ])
).filter(Boolean) as string[];

const batchedAnalysisResponseSchema = {
  type: Type.ARRAY,
  description: 'Array of plain-language explanations and risk assessments for each input clause',
  items: {
    type: Type.OBJECT,
    properties: {
      clauseId: {
        type: Type.STRING,
        description: 'The unique clause id matching the input clause',
      },
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
    required: ['clauseId', 'explanation', 'risk'],
  },
};

interface RawAnalysisGeneration {
  clauseId: string;
  explanation: string;
  risk: {
    severity: RiskSeverity;
    reason: string;
  };
}

/**
 * Call 1: Batched generation of explanations and risk assessments for all clauses in 1 Gemini call.
 */
async function generateBatchedClauseAnalysis(
  clauses: Clause[],
  language: Language = 'en'
): Promise<{ generations: Map<string, RawAnalysisGeneration>; apiCalls: number }> {
  const generations = new Map<string, RawAnalysisGeneration>();
  if (!clauses || clauses.length === 0) {
    return { generations, apiCalls: 0 };
  }

  const clausesFormatted = clauses
    .map(
      (c, idx) => `
[Clause ${idx + 1}]
ID: ${c.id}
HEADING: ${c.heading || 'Clause'}
CATEGORY: ${c.category}
SECTION: ${c.sectionNumber || 'N/A'}
SOURCE CLAUSE TEXT:
"""
${c.rawText}
"""
`
    )
    .join('\n----------------------------------------\n');

  let languageInstruction = '';
  if (language === 'hi') {
    languageInstruction = `
LANGUAGE INSTRUCTION:
- Write the "explanation" and risk "reason" strictly in clear, fluent HINDI (हिंदी - Devanagari script).
- Keep exact numbers, currency figures (e.g. ₹38,000 or ₹15,000), percentages, and dates verbatim.
- Do NOT translate clauseId or severity values.`;
  } else if (language === 'kn') {
    languageInstruction = `
LANGUAGE INSTRUCTION:
- Write the "explanation" and risk "reason" strictly in clear, fluent KANNADA (ಕನ್ನಡ script).
- Keep exact numbers, currency figures (e.g. ₹38,000 or ₹15,000), percentages, and dates verbatim.
- Do NOT translate clauseId or severity values.`;
  }

  const prompt = `
You are an expert AI legal co-pilot helping an ordinary Indian citizen understand a legal agreement.
Analyze the following legal clauses.

CLAUSES TO ANALYZE:
${clausesFormatted}

Instructions:
1. For each clause, write an "explanation": a direct, clear plain-language explanation of what this clause requires, grants, or forbids.
   - Ground every single fact strictly in the source text.
   - If numbers, fees, percentages, or timeframes are specified in the source, cite them faithfully. Do NOT invent or extrapolate numbers.
2. "risk":
   - "severity": "none" | "low" | "medium" | "high".
     * "high": unilateral forfeiture, immediate eviction without notice, unreasonable penalties, one-sided liabilities.
     * "medium": mandatory non-negotiable deductions, lock-in commitments, restricted activities.
     * "low": standard payment schedules, routine utility bills, standard notice requirements.
     * "none": standard recitals, standard jurisdiction clauses.
   - "reason": A single crisp sentence explaining why this level was assigned. Ground this strictly in the concrete obligations, liabilities, or forfeiture terms specified in the clause text without adding ungrounded outside claims.
3. ${languageInstruction}
4. Return a JSON array containing an object for every input clause matching its "clauseId".
`;

  const ai = getGeminiClient();
  let lastError: Error | null = null;
  let apiCalls = 0;

  for (const model of CANDIDATE_MODELS) {
    try {
      apiCalls++;
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: batchedAnalysisResponseSchema,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as RawAnalysisGeneration[];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            generations.set(item.clauseId, {
              clauseId: item.clauseId,
              explanation: item.explanation || '',
              risk: {
                severity: item.risk?.severity || 'low',
                reason: item.risk?.reason || '',
              },
            });
          }
          return { generations, apiCalls };
        }
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

  throw lastError || new Error('Batched clause analysis failed on all candidate models');
}

/**
 * Batched simplification and dual-gate verification pipeline.
 * Guarantees exactly 2 Gemini calls per document (1 generation + 1 judge).
 * Independently checks both explanation and risk.reason through Gate 1 and Gate 2.
 */
export async function simplifyClausesBatched(
  clauses: Clause[],
  language: Language = 'en'
): Promise<{ analyzedClauses: AnalyzedClause[]; apiCallsCount: number }> {
  if (clauses.length === 0) {
    return { analyzedClauses: [], apiCallsCount: 0 };
  }

  // 1. Call 1: Batched generation for all clauses (1 Gemini call)
  const { generations, apiCalls: genCalls } = await generateBatchedClauseAnalysis(clauses, language);
  let totalApiCalls = genCalls;

  // 2. Gate 1: Local Lexical & Numerical overlap check on BOTH explanation and risk.reason
  const gate1Results = new Map<
    string,
    {
      explanationPassed: boolean;
      riskReasonPassed: boolean;
    }
  >();

  const judgeItems: BatchJudgeItem[] = [];

  for (const clause of clauses) {
    const draft = generations.get(clause.id) || {
      clauseId: clause.id,
      explanation: '',
      risk: { severity: 'low' as RiskSeverity, reason: '' },
    };

    const explanationPassed = lexicalOverlapCheck(draft.explanation, clause.rawText);
    const riskReasonPassed = lexicalOverlapCheck(draft.risk.reason, clause.rawText);

    gate1Results.set(clause.id, { explanationPassed, riskReasonPassed });

    // Only submit to Gate 2 LLM judge if Gate 1 passed
    if (explanationPassed && draft.explanation.trim().length > 0) {
      judgeItems.push({
        id: `${clause.id}#explanation`,
        claim: draft.explanation,
        sourceText: clause.rawText,
      });
    }

    if (riskReasonPassed && draft.risk.reason.trim().length > 0) {
      judgeItems.push({
        id: `${clause.id}#risk`,
        claim: draft.risk.reason,
        sourceText: clause.rawText,
      });
    }
  }

  // 3. Call 2: Batched Gate 2 LLM Judge check (1 Gemini call for all claims)
  let judgeVerdicts = new Map<string, { verified: boolean; confidence: number; reason: string }>();
  if (judgeItems.length > 0) {
    try {
      judgeVerdicts = await batchLlmJudgeCheck(judgeItems);
      totalApiCalls++;
    } catch (judgeErr) {
      console.error('Batched LLM judge error:', judgeErr);
      totalApiCalls++;
    }
  }

  // 4. Decision & Mutual Suppression
  const analyzedClauses: AnalyzedClause[] = [];

  for (const clause of clauses) {
    const draft = generations.get(clause.id);
    const gate1 = gate1Results.get(clause.id);

    if (!draft || !gate1) {
      analyzedClauses.push({
        ...clause,
        analysis: {
          clauseId: clause.id,
          explanation: '',
          risk: { severity: 'unknown', reason: 'Processing failure' },
          verification: {
            status: 'needs_review',
            lexicalPassed: false,
            llmJudgePassed: false,
            confidence: 0,
            details: 'Draft generation missing',
          },
        },
      });
      continue;
    }

    const expVerdict = judgeVerdicts.get(`${clause.id}#explanation`);
    const riskVerdict = judgeVerdicts.get(`${clause.id}#risk`);

    const isExplanationVerified =
      gate1.explanationPassed &&
      expVerdict !== undefined &&
      expVerdict.verified === true &&
      (expVerdict.confidence ?? 0) >= 0.65;

    const isRiskVerified =
      gate1.riskReasonPassed &&
      riskVerdict !== undefined &&
      riskVerdict.verified === true &&
      (riskVerdict.confidence ?? 0) >= 0.65;

    // Strict Mutual Suppression: BOTH explanation and risk.reason must be verified
    const isFullyVerified = isExplanationVerified && isRiskVerified;

    if (isFullyVerified) {
      const minConfidence = Math.min(expVerdict?.confidence ?? 1, riskVerdict?.confidence ?? 1);
      analyzedClauses.push({
        ...clause,
        analysis: {
          clauseId: clause.id,
          explanation: draft.explanation,
          risk: {
            severity: draft.risk.severity,
            reason: draft.risk.reason,
          },
          verification: {
            status: 'verified',
            lexicalPassed: true,
            llmJudgePassed: true,
            confidence: minConfidence,
            details: `Explanation: ${expVerdict?.reason || 'Verified'}. Risk: ${riskVerdict?.reason || 'Verified'}`,
          },
        },
      });
    } else {
      // Abstention: Wipe BOTH fields if either fails verification
      const failReasons: string[] = [];
      if (!isExplanationVerified) {
        failReasons.push(
          !gate1.explanationPassed
            ? 'Explanation failed Gate 1 (lexical/number check)'
            : `Explanation failed Gate 2 (${expVerdict?.reason || 'unverified'})`
        );
      }
      if (!isRiskVerified) {
        failReasons.push(
          !gate1.riskReasonPassed
            ? 'Risk reason failed Gate 1 (lexical/number check)'
            : `Risk reason failed Gate 2 (${riskVerdict?.reason || 'unverified'})`
        );
      }

      analyzedClauses.push({
        ...clause,
        analysis: {
          clauseId: clause.id,
          explanation: '', // Strictly wiped out
          risk: {
            severity: 'unknown',
            reason: 'Unverified claim: explanation or risk assessment could not be strictly grounded in the clause text. Manual reading required.',
          },
          verification: {
            status: 'needs_review',
            lexicalPassed: gate1.explanationPassed && gate1.riskReasonPassed,
            llmJudgePassed: Boolean(expVerdict?.verified && riskVerdict?.verified),
            confidence: Math.min(expVerdict?.confidence ?? 0, riskVerdict?.confidence ?? 0),
            details: failReasons.join(' | '),
          },
        },
      });
    }
  }

  return { analyzedClauses, apiCallsCount: totalApiCalls };
}
