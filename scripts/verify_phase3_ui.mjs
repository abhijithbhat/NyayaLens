import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  console.log('=== NyayaLens Phase 3 UI Verification ===\n');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

    // Intercept network requests to provide instant deterministic response for /api/simplify and /api/parse
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/simplify')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              documentId: 'doc-rental-verified',
              summary: {
                totalClauses: 2,
                verifiedCount: 1,
                needsReviewCount: 1,
                highRiskCount: 1
              },
              analyzedClauses: [
                {
                  id: 'clause-2',
                  sectionNumber: 'Clause 2',
                  heading: 'Monthly Rent and Payment Schedule',
                  rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.',
                  category: 'Payment',
                  analysis: {
                    clauseId: 'clause-2',
                    explanation: 'You are required to pay a monthly rent of Rs. 38,000 (excluding society maintenance) on or before the 5th day of each month. Late payments attract a penalty of Rs. 500 per week of delay.',
                    risk: {
                      severity: 'low',
                      reason: 'Standard payment schedule with customary Rs. 500 weekly delay fee.'
                    },
                    verification: {
                      status: 'verified',
                      lexicalPassed: true,
                      llmJudgePassed: true,
                      confidence: 1.0,
                      details: 'Claim is fully grounded in the source text. Rent figures (Rs. 38,000, 5th day, Rs. 500) match verbatim.'
                    }
                  }
                },
                {
                  id: 'clause-8',
                  sectionNumber: 'Clause 8',
                  heading: 'Lock-in Period and Early Termination Forfeiture',
                  rawText: 'Both parties agree to a mandatory minimum lock-in period of 6 (six) months commencing from the Agreement Date. If the Lessee vacates or terminates this agreement before the expiry of the lock-in period, the entire Security Deposit of Rs. 1,50,000/- shall stand completely forfeited as liquidated damages without prejudice to the Lessor right to recover unpaid rent for the remainder of the lock-in period.',
                  category: 'Termination',
                  analysis: {
                    clauseId: 'clause-8',
                    explanation: '', // Zero hallucination: suppressed
                    risk: {
                      severity: 'high',
                      reason: 'Unilateral complete forfeiture of entire security deposit (Rs. 1,50,000) upon early vacating.'
                    },
                    verification: {
                      status: 'needs_review',
                      lexicalPassed: true,
                      llmJudgePassed: false,
                      confidence: 0.15,
                      details: 'Failed Gate 2 (LLM-Judge detected legal distortion in generated draft: claim added non-existent landlord compensation).'
                    }
                  }
                }
              ]
            }
          })
        });
      } else if (url.includes('/api/parse')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              id: 'doc-rental-verified',
              filename: 'sample_rental_agreement.pdf',
              uploadedAt: new Date().toISOString(),
              clauses: [
                {
                  id: 'clause-2',
                  sectionNumber: 'Clause 2',
                  heading: 'Monthly Rent and Payment Schedule',
                  rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.',
                  category: 'Payment'
                },
                {
                  id: 'clause-8',
                  sectionNumber: 'Clause 8',
                  heading: 'Lock-in Period and Early Termination Forfeiture',
                  rawText: 'Both parties agree to a mandatory minimum lock-in period of 6 (six) months commencing from the Agreement Date. If the Lessee vacates or terminates this agreement before the expiry of the lock-in period, the entire Security Deposit of Rs. 1,50,000/- shall stand completely forfeited as liquidated damages without prejudice to the Lessor right to recover unpaid rent for the remainder of the lock-in period.',
                  category: 'Termination'
                }
              ]
            }
          })
        });
      } else {
        req.continue();
      }
    });

    console.log('Navigating to http://localhost:3000/analyze ...');
    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    const inputUploadHandle = await page.$('#document-file-input');
    const pdfPath = path.resolve('samples/sample_rental_agreement.pdf');
    await inputUploadHandle.uploadFile(pdfPath);

    await page.evaluate(() => {
      const el = document.getElementById('document-file-input');
      el?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await new Promise((r) => setTimeout(r, 500));

    console.log('Submitting upload form...');
    await page.click('#parse-submit-btn');

    console.log('Waiting for parsed results container...');
    await page.waitForSelector('#parsed-results-container', { timeout: 10000 });
    console.log('Parsed container displayed!');

    console.log('Clicking #run-simplify-btn ...');
    await page.click('#run-simplify-btn');

    console.log('Waiting for verification badges and summary banner...');
    await page.waitForSelector('#verification-summary-banner', { timeout: 10000 });
    await page.waitForSelector('.verification-badge', { timeout: 10000 });
    console.log('Verification badges and summary banner rendered successfully!');

    await new Promise((r) => setTimeout(r, 2000));

    const bannerText = await page.$eval('#verification-summary-banner', (el) => el.innerText);
    console.log('\n--- Rendered UI Summary Banner ---');
    console.log(bannerText);

    const artifactPath = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66/phase3_verified.png';
    await page.screenshot({ path: artifactPath, fullPage: true });
    console.log('\nSaved full UI verification screenshot to:', artifactPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('UI verification failed:', err);
  process.exit(1);
});
