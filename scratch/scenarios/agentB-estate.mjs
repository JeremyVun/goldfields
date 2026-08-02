/**
 * A man of property in Slateford: the house, a store, a half-share in the
 * Times, a funded bridge and a seat on the bench.
 *
 *   node scratch/shot.mjs scratch/scenarios/agentB-estate.mjs --screen estate --port 5198
 */
export const seed = 9;
export const viewports = ['desktop', 'phone-se'];

export async function setup(d) {
  d.begin();
  d.state.location = 'fields-town';
  d.state.screen = 'estate';
  d.state.day = 300;
  d.state.provisionDays = 40;
  d.state.standing = 80;
  d.state.moneyPence = 400 * 240;
  d.state.licenceUntilDay = 330;
  d.state.estate.shamrock = true;
  d.state.estate.gazetteShare = true;
  d.state.estate.store = { camp: 'damp-camp', policy: 'fair', openedOn: 100 };
  d.state.estate.works = [{ id: 'bridge', day: 200 }];
  d.state.estate.jpSinceDay = 250;
  d.state.estate.nextCourtDay = 300;
}
