/**
 * A floated company with a mining crew, a crew sinking a level, a prospecting
 * crew, and a second lease full of water with a pump on it.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentA-company.mjs --port 5199
 */
export const seed = 5;
export const viewports = ['desktop', 'phone-se'];
export const stops = [
  { name: 'books', keys: [] },
  { name: 'crews', keys: ['1'] },
  { name: 'ground', keys: ['0', '2'] },
];

export async function setup(d) {
  d.begin();
  d.state.location = 'deep-mountains';
  d.state.screen = 'company';
  d.state.day = 120;
  d.state.provisionDays = 200;
  d.state.standing = 60;
  d.state.moneyPence = 200 * 240;
  d.state.claims['deep-mountains'] = { richnessPct: 140, workedDays: 6, peggedOn: 40, proven: true };

  d.dispatch({ type: 'floatCompany', shares: 12 });
  d.dispatch({ type: 'hireCrew' });
  d.dispatch({ type: 'hireCrew' });
  d.dispatch({ type: 'hireCrew' });

  const c = d.state.company;
  c.treasuryPence = 120 * 240;
  c.leases[0].level = 2;
  c.leases[0].plan = 'sink';
  c.leases[0].progressCrewWeeks = 1;
  c.leases[0].pump = true;
  c.leases.push({
    name: 'the Morning Star',
    reefPct: 110,
    level: 1,
    faceCrewWeeks: 4,
    yieldNowPct: 110,
    wet: true,
    pump: true,
    timbered: false,
    flooded: true,
    progressCrewWeeks: 1,
    plan: null,
  });

  d.dispatch({ type: 'setCrewTask', index: 0, task: 'mine', lease: 0 });
  d.dispatch({ type: 'setCrewTask', index: 1, task: 'develop', lease: 0 });
  d.dispatch({ type: 'setCrewTask', index: 2, task: 'prospect' });
  d.state.screen = 'company';
}
