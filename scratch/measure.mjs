/**
 * Measures the things a responsiveness review actually turns on: tap-target
 * size, type size, and whether anything is clipped or overflowing.
 *   node scratch/measure.mjs [port]
 *
 * Playwright is not a project dependency (the game itself has none): run
 * `npm i -D playwright --no-save` first, or `npx playwright install chromium`.
 */
import { chromium } from 'playwright';

const PORT = process.argv[2] ?? '5175';
const URL = `http://localhost:${PORT}/`;

const VIEWPORTS = [
  { name: 'phone-se  375x667', width: 375, height: 667, touch: true },
  { name: 'phone-tall 393x852', width: 393, height: 852, touch: true },
  { name: 'phone-land 852x393', width: 852, height: 393, touch: true },
  { name: 'tablet    768x1024', width: 768, height: 1024, touch: true },
  { name: 'desktop  1280x800', width: 1280, height: 800, touch: false },
];

const STOPS = [
  { name: 'title', keys: [] },
  { name: 'port', keys: ['1', 'x9:Space', 'Space'] },
  { name: 'store', keys: ['2'] },
  { name: 'menu', keys: ['Escape'] },
  { name: 'map', keys: ['Escape', 'm'] },
];

const probe = () => {
  const px = (n) => Math.round(n * 10) / 10;
  const fs = (sel) => {
    const e = document.querySelector(sel);
    return e ? px(parseFloat(getComputedStyle(e).fontSize)) : null;
  };
  const rows = [...document.querySelectorAll('.gf-menu-item')];
  const heights = rows.map((r) => r.getBoundingClientRect().height);
  const clipped = [...document.querySelectorAll('.gf-menu, .gf-overlay-panel')]
    .filter((e) => e.scrollHeight > e.clientHeight + 1)
    .map((e) => `${e.className.split(' ')[0]}(+${Math.round(e.scrollHeight - e.clientHeight)}px)`);
  const doc = document.documentElement;
  return {
    rows: rows.length,
    minRowH: heights.length ? px(Math.min(...heights)) : null,
    medRowH: heights.length ? px(heights.sort((a, b) => a - b)[heights.length >> 1]) : null,
    menuFs: fs('.gf-menu-item'),
    proseFs: fs('.gf-para'),
    titleFs: fs('.gf-title'),
    statusFs: fs('.gf-status'),
    inspFs: fs('.gf-inspector'),
    mapFs: fs('.gf-map'),
    clipped,
    hScroll: doc.scrollWidth > doc.clientWidth + 1,
  };
};

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('#screen');
  console.log(`\n=== ${vp.name} ===`);
  for (const stop of STOPS) {
    for (const k of stop.keys) {
      const m = /^x(\d+):(.*)$/.exec(k);
      const [times, key] = m ? [Number(m[1]), m[2]] : [1, k];
      for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        await page.waitForTimeout(30);
      }
    }
    await page.waitForTimeout(100);
    const r = await page.evaluate(probe);
    const flags = [];
    if (r.minRowH !== null && r.minRowH < 44) flags.push(`TAP ${r.minRowH}px`);
    if (r.clipped.length) flags.push(`CLIP ${r.clipped.join(',')}`);
    if (r.hScroll) flags.push('HSCROLL');
    console.log(
      `  ${stop.name.padEnd(6)} rows=${String(r.rows).padStart(2)} row=${String(r.medRowH).padStart(5)}px ` +
        `menu=${r.menuFs} prose=${r.proseFs} title=${r.titleFs} status=${r.statusFs} insp=${r.inspFs} map=${r.mapFs}` +
        (flags.length ? `  << ${flags.join(' | ')}` : ''),
    );
  }
  await ctx.close();
}
await browser.close();
