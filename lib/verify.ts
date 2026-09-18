import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each',
  'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up',
  'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  // common generic filler words
  'means', 'stipulates', 'states', 'notes', 'specifies', 'requires', 'provides', 'clause'
]);

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
].filter(Boolean) as string[];

/**
 * Gate 1: Lexical and numerical overlap check.
 * - Confirms that all specific numbers in the claim exist in the source text.
 * - Confirms that a sufficient ratio of substantive key terms from the claim appear in the source text.
 * - Fast, synchronous, zero-cost (no LLM call).
 */
export function lexicalOverlapCheck(claim: string, sourceText: string): boolean {
  if (!claim || !sourceText) return false;

  const normalizedSource = sourceText.toLowerCase();
  const normalizedClaim = claim.toLowerCase();

  // 1. Numerical & Currency check: extract numbers from claim
  // Matches standalone numbers, amounts like "38,000", "15000", "500", "11", "6"
  const claimNumbers = normalizedClaim.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g) || [];
  const sourceNumbersRaw = normalizedSource.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g) || [];

  // Normalize numbers by removing commas
  const sourceNumberSet = new Set(sourceNumbersRaw.map((n) => n.replace(/,/g, '')));

  for (const num of claimNumbers) {
    const cleanNum = num.replace(/,/g, '');
    // If the claim mentions a specific number, it must be present in the source text
    if (!sourceNumberSet.has(cleanNum) && !normalizedSource.includes(num)) {
      // Check written number representations for small integers (1 to 12)
      const writtenMap: Record<string, string> = {
        '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
        '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
        '11': 'eleven', '12': 'twelve',
      };
      if (writtenMap[cleanNum] && normalizedSource.includes(writtenMap[cleanNum])) {
        continue; // Found written form
      }
      return false; // Invented number detected!
    }
  }

  // 2. Substantive term overlap
  // Extract alphanumeric tokens
  const claimTokens = normalizedClaim
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (claimTokens.length === 0) {
    return true; // No substantive words to check
  }

  let matchingTokens = 0;
  for (const token of claimTokens) {
    // Check if token or stem appears in source text
    if (normalizedSource.includes(token)) {
      matchingTokens++;
    } else if (token.length > 4) {
      // Allow minor suffix variations (e.g. paying -> pay, delayed -> delay)
      const stem = token.slice(0, -2);
      if (normalizedSource.includes(stem)) {
        matchingTokens++;
      }
    }
  }

  const overlapRatio = matchingTokens / claimTokens.length;

  // Threshold: at least 35% of substantive words in the plain-language explanation
  // must link back directly to terms in the source clause.
  return overlapRatio >= 0.35;
}

export interface LlmJudgeResult {
  verified: boolean;
  confidence: number;
  reason: string;
}

const judgeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    verified: {
      type: Type.BOOLEAN,
      description: 'True if and only if the claim is strictly and completely supported by the source clause text',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confidence score between 0.0 and 1.0',
    },
    reason: {
      type: Type.STRING,
      description: 'Brief one-sentence explanation of why the claim is supported or unsupported',
    },
  },
  required: ['verified', 'confidence', 'reason'],
};

/**
 * Gate 2: LLM-Judge verification check.
 * - Asks a second independent Gemini call to judge whether the claim is fully supported by the source clause.
 * - Uses structured output schema for deterministic evaluation.
 */
export async function llmJudgeCheck(claim: string, sourceText: string): Promise<LlmJudgeResult> {
  const prompt = `
You are an impartial legal verification judge.
Your task is to judge whether the following CLAIM is strictly and completely supported by the provided SOURCE CLAUSE text.

SOURCE CLAUSE:
"""
${sourceText}
"""

CLAIM TO VERIFY:
"""
${claim}
"""

Verification Rules:
1. "verified: true" ONLY IF every fact, number, right, obligation, and consequence in the CLAIM is directly grounded in the SOURCE CLAUSE.
2. "verified: false" IF the CLAIM adds assumptions, invents terms, introduces outside facts, hallucinates penalties or permissions not mentioned in the source, or distorts the legal meaning.
3. Plain-language simplification is permitted, but NO substantive additions are allowed.
4. "confidence": return a number between 0.0 and 1.0.
5. "reason": a concise one-sentence justification.
`;

  const ai = getGeminiClient();
  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: judgeResponseSchema,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout of 35s exceeded on ${model}`)), 35000)
      );

      const response = (await Promise.race([callPromise, timeoutPromise])) as any;

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as LlmJudgeResult;
        return {
          verified: Boolean(parsed.verified),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          reason: parsed.reason || 'Evaluation completed',
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

  throw lastError || new Error('LLM-Judge call failed on all candidate models');
}
