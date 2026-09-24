import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { Type } from '@google/genai';
import { lexicalOverlapCheck } from '@/lib/verify';
import {
  ParsedDocument,
  ComparisonResult,
  AnalyzedClause,
  ChecklistItem,
  ChecklistApiResponse,
  Language,
  RiskSeverity,
  VerificationStatus,
} from '@/lib/types';

import { DEFAULT_MODEL_CASCADE } from '@/lib/models';

const checklistResponseSchema = {
  type: Type.ARRAY,
  description: 'Array of actionable checklist items and lawyer questions for qualifying clauses',
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: 'The unique candidate ID matching the input item',
      },
      checklistAction: {
        type: Type.STRING,
        description: 'Concrete, practical pre-signing action or verification item (1 crisp sentence)',
      },
      lawyerQuestion: {
        type: Type.STRING,
        description: 'Sharper legal inquiry specifically for high severity or needs-review items. Empty string if not needed.',
      },
    },
    required: ['id', 'checklistAction'],
  },
};

interface CandidateInput {
  id: string;
  clauseId: string;
  clauseHeading?: string;
  sourceType: 'analysis' | 'comparison';
  severity: RiskSeverity;
  verificationStatus: VerificationStatus;
  contextText: string;
  explanationText: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChecklistApiResponse>> {
  try {
    const body = await request.json();
    const language: Language = body.language === 'hi' ? 'hi' : body.language === 'kn' ? 'kn' : 'en';

    const candidates: CandidateInput[] = [];

    // 1. Ingest from Analyzed Document
    if (body.document || body.analyzedClauses) {
      const doc: ParsedDocument = body.document || { clauses: body.analyzedClauses };
      const clauses = (doc.clauses || body.analyzedClauses || []) as (AnalyzedClause | any)[];

      for (const c of clauses) {
        const status: VerificationStatus = c.analysis?.verification?.status || 'needs_review';
        const severity: RiskSeverity = c.analysis?.risk?.severity || 'medium';

        // Filter: ONLY status "verified" with "medium" | "high", OR status "needs_review"
        const isQualifyingVerified = status === 'verified' && (severity === 'medium' || severity === 'high');
        const isNeedsReview = status === 'needs_review';

        if (isQualifyingVerified || isNeedsReview) {
          candidates.push({
            id: `doc-${c.id}`,
            clauseId: c.id,
            clauseHeading: c.heading || `Clause ${c.id}`,
            sourceType: 'analysis',
            severity,
            verificationStatus: status,
            contextText: c.rawText || '',
            explanationText: c.analysis?.explanation || c.analysis?.risk?.reason || 'Manual reading required.',
          });
        }
      }
    }

    // 2. Ingest from Comparison Result
    if (body.comparison) {
      const comp: ComparisonResult = body.comparison;

      if (Array.isArray(comp.matchedPairs)) {
        for (const pair of comp.matchedPairs) {
          const status = pair.verification?.status || 'needs_review';
          const hasSubstantiveDiff = Boolean(pair.difference && pair.favors !== 'neutral');
          const isHighOrNeedsReview = status === 'needs_review' || hasSubstantiveDiff;

          if (isHighOrNeedsReview) {
            const severity: RiskSeverity =
              status === 'needs_review' ? 'high' : hasSubstantiveDiff ? 'medium' : 'low';
            candidates.push({
              id: `comp-${pair.clauseA.id}-${pair.clauseB.id}`,
              clauseId: `${pair.clauseA.id} vs ${pair.clauseB.id}`,
              clauseHeading: pair.clauseA.heading || pair.clauseB.heading || 'Compared Clause',
              sourceType: 'comparison',
              severity,
              verificationStatus: status,
              contextText: `Doc A: "${pair.clauseA.rawText}"\nDoc B: "${pair.clauseB.rawText}"`,
              explanationText: pair.difference || 'Unverified diff claim or substantive difference between versions.',
            });
          }
        }
      }

      if (Array.isArray(comp.unmatchedClauses)) {
        for (const un of comp.unmatchedClauses) {
          candidates.push({
            id: `unmatched-${un.clause.id}`,
            clauseId: un.clause.id,
            clauseHeading: `${un.clause.heading || 'Unmatched Clause'} (Only in Doc ${un.onlyIn})`,
            sourceType: 'comparison',
            severity: 'high',
            verificationStatus: 'verified',
            contextText: un.clause.rawText,
            explanationText: `Clause exists exclusively in Document ${un.onlyIn} with no corresponding term in the other document.`,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        status: 'success',
        data: {
          items: [],
          language,
          generatedAt: new Date().toISOString(),
          itemCount: 0,
          totalItems: 0,
          highRiskCount: 0,
          needsReviewCount: 0,
        },
      });
    }

    // Single batched Gemini call for all qualifying items
    const candidatesFormatted = candidates
      .map(
        (cand, idx) => `
[Item ${idx + 1}]
ID: ${cand.id}
HEADING: ${cand.clauseHeading || 'Clause'}
SEVERITY: ${cand.severity}
VERIFICATION_STATUS: ${cand.verificationStatus}
VERIFIED EXPLANATION / FINDINGS:
${cand.explanationText}
SOURCE CONTEXT:
"""
${cand.contextText}
"""
`
      )
      .join('\n----------------------------------------\n');

    let languageInstructions = 'Write checklist actions and lawyer questions in clear, concise English.';
    if (language === 'hi') {
      languageInstructions =
        'LANGUAGE REQUIREMENT: Write ALL checklist actions and lawyer questions in fluent, natural HINDI (हिंदी - Devanagari script). Retain exact rupee amounts (e.g., ₹38,000) and legal numbers.';
    } else if (language === 'kn') {
      languageInstructions =
        'LANGUAGE REQUIREMENT: Write ALL checklist actions and lawyer questions in fluent, natural KANNADA (ಕನ್ನಡ script). Retain exact rupee amounts (e.g., ₹38,000) and legal numbers.';
    }

    const prompt = `
You are an expert Indian legal advisor helping an individual safeguard their rights before signing an agreement.
Review these qualifying high-risk, medium-risk, or unverified clauses/differences.

QUALIFYING CLAUSES:
${candidatesFormatted}

Instructions:
1. For every candidate item:
   - "checklistAction": One plain, highly concrete checklist action or confirmation to request before signing (e.g., "Obtain written receipt for deposit", "Confirm whether 10% rent escalation takes effect in Month 11 or Month 12", "Request addition of a mutual 30-day notice clause").
   - "lawyerQuestion":
     * For "high" severity OR "needs_review" status: Formulate ONE sharp, exploratory legal question framed explicitly as a starting point to raise with a licensed advocate (e.g., "Ask your advocate whether this unilateral forfeiture clause violates Section 74 of the Indian Contract Act or local tenancy protections.", "Ask your advocate whether the mandatory deduction for repainting can be contested if the premises are returned in good condition.").
     * If referencing a specific statute, act, or section, frame it strictly as an exploratory inquiry for an advocate to verify in context, NEVER as a settled legal conclusion or definite verdict.
     * All numbers, amounts (₹), timeframes, and contractual obligations in the question must be grounded strictly in the provided clause text. Do NOT hallucinate outside figures or unstated terms.
     * For "medium" severity: Provide an exploratory lawyer question only if there is genuine ambiguity or exposure, otherwise return an empty string "".
2. Do NOT hallucinate facts or outside terms. Base all advice strictly on the provided findings and source context.
3. ${languageInstructions}
4. Return a JSON array matching the exact "id" of each candidate item.
`;

    const ai = getGeminiClient();
    let generatedItems: { id: string; checklistAction: string; lawyerQuestion?: string }[] = [];
    let lastError: Error | null = null;

    for (const model of DEFAULT_MODEL_CASCADE) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: checklistResponseSchema,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (Array.isArray(parsed)) {
            generatedItems = parsed;
            break;
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errStr = String(err);
        if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
          await new Promise((r) => setTimeout(r, 15000));
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (generatedItems.length === 0 && lastError) {
      console.warn('Checklist generation fallback due to error:', lastError);
    }

    const generatedMap = new Map(generatedItems.map((g) => [g.id, g]));

    const checklistItems: ChecklistItem[] = candidates.map((c) => {
      const gen = generatedMap.get(c.id);
      const isHighOrReview = c.severity === 'high' || c.verificationStatus === 'needs_review';

      const fallbackAction =
        language === 'hi'
          ? `हस्ताक्षर करने से पहले खंड "${c.clauseHeading}" के नियमों की पुष्टि करें।`
          : language === 'kn'
          ? `ಸಹಿ ಮಾಡುವ ಮೊದಲು "${c.clauseHeading}" ಷರತ್ತುಗಳನ್ನು ಸ್ಪಷ್ಟಪಡಿಸಿ.`
          : `Review and confirm terms of ${c.clauseHeading} in writing before signing.`;

      const fallbackLawyer = isHighOrReview
        ? language === 'hi'
          ? `वकील से पूछें: क्या खंड "${c.clauseHeading}" में दी गई शर्तें लागू करने योग्य हैं या एकतरफा बाध्यता बनाती हैं?`
          : language === 'kn'
          ? `ವಕೀಲರನ್ನು ಕೇಳಿ: "${c.clauseHeading}" ಷರತ್ತುಗಳು ಕಾನೂನುಬದ್ಧವಾಗಿ ಜಾರಿಗೊಳಿಸಬಹುದೇ ಅಥವಾ ಏಕಪಕ್ಷೀಯ ಹೊಣೆಗಾರಿಕೆಯನ್ನು ಉಂಟುಮಾಡುತ್ತವೆಯೇ?`
          : `Ask your advocate: Does the obligation in "${c.clauseHeading}" create an unreasonable or one-sided liability under applicable law?`
        : undefined;

      // Lightweight verification pass on generated lawyerQuestion:
      // Verify numerical and key substantive terms against the clause source context
      let finalLawyerQuestion: string | undefined = undefined;
      if (gen?.lawyerQuestion?.trim()) {
        const candidateQuestion = gen.lawyerQuestion.trim();
        const passedGrounding = lexicalOverlapCheck(candidateQuestion, c.contextText);
        if (passedGrounding) {
          finalLawyerQuestion = candidateQuestion;
        } else {
          console.warn(
            `[checklist verification] Lawyer question for ${c.id} failed lexical grounding check. Using safe fallback.`
          );
          finalLawyerQuestion = fallbackLawyer;
        }
      } else if (isHighOrReview) {
        finalLawyerQuestion = fallbackLawyer;
      }

      return {
        id: c.id,
        clauseId: c.clauseId,
        clauseHeading: c.clauseHeading,
        sourceType: c.sourceType,
        severity: c.severity,
        verificationStatus: c.verificationStatus,
        checklistAction: gen?.checklistAction || fallbackAction,
        lawyerQuestion: finalLawyerQuestion,
        completed: false,
      };
    });

    const highRiskCount = checklistItems.filter(
      (c) => c.severity === 'high' || c.verificationStatus === 'needs_review'
    ).length;
    const needsReviewCount = checklistItems.filter((c) => c.verificationStatus === 'needs_review').length;

    return NextResponse.json({
      status: 'success',
      data: {
        items: checklistItems,
        language,
        generatedAt: new Date().toISOString(),
        itemCount: checklistItems.length,
        totalItems: checklistItems.length,
        highRiskCount,
        needsReviewCount,
      },
    });
  } catch (error: unknown) {
    console.error('Checklist generation route error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal error during checklist generation',
      },
      { status: 500 }
    );
  }
}
