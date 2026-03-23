#!/usr/bin/env python3
"""
wall-cast screenshot generator  (Python + Playwright)

Usage:
    python docs/screenshots/make_screenshots.py

First time setup:
    pip install playwright
    playwright install chromium

Connects directly to the live VPS — no Vite dev server needed.

What it does:
  1. Navigates to each screen URL on the live VPS (http://192.168.101.252)
  2. Pins the rotator widget to a specific slot so every widget type appears
  3. Injects anonymisation JS: replaces PII text, LAN IPs, and public IPs
  4. Takes a 1920×1080 screenshot
  5. Produces 6 PNGs:   screenshot-{1-4}.png  (display screens)
                        screenshot-5.png       (landing page)
                        screenshot-6.png       (admin panel, Screens tab)

Rotator slot reference (update if widget order changes in wall-cast.yaml):
    main   rotator (right/large):  0=weather  1=calendar  2=traffic  3=warnings
    bottom rotator (left/small):   0=rain     1=garbage   2=polestar  3=bus
"""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

# ── Configuration ──────────────────────────────────────────────────────────────

BASE_URL = "http://192.168.101.252"
OUT_DIR  = Path(__file__).parent

# 4 display screenshots — each covers a different pair of widgets
DISPLAY_SHOTS = [
    dict(n=1, screen="living-room", main_slot=0, bottom_slot=0, desc="weather + rain"),
    dict(n=2, screen="kids-room",   main_slot=1, bottom_slot=1, desc="calendar + garbage"),
    dict(n=3, screen="office",      main_slot=2, bottom_slot=2, desc="traffic + polestar"),
    dict(n=4, screen="bedroom",     main_slot=3, bottom_slot=3, desc="warnings (injected) + bus"),
]

# ── Anonymisation ──────────────────────────────────────────────────────────────
# Extend this list when new personal content appears. Order matters: more
# specific strings first to avoid partial-match collisions.

TEXT_REPLACEMENTS = [
    # ── Person names ──
    ("Niels",    "Liam"),
    ("Sophie",   "Emma"),
    # ── Calendar event titles ──
    ("Delivery G medicine",  "Pick up prescription"),
    ("Bring back books",     "Library return due"),
    ("Genesis dance class",  "Evening yoga class"),
    ("Orthodontist",         "Doctor appointment"),
    ("School trip",          "Field trip"),
    # ── Street addresses ──
    ("Keizersgracht", "Main Street"),
    ("Prinsengracht",  "Park Avenue"),
    # ── Bus stop names ──
    ("Polakkenbrug",   "Leidseplein"),
    ("Rembrandtplein", "Leidseplein"),
    # ── LAN IPs from the VPS subnet (192.168.101.x → anonymised subnet) ──
    ("192.168.101.", "192.168.1."),
]

# Public IPv4s shown in the network widget are replaced by a documentation-
# range address (RFC 5737). Any non-RFC-1918 / non-loopback IP qualifies.
FAKE_PUBLIC_IP = "203.0.113.42"

# ── JavaScript helpers ─────────────────────────────────────────────────────────

# Receives [mainSlot, bottomSlot] as arg; pins both rotators to those indices.
ROTATOR_JS = """
([mainSlot, bottomSlot]) => {
  const rotators = Array.from(document.querySelectorAll('div')).filter(d => {
    const kids = Array.from(d.children);
    return kids.length >= 3 && kids.every(k => k.style.position === 'absolute');
  });
  function pin(el, idx) {
    Array.from(el.children).forEach((k, i) => {
      k.style.opacity = String(i === idx ? 1 : 0);
      k.style.transition = 'none';
    });
  }
  if (rotators[0]) pin(rotators[0], mainSlot);
  if (rotators[1]) pin(rotators[1], bottomSlot);
}
"""

# Receives [pairs, fakePublicIp] as arg; replaces text nodes and input values.
REPLACE_JS = """
([pairs, fakePublicIp]) => {
  const PUBLIC_IP_RE = /\\b(?!(?:10\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.|192\\.168\\.|127\\.))(?:\\d{1,3}\\.){3}\\d{1,3}\\b/g;

  function sub(str) {
    for (const [from, to] of pairs) {
      if (str.includes(from)) str = str.split(from).join(to);
    }
    return str.replace(PUBLIC_IP_RE, fakePublicIp);
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
}
"""

