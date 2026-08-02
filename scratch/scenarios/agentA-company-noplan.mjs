/**
 * The complaint case: a crew, a mine, and no development ordered — the develop
 * row must be shut and say why, and the books must not call the crew idle-free.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentA-company-noplan.mjs --port 5199
 */
export const seed = 5;
export const viewports = ['desktop'];
export const stops = [
  { name: 'noplan-crews', keys: ['1'] },
  { name: 'noplan-books', keys: ['0'] },
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
  d.state.company.treasuryPence = 120 * 240;
  d.state.company.leases[0].level = 1;
  d.dispatch({ type: 'setCrewTask', index: 0, task: 'mine', lease: 0 });
  d.dispatch({ type: 'setCrewTask', index: 1, task: 'develop', lease: 0 });
  d.state.screen = 'company';
}
