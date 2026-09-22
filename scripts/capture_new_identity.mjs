import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function capture() {
  console.log('=== Capturing NyayaLens Screenshots in New Identity ===\n');

  const artifactDir = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/c8bb6c1f-d9ac-4fbe-be32-a3298b697637';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_capture_'));

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });

    // 1. Homepage
    console.log('1. Capturing Homepage (http://localhost:3000/)...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1', { timeout: 10000 });
    const homeScreenshot = path.join(artifactDir, 'homepage.png');
    await page.screenshot({ path: homeScreenshot, fullPage: true });
    console.log(`✓ Saved homepage screenshot: ${homeScreenshot}`);

    // 2. Analyze Page (with cached sample document and analysis)
    console.log('\n2. Capturing Analyze Page (http://localhost:3000/analyze)...');
    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle0' });

    // Populate sessionStorage with sample doc A so it immediately displays clauses
    const sampleDocA = JSON.parse(fs.readFileSync(path.resolve('samples/parsed_docA.json'), 'utf-8'));
    await page.evaluate((doc) => {
      sessionStorage.setItem(`nyayalens_doc_${doc.id}`, JSON.stringify(doc));
      sessionStorage.setItem('nyayalens_active_doc_id', doc.id);
    }, sampleDocA);

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#parsed-results-container', { timeout: 10000 });
    
    // Trigger simplification to showcase Dual-Gate verification badges & checklist
    console.log('   Running simplification & checklist...');
    const simplifyBtn = await page.$('#run-simplify-btn');
    if (simplifyBtn) {
      await simplifyBtn.click();
      await page.waitForSelector('#analyze-checklist-section', { timeout: 60000 });
    }

    const analyzeScreenshot = path.join(artifactDir, 'analyze.png');
    await page.screenshot({ path: analyzeScreenshot, fullPage: true });
    console.log(`✓ Saved analyze screenshot: ${analyzeScreenshot}`);

    // 3. Compare Page (http://localhost:3000/compare?docA=doc-rental-agreement-a&docB=doc-rental-agreement-b)
    console.log('\n3. Capturing Compare Page (http://localhost:3000/compare)...');
    await page.goto(
      'http://localhost:3000/compare?docA=doc-rental-agreement-a&docB=doc-rental-agreement-b',
      { waitUntil: 'networkidle0' }
    );
    await page.waitForSelector('#compare-action-btn', { timeout: 10000 });
    console.log('   Executing comparison pipeline...');
    const compareBtn = await page.$('#compare-action-btn');
    if (compareBtn) {
      await compareBtn.click();
      await page.waitForSelector('#comparison-results-container', { timeout: 60000 });
    }

    const compareScreenshot = path.join(artifactDir, 'compare.png');
    await page.screenshot({ path: compareScreenshot, fullPage: true });
    console.log(`✓ Saved compare screenshot: ${compareScreenshot}`);

    // 4. Chat Page (http://localhost:3000/chat/doc-rental-agreement-a)
    console.log('\n4. Capturing Chat Page (http://localhost:3000/chat/doc-rental-agreement-a)...');
    await page.goto('http://localhost:3000/chat/doc-rental-agreement-a', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#chat-query-input', { timeout: 10000 });

    // Ask a prompt to show streaming response, verification badge & retrieved evidence
    const starterBtn = await page.$('#chat-messages-container button');
    if (starterBtn) {
      console.log('   Clicking starter question...');
      await starterBtn.click();
      await new Promise((r) => setTimeout(r, 8000));
    }

    const chatScreenshot = path.join(artifactDir, 'chat.png');
    await page.screenshot({ path: chatScreenshot, fullPage: true });
    console.log(`✓ Saved chat screenshot: ${chatScreenshot}`);

    console.log('\n=== All 4 Screenshots Captured Successfully! ===');
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
