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
check((await title()) === 'SUZE PORT', 'space bar carries a man ashore');

const before = await page.locator('.gf-menu-item.is-highlight').textContent();
await press('ArrowDown');
const after = await page.locator('.gf-menu-item.is-highlight').textContent();
check(before !== after && (await page.locator('.gf-menu-item.is-highlight').count()) === 1,
  'the arrows move the marker, and only one row wears it');
await press('Escape');
check((await page.textContent('.gf-overlay-title')) === 'THE KITTY', 'ESC opens the kitty');
check((await page.locator('.gf-overlay-close').count()) === 0, 'which needs no cross where there is an ESC');
await press('Escape');
await press('m');
check(/MAP/.test(await page.textContent('.gf-overlay-title')), 'M opens the map');
await press('x');
check((await page.locator('.gf-overlay-panel').count()) === 0, 'and any key shuts it');

check((await page.textContent('.gf-legend')).includes('kitty'), 'the legend still teaches the keys');

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
check((await title()) === 'GOLDFIELDS', 'ESC comes back to the title');

await ctx.close();
await browser.close();
console.log(fails.length ? `\nFAILED ${fails.length}: ${fails.join(' | ')}` : '\nthe keyboard is unharmed');
process.exit(fails.length ? 1 : 0);
