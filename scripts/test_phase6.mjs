import fs from 'fs';
import path from 'path';

async function main() {
  console.log('=== Phase 6 Verification Test Suite ===\n');

  // Load sample doc A and doc B
  const docAPath = path.resolve('samples/parsed_docA.json');
  const docBPath = path.resolve('samples/parsed_docB.json');
  const docA = JSON.parse(fs.readFileSync(docAPath, 'utf-8'));
  const docB = JSON.parse(fs.readFileSync(docBPath, 'utf-8'));

  console.log(`Loaded docA (${docA.clauses.length} clauses) and docB (${docB.clauses.length} clauses).`);

  // -------------------------------------------------------------
  // Test 1: Simplify in English (or mock simplified clauses for checklist)
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing /api/simplify (English) on 2 sample clauses ---');
  const testClauses = [
    docA.clauses.find((c) => c.category === 'Deposit') || docA.clauses[2],
    docA.clauses.find((c) => c.category === 'Termination') || docA.clauses[3],
  ];

  const simRes = await fetch('http://localhost:3000/api/simplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clauses: testClauses, language: 'en' }),
  });
  const simJson = await simRes.json();
  console.log(`Simplify Status: ${simJson.status}`);
  if (simJson.data) {
    console.log(`Analyzed: ${simJson.data.analyzedClauses.length} clauses.`);
    for (const ac of simJson.data.analyzedClauses) {
      console.log(`  [${ac.heading}] Risk: ${ac.analysis.risk.severity.toUpperCase()} | Verification: ${ac.analysis.verification.status}`);
      console.log(`    Details: ${ac.analysis.verification.details}`);
      console.log(`    Explanation: ${ac.analysis.explanation}`);
      console.log(`    Reason: ${ac.analysis.risk.reason}`);
    }
  }

  // -------------------------------------------------------------
  // Test 2: Multilingual Simplification (Hindi & Kannada)
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing /api/simplify in Hindi (hi) ---');
  const simHiRes = await fetch('http://localhost:3000/api/simplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clauses: [testClauses[0]], language: 'hi' }),
  });
  const simHiJson = await simHiRes.json();
  if (simHiJson.data?.analyzedClauses?.[0]) {
    const acHi = simHiJson.data.analyzedClauses[0];
    console.log(`  Hindi Clause: ${acHi.heading}`);
    console.log(`  Verification: ${acHi.analysis.verification.status}`);
    console.log(`  Details: ${acHi.analysis.verification.details}`);
    console.log(`  Explanation (Hindi): ${acHi.analysis.explanation}`);
    console.log(`  Risk Reason (Hindi): ${acHi.analysis.risk.reason}`);
  }

  console.log('\n--- 3. Testing /api/simplify in Kannada (kn) ---');
  const simKnRes = await fetch('http://localhost:3000/api/simplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clauses: [testClauses[0]], language: 'kn' }),
  });
  const simKnJson = await simKnRes.json();
  if (simKnJson.data?.analyzedClauses?.[0]) {
    const acKn = simKnJson.data.analyzedClauses[0];
    console.log(`  Kannada Clause: ${acKn.heading}`);
    console.log(`  Verification: ${acKn.analysis.verification.status}`);
    console.log(`  Details: ${acKn.analysis.verification.details}`);
    console.log(`  Explanation (Kannada): ${acKn.analysis.explanation}`);
    console.log(`  Risk Reason (Kannada): ${acKn.analysis.risk.reason}`);
  }

  // -------------------------------------------------------------
  // Test 4: Checklist Generation (English) on Analyzed Clauses
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing /api/checklist (English) ---');
  // Pass analyzed clauses including medium/high risk items
  const checkRes = await fetch('http://localhost:3000/api/checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analyzedClauses: simJson.data.analyzedClauses,
      language: 'en',
    }),
  });
  const checkJson = await checkRes.json();
  console.log(`Checklist Status: ${checkJson.status}`);
  if (checkJson.data?.items) {
    console.log(`Generated ${checkJson.data.items.length} checklist items:\n`);
    for (const item of checkJson.data.items) {
      console.log(`• [${item.clauseHeading}] (Risk: ${item.severity}, Status: ${item.verificationStatus})`);
      console.log(`  Action: ${item.checklistAction}`);
      if (item.lawyerQuestion) {
        console.log(`  ⚖️ Lawyer Question: "${item.lawyerQuestion}"`);
      }
    }
  }

  // -------------------------------------------------------------
  // Test 5: Checklist Generation in Hindi & Kannada
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing /api/checklist in Hindi (hi) ---');
  const checkHiRes = await fetch('http://localhost:3000/api/checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analyzedClauses: simJson.data.analyzedClauses,
      language: 'hi',
    }),
  });
  const checkHiJson = await checkHiRes.json();
  if (checkHiJson.data?.items) {
    for (const item of checkHiJson.data.items) {
      console.log(`• [${item.clauseHeading}]`);
      console.log(`  Action (Hindi): ${item.checklistAction}`);
      if (item.lawyerQuestion) {
        console.log(`  ⚖️ Lawyer Question (Hindi): "${item.lawyerQuestion}"`);
      }
    }
  }

  console.log('\n--- 6. Testing /api/checklist in Kannada (kn) ---');
  const checkKnRes = await fetch('http://localhost:3000/api/checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analyzedClauses: simJson.data.analyzedClauses,
      language: 'kn',
    }),
  });
  const checkKnJson = await checkKnRes.json();
  if (checkKnJson.data?.items) {
    for (const item of checkKnJson.data.items) {
      console.log(`• [${item.clauseHeading}]`);
      console.log(`  Action (Kannada): ${item.checklistAction}`);
      if (item.lawyerQuestion) {
        console.log(`  ⚖️ Lawyer Question (Kannada): "${item.lawyerQuestion}"`);
      }
    }
  }

  console.log('\n=== Test Suite Complete ===');
}

main().catch(console.error);
