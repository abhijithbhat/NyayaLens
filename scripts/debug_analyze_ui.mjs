import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  const artifactDir = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_a_'));

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERR:', err));

    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle2' });

    const sampleDocA = JSON.parse(fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8'));
    // Use 2 clauses
    const sample = {
      ...sampleDocA,
      clauses: sampleDocA.clauses.slice(0, 2),
    };

    await page.evaluate((doc) => {
      sessionStorage.setItem(`nyayalens_doc_${doc.id}`, JSON.stringify(doc));
      sessionStorage.setItem('nyayalens_active_doc_id', doc.id);
    }, sample);

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#run-simplify-btn', { timeout: 10000 });

    console.log('Clicking run-simplify-btn...');
    await page.click('#run-simplify-btn');

    // Wait up to 90 seconds for verification and checklist to complete
    console.log('Waiting for results (up to 90s)...');
    await page.waitForFunction(
      () => Boolean(document.querySelector('#analyze-checklist-section') || document.querySelector('#verification-summary-banner')),
      { timeout: 90000 }
    );

    // Give 2 seconds for animation
    await new Promise((r) => setTimeout(r, 2000));

    const screenshotPath = path.join(artifactDir, 'analyze_phase6_checklist.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
