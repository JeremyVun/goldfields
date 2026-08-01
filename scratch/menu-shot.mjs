/**
 * One-off: photograph the menu overlay at a state rich enough to fill it.
 *   node scratch/menu-shot.mjs [outdir] [port]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'scratch/shots';
const PORT = process.argv[3] ?? '5175';
const URL = `http://localhost:${PORT}/`;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, dsf: 1, touch: false },
  { name: 'small-desktop', width: 1024, height: 700, dsf: 1, touch: false },
  { name: 'short-desktop', width: 1100, height: 560, dsf: 1, touch: false },
  { name: 'phone-tall', width: 393, height: 852, dsf: 2, touch: true },
  { name: 'phone-land', width: 852, height: 393, dsf: 2, touch: true },
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
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const { app, createInitialState } = window.__gf;
    const s = createInitialState(41);
    s.day = 34;
    s.screen = 'camp';
    s.location = 'damp-camp';
    s.moneyPence = 5411;
    s.bankPence = 92000;
    s.goldCentiOz = 349;
    s.items = { ...s.items, pan: 1, cradle: 1, pick: 1, shovel: 1, tent: 1, swag: 1, gun: 1, waterBags: 1, ropeBucket: 1 };
    s.gunLoaded = true;
    s.provisionDays = 1;
    s.waterDays = 4;
    s.health = 42;
    s.illness = { id: 'dysentery', severity: 2, since: 30 };
    s.licenceDaysLeft = 8;
    s.hasLicence = true;
    s.standing = 11.25;
    s.employment = { job: 'wharf', daysServed: 4, since: 12 };
    s.claims = { ...s.claims, 'damp-camp': { quality: 110, workedDays: 3, peggedOn: 30, proven: false } };
    s.salvage = 1;
    s.shaft = { camp: 'damp-camp', depth: 22, bottomed: false, timbered: true, pumped: false };
    app.state = s;
    app.render();
    app.openOverlay('menu');
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/menu-${vp.name}.png` });
  // Is anything hidden below the fold?
  const overflow = await page.evaluate(() => {
    const p = document.querySelector('.gf-overlay-panel');
    return { scrollH: p.scrollHeight, clientH: p.clientHeight };
  });
  console.log(vp.name, JSON.stringify(overflow), overflow.scrollH > overflow.clientH + 1 ? 'SCROLLS' : 'fits');
  await ctx.close();
}

await browser.close();
