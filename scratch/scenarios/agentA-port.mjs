/**
 * A single man at Port Gannet looking for somewhere to live.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentA-port.mjs --port 5199
 */
export const seed = 23;
export const viewports = ['desktop', 'phone-se'];
export const stops = [
  { name: 'port-hub', keys: [] },
  { name: 'port-lodgings', keys: ['3'] },
];

export async function setup(d) {
  d.begin();
  d.state.day = 70;
  d.state.standing = 40;
  d.state.moneyPence = 20 * 240;
  d.state.hearth.nextBallDay = 75;
}
