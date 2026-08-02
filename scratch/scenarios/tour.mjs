/**
 * The layout-stress tour (successor to the old shots.mjs): one run photographs
 * the screens that squeeze the frame hardest, at every viewport.
 *
 *   node scratch/shot.mjs scratch/scenarios/tour.mjs --vp all
 */
export const seed = 3;
export const viewports = ['desktop', 'phone-se', 'phone-land', 'tablet'];

export async function setup(d) {
  d.begin(); // Suze Port
}

export const stops = [
  { name: '1-port', keys: [] },
  { name: '2-store', keys: ['2'] },
  { name: '3-menu', keys: ['Escape'] },
  { name: '4-map', keys: ['Escape', 'm'] },
];
