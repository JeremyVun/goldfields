/**
 * The longest menu in the game — Bell's outfitters at Port Gannet, twenty-odd
 * articles with warnings on several of them — which is where the two-column
 * layout, the row heights and the alert wrapping all get their hardest test.
 *
 *   node scratch/shot.mjs scratch/scenarios/store.mjs --vp all
 */
export const seed = 3;
export const viewports = ['phone-se', 'tablet', 'tablet-land', 'desktop', 'desktop-wide'];

export async function setup(d) {
  d.begin(); // new game, through the intro, standing at the port
  d.pressLabel('outfitters');
}
