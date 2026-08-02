/**
 * The same game played by key alone, at a desk. Nothing done for the phone may
 * cost the keyboard anything.
 *   node scratch/keys.mjs [port]
 *
 * Playwright is not a project dependency (the game itself has none): run
 * `npm i -D playwright --no-save` first, or `npx playwright install chromium`.
 */
import { chromium } from 'playwright';

const PORT = process.argv[2] ?? '5175';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const fails = [];
const check = (ok, what) => { console.log(`${ok ? '  ok ' : '  NO '} ${what}`); if (!ok) fails.push(what); };
page.on('pageerror', (e) => fails.push(`page error: ${e.message}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.click('#screen');
const title = () => page.textContent('.gf-title');
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(50); } };

console.log('by key, at 1280x800:');
check(/SPACE BAR/.test(await page.textContent('.gf-body')), 'the title screen still names the SPACE BAR');
check(!(await page.locator('.gf-menu-note').first().isVisible()), 'flavour stays in the inspector line, not the rows');

await press('Space');
while (await page.locator('.gf-prompt').count()) await press('Space');
if (/NEW ARRIVALS/.test(await title())) { await press('Space'); while (await page.locator('.gf-prompt').count()) await press('Space'); }
check((await title()) === 'PORT GANNET', 'space bar carries a man ashore');

const before = await page.locator('.gf-menu-item.is-highlight').textContent();
await press('ArrowDown');
const after = await page.locator('.gf-menu-item.is-highlight').textContent();
check(before !== after && (await page.locator('.gf-menu-item.is-highlight').count()) === 1,
  'the arrows move the marker, and only one row wears it');
await press('Escape');
check((await page.textContent('.gf-overlay-title')) === 'MENU', 'ESC opens the menu');
check((await page.locator('.gf-overlay-close').count()) === 0, 'which needs no cross where there is an ESC');
await press('Escape');
await press('m');
check(/MAP/.test(await page.textContent('.gf-overlay-title')), 'M opens the map');
await press('x');
check((await page.locator('.gf-overlay-panel').count()) === 0, 'and any key shuts it');

check((await page.textContent('.gf-legend')).includes('menu'), 'the legend still teaches the keys');

// A store: the one place a menu is laid across two columns, which the left and
// right arrows must be able to cross — and no row of which may be printed over
// another, whatever height the box has been given.
await page.locator('.gf-menu-item', { hasText: "BELL'S OUTFITTERS" }).click();
await page.waitForTimeout(120);
check(await page.locator('.gf-menu--dense').count() === 1, 'a store lays its shelves across two columns');
const columnOf = () => page.evaluate(() => {
  const row = document.querySelector('.gf-menu-item.is-highlight');
  return row ? Math.round(row.getBoundingClientRect().left) : -1;
});
const leftCol = await columnOf();
await press('ArrowRight');
const rightCol = await columnOf();
check(rightCol > leftCol, 'the right arrow crosses to the far column');
await press('ArrowLeft');
check((await columnOf()) === leftCol, 'and the left arrow comes back');
const printedOver = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gf-menu-item')].map((r) => r.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      if (Math.min(b[i].right, b[j].right) - Math.max(b[i].left, b[j].left) > 2 &&
          Math.min(b[i].bottom, b[j].bottom) - Math.max(b[i].top, b[j].top) > 2) n++;
  return n;
});
check(printedOver === 0, `no article is printed over another (${printedOver} pairs overlap)`);

// The same glass changing size under the hand, which is not the same thing as
// two glasses of fixed size: a shelf laid out for one width and then given
// another has been known to keep the first layout, print its rows one over
// another, and still be doing it after the window was dragged back again.
const overlapCount = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('.gf-menu-item')].map((r) => r.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      if (Math.min(b[i].right, b[j].right) - Math.max(b[i].left, b[j].left) > 2 &&
          Math.min(b[i].bottom, b[j].bottom) - Math.max(b[i].top, b[j].top) > 2) n++;
  return n;
});
for (const size of [{ width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  check(await overlapCount() === 0, `dragged to ${size.width}x${size.height}, the shelves keep their own rows`);
}
await press('0');

// A game number, typed at the frame with nothing focused.
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.click('#screen');
await press('2');
check(/press RETURN/.test(await page.textContent('.gf-body')), 'the number screen still names RETURN');
await press('4'); await press('2');
check((await page.textContent('.gf-input-buffer')) === '42', 'digits typed at the frame reach the buffer once each');
await press('Backspace');
check((await page.textContent('.gf-input-buffer')) === '4', 'and backspace takes one off');
await press('Enter');
check(/No such game/.test(await page.textContent('.gf-input-error')), 'RETURN sends it');
await press('Escape');
check((await title()) === 'GOLDRUSH', 'ESC comes back to the title');

await ctx.close();
await browser.close();
console.log(fails.length ? `\nFAILED ${fails.length}: ${fails.join(' | ')}` : '\nthe keyboard is unharmed');
process.exit(fails.length ? 1 : 0);
