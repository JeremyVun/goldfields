/**
 * A new chum ashore at Port Gannet, with enough in his pocket to visit every
 * counter on Main Street.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-port.mjs --screen suze --port 5198
 */
export const seed = 3;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d) {
  d.begin();
  d.state.location = 'suze-port';
  d.state.screen = 'suze';
  d.state.day = 12;
  d.state.provisionDays = 20;
  d.state.moneyPence = 30 * 240;
}
