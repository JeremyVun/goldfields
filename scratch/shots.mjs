/**
 * Screenshot harness for the responsiveness review. Not part of the build.
 *   node scratch/shots.mjs [outdir] [port]
 *
 * Playwright is not a project dependency (the game itself has none): run
 * `npm i -D playwright --no-save` first, or `npx playwright install chromium`.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'scratch/shots';
const PORT = process.argv[3] ?? '5175';
const URL = `http://localhost:${PORT}/`;

const VIEWPORTS = [
  { name: 'phone-se', width: 375, height: 667, dsf: 2, touch: true },
  { name: 'phone-tall', width: 393, height: 852, dsf: 3, touch: true },
  { name: 'phone-land', width: 852, height: 393, dsf: 3, touch: true },
  { name: 'tablet', width: 768, height: 1024, dsf: 2, touch: true },
  { name: 'desktop', width: 1280, height: 800, dsf: 1, touch: false },
];

/** A tour of the screens that stress the layout hardest. */
const TOUR = [
  { name: '01-title', keys: [] },
  { name: '02-narration', keys: ['1'] },
  { name: '03-intro', keys: ['x9:Space'] },
  { name: '04-port', keys: ['Space'] },
  { name: '05-store', keys: ['2'] },
  { name: '06-menu', keys: ['Escape'] },
  { name: '07-map', keys: ['Escape', 'm'] },
  { name: '08-mine', keys: ['Escape', '0', 'G'] },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log(`[${vp.name}] ${m.text()}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('#screen');

  for (const stop of TOUR) {
    for (const k of stop.keys) {
      const m = /^x(\d+):(.*)$/.exec(k);
      const [times, key] = m ? [Number(m[1]), m[2]] : [1, k];
      for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        await page.waitForTimeout(40);
      }
    }
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${OUT}/${vp.name}-${stop.name}.png` });
  }
  await ctx.close();
  console.log(`shot ${vp.name}`);
}

await browser.close();
