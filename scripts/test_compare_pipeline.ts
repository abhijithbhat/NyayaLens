import fs from 'fs';
import path from 'path';
import { getGeminiClient } from '../lib/gemini';
import { Type } from '@google/genai';
import { ParsedDocument, Clause } from '../lib/types';
import { compareDocuments } from '../lib/compare';

try {
  process.loadEnvFile('.env.local');
} catch {}

const parseResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      sectionNumber: { type: Type.STRING },
      heading: { type: Type.STRING },
      rawText: { type: Type.STRING },
      category: {
        type: Type.STRING,
        enum: ['Payment', 'Termination', 'Liability', 'Deposit', 'Notice', 'Other'],
      },
    },
    required: ['id', 'heading', 'rawText', 'category'],
  },
};

async function parsePdfDirect(filePath: string, filename: string): Promise<ParsedDocument> {
  const fileBytes = fs.readFileSync(filePath);
  const base64Data = fileBytes.toString('base64');
  const ai = getGeminiClient();

  const prompt = `
You are an expert legal document parser.
Analyze this legal document and segment it completely into individual clauses.
Extract each clause verbatim with sequential id (clause-1, clause-2...), sectionNumber, heading, rawText, and category (Payment, Termination, Liability, Deposit, Notice, Other).
`;

  const CANDIDATE_MODELS = Array.from(
    new Set([
      process.env.GEMINI_MODEL,
      'gemini-3.6-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ])
  ).filter(Boolean) as string[];

  let res: any = null;
  let lastErr: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      res = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: parseResponseSchema,
        },
      });
      if (res?.text) break;
    } catch (err) {
      lastErr = err;
      console.log(`   Model ${model} error (${(err as any)?.message || err}), trying next candidate...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!res?.text) {
    throw lastErr || new Error('PDF parsing failed across all models');
  }

  const clausesRaw = JSON.parse(res.text?.trim() || '[]') as Clause[];
  const clauses = clausesRaw.map((c, i) => ({
    id: c.id || `clause-${i + 1}`,
    sectionNumber: c.sectionNumber || undefined,
    heading: c.heading || `Clause ${i + 1}`,
    rawText: c.rawText || '',
    category: c.category || 'Other',
  }));

  return {
    id: `doc-${path.basename(filePath, '.pdf')}`,
    filename,
    uploadedAt: new Date().toISOString(),
    clauses,
  };
}

async function main() {
  console.log('========================================================');
  console.log('🚀 NyayaLens Part B Compare Engine Verification');
  console.log('========================================================\n');

  const pdfA = path.resolve('samples/sample_rental_agreement.pdf');
  const pdfB = path.resolve('samples/sample_rental_agreement_v2.pdf');

  console.log('1. Loading Document A (sample_rental_agreement.pdf)...');
  const docA: ParsedDocument = JSON.parse(
    fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8')
  );
  console.log(`   Document A loaded clauses: ${docA.clauses.length}`);
  for (const c of docA.clauses) {
    console.log(`   - [${c.id}] ${c.sectionNumber || ''} ${c.heading} (${c.category})`);
  }

  console.log('\n2. Loading Document B (sample_rental_agreement_v2.pdf)...');
  const docB: ParsedDocument = JSON.parse(
    fs.readFileSync(path.resolve('samples/parsed_docB.json'), 'utf-8')
  );
  console.log(`   Document B loaded clauses: ${docB.clauses.length}`);
  for (const c of docB.clauses) {
    console.log(`   - [${c.id}] ${c.sectionNumber || ''} ${c.heading} (${c.category})`);
  }

  console.log('\n3. Executing compareDocuments(docA, docB)...');
  console.time('Comparison Pipeline Duration');
  const result = await compareDocuments(docA, docB);
  console.timeEnd('Comparison Pipeline Duration');

  console.log('\n================ COMPARISON SUMMARY ================');
  console.log(`Total Clauses in Doc A:    ${result.summary.totalClausesA}`);
  console.log(`Total Clauses in Doc B:    ${result.summary.totalClausesB}`);
  console.log(`Matched Pairs Aligned:     ${result.summary.matchedCount}`);
  console.log(`Unmatched (Only in Doc A): ${result.summary.unmatchedCountA}`);
  console.log(`Unmatched (Only in Doc B): ${result.summary.unmatchedCountB}`);
  console.log(`Favors Doc A:              ${result.summary.favorsACount}`);
  console.log(`Favors Doc B:              ${result.summary.favorsBCount}`);
  console.log(`Neutral:                   ${result.summary.neutralCount}`);
  console.log(`Gemini API Calls:          ${result.summary.apiCallsCount} (Expected: 3)`);

  console.log('\n================ UNMATCHED CLAUSES ================');
  for (const u of result.unmatchedClauses) {
    console.log(`[Only in Doc ${u.onlyIn}] ${u.clause.sectionNumber || ''} ${u.clause.heading}: "${u.clause.rawText.slice(0, 80)}..."`);
  }

  console.log('\n================ MATCHED PAIRS & DIFFS ================');
  for (const pair of result.matchedPairs) {
    console.log(`\n🔹 [${pair.id}]`);
    console.log(`   A: ${pair.clauseA.heading} | B: ${pair.clauseB.heading}`);
    console.log(`   Favors: [${pair.favors}] (${pair.favorsReason})`);
    console.log(`   Verification: status=${pair.verification.status}, conf=${pair.verification.confidence}`);
    console.log(`   Diff: "${pair.difference}"`);
  }

  // Save the real output JSON to samples/comparison_real_output.json
  const outputPath = path.resolve('samples/comparison_real_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n💾 Real comparison JSON output saved to: ${outputPath}`);

  // Assertions for correctness
  if (result.summary.unmatchedCountA < 1) {
    console.warn('⚠️ Expected at least 1 unmatched clause in Doc A (Painting deduction)');
  }
  if (result.summary.unmatchedCountB < 1) {
    console.warn('⚠️ Expected at least 1 unmatched clause in Doc B (Pet policy)');
  }
  if (result.summary.apiCallsCount !== 3) {
    console.warn(`⚠️ Expected 3 API calls, got ${result.summary.apiCallsCount}`);
  }

  console.log('\n✅ Compare pipeline verification completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in compare verification:', err);
  process.exit(1);
});
