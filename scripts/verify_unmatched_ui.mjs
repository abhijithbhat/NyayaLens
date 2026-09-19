import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_compare_unmatched_'));
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

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
      matchedPairs: [],
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

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/compare')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: mockComparisonResult }),
        });
      } else if (url.includes('/api/parse')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: { id: 'mock', clauses: [{ id: 'c1', rawText: 'text', category: 'Other' }] },
          }),
        });
      } else {
        req.continue();
      }
    });

    await page.goto('http://localhost:3000/compare', { waitUntil: 'networkidle2' });

    const pdfPathA = path.resolve('samples/sample_rental_agreement.pdf');
    const pdfPathB = path.resolve('samples/sample_rental_agreement_v2.pdf');

    const inputA = await page.$('#doc-a-file-input');
    await inputA.uploadFile(pdfPathA);
    await page.evaluate(() => document.getElementById('doc-a-file-input').dispatchEvent(new Event('change', { bubbles: true })));

    const inputB = await page.$('#doc-b-file-input');
    await inputB.uploadFile(pdfPathB);
    await page.evaluate(() => document.getElementById('doc-b-file-input').dispatchEvent(new Event('change', { bubbles: true })));

    await page.click('#parse-doc-a-btn');
    await page.click('#parse-doc-b-btn');

    await page.waitForFunction(() => {
      const btn = document.getElementById('compare-action-btn');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    await page.click('#compare-action-btn');
    await page.waitForSelector('#comparison-results-container', { timeout: 10000 });

    // Click Unmatched tab
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await (await b.getProperty('textContent')).jsonValue();
      if (text.includes('Unmatched Clauses')) {
        await b.click();
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 600));

    const screenshotPath = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66/compare_unmatched_verified.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Screenshot saved to:', screenshotPath);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
