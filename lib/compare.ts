import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';
import {
  ParsedDocument,
  Clause,
  MatchedClausePair,
  UnmatchedClause,
  ComparisonResult,
  DiffParty,
  VerificationStatus,
} from '@/lib/types';
import { LlmJudgeResult } from '@/lib/verify';

import { DEFAULT_MODEL_CASCADE } from '@/lib/models';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
  'i', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'you', 'your', 'yours',
  // Comparison common generic words
  'document', 'clause', 'specifies', 'requires', 'states', 'differs', 'whereas', 'while', 'version', 'difference'
]);

/**
 * Two-sided lexical and numerical overlap check for comparison diffs.
 * - Every number mentioned in the diff claim must exist in EITHER clause A or clause B.
 * - Substantive key terms from the diff must link back to clause A or clause B.
 */
export function lexicalDiffOverlapCheck(diff: string, sourceA: string, sourceB: string): boolean {
  if (!diff) return false;
  if (!sourceA && !sourceB) return false;

  const combinedSource = `${sourceA} \n ${sourceB}`.toLowerCase();
  const normalizedDiff = diff.toLowerCase();

  // 1. Numerical check: extract numbers from diff claim
  const claimNumbers = normalizedDiff.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g) || [];
  const sourceNumbersRaw = combinedSource.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g) || [];
  const sourceNumberSet = new Set(sourceNumbersRaw.map((n) => n.replace(/,/g, '')));

  for (const num of claimNumbers) {
    const cleanNum = num.replace(/,/g, '');
    if (!sourceNumberSet.has(cleanNum) && !combinedSource.includes(num)) {
      const writtenMap: Record<string, string> = {
        '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
        '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
        '11': 'eleven', '12': 'twelve',
      };
      if (writtenMap[cleanNum] && combinedSource.includes(writtenMap[cleanNum])) {
        continue;
      }
      // Number not found in either Document A or Document B source clause!
      return false;
    }
  }

  // 2. Substantive term overlap
  const claimTokens = normalizedDiff
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (claimTokens.length === 0) return true;

  let matches = 0;
  for (const token of claimTokens) {
    if (combinedSource.includes(token)) {
      matches++;
    } else if (token.length > 4 && combinedSource.includes(token.slice(0, -2))) {
      matches++;
    }
  }

  const ratio = matches / claimTokens.length;
  return ratio >= 0.25; // 25% overlap required for comparison diff
}

/**
 * Call 1 Schema: Clause Alignment
 */
const alignmentResponseSchema = {
  type: Type.OBJECT,
  properties: {
    matchedPairs: {
      type: Type.ARRAY,
      description: 'Pairs of clause IDs from Document A and Document B that correspond to the same topic/obligation',
      items: {
        type: Type.OBJECT,
        properties: {
          idA: { type: Type.STRING, description: 'Clause ID from Document A' },
          idB: { type: Type.STRING, description: 'Clause ID from Document B' },
        },
        required: ['idA', 'idB'],
      },
    },
    unmatchedA: {
      type: Type.ARRAY,
      description: 'Clause IDs in Document A with no counterpart in Document B',
      items: { type: Type.STRING },
    },
    unmatchedB: {
      type: Type.ARRAY,
      description: 'Clause IDs in Document B with no counterpart in Document A',
      items: { type: Type.STRING },
    },
  },
  required: ['matchedPairs', 'unmatchedA', 'unmatchedB'],
};

/**
 * Call 2 Schema: Batched Diff & Favors Generation
 */
const diffResponseSchema = {
  type: Type.ARRAY,
  description: 'List of differences and favoring assessment for each matched pair',
  items: {
    type: Type.OBJECT,
    properties: {
      idA: { type: Type.STRING, description: 'Clause ID from Document A' },
      idB: { type: Type.STRING, description: 'Clause ID from Document B' },
      difference: {
        type: Type.STRING,
        description: 'Clear, objective plain-language summary of how Clause A and Clause B differ',
      },
      favors: {
        type: Type.STRING,
        description: 'Whether the change favors Document A terms, Document B terms, or is neutral',
      },
      favorsReason: {
        type: Type.STRING,
        description: 'One concise sentence explaining why this favors A, B, or is neutral',
      },
    },
    required: ['idA', 'idB', 'difference', 'favors', 'favorsReason'],
  },
};

