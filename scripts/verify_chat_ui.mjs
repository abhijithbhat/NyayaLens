import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  console.log('=== NyayaLens Phase 5 Chat UI Verification ===\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_chat_ui_'));
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1200 });

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

    console.log('Navigating to http://localhost:3000/chat/doc-rental-agreement-a ...');
    await page.goto('http://localhost:3000/chat/doc-rental-agreement-a', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('Waiting for chat UI elements to render...');
    await page.waitForSelector('#chat-header-title', { timeout: 10000 });
    await page.waitForSelector('#chat-query-input', { timeout: 10000 });

    // Read real chat test exchanges
    const realExchangesPath = path.join(process.cwd(), 'samples/chat_exchanges_real.json');
    const exchanges = JSON.parse(fs.readFileSync(realExchangesPath, 'utf-8'));

    // Read parsed document to get full clause details for cited clauses
    const parsedDocPath = path.join(process.cwd(), 'samples/parsed_docA.json');
    const parsedDoc = JSON.parse(fs.readFileSync(parsedDocPath, 'utf-8'));

    // Inject state with both real test exchanges
    await page.evaluate(({ exchanges, parsedDoc }) => {
      // Find the React state setter or simulate message state
      const clauseMap = new Map(parsedDoc.clauses.map(c => [c.id, c]));

      const messages = [
        {
          id: 'user-1',
          role: 'user',
          content: exchanges.exchangeA.question,
          createdAt: '6:49 PM',
        },
        {
          id: 'asst-1',
          role: 'assistant',
          content: exchanges.exchangeA.streamedAnswer,
          citedClauseIds: ['clause-2'],
          retrievedClauses: exchanges.exchangeA.retrievedClauses.map(rc => ({
            ...clauseMap.get(rc.id) || rc,
            similarity: rc.id === 'clause-2' ? 0.764 : 0.668,
          })),
          verification: exchanges.exchangeA.verification,
          createdAt: '6:49 PM',
        },
        {
          id: 'user-2',
          role: 'user',
          content: exchanges.exchangeB.question,
          createdAt: '6:50 PM',
        },
        {
          id: 'asst-2',
          role: 'assistant',
          content: exchanges.exchangeB.streamedAnswer,
          citedClauseIds: [],
          retrievedClauses: exchanges.exchangeB.retrievedClauses.map(rc => ({
            ...clauseMap.get(rc.id) || rc,
            similarity: 0.61,
          })),
          verification: exchanges.exchangeB.verification,
          createdAt: '6:50 PM',
        },
      ];

      // Dispatch custom event or set directly if component listens or reload with injected session
      window.__INJECT_MESSAGES__?.(messages);
    }, { exchanges, parsedDoc });

    // Check home page navigation first
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    const chatLink = await page.$('#go-to-chat-link');
    console.log('Home page has Chat Q&A link:', !!chatLink);

    // Navigate to Chat page
    await page.goto('http://localhost:3000/chat/doc-rental-agreement-a', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#chat-header-title', { timeout: 10000 });
    console.log('Chat header loaded.');

    // Ask Question (a) via the input
    console.log('Submitting live question: "What is the monthly rent amount and penalty for delayed payment?" ...');
    await page.type('#chat-query-input', 'What is the monthly rent amount and penalty for delayed payment?');
    await page.click('#chat-submit-btn');

    // Wait for the response to stream and post-stream verification badge to appear
    console.log('Waiting for assistant response and verification badge...');
    await page.waitForFunction(
      () => {
        const text = document.getElementById('chat-messages-container')?.innerText || '';
        return text.includes('Dual-Gate Verified') || text.includes('Needs Review');
      },
      { timeout: 45000 }
    );
    console.log('Post-stream verification badge appeared in UI!');

    // Wait 2 seconds for smooth UI finish
    await new Promise((r) => setTimeout(r, 2000));

    // Capture screenshot of the verified chat interface
    const artifactDir = '/Users/vishwajithmbhat/.gemini/antigravity-ide/brain/7be1a762-2c9e-4f83-9c0f-1d8e11a3dd66';
    const screenshotPath = path.join(artifactDir, 'chat_verified.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\nScreenshot saved to: ${screenshotPath}`);

    console.log('\nChat UI Verification Successful!');
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
