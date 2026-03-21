#!/usr/bin/env node
/**
 * wall-cast screenshot generator
 *
 * Usage:  node docs/screenshots/make-screenshots.js
 * Requires: npm install (run once inside docs/screenshots/)
 *
 * Prerequisites:
 *   Start the Vite dev server proxied to the live backend:
 *     cd frontend && VITE_BACKEND_URL=http://192.168.101.252 npm run dev
 *   Then run this script from the repo root or from docs/screenshots/.
 *
 * What it does:
 *   1. Connects to localhost:5173 (Vite dev server → live backend)
 *   2. Takes 5 display screenshots pinned to specific rotator positions
 *      so every widget type appears at least once across the set
 *   3. Takes 1 admin-panel screenshot
 *   4. Anonymises personal data before each capture:
 *        - Calendar event titles  → generic placeholder events
 *        - Bus stop name          → a fixed Amsterdam stop name
 *        - Person names           → fictional names
 *   5. For the warnings slot (empty outside active KNMI alert periods):
 *      injects a fake warning card directly into the DOM after page load —
 *      no network interception needed
 *   6. Writes screenshot-{1-6}.png into docs/screenshots/
 *
 * Rotator slot reference (update if widget order changes in wall-cast.yaml):
 *   main   rotator (right/large): 0=weather  1=calendar  2=traffic  3=warnings
 *   bottom rotator (left/small):  0=rain     1=garbage   2=polestar  3=bus
 */

const puppeteer = require('puppeteer');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:5173';
const OUT_DIR  = path.resolve(__dirname);

// 5 display shots — one per screen, covering all widget types
const DISPLAY_SHOTS = [
  { n: 1, screen: 'living-room', mainSlot: 0, bottomSlot: 0, desc: 'weather + rain' },
  { n: 2, screen: 'kids-room',   mainSlot: 1, bottomSlot: 1, desc: 'calendar + garbage' },
  { n: 3, screen: 'office',      mainSlot: 2, bottomSlot: 2, desc: 'traffic + polestar' },
  { n: 4, screen: 'bedroom',     mainSlot: 3, bottomSlot: 3, desc: 'warnings (injected) + bus' },
  { n: 5, screen: 'kitchen',     mainSlot: 0, bottomSlot: 3, desc: 'weather + bus' },
];

// ── Anonymisation ──────────────────────────────────────────────────────────────

// Text replacements applied to all DOM text nodes before each capture.
// Extend this list when new personal text appears in your config/calendar.
const TEXT_REPLACEMENTS = [
  // Calendar event titles
  ['Delivery G medicine',  'Pick up prescription'],
  ['Bring back books',     'Library return due'],
  ['Genesis dance class',  'Evening yoga class'],
  // Bus stop name (widget header)
  ['Polakkenbrug',         'Leidseplein'],
  ['Rembrandtplein',       'Leidseplein'],
  // Person names (admin panel, calendar headers)
  ['Niels',                'Liam'],
  ['Alice',                'Emma'],
  // Admin panel: anonymise real LAN IPs and dev-server cast URL
  ['192.168.101.',         '192.168.1.'],
  ['localhost:5173',       '192.168.1.10'],
];

// ── Browser helpers ────────────────────────────────────────────────────────────

/** Force rotator children to a specific slot (overrides React animation state). */
const rotatorScript = (mainSlot, bottomSlot) => `
  (function () {
    const rotators = Array.from(document.querySelectorAll('div')).filter(d => {
      const kids = Array.from(d.children);
      return kids.length >= 3 && kids.every(k => k.style.position === 'absolute');
    });
    function pin(el, idx) {
      Array.from(el.children).forEach((k, i) => {
        k.style.opacity    = String(i === idx ? 1 : 0);
        k.style.transition = 'none';
      });
    }
    if (rotators[0]) pin(rotators[0], ${mainSlot});
    if (rotators[1]) pin(rotators[1], ${bottomSlot});
  })();
`;

/** Replace text nodes and input values in the DOM to anonymise personal data. */
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
        // Also replace value/placeholder in input and textarea elements
        if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && node.value) {
          node.value = sub(node.value);
        }
        for (const child of node.childNodes) walk(child);
      }
    }
    walk(document.body);
  })();