/**
 * Call 3 Schema: Batched Two-Sided LLM Judge
 */
const compareJudgeResponseSchema = {
  type: Type.ARRAY,
  description: 'Verification results for all comparison diffs against both source clauses',
  items: {
    type: Type.OBJECT,
    properties: {
      pairId: { type: Type.STRING, description: 'Pair identifier (e.g. idA_idB)' },
      verified: {
        type: Type.BOOLEAN,
        description: 'True if and only if claims about Clause A match Clause A, claims about Clause B match Clause B, and no hallucinations exist',
      },
      confidence: {
        type: Type.NUMBER,
        description: 'Confidence score between 0.0 and 1.0',
      },
      reason: {
        type: Type.STRING,
        description: 'Brief one-sentence evaluation of accuracy against both source clauses',
      },
    },
    required: ['pairId', 'verified', 'confidence', 'reason'],
  },
};

/**
 * Core Compare Engine:
 * Compares two parsed documents, aligns clauses, generates diffs, and verifies all claims against both source clauses.
 * Uses exactly 3 Gemini calls total for the entire document comparison.
 */
export async function compareDocuments(
  docA: ParsedDocument,
  docB: ParsedDocument
): Promise<ComparisonResult> {
  const comparisonId = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const comparedAt = new Date().toISOString();

  const clausesA = docA.clauses || [];
  const clausesB = docB.clauses || [];

  if (clausesA.length === 0 && clausesB.length === 0) {
    return {
      id: comparisonId,
      documentA: { id: docA.id, filename: docA.filename || 'Document A' },
      documentB: { id: docB.id, filename: docB.filename || 'Document B' },
      comparedAt,
      summary: {
        totalClausesA: 0,
        totalClausesB: 0,
        matchedCount: 0,
        unmatchedCountA: 0,
        unmatchedCountB: 0,
        favorsACount: 0,
        favorsBCount: 0,
        neutralCount: 0,
        apiCallsCount: 0,
      },
      matchedPairs: [],
      unmatchedClauses: [],
    };
  }

  const clauseMapA = new Map<string, Clause>(clausesA.map((c) => [c.id, c]));
  const clauseMapB = new Map<string, Clause>(clausesB.map((c) => [c.id, c]));

  let apiCallsCount = 0;
  const ai = getGeminiClient();

  // -------------------------------------------------------------------------
  // CALL 1: Clause Alignment
  // -------------------------------------------------------------------------
  const docASummary = clausesA
    .map(
      (c) =>
        `[Doc A - ID: "${c.id}"] ${c.sectionNumber || ''} ${c.heading || ''} (Category: ${c.category})\nText: ${c.rawText}`
    )
    .join('\n---\n');

  const docBSummary = clausesB
    .map(
      (c) =>
        `[Doc B - ID: "${c.id}"] ${c.sectionNumber || ''} ${c.heading || ''} (Category: ${c.category})\nText: ${c.rawText}`
    )
    .join('\n---\n');

  const alignmentPrompt = `
You are an expert legal document analyst.
Your task is to compare two legal documents (Document A and Document B) and align corresponding clauses that govern the same legal subject matter or obligation.

DOCUMENT A CLAUSES:
${docASummary}

DOCUMENT B CLAUSES:
${docBSummary}

Matching Guidelines:
1. Match clauses that address the same substantive topic (e.g. Rent Payment in A with Rent Payment in B, Security Deposit in A with Security Deposit in B, Term/Duration in A with Term/Duration in B, Notice/Termination in A with Notice/Termination in B).
2. Each clause in Document A can be paired with at most ONE clause in Document B.
3. If a clause in Document A has no corresponding topic in Document B, list its ID in unmatchedA.
4. If a clause in Document B has no corresponding topic in Document A, list its ID in unmatchedB.
5. Do NOT invent IDs. Use only the exact clause IDs provided above.
`;

  let alignmentResult: {
    matchedPairs: Array<{ idA: string; idB: string }>;
    unmatchedA: string[];
    unmatchedB: string[];
  } = { matchedPairs: [], unmatchedA: [], unmatchedB: [] };

  for (const model of DEFAULT_MODEL_CASCADE) {
    try {
      console.log(`[compare] Call 1 (Alignment) attempting with model: ${model}...`);
      apiCallsCount++;
      const callPromise = ai.models.generateContent({
        model,
        contents: alignmentPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: alignmentResponseSchema,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout of 30s on ${model}`)), 30000)
      );

      const res = (await Promise.race([callPromise, timeoutPromise])) as any;

      if (res.text) {
        alignmentResult = JSON.parse(res.text.trim());
        console.log(`[compare] Call 1 succeeded! Matched: ${alignmentResult.matchedPairs?.length}, UnmatchedA: ${alignmentResult.unmatchedA?.length}, UnmatchedB: ${alignmentResult.unmatchedB?.length}`);
        break;
      }
    } catch (err: any) {
      console.log(`[compare] Call 1 error on ${model}:`, err?.message || err);
      const errStr = String(err);
      if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
        await new Promise((r) => setTimeout(r, 10000));
      } else if (errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Sanitize matched pairs and enforce deterministic matching boundaries
  const validMatchedPairs: Array<{ idA: string; idB: string; clauseA: Clause; clauseB: Clause }> = [];
  const matchedAIds = new Set<string>();
  const matchedBIds = new Set<string>();

  for (const pair of alignmentResult.matchedPairs || []) {
    const cA = clauseMapA.get(pair.idA);
    const cB = clauseMapB.get(pair.idB);
    if (cA && cB && !matchedAIds.has(pair.idA) && !matchedBIds.has(pair.idB)) {
      validMatchedPairs.push({ idA: pair.idA, idB: pair.idB, clauseA: cA, clauseB: cB });
      matchedAIds.add(pair.idA);
      matchedBIds.add(pair.idB);
    }
  }

  // Compute unmatched clauses with 100% data integrity
  const unmatchedClauses: UnmatchedClause[] = [];
  for (const cA of clausesA) {
    if (!matchedAIds.has(cA.id)) {
      unmatchedClauses.push({ clause: cA, onlyIn: 'A' });
    }
  }
  for (const cB of clausesB) {
    if (!matchedBIds.has(cB.id)) {
      unmatchedClauses.push({ clause: cB, onlyIn: 'B' });
    }
  }

  // If no matched pairs, return immediately
  if (validMatchedPairs.length === 0) {
    return {
      id: comparisonId,
      documentA: { id: docA.id, filename: docA.filename || 'Document A' },
      documentB: { id: docB.id, filename: docB.filename || 'Document B' },
      comparedAt,
      summary: {
        totalClausesA: clausesA.length,
        totalClausesB: clausesB.length,
        matchedCount: 0,
        unmatchedCountA: unmatchedClauses.filter((u) => u.onlyIn === 'A').length,
        unmatchedCountB: unmatchedClauses.filter((u) => u.onlyIn === 'B').length,
        favorsACount: 0,
        favorsBCount: 0,
        neutralCount: 0,
        apiCallsCount,
      },
      matchedPairs: [],
      unmatchedClauses,
    };
  }

  // -------------------------------------------------------------------------
  // CALL 2: Batched Diff & Favors Generation
  // -------------------------------------------------------------------------
  const pairsFormatted = validMatchedPairs
    .map(
      (p, idx) => `
[Pair ${idx + 1}]
Pair ID: ${p.idA}__${p.idB}
ID A: "${p.idA}"
CLAUSE A TEXT:
"""${p.clauseA.rawText}"""

ID B: "${p.idB}"
CLAUSE B TEXT:
"""${p.clauseB.rawText}"""
`
    )
    .join('\n----------------------------------------\n');

  const diffPrompt = `
You are an expert legal contract comparison analyst.
Analyze each matched pair of clauses between Document A and Document B.

PAIRS TO COMPARE:
${pairsFormatted}

Instructions for each pair:
1. "difference": Write an objective, plain-language description explaining exactly what changed between Clause A and Clause B.
   - If terms or figures are identical, state: "No substantive difference; both documents require...".
   - If numbers, durations, fees, or obligations differ, cite the exact figures from BOTH clauses (e.g. "Document A specifies Rs. 1,50,000 security deposit with 7-day refund, whereas Document B specifies Rs. 2,00,000 with 15-day refund.").
2. "favors": Must be strictly one of:
   - "A" (if Document A's terms are more favorable or protective to the user/tenant)
   - "B" (if Document B's terms are more favorable or protective to the user/tenant)
   - "neutral" (if neither is clearly more favorable or differences are balanced)
3. "favorsReason": Concise one-sentence explanation of why it favors A, B, or neutral.
4. Return an array of objects matching idA and idB.
`;

  let diffResults: Array<{
    idA: string;
    idB: string;
    difference: string;
    favors: string;
    favorsReason: string;
  }> = [];

  for (const model of DEFAULT_MODEL_CASCADE) {
    try {
      console.log(`[compare] Call 2 (Diff Generation) attempting with model: ${model} on ${validMatchedPairs.length} pairs...`);
      apiCallsCount++;
      const callPromise = ai.models.generateContent({
        model,
        contents: diffPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: diffResponseSchema,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout of 30s on ${model}`)), 30000)
      );

      const res = (await Promise.race([callPromise, timeoutPromise])) as any;

      if (res.text) {
        diffResults = JSON.parse(res.text.trim());
        console.log(`[compare] Call 2 succeeded! Generated diffs for ${diffResults?.length} pairs.`);
        break;
      }
    } catch (err: any) {
      console.log(`[compare] Call 2 error on ${model}:`, err?.message || err);
      const errStr = String(err);
      if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
        await new Promise((r) => setTimeout(r, 10000));
      } else if (errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const diffMap = new Map<string, { difference: string; favors: DiffParty; favorsReason: string }>();
  for (const d of diffResults || []) {
    const key = `${d.idA}__${d.idB}`;
    let favorsClean: DiffParty = 'neutral';
    if (d.favors === 'A' || d.favors === 'B') favorsClean = d.favors;
    diffMap.set(key, {
      difference: d.difference || 'No difference details provided',
      favors: favorsClean,
      favorsReason: d.favorsReason || '',
    });
  }

  // -------------------------------------------------------------------------
  // CALL 3: Batched Two-Sided LLM Judge Verification
  // -------------------------------------------------------------------------
  // Prepare verification items
  const judgeInputItems: Array<{
    pairId: string;
    clauseA: Clause;
    clauseB: Clause;
    difference: string;
    favorsReason: string;
    lexicalPassed: boolean;
  }> = [];

  for (const pair of validMatchedPairs) {
    const pairId = `${pair.idA}__${pair.idB}`;
    const diffData = diffMap.get(pairId) || {
      difference: 'Identical terms',
      favors: 'neutral' as DiffParty,
      favorsReason: 'No difference',
    };

    // Gate 1: Two-sided lexical and numerical overlap check
    const gate1Passed = lexicalDiffOverlapCheck(
      diffData.difference,
      pair.clauseA.rawText,
      pair.clauseB.rawText
    );

    judgeInputItems.push({
      pairId,
      clauseA: pair.clauseA,
      clauseB: pair.clauseB,
      difference: diffData.difference,
      favorsReason: diffData.favorsReason,
      lexicalPassed: gate1Passed,
    });
  }

  const judgePromptFormatted = judgeInputItems
    .map(
      (item, idx) => `
[Evaluation Item ${idx + 1}]
PAIR ID: ${item.pairId}
SOURCE CLAUSE A:
"""${item.clauseA.rawText}"""

SOURCE CLAUSE B:
"""${item.clauseB.rawText}"""

GENERATED DIFF CLAIM:
"""${item.difference}"""

FAVORS REASON:
"""${item.favorsReason}"""
`
    )
    .join('\n----------------------------------------\n');

  const compareJudgePrompt = `
You are an impartial legal verification judge evaluating comparison claims between two contract clauses.

ITEMS TO EVALUATE:
${judgePromptFormatted}

Verification Rules:
1. "verified: true" ONLY IF:
   - All claims made regarding Document A are strictly and completely supported by SOURCE CLAUSE A.
   - All claims made regarding Document B are strictly and completely supported by SOURCE CLAUSE B.
   - The reported differences accurately reflect both source texts without hallucinating amounts, durations, conditions, or terms.
2. "verified: false" IF:
   - The diff claim attributes statements or terms to Document A or B that are not present, misquotes numbers, invents non-existent clauses, or misrepresents the legal differences.
   - The diff claim asserts that a document omits a specific law, act, term, or condition (e.g., claiming Document B omits the Karnataka Rent Act), but that exact term or law IS explicitly present in the source clause of that document.
3. Return an array of verdicts matching pairId.
`;

  const judgeVerdicts = new Map<string, LlmJudgeResult>();

  for (const model of DEFAULT_MODEL_CASCADE) {
    try {
      console.log(`[compare] Call 3 (Verification Judge) attempting with model: ${model} on ${judgeInputItems.length} diff claims...`);
      apiCallsCount++;
      const callPromise = ai.models.generateContent({
        model,
        contents: compareJudgePrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: compareJudgeResponseSchema,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout of 35s on ${model}`)), 35000)
      );

      const res = (await Promise.race([callPromise, timeoutPromise])) as any;

      if (res.text) {
        const parsed = JSON.parse(res.text.trim()) as Array<{
          pairId: string;
          verified: boolean;
          confidence: number;
          reason: string;
        }>;

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            judgeVerdicts.set(item.pairId, {
              verified: Boolean(item.verified),
              confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
              reason: item.reason || 'Judge evaluation completed',
            });
          }
          console.log(`[compare] Call 3 succeeded! Received verdicts for ${parsed.length} pairs.`);
          break;
        }
      }
    } catch (err: any) {
      console.log(`[compare] Call 3 error on ${model}:`, err?.message || err);
      const errStr = String(err);
      if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
        await new Promise((r) => setTimeout(r, 10000));
      } else if (errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Assemble Final Matched Pairs with Dual-Gate Verification & Strict Abstention
  const matchedPairs: MatchedClausePair[] = [];

  for (const item of judgeInputItems) {
    const diffData = diffMap.get(item.pairId) || {
      difference: '',
      favors: 'neutral' as DiffParty,
      favorsReason: '',
    };

    const judgeRes = judgeVerdicts.get(item.pairId) || {
      verified: false,
      confidence: 0.0,
      reason: 'LLM-Judge call did not return verdict',
    };

    const isVerified = item.lexicalPassed && judgeRes.verified;
    const status: VerificationStatus = isVerified ? 'verified' : 'needs_review';

    // Strict Abstention Policy:
    // If unverified by either Gate 1 or Gate 2, DO NOT show the unverified diff claim!
    const verifiedDifference = isVerified
      ? diffData.difference
      : '';

    const verificationDetails = isVerified
      ? judgeRes.reason
      : !item.lexicalPassed
      ? 'Unverified diff claim: Gate 1 lexical/numerical check failed against source clauses.'
      : `Unverified diff claim: Gate 2 judge check failed (${judgeRes.reason}).`;

    matchedPairs.push({
      id: `pair-${item.pairId}`,
      clauseA: item.clauseA,
      clauseB: item.clauseB,
      difference: verifiedDifference,
      favors: isVerified ? diffData.favors : 'neutral',
      favorsReason: isVerified ? diffData.favorsReason : 'Unverified claim suppressed.',
      verification: {
        status,
        confidence: judgeRes.confidence,
        details: verificationDetails,
      },
    });
  }

  const favorsACount = matchedPairs.filter((p) => p.favors === 'A').length;
  const favorsBCount = matchedPairs.filter((p) => p.favors === 'B').length;
  const neutralCount = matchedPairs.filter((p) => p.favors === 'neutral').length;

  return {
    id: comparisonId,
    documentA: { id: docA.id, filename: docA.filename || 'Document A' },
    documentB: { id: docB.id, filename: docB.filename || 'Document B' },
    comparedAt,
    summary: {
      totalClausesA: clausesA.length,
      totalClausesB: clausesB.length,
      matchedCount: matchedPairs.length,
      unmatchedCountA: unmatchedClauses.filter((u) => u.onlyIn === 'A').length,
      unmatchedCountB: unmatchedClauses.filter((u) => u.onlyIn === 'B').length,
      favorsACount,
      favorsBCount,
      neutralCount,
      apiCallsCount,
    },
    matchedPairs,
    unmatchedClauses,
  };
}
