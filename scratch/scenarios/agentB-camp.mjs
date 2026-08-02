/**
 * A digger at Reedbank Camp with pegs in the ground and a shaft down.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-camp.mjs --screen camp --port 5198
 */
export const seed = 6;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d) {
  d.begin();
  d.state.location = 'damp-camp';
  d.state.screen = 'camp';
  d.state.day = 70;
  d.state.provisionDays = 30;
  d.state.moneyPence = 20 * 240;
  d.state.licenceUntilDay = 100;
  d.state.claims['damp-camp'] = { richnessPct: 120, workedDays: 4, peggedOn: 50, proven: true, registered: true };
  d.state.items = { ...d.state.items, pan: 1, pick: 1, shovel: 1, cradle: 1, tent: 1 };
}