`;

/**
 * Inject a fake KNMI warning card into the warnings rotator slot.
 *
 * The WarningsWidget renders opacity:0 when no active warnings exist.
 * This script finds the slot, makes it visible, and injects a yellow-code
 * wind warning card that matches the real widget's visual style.
 */
const INJECT_WARNING_SCRIPT = `
  (function () {
    const rotators = Array.from(document.querySelectorAll('div')).filter(d => {
      const kids = Array.from(d.children);
      return kids.length >= 3 && kids.every(k => k.style.position === 'absolute');
    });
    const slot = rotators[0] && rotators[0].children[3];
    if (!slot) return;

    // Make the slot itself visible (React sets opacity:0 when no warnings)
    slot.style.opacity = '1';

    // Find the shell div (first child of slot)
    const shell = slot.firstElementChild;
    if (!shell) return;
    shell.style.opacity = '1';

    // Clear existing content (title stays; we add after it)
    while (shell.children.length > 1) shell.removeChild(shell.lastChild);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.07);flex-shrink:0;margin:0';
    shell.appendChild(divider);

    // Warning card
    const card = document.createElement('div');
    card.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:0.35rem',
      'background:rgba(234,179,8,0.07)',
      'border:1px solid rgba(234,179,8,0.25)',
      'border-left:5px solid #eab308',
      'border-radius:8px', 'padding:0.45rem 0.7rem', 'flex-shrink:0',
    ].join(';');

    // Top row: phenomenon + code badge
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem';

    const phenomenon = document.createElement('span');
    phenomenon.style.cssText = 'font-size:clamp(1.1rem,2vw,1.6rem);font-weight:600;color:var(--color-text);text-transform:capitalize;line-height:1.1';
    phenomenon.textContent = 'Wind';

    const badge = document.createElement('div');
    badge.style.cssText = 'background:#eab30822;border:1px solid #eab30855;border-radius:5px;padding:0.2rem 0.5rem;flex-shrink:0';
    const badgeText = document.createElement('span');
    badgeText.style.cssText = 'font-size:clamp(0.7rem,1.2vw,0.95rem);font-weight:700;color:#eab308;text-transform:uppercase;letter-spacing:0.1em';
    badgeText.textContent = 'Code geel';
    badge.appendChild(badgeText);

    top.appendChild(phenomenon);
    top.appendChild(badge);
    card.appendChild(top);

    // Region
    const region = document.createElement('span');
    region.style.cssText = 'font-size:clamp(0.9rem,1.6vw,1.3rem);color:var(--color-muted);line-height:1.3';
    region.textContent = 'Noord-Holland · Flevoland';
    card.appendChild(region);

    // Description
    const desc = document.createElement('span');
    desc.style.cssText = 'font-size:clamp(0.9rem,1.6vw,1.3rem);color:var(--color-text);opacity:0.75;line-height:1.4';
    desc.textContent = 'Windstoten 75–90 km/u langs de kust en in open gebieden.';
    card.appendChild(desc);

    // Valid until
    const until = document.createElement('span');
    until.style.cssText = 'font-size:clamp(0.7rem,1.2vw,0.95rem);color:#eab308;opacity:0.8;margin-top:0.05rem';
    const exp = new Date(Date.now() + 7200000);
    const hhmm = exp.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    until.textContent = 'Geldig tot ' + hhmm;
    card.appendChild(until);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;overflow:hidden;flex:1;min-height:0';
    list.appendChild(card);
    shell.appendChild(list);
  })();
`;

// ── Main ───────────────────────────────────────────────────────────────────────

(async () => {
  // Sanity-check that the dev server is reachable
  try {
    const { default: http } = await import('http');
    await new Promise((resolve, reject) => {
      http.get(BASE_URL, res => resolve(res)).on('error', reject);
    });
  } catch {
    console.error(`\nError: cannot reach ${BASE_URL}`);
    console.error('Start the Vite dev server first:');
    console.error('  cd frontend && VITE_BACKEND_URL=http://192.168.101.252 npm run dev\n');
    process.exit(1);
  }

  console.log(`Launching headless browser at 1920×1080\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  // ── Display screenshots ────────────────────────────────────────────────────
  for (const { n, screen, mainSlot, bottomSlot, desc } of DISPLAY_SHOTS) {
    const outFile = path.join(OUT_DIR, `screenshot-${n}.png`);
    console.log(`[${n}/6] /?screen=${screen}  (${desc})`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 'load' not networkidle0 — the SSE stream keeps the network permanently busy
    await page.goto(`${BASE_URL}/?screen=${screen}`, {
      waitUntil: 'load',
      timeout: 25000,
    });

    // Wait for widgets + async data to render
    await new Promise(r => setTimeout(r, 4000));

    // Pin rotators to the desired widget positions
    await page.evaluate(rotatorScript(mainSlot, bottomSlot));

    // For the warnings slot: inject a fake warning card (no network interception)
    if (mainSlot === 3) {
      await page.evaluate(INJECT_WARNING_SCRIPT);
    }

    // Anonymise personal text in the DOM
    await page.evaluate(replaceScript(TEXT_REPLACEMENTS));

    // Let transitions settle
    await new Promise(r => setTimeout(r, 400));

    await page.screenshot({ path: outFile, type: 'png' });
    console.log(`       ✓ ${path.basename(outFile)}\n`);
    await page.close();
  }

  // ── Admin screenshot ───────────────────────────────────────────────────────
  console.log('[6/6] /#admin  (Screens tab)');

  const adminPage = await browser.newPage();
  await adminPage.setViewport({ width: 1920, height: 1080 });
  await adminPage.goto(`${BASE_URL}/#admin`, {
    waitUntil: 'load',
    timeout: 20000,
  });
  await new Promise(r => setTimeout(r, 2500));

  // Click the Screens tab
  await adminPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === 'Screens');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Anonymise names in admin panel
  await adminPage.evaluate(replaceScript(TEXT_REPLACEMENTS));

  await adminPage.screenshot({
    path: path.join(OUT_DIR, 'screenshot-6.png'),
    type: 'png',
  });
  console.log('       ✓ screenshot-6.png\n');
  await adminPage.close();

  await browser.close();
  console.log('Done — 6 screenshots saved to docs/screenshots/');
})().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
