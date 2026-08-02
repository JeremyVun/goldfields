/**
 * A licensed digger standing in Bell Street, with money enough for every
 * counter in Slateford. Used to read the reflowed town prose.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-town.mjs --screen ftown --port 5198
 */
export const seed = 4;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d) {
  d.begin();
  d.state.location = 'fields-town';
  d.state.screen = 'ftown';
  d.state.day = 60;
  d.state.provisionDays = 40;
  d.state.moneyPence = 60 * 240;
  d.state.standing = 45;
  d.state.licenceUntilDay = 90;
  d.state.goldCentiOz = 340;
}