# Injects a fake KNMI yellow-code wind warning into rotator slot 3 (index 3).
# The WarningsWidget renders opacity:0 when there are no active warnings —
# this script makes the slot visible and inserts a realistic-looking card.
INJECT_WARNING_JS = """
() => {
  const rotators = Array.from(document.querySelectorAll('div')).filter(d => {
    const kids = Array.from(d.children);
    return kids.length >= 3 && kids.every(k => k.style.position === 'absolute');
  });
  const slot = rotators[0] && rotators[0].children[3];
  if (!slot) return;

  slot.style.opacity = '1';
  const shell = slot.firstElementChild;
  if (!shell) return;
  shell.style.opacity = '1';
  while (shell.children.length > 1) shell.removeChild(shell.lastChild);

  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.07);flex-shrink:0;margin:0';
  shell.appendChild(divider);

  const card = document.createElement('div');
  card.style.cssText = [
    'display:flex','flex-direction:column','gap:0.35rem',
    'background:rgba(234,179,8,0.07)',
    'border:1px solid rgba(234,179,8,0.25)',
    'border-left:5px solid #eab308',
    'border-radius:8px','padding:0.45rem 0.7rem','flex-shrink:0',
  ].join(';');

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

  const region = document.createElement('span');
  region.style.cssText = 'font-size:clamp(0.9rem,1.6vw,1.3rem);color:var(--color-muted);line-height:1.3';
  region.textContent = 'Noord-Holland · Flevoland';
  card.appendChild(region);

  const desc = document.createElement('span');
  desc.style.cssText = 'font-size:clamp(0.9rem,1.6vw,1.3rem);color:var(--color-text);opacity:0.75;line-height:1.4';
  desc.textContent = 'Windstoten 75–90 km/u langs de kust en in open gebieden.';
  card.appendChild(desc);

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
}
"""


# ── Main ───────────────────────────────────────────────────────────────────────

async def anonymise(page) -> None:
    """Replace PII text, LAN IPs, and public IPs across the entire DOM."""
    await page.evaluate(REPLACE_JS, [TEXT_REPLACEMENTS, FAKE_PUBLIC_IP])


async def main() -> None:
    print(f"Connecting to {BASE_URL} …\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})

        # ── Display screenshots 1–4 ────────────────────────────────────────────
        for shot in DISPLAY_SHOTS:
            n          = shot["n"]
            screen     = shot["screen"]
            main_slot  = shot["main_slot"]
            bottom_slot = shot["bottom_slot"]
            desc       = shot["desc"]
            out        = OUT_DIR / f"screenshot-{n}.png"

            print(f"[{n}/6] /?screen={screen}  ({desc})")

            page = await context.new_page()
            await page.goto(f"{BASE_URL}/?screen={screen}", wait_until="load", timeout=30000)
            await page.wait_for_timeout(4000)           # let async data render

            await page.evaluate(ROTATOR_JS, [main_slot, bottom_slot])
            if main_slot == 3:                           # warnings slot needs a fake card
                await page.evaluate(INJECT_WARNING_JS)

            await anonymise(page)
            await page.wait_for_timeout(400)            # let transitions settle

            await page.screenshot(path=str(out), type="png")
            print(f"       ✓ {out.name}\n")
            await page.close()

        # ── Landing page (5) ──────────────────────────────────────────────────
        print("[5/6] /  (landing page)")
        page = await context.new_page()
        await page.goto(BASE_URL, wait_until="load", timeout=20000)
        await page.wait_for_timeout(2500)
        await anonymise(page)
        await page.screenshot(path=str(OUT_DIR / "screenshot-5.png"), type="png")
        print("       ✓ screenshot-5.png\n")
        await page.close()

        # ── Admin panel — Screens tab (6) ──────────────────────────────────────
        print("[6/6] /#admin  (Screens tab)")
        page = await context.new_page()
        await page.goto(f"{BASE_URL}/#admin", wait_until="load", timeout=20000)
        await page.wait_for_timeout(2500)
        await page.evaluate("""() => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => b.textContent.trim() === 'Screens');
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)
        await anonymise(page)
        await page.screenshot(path=str(OUT_DIR / "screenshot-6.png"), type="png")
        print("       ✓ screenshot-6.png\n")
        await page.close()

        await browser.close()

    print(f"All done — 6 screenshots saved to {OUT_DIR}/")


if __name__ == "__main__":
    asyncio.run(main())
