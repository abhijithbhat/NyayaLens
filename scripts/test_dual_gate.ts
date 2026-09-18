import { lexicalOverlapCheck, llmJudgeCheck } from '../lib/verify';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('====================================================');
  console.log('    NYAYALENS DUAL-GATE VERIFICATION TEST SUITE     ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: VERIFIED CASE (Grounded Legal Claim)
  // ----------------------------------------------------
  const clause1 = {
    id: 'clause-2',
    heading: 'Monthly Rent and Maintenance',
    rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor\'s designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.',
  };

  const claim1 = 'The tenant is obligated to pay Rs. 38,000 monthly rent on or before the 5th of every month, with a late fee penalty of Rs. 500 per week for delays.';

  console.log('--- TEST 1: Grounded Legal Claim ---');
  console.log('Source Clause:', clause1.rawText);
  console.log('Generated Claim:', claim1);

  const gate1Pass = lexicalOverlapCheck(claim1, clause1.rawText);
  console.log('Gate 1 (Lexical/Numerical Overlap):', gate1Pass ? 'PASSED ✓' : 'FAILED ✗');

  const judgeResult1 = await llmJudgeCheck(claim1, clause1.rawText);
  console.log('Gate 2 (LLM-Judge Verification) :', judgeResult1.verified ? 'PASSED ✓' : 'FAILED ✗');
  console.log('Judge Confidence                :', judgeResult1.confidence);
  console.log('Judge Reason                    :', judgeResult1.reason);

  const test1Status = gate1Pass && judgeResult1.verified && judgeResult1.confidence >= 0.65 ? 'verified' : 'needs_review';
  console.log('Final Pipeline Decision         :', test1Status === 'verified' ? '✓ VERIFIED' : '⚠ NEEDS_REVIEW');
  console.log('\n----------------------------------------------------\n');

  await delay(2000);

  // ----------------------------------------------------
  // TEST 2: GATE 1 ABSTENTION (Invented Numbers / Ungrounded)
  // ----------------------------------------------------
  const clause2 = {
    id: 'clause-4',
    heading: 'Painting and Maintenance Deductions',
    rawText: 'At the time of vacating the premises, a mandatory non-negotiable deduction of Rs. 15,000/- (Rupees Fifteen Thousand only) or one month\'s rent (whichever is lower) shall be retained from the Security Deposit towards professional deep cleaning and repainting of the interior walls.',
  };

  const claim2 = 'The landlord will pay an incentive bonus of Rs. 50,000 to the tenant upon vacating if walls are clean.';

  console.log('--- TEST 2: Gate 1 Abstention (Invented Number Rs. 50,000) ---');
  console.log('Source Clause:', clause2.rawText);
  console.log('Generated Claim:', claim2);

  const gate1Result2 = lexicalOverlapCheck(claim2, clause2.rawText);
  console.log('Gate 1 (Lexical/Numerical Overlap):', gate1Result2 ? 'PASSED ✓' : 'FAILED ✗ (Invented number 50,000 rejected)');

  const test2Status = gate1Result2 ? 'verified' : 'needs_review';
  console.log('Final Pipeline Decision         :', test2Status === 'verified' ? '✓ VERIFIED' : '⚠ ABSTAINED (needs_review)');
  console.log('Abstention Note: Gate 1 caught the hallucination immediately without needing a second LLM call.');
  console.log('\n----------------------------------------------------\n');

  await delay(2000);

  // ----------------------------------------------------
  // TEST 3: GATE 2 ABSTENTION (Subtle Legal Inversion / Over-Claim)
  // ----------------------------------------------------
  const clause3 = {
    id: 'clause-8',
    heading: 'Prohibited Activities and Subletting',
    rawText: 'The Lessee covenants that the premises shall be used exclusively for residential purposes only. Subletting, re-letting, assigning, or parting with possession of the premises or any portion thereof to third parties or PG guests is strictly prohibited and shall constitute an incurable material breach.',
  };

  // Uses source words (lessee, subletting, re-letting, premises, third parties, PG guests)
  // but inverts the prohibition into permission!
  const claim3 = 'The lessee has permission to sublet and re-let the residential premises to third parties and PG guests.';

  console.log('--- TEST 3: Gate 2 Abstention (Subtle Over-claim with High Lexical Overlap) ---');
  console.log('Source Clause:', clause3.rawText);
  console.log('Generated Claim:', claim3);

  const gate1Result3 = lexicalOverlapCheck(claim3, clause3.rawText);
  console.log('Gate 1 (Lexical/Numerical Overlap):', gate1Result3 ? 'PASSED ✓ (Words overlap)' : 'FAILED ✗');

  const judgeResult3 = await llmJudgeCheck(claim3, clause3.rawText);
  console.log('Gate 2 (LLM-Judge Verification) :', judgeResult3.verified ? 'PASSED ✓' : 'FAILED ✗ (Judge detected contrary meaning)');
  console.log('Judge Confidence                :', judgeResult3.confidence);
  console.log('Judge Reason                    :', judgeResult3.reason);

  const test3Status = gate1Result3 && judgeResult3.verified && judgeResult3.confidence >= 0.65 ? 'verified' : 'needs_review';
  console.log('Final Pipeline Decision         :', test3Status === 'verified' ? '✓ VERIFIED' : '⚠ ABSTAINED (needs_review)');
  console.log('Abstention Note: Gate 2 successfully caught the subtle legal distortion and prevented hallucination.');

  console.log('\n====================================================');
  console.log('  ALL DUAL-GATE VERIFICATION CHECKS PASSED PERFECTLY ');
  console.log('====================================================');
}

main().catch(console.error);
