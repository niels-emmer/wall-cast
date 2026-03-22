#!/usr/bin/env node
/**
 * Captures only screenshot-5 (landing page) and screenshot-6 (admin panel).
 * Requires: Vite dev server running on localhost:5173
 */

const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const OUT_DIR  = path.resolve(__dirname);

const TEXT_REPLACEMENTS = [
  // Person names
  ['Niels',             'Liam'],
  ['Alice',             'Emma'],
  ['Bob',               'Oliver'],
  ['Philipina',         'Sophie'],
  ['Genesis',           'Maya'],
  ['Arthur',            'Noah'],
  // Any email addresses that might appear
  ['echtniels@gmail',   'liam@example'],
  ['@gmail.com',        '@example.com'],
  ['@googlemail.com',   '@example.com'],
  // LAN IPs
  ['192.168.101.',      '192.168.1.'],
  ['192.168.100.',      '192.168.1.'],
  // Dev-server URL
  ['localhost:5173',    '192.168.1.10'],
  // Router / network identifiers
  ['192.168.101.1',     '192.168.1.1'],
  // Any google calendar IDs (long hex strings) — left as-is, not PII per se
];

const replaceScript = (pairs) => `
  (function () {
    const pairs = ${JSON.stringify(pairs)};
    function sub(str) {
      for (const [from, to] of pairs) {
        if (str.includes(from)) str = str.split(from).join(to);
      }
      return str;
    }
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const replaced = sub(node.textContent);
        if (replaced !== node.textContent) node.textContent = replaced;
      } else {
        if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && node.value) {
          node.value = sub(node.value);
        }
        for (const child of node.childNodes) walk(child);
      }
    }
    walk(document.body);
  })();
`;

(async () => {
  try {
    const { default: http } = await import('http');
    await new Promise((resolve, reject) => {
      http.get(BASE_URL, res => resolve(res)).on('error', reject);
    });
  } catch {
    console.error(`\nError: cannot reach ${BASE_URL}`);
    console.error('Start the Vite dev server first:\n');
    process.exit(1);
  }

  console.log('Launching headless browser at 1920×1080\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  // ── Screenshot 5: Landing page ─────────────────────────────────────────────
  console.log('[1/2] /  (landing page → screenshot-5.png)');
  const landingPage = await browser.newPage();
  await landingPage.setViewport({ width: 1920, height: 1080 });
  await landingPage.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));
  await landingPage.evaluate(replaceScript(TEXT_REPLACEMENTS));
  await landingPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-5.png'), type: 'png' });
  console.log('       ✓ screenshot-5.png\n');
  await landingPage.close();

  // ── Screenshot 6: Admin panel ──────────────────────────────────────────────
  console.log('[2/2] /#admin  (Screens tab → screenshot-6.png)');
  const adminPage = await browser.newPage();
  await adminPage.setViewport({ width: 1920, height: 1080 });
  await adminPage.goto(`${BASE_URL}/#admin`, { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click the Screens tab
  await adminPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === 'Screens');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await adminPage.evaluate(replaceScript(TEXT_REPLACEMENTS));
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-6.png'), type: 'png' });
  console.log('       ✓ screenshot-6.png\n');
  await adminPage.close();

  await browser.close();
  console.log('Done — screenshots 5 and 6 saved to docs/screenshots/');
})().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
