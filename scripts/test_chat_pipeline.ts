import fs from 'fs';
import path from 'path';
import { ParsedDocument, Clause, ClauseEmbedding } from '../lib/types';
import { embedAllClauses, findRelevantClauses } from '../lib/retrieval';
import { lexicalOverlapCheck, llmJudgeCheck } from '../lib/verify';
import { getGeminiClient } from '../lib/gemini';

try {
  process.loadEnvFile('.env.local');
} catch {}

const CANDIDATE_MODELS = Array.from(
  new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ])
).filter(Boolean) as string[];

async function runChatQuestion(
  doc: ParsedDocument,
  embeddings: ClauseEmbedding[],
  question: string
) {
  console.log(`\n============================================================`);
  console.log(`QUESTION: "${question}"`);
  console.log(`============================================================`);

  // 1. Semantic Retrieval
  const matches = await findRelevantClauses(question, embeddings, doc.clauses, 5);
  console.log(`\n[Retrieval] Top ${matches.length} Relevant Clauses:`);
  for (const m of matches) {
    console.log(`  - [${m.clause.id}] ${m.clause.sectionNumber || ''} ${m.clause.heading} (Similarity: ${(m.similarity * 100).toFixed(1)}%)`);
  }

  const retrievedClauses = matches.map((m) => m.clause);
  const formattedContext = retrievedClauses
    .map((c) => `[CLAUSE ID: "${c.id}" | ${c.sectionNumber || 'Section'} - ${c.heading || 'Clause'}]\n"""\n${c.rawText}\n"""`)
    .join('\n\n');

  const prompt = `
You are NyayaLens, an expert self-verifying AI legal co-pilot for Indian contracts and legal documents.
Answer the user's question strictly and accurately based ONLY on the following retrieved clauses from the user's document.

DOCUMENT NAME: "${doc.filename}"

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

  // 2. Stream Generation
  const ai = getGeminiClient();
  let streamResponse: any = null;
  let activeModel = CANDIDATE_MODELS[0];

  for (const model of CANDIDATE_MODELS) {
    try {
      streamResponse = await ai.models.generateContentStream({
        model,
        contents: prompt,
      });
      activeModel = model;
      break;
    } catch (err: any) {
      console.log(`Model ${model} stream error: ${err.message || err}, falling back...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!streamResponse) {
    throw new Error('Failed to generate streaming response on all models');
  }

  console.log(`\n[Streaming Response from ${activeModel}]:`);
  process.stdout.write('  ');
  let fullAnswer = '';
  for await (const chunk of streamResponse) {
    const text = chunk.text || '';
    fullAnswer += text;
    process.stdout.write(text);
  }
  console.log('\n');

  // 3. Post-Stream Verification
  console.log('[Verification] Running dual-gate check against retrieved clauses...');
  const combinedRetrievedText = retrievedClauses
    .map((c) => `[${c.sectionNumber || c.id}] ${c.heading || ''}\n${c.rawText}`)
    .join('\n\n');

  const isNegativeAnswer =
    /does not (contain|mention|address|specify|provide|include)|not found in the provided|no provision/i.test(
      fullAnswer
    );

  let gate1Passed = false;
  if (isNegativeAnswer) {
    gate1Passed = true;
  } else {
    gate1Passed = lexicalOverlapCheck(fullAnswer, combinedRetrievedText);
  }

  const judgeResult = await llmJudgeCheck(fullAnswer, combinedRetrievedText);
  const isVerified = gate1Passed && judgeResult.verified;
  const status = isVerified ? 'verified' : 'needs_review';

  console.log(`[Verification Result]:`);
  console.log(`  - Status:       ${status.toUpperCase()}`);
  console.log(`  - Confidence:   ${(judgeResult.confidence * 100).toFixed(1)}%`);
  console.log(`  - Gate 1 Passed: ${gate1Passed}`);
  console.log(`  - Gate 2 Passed: ${judgeResult.verified}`);
  console.log(`  - Details:      "${judgeResult.reason}"`);

  return {
    question,
    retrievedClauses: retrievedClauses.map((c) => ({
      id: c.id,
      sectionNumber: c.sectionNumber,
      heading: c.heading,
    })),
    streamedAnswer: fullAnswer.trim(),
    verification: {
      status,
      confidence: judgeResult.confidence,
      details: judgeResult.reason,
      gate1Passed,
      gate2Passed: judgeResult.verified,
    },
  };
}

async function main() {
  console.log('============================================================');
  console.log('🚀 NyayaLens Phase 5: Chat Q&A Pipeline Verification');
  console.log('============================================================');

  // Load Document A
  const docA: ParsedDocument = JSON.parse(
    fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8')
  );
  console.log(`\nLoaded Document: "${docA.filename}" (${docA.clauses.length} clauses)`);

  // Batch embed all clauses
  console.log('\nEmbedding all clauses in 1 batched API call...');
  console.time('Batch Embedding Duration');
  const embeddings = await embedAllClauses(docA.clauses);
  console.timeEnd('Batch Embedding Duration');
  console.log(`Successfully embedded ${embeddings.length} clauses (Dimensions: ${embeddings[0].embedding.length})`);

  // Save embeddings cache for future fast tests
  const cachePath = path.resolve('samples/embeddings_docA.json');
  fs.writeFileSync(cachePath, JSON.stringify(embeddings, null, 2), 'utf-8');
  console.log(`Cached embeddings saved to: ${cachePath}`);

  // Test Case (a): Clearly answerable question
  const exchangeA = await runChatQuestion(
    docA,
    embeddings,
    'What is the monthly rent amount, when is it due, and what is the penalty for delayed payment?'
  );

  // Test Case (b): Question about something the document doesn't address at all (Pets)
  const exchangeB = await runChatQuestion(
    docA,
    embeddings,
    'What are the specific rules and penalty fees for keeping domestic pets like dogs or cats in the apartment?'
  );

  // Save both real exchanges to samples/chat_exchanges_real.json
  const outPath = path.resolve('samples/chat_exchanges_real.json');
  fs.writeFileSync(outPath, JSON.stringify({ exchangeA, exchangeB }, null, 2), 'utf-8');
  console.log(`\n💾 Saved real chat test exchanges to: ${outPath}`);

  console.log('\n✅ Phase 5 Chat Q&A Pipeline Verification Completed Successfully!');
}

main().catch((err) => {
  console.error('Fatal error in chat pipeline verification:', err);
  process.exit(1);
});
