/**
 * A digger a month into the field with money, kit and a claim — the state in
 * which the game's menus are at their longest (the camp, the camp store, and
 * the MENU overlay with every panel filled).
 *
 *   node scratch/shot.mjs scratch/scenarios/rich.mjs --vp tablet-land,desktop
 */
export const seed = 11;
export const viewports = ['phone-se', 'tablet-land', 'desktop'];
export const stops = [
  { name: 'camp', keys: [] },
  { name: 'menu', keys: ['Escape'] },
  { name: 'map', keys: ['Escape', 'm'] },
];

export async function setup(d) {
  d.begin();
  d.state.moneyPence = 480_000;
  d.state.health = 78;
  d.state.day = 34;
  d.state.location = 'damp-camp';
  d.state.screen = 'camp';
}
