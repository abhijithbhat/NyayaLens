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

    console.log('1. Navigating to /analyze...');
    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle2' });

    console.log('2. Selecting sample_rental_agreement.pdf...');
    const fileInput = await page.$('#document-file-input');
    const samplePath = path.resolve('samples/sample_rental_agreement.pdf');
    await fileInput.uploadFile(samplePath);

    console.log('3. Clicking Upload & Ingest...');
    await page.click('#parse-submit-btn');

    console.log('4. Waiting for parsing to complete...');
    await page.waitForSelector('#clause-count-display', { timeout: 60000 });
    const count = await page.$eval('#clause-count-display', (el) => el.textContent?.trim());
    console.log(`   Parsed successfully! ${count} clauses.`);

    console.log('5. Clicking Run AI Simplification & Dual-Gate Verification...');
    await page.click('#run-simplify-btn');

    console.log('6. Waiting for checklist section to appear...');
    await page.waitForSelector('#analyze-checklist-section', { timeout: 120000 });
    console.log('   Checklist section rendered!');

    await new Promise((r) => setTimeout(r, 2000));

    const screenshotPath = path.join(artifactDir, 'analyze_phase6_checklist.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
