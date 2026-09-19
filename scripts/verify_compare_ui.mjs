import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  console.log('=== NyayaLens Compare Mode UI Verification ===\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_compare_ui_'));
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1400 });

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    // Mock comparison API response representing the real comparison between Agreement v1 and v2
    const mockComparisonResult = {
      id: 'cmp-test-123',
      documentA: { filename: 'sample_rental_agreement.pdf' },
      documentB: { filename: 'sample_rental_agreement_v2.pdf' },
      comparedAt: new Date().toISOString(),
      summary: {
        totalClausesA: 10,
        totalClausesB: 10,
        matchedCount: 9,
        unmatchedCountA: 1,
        unmatchedCountB: 1,
        favorsACount: 2,
        favorsBCount: 2,
        neutralCount: 5,
        apiCallsCount: 3,
      },
      matchedPairs: [
        {
          id: 'pair-clause-2__clause-2',
          clauseA: {
            id: 'clause-2',
            sectionNumber: 'Clause 2',
            heading: 'Monthly Rent and Maintenance',
            rawText: 'The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.',
            category: 'Payment',
          },
          clauseB: {
            id: 'clause-2',
            sectionNumber: 'Clause 2',
            heading: 'Monthly Rent and Maintenance',
            rawText: 'The Lessee agrees to pay a monthly rent of Rs. 42,000/- (Rupees Forty-Two Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 1,000/- per week of delay.',
            category: 'Payment',
          },
          difference: 'Document A specifies a monthly rent of Rs. 38,000/- with a late penalty of Rs. 500/- per week, whereas Document B increases the monthly rent to Rs. 42,000/- and doubles the late penalty to Rs. 1,000/- per week.',
          favors: 'A',
          favorsReason: 'Document A offers Rs. 4,000 lower monthly rent and half the late penalty charge for delayed payment.',
          verification: {
            status: 'verified',
            confidence: 0.98,
            details: 'Both rent amounts (Rs. 38,000 and Rs. 42,000) and late penalties (Rs. 500 and Rs. 1,000) strictly match source clauses A and B.',
          },
        },
        {
          id: 'pair-clause-3__clause-3',
          clauseA: {
            id: 'clause-3',
            sectionNumber: 'Clause 3',
            heading: 'Security Deposit',
            rawText: 'The Lessee has paid an interest-free refundable security deposit of Rs. 1,50,000/- (Rupees One Lakh Fifty Thousand only) to the Lessor via RTGS transfer upon signing this Agreement. This deposit shall be refunded to the Lessee within 7 business days of peacefully vacating the Scheduled Premises, subject to deductions for unpaid rent, utility dues, and property damages.',
            category: 'Deposit',
          },
          clauseB: {
            id: 'clause-3',
            sectionNumber: 'Clause 3',
            heading: 'Security Deposit',
            rawText: 'The Lessee has paid an interest-free refundable security deposit of Rs. 2,00,000/- (Rupees Two Lakhs only) to the Lessor via RTGS transfer upon signing this Agreement. This deposit shall be refunded to the Lessee within 15 business days of peacefully vacating the Scheduled Premises, subject to deductions for unpaid rent and utility dues.',
            category: 'Deposit',
          },
          difference: 'Document A requires a refundable security deposit of Rs. 1,50,000/- with refund within 7 business days, whereas Document B requires Rs. 2,00,000/- with refund within 15 business days.',
          favors: 'A',
          favorsReason: 'Document A requires a lower upfront deposit (Rs. 50,000 less) and faster refund turnaround (7 days vs 15 days).',
          verification: {
            status: 'verified',
            confidence: 0.96,
            details: 'Deposit amounts and refund turnaround days confirmed in both source agreements.',
          },
        },
        {
          id: 'pair-clause-5__clause-4',
          clauseA: {
            id: 'clause-5',
            sectionNumber: 'Clause 5',
            heading: 'Lock-in Period and Notice for Termination',
            rawText: 'Both parties agree to a mandatory Lock-in Period of 6 (six) months, during which neither party can terminate this Agreement. After completion of the lock-in period, either party may terminate the tenancy by serving 2 (two) months prior written notice or by paying 2 months rent in lieu thereof.',
            category: 'Termination',
          },
          clauseB: {
            id: 'clause-4',
            sectionNumber: 'Clause 4',
            heading: 'Lock-in Period and Notice for Termination',
            rawText: 'Both parties agree to a Lock-in Period of 3 (three) months, during which neither party can terminate this Agreement. After completion of the lock-in period, either party may terminate the tenancy by serving 1 (one) month prior written notice or by paying 1 month rent in lieu thereof.',
            category: 'Termination',
          },
          difference: 'Document A establishes a 6-month lock-in period and requires 2 months prior written notice, whereas Document B reduces the lock-in to 3 months and notice period to 1 month.',
          favors: 'B',
          favorsReason: 'Document B provides significantly greater flexibility with a shorter lock-in commitment and shorter notice requirement.',
          verification: {
            status: 'verified',
            confidence: 0.97,
            details: 'Verified against source clauses: 6 months vs 3 months lock-in, and 2 months vs 1 month notice.',
          },
        },
      ],
      unmatchedClauses: [
        {
          clause: {
            id: 'clause-4',
            sectionNumber: 'Clause 4',
            heading: 'Painting and Maintenance Deductions',
            rawText: 'At the time of vacating the premises, a mandatory non-negotiable deduction of Rs. 15,000/- (Rupees Fifteen Thousand only) or one month rent (whichever is lower) shall be retained from the Security Deposit towards professional deep cleaning and repainting of the interior walls.',
            category: 'Deposit',
          },
          onlyIn: 'A',
        },
        {
          clause: {
            id: 'clause-10',
            sectionNumber: 'Clause 10',
            heading: 'Pet Policy and Animal Regulations',
            rawText: 'Keeping of any domestic animals or pets, including dogs, cats, or birds, within the Scheduled Premises is strictly prohibited under all circumstances without exception. Any unauthorized keeping of pets will lead to immediate lease cancellation and a penalty of Rs. 25,000/-.',
            category: 'Other',
          },
          onlyIn: 'B',
        },
      ],
    };

    // Intercept /api/compare and /api/parse
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/compare')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: mockComparisonResult,
          }),
        });
      } else if (url.includes('/api/parse')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              id: 'doc-mock',
              filename: 'agreement.pdf',
              uploadedAt: new Date().toISOString(),
              clauses: [{ id: 'c1', rawText: 'Sample clause', category: 'Payment' }],
            },
          }),
        });
      } else {
        req.continue();
      }
    });

    console.log('1. Navigating to http://localhost:3000/compare...');
    await page.goto('http://localhost:3000/compare', { waitUntil: 'networkidle2' });

    // Verify initial UI elements
    const title = await page.$eval('h1', (el) => el.textContent);
    console.log('   Found Header:', title);

    // Upload Doc A and Doc B
    const pdfPathA = path.resolve('samples/sample_rental_agreement.pdf');
    const pdfPathB = path.resolve('samples/sample_rental_agreement_v2.pdf');

    console.log('2. Attaching Document A and Document B...');
    const inputA = await page.$('#doc-a-file-input');
    await inputA.uploadFile(pdfPathA);
    await page.evaluate(() => document.getElementById('doc-a-file-input').dispatchEvent(new Event('change', { bubbles: true })));

    const inputB = await page.$('#doc-b-file-input');
    await inputB.uploadFile(pdfPathB);
    await page.evaluate(() => document.getElementById('doc-b-file-input').dispatchEvent(new Event('change', { bubbles: true })));

    console.log('3. Parsing Document A & B...');
    await page.click('#parse-doc-a-btn');
    await page.click('#parse-doc-b-btn');

    await page.waitForFunction(() => {
      const btn = document.getElementById('compare-action-btn');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    console.log('4. Clicking "Compare Legal Documents"...');
    await page.click('#compare-action-btn');

    console.log('5. Waiting for comparison results container...');
    await page.waitForSelector('#comparison-results-container', { timeout: 10000 });

    const screenshotPath = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66/compare_verified.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Screenshot saved successfully to:', screenshotPath);

    console.log('\n✅ Compare Mode UI Verification Completed Successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error during Compare UI verification:', err);
  process.exit(1);
});
