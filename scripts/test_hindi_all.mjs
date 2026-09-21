import fs from 'fs';
import path from 'path';

async function main() {
  const docA = JSON.parse(fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8'));
  const rentClause = docA.clauses.find((c) => c.category === 'Payment');
  const lockinClause = docA.clauses.find((c) => c.category === 'Termination');

  console.log('Testing Hindi simplification on Rent Clause and Lock-in Clause...');

  const res = await fetch('http://localhost:3000/api/simplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clauses: [rentClause, lockinClause],
      language: 'hi',
    }),
  });

  const json = await res.json();
  if (json.data?.analyzedClauses) {
    for (const ac of json.data.analyzedClauses) {
      console.log(`\n[${ac.heading}] Verification: ${ac.analysis.verification.status}`);
      console.log(`  Details: ${ac.analysis.verification.details}`);
      console.log(`  Explanation (Hindi): ${ac.analysis.explanation}`);
      console.log(`  Reason (Hindi): ${ac.analysis.risk.reason}`);
    }
  }
}

main().catch(console.error);
