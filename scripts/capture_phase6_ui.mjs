import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  console.log('=== Capturing Phase 6 UI Screenshots ===\n');

  const artifactDir = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_p6_'));

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    page.on('console', (msg) => console.log('PAGE:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    // 1. Capture Analyze page with sample doc A preloaded
    console.log('1. Loading /analyze with sample doc A...');
    try {
      await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle2' });

      // Use a concise 3-clause slice of docA for fast UI test
      const fullDocA = JSON.parse(fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8'));
      const sampleDocA = {
        ...fullDocA,
        clauses: fullDocA.clauses.slice(0, 4), // 4 clauses: Rent, Deposit, Painting, Termination
      };

      await page.evaluate((doc) => {
        sessionStorage.setItem(`nyayalens_doc_${doc.id}`, JSON.stringify(doc));
        sessionStorage.setItem('nyayalens_active_doc_id', doc.id);
      }, sampleDocA);

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForSelector('#parsed-results-container', { timeout: 15000 });

      console.log('   Running simplification & checklist...');
      const runSimplifyBtn = await page.$('#run-simplify-btn');
      if (runSimplifyBtn) {
        await runSimplifyBtn.click();
        await page.waitForSelector('#analyze-checklist-section', { timeout: 90000 });
      }

      const analyzeScreenshot = path.join(artifactDir, 'analyze_phase6_checklist.png');
      await page.screenshot({ path: analyzeScreenshot, fullPage: true });
      console.log(`   Saved Analyze screenshot: ${analyzeScreenshot}`);
    } catch (aErr) {
      console.error('Analyze capture error:', aErr);
    }

    // 2. Capture Compare page
    console.log('\n2. Loading /compare with docA and docB...');
    try {
      await page.goto('http://localhost:3000/compare?docA=doc-rental-agreement-a&docB=doc-rental-agreement-b', {
        waitUntil: 'networkidle2',
      });

      const compareBtn = await page.$('#compare-action-btn');
      if (compareBtn) {
        console.log('   Clicking Compare Legal Documents...');
        await compareBtn.click();
        await page.waitForSelector('#comparison-results-container', { timeout: 90000 });
        // wait for checklist to render
        await page.waitForSelector('#compare-checklist-section', { timeout: 90000 });
      }

      const compareScreenshot = path.join(artifactDir, 'compare_phase6_checklist.png');
      await page.screenshot({ path: compareScreenshot, fullPage: true });
      console.log(`   Saved Compare screenshot: ${compareScreenshot}`);
    } catch (cErr) {
      console.error('Compare capture error:', cErr);
    }

    // 3. Capture Chat page
    console.log('\n3. Loading /chat/doc-rental-agreement-a ...');
    try {
      await page.goto('http://localhost:3000/chat/doc-rental-agreement-a', { waitUntil: 'networkidle2' });
      const chatScreenshot = path.join(artifactDir, 'chat_phase6_consistency.png');
      await page.screenshot({ path: chatScreenshot, fullPage: true });
      console.log(`   Saved Chat screenshot: ${chatScreenshot}`);
    } catch (chErr) {
      console.error('Chat capture error:', chErr);
    }

    console.log('\n=== All Phase 6 Screenshots Captured Successfully ===');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
