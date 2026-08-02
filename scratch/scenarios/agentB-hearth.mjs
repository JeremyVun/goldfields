/**
 * A courtship in hand at Port Gannet: the hearth, the announced ball, and a
 * post-office counter with read mail behind it.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-hearth.mjs --screen ball --port 5198
 */
export const seed = 21;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d) {
  d.begin();
  d.state.location = 'suze-port';
  d.state.screen = 'hearth';
  d.state.day = 200;
  d.state.provisionDays = 40;
  d.state.standing = 60;
  d.state.moneyPence = 80 * 240;
  d.state.hearth.nextBallDay = 210;
  d.state.hearth.intended = {
    name: 'Ellen Doyle',
    trade: 'storekeeper',
    manner: 'plain speaking',
    metOn: 100,
    metAt: 'ball',
    callsKept: 2,
    lavishGifts: 0,
    lastGiftOn: 0,
  };
  d.state.hearth.rung = 'courting';
  d.state.hearth.nextEvent = { kind: 'call', openDay: 204, closeDay: 208, announced: true };
  d.state.hearth.letters = [
    { day: 150, text: 'She writes that the port is quiet and the work steady, and that her father asks after your claim as though he had a share in it.', tone: 'good', read: true },
    { day: 172, text: 'A second letter, in the same round hand, asking when you are next at the port and whether you have eaten a vegetable since Easter.', tone: 'neutral', read: true },
  ];
}
