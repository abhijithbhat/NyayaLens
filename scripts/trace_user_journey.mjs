import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  console.log('=== NyayaLens End-to-End User Journey Trace ===\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_journey_'));
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    const artifactDir = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66';

    // -------------------------------------------------------------
    // Step 0: Capture Homepage
    // -------------------------------------------------------------
    console.log('0. Opening Homepage (http://localhost:3000)...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    const homepageScreenshot = path.join(artifactDir, 'new_homepage.png');
    await page.screenshot({ path: homepageScreenshot, fullPage: true });
    console.log(`   Homepage screenshot saved to: ${homepageScreenshot}`);

    // -------------------------------------------------------------
    // Step 1: Open /analyze in the browser
    // -------------------------------------------------------------
    console.log('\n1. Navigating to http://localhost:3000/analyze ...');
    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle2' });

    // -------------------------------------------------------------
    // Step 2: Upload samples/sample_rental_agreement_v2.pdf
    // -------------------------------------------------------------
    console.log('2. Selecting file "samples/sample_rental_agreement_v2.pdf"...');
    const fileInput = await page.$('#document-file-input');
    const sampleV2Path = path.resolve('samples/sample_rental_agreement_v2.pdf');
    await fileInput.uploadFile(sampleV2Path);

    console.log('   Submitting file upload to /api/parse...');
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    console.log('   Waiting for document ingestion to finish...');
    await page.waitForSelector('#clause-count-display', { timeout: 60000 });
    const clauseCountText = await page.$eval('#clause-count-display', (el) => el.textContent?.trim());
    console.log(`   Ingestion complete! Clauses extracted: ${clauseCountText}`);

    // Extract the active document ID and filename from the Analyze page state
    const documentData = await page.evaluate(() => {
      const activeDocId = sessionStorage.getItem('nyayalens_active_doc_id');
      const activeDoc = activeDocId ? JSON.parse(sessionStorage.getItem(`nyayalens_doc_${activeDocId}`) || 'null') : null;
      return { activeDocId, activeDoc };
    });

    console.log(`   Uploaded Document ID: "${documentData.activeDocId}"`);
    console.log(`   Uploaded Document Filename: "${documentData.activeDoc?.filename}"`);

    const analyzeScreenshot = path.join(artifactDir, 'analyze_v2_ingested.png');
    await page.screenshot({ path: analyzeScreenshot });
    console.log(`   Analyze page screenshot saved to: ${analyzeScreenshot}`);

    // -------------------------------------------------------------
    // Step 3: Navigate from Analyze to Chat
    // -------------------------------------------------------------
    console.log('\n3. Clicking navigation link to Chat Q&A...');
    // We can click either the action bar button (#open-doc-chat-btn) or header link (#header-chat-link)
    const chatBtn = await page.$('#open-doc-chat-btn');
    if (!chatBtn) throw new Error('Could not find #open-doc-chat-btn on /analyze page');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      chatBtn.click(),
    ]);

    const chatUrl = page.url();
    console.log(`   Chat Navigation landed on URL: ${chatUrl}`);

    // Wait for chat elements
    await page.waitForSelector('#chat-header-title', { timeout: 15000 });
    const chatHeaderTitle = await page.$eval('#chat-header-title', (el) => el.textContent?.trim());
    console.log(`   Chat Page Header Title: "${chatHeaderTitle}"`);

    const chatScreenshot = path.join(artifactDir, 'chat_with_v2.png');
    await page.screenshot({ path: chatScreenshot });
    console.log(`   Chat page screenshot saved to: ${chatScreenshot}`);

    // -------------------------------------------------------------
    // Step 4: Return to /analyze and Navigate to Compare
    // -------------------------------------------------------------
    console.log('\n4. Returning to /analyze and clicking navigation link to Compare Mode...');
    await page.goBack({ waitUntil: 'networkidle2' });

    // Wait for document to restore and action button to be visible
    await page.waitForSelector('#open-doc-compare-btn', { timeout: 15000 });
    console.log('   Clicking #open-doc-compare-btn on /analyze page...');
    const compareBtn = await page.$('#open-doc-compare-btn');
    if (!compareBtn) throw new Error('Could not find #open-doc-compare-btn on /analyze page');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      compareBtn.click(),
    ]);

    const compareUrl = page.url();
    console.log(`   Compare Navigation landed on URL: ${compareUrl}`);

    // Verify Document A is automatically loaded
    await page.waitForSelector('#doc-a-filename-display', { timeout: 15000 });
    const docAFilename = await page.$eval('#doc-a-filename-display', (el) => el.textContent?.trim()).catch(() => 'Ready');
    console.log(`   Compare Page Document A Loaded: "${docAFilename}"`);

    const compareScreenshot = path.join(artifactDir, 'compare_with_v2.png');
    await page.screenshot({ path: compareScreenshot });
    console.log(`   Compare page screenshot saved to: ${compareScreenshot}`);

    console.log('\n================ USER JOURNEY TRACE RESULTS ================');
    console.log(`1. Uploaded Document:       ${documentData.activeDoc?.filename} (ID: ${documentData.activeDocId})`);
    console.log(`2. Chat Navigation URL:     ${chatUrl}`);
    console.log(`   Document ID in Chat URL: ${chatUrl.split('/chat/')[1]}`);
    console.log(`   Carried Document:        ${chatHeaderTitle}`);
    console.log(`3. Compare Navigation URL:  ${compareUrl}`);
    console.log(`   Document ID in Comp URL: ${new URL(compareUrl).searchParams.get('docA')}`);
    console.log(`   Carried Document A:      ${docAFilename}`);
    console.log('============================================================\n');

    console.log('✅ End-to-End User Journey Traced Successfully!');
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Journey trace failed:', err);
  process.exit(1);
});
