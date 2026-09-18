import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  console.log('Navigating to http://localhost:3000/analyze...');
  await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle2' });

  const samplePath = path.resolve('samples/sample_rental_agreement.pdf');
  console.log('Attaching sample file:', samplePath);
  const inputUploadHandle = await page.$('#document-file-input');
  await inputUploadHandle.uploadFile(samplePath);

  // Dispatch change event so React state updates
  await page.evaluate(() => {
    const el = document.getElementById('document-file-input');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await new Promise((r) => setTimeout(r, 500));

  const isBtnDisabled = await page.$eval('#parse-submit-btn', (el) => el.disabled);
  console.log('Is submit button disabled?', isBtnDisabled);

  console.log('Submitting upload form...');
  await page.click('#parse-submit-btn');

  console.log('Waiting for parsed results container or error...');
  await page.waitForSelector('#parsed-results-container, #parse-error-banner', { timeout: 60000 });

  const hasError = await page.$('#parse-error-banner');
  if (hasError) {
    const errorText = await page.$eval('#parse-error-banner', (el) => el.innerText);
    console.error('Page displayed error banner:', errorText);
  }

  const count = await page.$eval('#clause-count-display', (el) => el.innerText).catch(() => null);
  console.log('Detected clause count in UI:', count);

  const screenshotPath = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66/ingestion_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
}

main().catch((err) => {
  console.error('Error during ingestion UI verification:', err);
  process.exit(1);
});
