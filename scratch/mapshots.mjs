/** Photographs scratch/shots-map/states-*.html, one picture per sheet. */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 });
for (const theme of process.argv.slice(2)) {
  await page.goto(`file://${process.cwd()}/scratch/shots-map/states-${theme}.html`);
  const figs = await page.locator('figure').all();
  for (const [i, fig] of figs.entries()) {
    await fig.screenshot({ path: `scratch/shots-map/state-${theme}-${i}.png` });
  }
}
await browser.close();
