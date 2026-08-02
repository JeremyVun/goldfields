/**
 * Slateford five days before the first subscription ball of the year: the hub
 * item, the ball screen ahead of the night, and the notice in the Times.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentA-ball.mjs --port 5199
 */
export const seed = 21;
export const viewports = ['desktop', 'phone-se'];
export const stops = [
  { name: 'hub', keys: [] },
  { name: 'ball', keys: ['U'] },
  { name: 'gazette', keys: ['0', '9'] },
  { name: 'lodgings', keys: ['0', 'L'] },
  { name: 'estate', keys: ['0', 'E'] },
];

export async function setup(d) {
  d.begin();
  d.state.location = 'fields-town';
  d.state.screen = 'ftown';
  d.state.day = 70;
  d.state.provisionDays = 60;
  d.state.standing = 40;
  d.state.moneyPence = 20 * 240;
  d.state.hearth.nextBallDay = 75;
}
