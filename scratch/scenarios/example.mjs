/**
 * Example scenario for scratch/shot.mjs: a flush digger standing in the
 * Ballarat-side camp store. Copy this file as a starting point.
 *
 *   node scratch/shot.mjs scratch/scenarios/example.mjs --vp desktop,phone-se
 *
 * setup() is stringified and run in the browser, so it must be self-contained:
 * everything it needs comes through `d` (the driver) and `engine`.
 */
export const seed = 7;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d, engine) {
  d.begin(); // new game, through the intro, standing at Suze Port

  // Direct state surgery is fine — the tool runs the result through the save
  // validator and fails loudly if a field is out of bounds.
  d.state.moneyPence = 240_000;
  d.state.health = 85;
  d.state.day = 40;

  // Or drive the real menus, exactly as a player would; press() throws with
  // the available keys/labels if you ask for something not on the screen.
  d.pressLabel('outfitters');

  // d.state is saved automatically; you may also return a state explicitly.
}
