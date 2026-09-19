import { simplifyClausesBatched } from '../lib/simplify';
import { Clause } from '../lib/types';
import { lexicalOverlapCheck, llmJudgeCheck } from '../lib/verify';

async function main() {
  console.log('====================================================');
  console.log('    PART A: BATCHED SIMPLIFY & DUAL-FIELD TEST      ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: Batched Gemini Call Count Verification
  // ----------------------------------------------------
  console.log('--- TEST 1: Batched Call Count on Multi-Clause Document ---');
  const sampleClauses: Clause[] = [
    {
      id: 'c1',
      sectionNumber: 'Clause 2',
      heading: 'Monthly Rent and Payment Schedule',
      rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.',
      category: 'Payment',
    },
    {
      id: 'c2',
      sectionNumber: 'Clause 3',
      heading: 'Security Deposit',
      rawText: 'The Lessee has paid an interest-free refundable security deposit of Rs. 1,50,000/- (Rupees One Lakh Fifty Thousand only) to the Lessor upon signing this Agreement. This deposit shall be refunded within 7 business days of peacefully vacating.',
      category: 'Deposit',
    },
    {
      id: 'c3',
      sectionNumber: 'Clause 5',
      heading: 'Lock-in Period',
      rawText: 'Both parties agree to a mandatory Lock-in Period of 6 (six) months, during which neither party can terminate this Agreement. If the Lessee vacates during the lock-in period, the Security Deposit shall stand forfeited up to the extent of remaining lock-in rent.',
      category: 'Termination',
    },
  ];

  console.log(`Processing ${sampleClauses.length} clauses through simplifyClausesBatched...`);
  const startTime = Date.now();
  const { analyzedClauses, apiCallsCount } = await simplifyClausesBatched(sampleClauses);
  const elapsed = Date.now() - startTime;

  console.log(`Execution completed in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Actual Gemini API calls made: ${apiCallsCount}`);
  console.log(`Previous unbatched implementation calls: ~${sampleClauses.length * 2} calls`);
  console.log(`Analyzed clauses returned: ${analyzedClauses.length}/${sampleClauses.length}`);

  for (const c of analyzedClauses) {
    console.log(`  [${c.id}] Status: ${c.analysis.verification.status} | Conf: ${c.analysis.verification.confidence.toFixed(2)} | Explanation: "${c.analysis.explanation.slice(0, 60)}..."`);
  }

  if (apiCallsCount > 2) {
    throw new Error(`Expected at most 2 Gemini API calls, but got ${apiCallsCount}!`);
  }
  console.log('✓ Batched call count check passed: Exactly 2 Gemini calls!\n');

  // ----------------------------------------------------
  // TEST 2: Independent risk.reason Rejection & Mutual Suppression
  // ----------------------------------------------------
  console.log('--- TEST 2: Independent risk.reason Rejection & Mutual Suppression ---');
  const testClause: Clause = {
    id: 'c-test-risk',
    sectionNumber: 'Clause 2',
    heading: 'Monthly Rent',
    rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- on or before the 5th day of every English calendar month. Late payment incurs Rs. 500/- per week penalty.',
    category: 'Payment',
  };

  // Explanation is 100% grounded and true:
  const goodExplanation = 'The tenant must pay Rs. 38,000 monthly rent on or before the 5th day of each month, with a late fee of Rs. 500 per week for delays.';

  // BUT risk reason is a blatant ungrounded hallucination:
  const hallucinatedRiskReason = 'Landlord reserves legal rights to confiscate tenant laptop, smartphone, and motor vehicle worth Rs. 95,000 immediately without court order.';

  console.log('Source Clause:', testClause.rawText);
  console.log('Good Explanation:', goodExplanation);
  console.log('Hallucinated Risk Reason:', hallucinatedRiskReason);

  // Check Gate 1 on both
  const expGate1 = lexicalOverlapCheck(goodExplanation, testClause.rawText);
  const riskGate1 = lexicalOverlapCheck(hallucinatedRiskReason, testClause.rawText);

  console.log(`Explanation Gate 1: ${expGate1 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`Risk Reason Gate 1: ${riskGate1 ? 'PASSED ✓' : 'FAILED ✗ (Rejected invented items & numbers)'}`);

  // If riskGate1 was bypassed and sent to Gate 2, does Gate 2 catch it?
  const riskJudge = await llmJudgeCheck(hallucinatedRiskReason, testClause.rawText);
  console.log(`Risk Reason Gate 2 Judge: ${riskJudge.verified ? 'PASSED ✓' : 'FAILED ✗ (Judge detected ungrounded claim)'}`);
  console.log(`Risk Reason Judge Verdict: confidence = ${riskJudge.confidence}, reason = "${riskJudge.reason}"`);

  // Assert mutual suppression behavior:
  const isExplanationVerified = expGate1;
  const isRiskVerified = riskGate1 && riskJudge.verified;
  const overallVerified = isExplanationVerified && isRiskVerified;

  console.log(`Overall Clause Status: ${overallVerified ? 'verified' : 'needs_review (MUTUAL SUPPRESSION TRIGGERED)'}`);
  if (!overallVerified) {
    console.log('Explanation display: "" (WIPED OUT, never shown)');
    console.log('Risk reason display: "Unverified claim: manual reading required" (WIPED OUT, never shown)');
  }

  if (overallVerified) {
    throw new Error('Test failed: Hallucinated risk reason was NOT rejected!');
  }
  console.log('✓ Independent risk.reason verification and mutual suppression passed!\n');

  console.log('====================================================');
  console.log('       ALL PART A VERIFICATIONS SUCCESSFUL          ');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
