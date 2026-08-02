/**
 * The books of a floated company: three crews, two mines, a quarter of weekly
 * figures ruled off in columns.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-company.mjs --port 5198
 */
export const seed = 5;
export const viewports = ['desktop', 'phone-se'];
export const stops = [
  { name: 'books', keys: [] },
  { name: 'crews', keys: ['1'] },
  { name: 'mines', keys: ['0', '2'] },
];

export async function setup(d) {
  d.begin();
  d.state.location = 'deep-mountains';
  d.state.screen = 'company';
  d.state.day = 150;
  d.state.provisionDays = 200;
  d.state.standing = 60;
  d.state.moneyPence = 200 * 240;
  d.state.claims['deep-mountains'] = { richnessPct: 140, workedDays: 6, peggedOn: 40, proven: true };

  d.dispatch({ type: 'floatCompany', shares: 12 });
  d.dispatch({ type: 'hireCrew' });
  d.dispatch({ type: 'hireCrew' });

  const c = d.state.company;
  c.treasuryPence = 140 * 240;
  c.weekProfitPence = [-1200, 400, 9600, -800, 2400, 14400];
  c.lastWeekGoldCentiOz = 640;
  c.leases[0].level = 2;
  c.leases[0].plan = 'sink';
  c.leases[0].progressCrewWeeks = 1;
  d.dispatch({ type: 'setCrewTask', index: 0, task: 'mine', lease: 0 });
  d.dispatch({ type: 'setCrewTask', index: 1, task: 'develop', lease: 0 });
  d.state.screen = 'company';
}
