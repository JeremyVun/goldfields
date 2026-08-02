/**
 * Plays the game by finger alone — no key is pressed anywhere in this script.
 * Everything a player must be able to do on a phone has to be reachable here.
 *   node scratch/touch.mjs [port]
 *
 * Playwright is not a project dependency (the game itself has none): run
 * `npm i -D playwright --no-save` first, or `npx playwright install chromium`.
 */
import { chromium } from 'playwright';

const PORT = process.argv[2] ?? '5175';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const fails = [];
const check = (ok, what) => {
  console.log(`${ok ? '  ok ' : '  NO '} ${what}`);
  if (!ok) fails.push(what);
};

page.on('pageerror', (e) => fails.push(`page error: ${e.message}`));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

const title = () => page.textContent('.gf-title');
const rowByText = (text) => page.locator('.gf-menu-item', { hasText: text }).first();

console.log('by finger, on a 393x852 glass:');

// The title screen tells a player with no keyboard what to do, and the doing works.
check(/touch/i.test(await page.textContent('.gf-body')), 'title screen says how to start by touch');
await rowByText('BEGIN A NEW GAME').tap();
await page.waitForTimeout(200);
// The title is held as a backdrop while a tale is told, so the tale itself is
// the sign that the tap was taken.
check(await page.locator('.gf-prompt').count() === 1, 'a new game begins from a tap');

// Narration is paged by tapping the page, and the landing taken by tapping a row.
for (let i = 0; i < 30 && (await page.locator('.gf-prompt').count()); i++) {
  await page.locator('.gf-prompt').tap();
  await page.waitForTimeout(60);
}
if (/NEW ARRIVALS/.test(await title())) {
  check(/touch/i.test(await page.textContent('.gf-menu')), 'the way ashore is put in touchable words');
  await page.locator('.gf-menu-item').first().tap();
  await page.waitForTimeout(200);
  for (let i = 0; i < 30 && (await page.locator('.gf-prompt').count()); i++) {
    await page.locator('.gf-prompt').tap();
    await page.waitForTimeout(60);
  }
}
check((await title()) === 'PORT GANNET', 'the arrival is paged through by tapping');

// The flavour of a choice can be read before the choice is taken.
check(
  (await page.locator('.gf-menu-note').first().isVisible()) &&
    !(await page.locator('.gf-inspector').first().isVisible()),
  'flavour is in the rows, not in the inspector line',
);

// The menu and the map, which have no key to press.
await page.locator('.gf-legend-act', { hasText: 'MENU' }).tap();
check((await page.textContent('.gf-overlay-title')) === 'MENU', 'the menu opens from the foot of the glass');
await page.locator('.gf-overlay-close').tap();
check((await page.locator('.gf-overlay-panel').count()) === 0, 'and shuts again from the cross');

await page.locator('.gf-legend-act', { hasText: 'MAP' }).tap();
check(/MAP/.test(await page.textContent('.gf-overlay-title')), 'the map opens the same way');
// The chart module is fetched on first opening; the prose follows it in.
check(
  await page.locator('.gf-map-prose').waitFor({ timeout: 5000 }).then(() => true, () => false),
  'and the drawing is there to read',
);
await page.locator('.gf-overlay-close').tap();

// Shopping: a store row, and back again.
await rowByText("BELL'S OUTFITTERS").tap();
check(/BELL/.test(await title()), 'a shop opens');
// Every article on the shelves must be reachable, not laid off the edge of the
// frame where a finger cannot follow it.
const shelves = await page.evaluate(() => {
  const menu = document.querySelector('.gf-menu');
  const box = menu.getBoundingClientRect();
  const rows = [...document.querySelectorAll('.gf-menu-item')];
  const strays = rows.filter((r) => {
    const b = r.getBoundingClientRect();
    return b.right > box.right + 1 || b.left < box.left - 1;
  });
  return { rows: rows.length, strays: strays.length, scrolls: menu.scrollHeight > menu.clientHeight };
});
check(shelves.strays === 0, `no row is laid off sideways (${shelves.rows} rows, ${shelves.strays} astray)`);
await page.locator('.gf-menu-item').last().scrollIntoViewIfNeeded();
check(await page.locator('.gf-menu-item').last().isVisible(), 'the last of them can be scrolled to');
await rowByText('A TIN PAN').tap();
await page.waitForTimeout(100);
while (await page.locator('.gf-prompt').count()) {
  await page.locator('.gf-prompt').tap();
  await page.waitForTimeout(60);
}
check(/·\s*2s\s*·/.test(await page.textContent('.gf-status-line')), 'a purchase is paid for (8s of 10s gone)');
check(/BELL/.test(await title()), 'and leaves the player at the counter');

// Putting the game down, and taking it up again by its number — the one place
// the frame must ask the glass for a keypad of its own.
await page.locator('.gf-menu-item', { hasText: 'BACK' }).last().tap();
await page.locator('.gf-legend-act', { hasText: 'MENU' }).tap();
await page.locator('.gf-menu-item', { hasText: 'SAVE' }).first().tap();
await page.waitForTimeout(200);
const saved = (await page.textContent('.gf-body')).match(/number (\d+)/);
check(!!saved, 'the game is put down under a number');
while (await page.locator('.gf-prompt').count()) {
  await page.locator('.gf-prompt').tap();
  await page.waitForTimeout(60);
}

await page.reload({ waitUntil: 'networkidle' });
await rowByText('TAKE UP A SAVED GAME').tap();
await page.waitForTimeout(150);
check(!/press RETURN/i.test(await page.textContent('.gf-body')), 'the number screen names no key that is not there');
await page.locator('.gf-input-row').tap();
check(
  await page.evaluate(() => document.activeElement?.classList.contains('gf-input-field')),
  'touching the row asks the glass for its keypad',
);
await page.locator('.gf-input-field').fill(saved ? saved[1] : '0');
await page.waitForTimeout(80);
check(
  (await page.textContent('.gf-input-buffer')) === (saved ? saved[1] : '0'),
  'the digits are drawn under the block cursor as they are typed',
);
await rowByText('TAKE IT UP').tap();
await page.waitForTimeout(250);
while (await page.locator('.gf-prompt').count()) {
  await page.locator('.gf-prompt').tap();
  await page.waitForTimeout(60);
}
check(/·\s*2s\s*·/.test(await page.textContent('.gf-status-line')), 'and the game comes back as it was left');

await ctx.close();
await browser.close();

console.log(fails.length ? `\nFAILED ${fails.length}: ${fails.join(' | ')}` : '\nall touch paths good');
process.exit(fails.length ? 1 : 0);
