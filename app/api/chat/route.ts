import { NextRequest } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { ParsedDocument, ClauseEmbedding, VerificationStatus, Clause } from '@/lib/types';
import { findRelevantClauses, embedAllClauses } from '@/lib/retrieval';
import { lexicalOverlapCheck, llmJudgeCheck } from '@/lib/verify';
import { CHAT_STREAMING_MODELS } from '@/lib/models';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { errorResponse } from '@/lib/apiError';

export async function POST(req: NextRequest): Promise<Response> {
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await req.json();
    const { document, question, clauseEmbeddings } = body as {
      document?: ParsedDocument;
      question?: string;
      clauseEmbeddings?: ClauseEmbedding[];
    };

    if (!document || !Array.isArray(document.clauses) || document.clauses.length === 0) {
      return errorResponse('INVALID_DOCUMENT', 'Valid document with clauses is required.', 400);
    }

    if (!question || !question.trim()) {
      return errorResponse('EMPTY_QUESTION', 'Question cannot be empty.', 400);
    }

    // 1. Semantic Retrieval: Retrieve top 5 most relevant clauses
    let embeddings = clauseEmbeddings;
    if (!embeddings || embeddings.length < document.clauses.length) {
      embeddings = await embedAllClauses(document.clauses);
    }

    const relevantMatches = await findRelevantClauses(
      question,
      embeddings,
      document.clauses,
      5
    );

    const retrievedClauses: Clause[] = relevantMatches.map((m) => m.clause);
    const combinedRetrievedText = retrievedClauses
      .map((c) => `[${c.sectionNumber || c.id}] ${c.heading || ''}\n${c.rawText}`)
      .join('\n\n');

    const formattedContext = retrievedClauses
      .map(
        (c) =>
          `[CLAUSE ID: "${c.id}" | ${c.sectionNumber || 'Section'} - ${c.heading || 'Clause'}]\n"""\n${c.rawText}\n"""`
      )
      .join('\n\n');

    const prompt = `
You are NyayaLens, an expert self-verifying AI legal co-pilot for Indian contracts and legal documents.
Answer the user's question strictly and accurately based ONLY on the following retrieved clauses from the user's document.

DOCUMENT NAME: "${document.filename || 'Agreement'}"

RETRIEVED SOURCE CLAUSES:
${formattedContext}

USER QUESTION:
"${question}"

STRICT INSTRUCTIONS:
1. Ground every single statement, figure, right, and obligation strictly in the retrieved clauses above.
2. Cite the exact clause (e.g. "[Clause 2]" or "[clause-2]") for each fact mentioned.
3. Plain-language explanation: explain legal terms clearly in simple English without distorting their legal meaning.
4. CRITICAL ABSTENTION RULE: If the retrieved clauses do NOT mention or cover the topic asked in the question (for example, if asked about pets, parking, subletting, or painting and none of the clauses discuss it), DO NOT MAKE ASSUMPTIONS OR INVENT TERMS. State clearly and directly that this agreement does not contain provisions or rules regarding that subject.
`;

    // 2. Set up ReadableStream for token streaming + post-stream verification
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial retrieval event
          const retrievalPayload = JSON.stringify({
            type: 'retrieval',
            retrievedClauses,
            embeddings,
          });
          controller.enqueue(encoder.encode(`data: ${retrievalPayload}\n\n`));

          const ai = getGeminiClient();
          let streamResponse: any = null;
          let activeModel = CHAT_STREAMING_MODELS[0];

          for (const model of CHAT_STREAMING_MODELS) {
            try {
              streamResponse = await ai.models.generateContentStream({
                model,
                contents: prompt,
              });
              activeModel = model;
              break;
            } catch (err: unknown) {
              const errStr = String(err);
              if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
                await new Promise((r) => setTimeout(r, 1000));
              }
              continue;
            }
          }

          if (!streamResponse) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Unable to connect to Gemini stream.' })}\n\n`
              )
            );
            controller.close();
            return;
          }

          let fullAnswer = '';

          // Stream tokens as they arrive
          for await (const chunk of streamResponse) {
            const token = chunk.text || '';
            if (token) {
              fullAnswer += token;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
              );
            }
          }

          // 3. Post-Stream Verification (Server-Side)
          // Run full answer through Gate 1 (lexical) and Gate 2 (LLM-Judge) against combined retrieved text
          let gate1Passed = false;
          let judgeResult = { verified: false, confidence: 0, reason: 'Verification pending' };

          try {
            // Check if the model explicitly stated the agreement does not address the topic
            const isNegativeAnswer =
              /does not (contain|mention|address|specify|provide|include)|not found in the provided|no provision/i.test(
                fullAnswer
              );

            if (isNegativeAnswer) {
              // For negative answers stating absence of terms, verify with judge directly
              judgeResult = await llmJudgeCheck(fullAnswer, combinedRetrievedText);
              gate1Passed = true;
            } else {
              gate1Passed = lexicalOverlapCheck(fullAnswer, combinedRetrievedText);
              judgeResult = await llmJudgeCheck(fullAnswer, combinedRetrievedText);
            }
          } catch (verifErr: unknown) {
            console.error('Post-stream verification error:', verifErr);
            judgeResult = {
              verified: false,
              confidence: 0,
              reason: 'Verification judge could not complete',
            };
          }

          // Identify which retrieved clauses were cited
          const citedIds: string[] = [];
          for (const c of retrievedClauses) {
            const idPattern = new RegExp(`\\b${c.id}\\b`, 'i');
            const secPattern = c.sectionNumber
              ? new RegExp(`\\b${c.sectionNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
              : null;

            if (idPattern.test(fullAnswer) || (secPattern && secPattern.test(fullAnswer))) {
              citedIds.push(c.id);
            }
          }

          // If no explicit ID cited, default to the top-1 retrieved clause if verified
          if (citedIds.length === 0 && relevantMatches.length > 0) {
            citedIds.push(relevantMatches[0].clause.id);
          }

          const isVerified = gate1Passed && judgeResult.verified;
          const status: VerificationStatus = isVerified ? 'verified' : 'needs_review';

          const verificationPayload = JSON.stringify({
            type: 'verification',
            verification: {
              status,
              confidence: judgeResult.confidence,
              details: judgeResult.reason,
              lexicalPassed: gate1Passed,
              llmJudgePassed: judgeResult.verified,
            },
            citedClauseIds: citedIds,
          });

          controller.enqueue(encoder.encode(`data: ${verificationPayload}\n\n`));
          controller.close();
        } catch (streamErr: unknown) {
          console.error('Streaming error in chat route:', streamErr);
          const errorMsg = streamErr instanceof Error ? streamErr.message : 'Streaming error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('Chat API error:', err);
    return errorResponse(
      'CHAT_ERROR',
      err instanceof Error ? err.message : 'Unknown chat error',
      500
    );
  }
}
