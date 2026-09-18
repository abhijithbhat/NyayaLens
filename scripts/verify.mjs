import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  console.log('Clicking Test Gemini Connectivity button...');
  await page.click('#test-gemini-btn');

  console.log('Waiting for response...');
  await page.waitForSelector('#healthcheck-result, #healthcheck-error', { timeout: 15000 });

  const resultText = await page.evaluate(() => {
    const el = document.getElementById('gemini-response-text');
    const err = document.getElementById('healthcheck-error');
    return el ? el.innerText : (err ? err.innerText : 'Unknown');
  });

  console.log('RENDERED_TEXT_ON_SCREEN:', resultText);

  const screenshotPath = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66/healthcheck_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
