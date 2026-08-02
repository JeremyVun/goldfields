/** The civic ladder: deeds, the paper, public works and the Bench (§26-§28). */

import { purse } from '../company';
import {
  CAMP_DEFS,
  GAZETTE_SHARE_PRICE,
  JP_FEE,
  SHAMROCK_PRICE,
  STORE_PRICE,
  STORE_STOCK_PRICE,
  STORY_COOLDOWN_DAYS,
  WORK_DEFS,
} from '../constants';
import {
  canTakeCommission,
  commissionRequirements,
  courtDocket,
  courtDue,
  daysToNextStory,
  estateDeeds,
  estateWeeklyIncome,
  gazetteRequirements,
  shamrockRequirements,
  storeRequirements,
  storyDue,
  WORK_NAMES,
} from '../estate';
import { formatMoney } from '../money';
import { inAftermath, isCamp } from '../state';
import { formatDate } from '../time';
import type { CampId, GameState, MenuItem, ScreenView, WorkId } from '../types';
import { item, back, homeScreenFor } from './shared';

/**
 * The way onto the civic ladder, offered at every hub the way the dark one is
 * (§26). A man with nothing sees what the deeds would cost him.
 */
export function estateEntry(state: GameState, key: string): MenuItem | null {
  const e = state.estate;
  if (isCamp(state.location) && e.store && e.store.camp !== state.location) return null;
  const held = estateDeeds(state).length + e.works.length;
  const localStore = isCamp(state.location) && e.store?.camp === state.location;
  return item(
    key,
    localStore
      ? `Your store at ${CAMP_DEFS[state.location as CampId].name}`
      : isCamp(state.location) && !e.store
        ? `Open a store at ${CAMP_DEFS[state.location as CampId].name}`
        : held > 0
          ? 'Your property in the district'
          : 'What a man of property may buy here',
    { type: 'goto', screen: 'estate' },
    e.jpSinceDay !== null
      ? 'deeds, public works, and the business of the Bench'
      : held > 0
        ? 'deeds, the store\'s prices, and the paper'
        : 'a hotel, a store, a half-share in the Times; standing buys what money cannot',
  );
}

/**
 * The house itself, offered where the house stands (§26). The one deed a man
 * buys at a bar: Mrs. Doyle names her price, and afterwards the same key opens
 * his own books rather than a second door to the same room.
 */
export function shamrockEntry(state: GameState, key: string): MenuItem {
  if (state.estate.shamrock) {
    return item(
      key,
      'The house is yours — the books, and the rest of your property',
      { type: 'goto', screen: 'estate' },
      'Mrs. Doyle keeps the bar; the takings are settled of a Sunday',
    );
  }
  const unmet = shamrockRequirements(state).filter((r) => !r.met);
  return item(
    key,
    `Ask Mrs. Doyle what she wants for the house — ${formatMoney(SHAMROCK_PRICE)}`,
    { type: 'buyShamrock' },
    unmet.length === 0
      ? 'she stays on to run it; every rumour on this field crosses that bar'
      : `wants ${unmet[0].text}`,
    unmet.length > 0,
  );
}

/** What the public-works list strikes out of the world's dice (§27). */
const WORK_NOTES: Record<WorkId, string> = {
  bridge: 'no more bogging or flood-crossing on the Reedbank Camp road, for you or any bullocky on it',
  waterRace: 'summer halved at that camp, the Sandy Blight struck out, puddling the year round, and the ground goes off slower',
  ward: 'treatment free to its benefactor and half-price to the field; less dysentery and typhoid at every camp',
  school: 'no return whatever, this year; in the next, a lad off the school benches worth ten hired mates',
};

/**
 * Public works, the commission and the monthly court, added at the
 * foot of the Chambers menu (§27, §28.1).
 */
export function civicCouncilItems(state: GameState): MenuItem[] {
  const out: MenuItem[] = [];
  const money = purse(state);
  const works: [string, WorkId, CampId | undefined][] = [
    ['4', 'bridge', undefined],
    ['5', 'waterRace', 'damp-camp'],
    ['6', 'waterRace', 'snakey-gully'],
    ['7', 'waterRace', 'deep-mountains'],
    ['8', 'ward', undefined],
    ['9', 'school', undefined],
  ];
  for (const [key, id, camp] of works) {
    const def = WORK_DEFS[id];
    const done = state.estate.works.some((w) => w.id === id);
    const label =
      id === 'waterRace'
        ? `Fund a water race to ${CAMP_DEFS[camp as CampId].name} — ${formatMoney(def.cost)}`
        : `Fund ${WORK_NAMES[id]} — ${formatMoney(def.cost)}`;
    if (done && id === 'waterRace' && !state.estate.works.some((w) => w.id === 'waterRace' && w.camp === camp)) {
      continue; // the race is cut, and it is cut to one camp only
    }
    out.push(
      item(key, label, { type: 'fundWork', work: id, camp },
        done ? 'funded, built, and the plaque up' : money < def.cost ? `the estimate is ${formatMoney(def.cost)}` : WORK_NOTES[id],
        done || money < def.cost),
    );
  }
  if (state.estate.jpSinceDay === null) {
    const unmet = commissionRequirements(state).filter((r) => !r.met);
    // Not offered at all until the aftermath, when the Local Courts are formed.
    if (inAftermath(state)) {
      out.push(
        item('J', `Accept the commission of the peace — ${formatMoney(JP_FEE)}`, { type: 'acceptCommission' },
          canTakeCommission(state) ? 'gazetted a Justice of the Peace for this district' : `wants ${unmet[0].text}`,
          !canTakeCommission(state)),
      );
    }
  } else {
    out.push(
      item('H', 'Hold a court day', { type: 'holdCourt' },
        courtDue(state)
          ? 'two or three cases, and a day of your own time'
          : `the list is called again on day ${state.estate.nextCourtDay}`,
        !courtDue(state)),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE CIVIC LADDER (§26-§28)
// ---------------------------------------------------------------------------

/** The deeds in the strongbox, and what a man of property may buy next. */
export function estateView(state: GameState): ScreenView {
  const e = state.estate;
  const home = homeScreenFor(state);
  const inTown = state.location === 'fields-town';
  const camp = isCamp(state.location) ? (state.location as CampId) : null;
  const body: string[] = [
    'Half the men on this field dig, and the other half supply the men who dig,',
    'and it is not the diggers who are buying land at Port Gannet. What follows is',
    'bought with clean money, and pays in something other than gold.',
    '',
  ];
  if (!state.hearth.cottage) {
    body.push(
      'No agent in this district will sell a single man a dwelling-house. The',
      'one house to be had is the cottage at Port Gannet, bought by a married',
      'man, and the acquaintance that leads to it begins at the subscription',
      'balls in Slateford.',
      '',
    );
  }
  const deeds = estateDeeds(state);
  if (deeds.length) {
    body.push('YOUR DEEDS');
    for (const d of deeds) body.push(`  ${d}`);
    body.push(`The estate turns in about ${formatMoney(estateWeeklyIncome(state))} the week, paid wherever you stand.`);
  } else {
    body.push('You hold no property whatever. Every man on this field began that way.');
  }
  if (e.works.length) {
    body.push('');
    body.push('PUBLIC WORKS FUNDED AT THE CHAMBERS');
    for (const w of e.works) body.push(`  ${WORK_NAMES[w.id]}${w.camp ? `, to ${CAMP_DEFS[w.camp].name}` : ''}`);
  }
  if (e.jpSinceDay !== null) {
    body.push('');
    body.push(`Gazetted a Justice of the Peace on day ${e.jpSinceDay}. The court sits at Slateford on day ${e.nextCourtDay}.`);
  }

  const menu: MenuItem[] = [];
  if (!e.shamrock) {
    const unmet = shamrockRequirements(state).filter((r) => !r.met);
    menu.push(
      item('1', `Buy the Crown & Cradle — ${formatMoney(SHAMROCK_PRICE)}`, { type: 'buyShamrock' },
        unmet.length === 0
          ? 'Mrs. Doyle stays on to run it; every rumour on this field crosses that bar'
          : `wants ${unmet[0].text}`,
        unmet.length > 0),
    );
  }
  if (!e.store) {
    const target: CampId = camp ?? 'damp-camp';
    const unmet = storeRequirements(state, target).filter((r) => !r.met);
    menu.push(
      item('2', `Open a store of your own — ${formatMoney(STORE_PRICE)} and ${formatMoney(STORE_STOCK_PRICE)} of stock`,
        { type: 'openStore', camp: target },
        camp
          ? unmet.length === 0
            ? `a counter at ${CAMP_DEFS[camp].name}; when the rush comes here you are the one selling`
            : `wants ${unmet[0].text}`
          : 'a store is opened at a camp, standing on the ground',
        unmet.length > 0),
    );
  } else {
    const store = e.store;
    menu.push(
      item('F', 'Deal fairly with the field', { type: 'setStorePolicy', policy: 'fair' },
        store.policy === 'fair' ? 'your prices already' : 'half the profit, and the camp protects its honest man',
        store.policy === 'fair'),
    );
    menu.push(
      item('G', 'Charge what the rush will bear', { type: 'setStorePolicy', policy: 'gouge' },
        store.policy === 'gouge' ? 'your prices already' : 'twice the profit, and the field remembers',
        store.policy === 'gouge'),
    );
  }
  if (!e.gazetteShare) {
    const unmet = gazetteRequirements(state).filter((r) => !r.met);
    menu.push(
      item('3', `Buy a half-share in The Slateford Times — ${formatMoney(GAZETTE_SHARE_PRICE)}`, { type: 'buyGazetteShare' },
        unmet.length === 0 ? 'a pound a week, and the ear of eleven thousand men' : `wants ${unmet[0].text}`,
        unmet.length > 0),
    );
  } else {
    menu.push(
      item('P', 'The Times office — set a story', { type: 'goto', screen: 'press' },
        inTown
          ? storyDue(state)
            ? 'the press is idle and the type is standing'
            : `the next story in ${daysToNextStory(state)} day${daysToNextStory(state) === 1 ? '' : 's'}`
          : 'copy is set in Bell Street, not shouted across forty miles of scrub',
        !inTown || !storyDue(state)),
    );
  }
  if (inTown) {
    menu.push(item('W', 'The Council Chambers — public works', { type: 'goto', screen: 'ftown-council' }, 'bridges, races, wards and schools'));
  }
  menu.push(back(home));
  return {
    screen: 'estate',
    title: 'YOUR PROPERTY IN THE DISTRICT',
    body,
    menu,
  };
}

/** The Times office: a flatbed press, and the ear of the whole field. */
export function pressView(state: GameState): ScreenView {
  const body: string[] = [
    'Mr. Vale sets the type himself when the boy is drunk, which is on Fridays.',
    'The paper goes out on Saturday to every camp on the field, and what it says',
    'is believed by more men than have ever met a proprietor of it.',
    '',
    storyDue(state)
      ? `The press is idle. One story in ${STORY_COOLDOWN_DAYS} days is all the paper it has.`
      : `Nothing further can be set for ${daysToNextStory(state)} day${daysToNextStory(state) === 1 ? '' : 's'}.`,
  ];
  const camps: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];
  const ready = storyDue(state) && state.location === 'fields-town';
  const menu: MenuItem[] = camps.map((c, i) =>
    item(String(i + 1), `Cry up the ground at ${CAMP_DEFS[c].name}`, { type: 'placeStory', kind: 'talkUp', camp: c },
      'a rush there in two days; try the ground with a dish first, or the field will learn whose paper called it',
      !ready),
  );
  menu.push(item('4', 'Press the licence question', { type: 'placeStory', kind: 'pressLicence' }, 'the field grows angrier, and the next hunt is printed before it runs', !ready));
  menu.push(item('5', 'Counsel patience', { type: 'placeStory', kind: 'soothe' }, 'a leading article, and the field simmers a degree lower', !ready));
  menu.push(
    item('6', 'Kill a notice concerning yourself', { type: 'placeStory', kind: 'killNotice' },
      state.estate.noticeKillUsed
        ? 'Mr. Vale has done that for you once this year, and has a memory'
        : 'a fortnight in which the Camp is not reminded of you',
      !ready || state.estate.noticeKillUsed || state.outlawed),
  );
  menu.push(back('estate'));
  return { screen: 'press', title: 'THE SLATEFORD TIMES, BELL STREET', body, menu };
}

/** The Local Court, in the Council's main hall, with the field at the back of it. */
export function courtView(state: GameState): ScreenView {
  const docket = courtDocket(state);
  const body: string[] = [
    'A table, a Bible, a constable at the door and the whole of the diggings at',
    'the back of the hall, because a court on a goldfield is the best free',
    'entertainment in the district.',
    '',
    'BEFORE THE BENCH TODAY',
  ];
  for (const c of docket) {
    body.push(`  ${c.charge}`);
    body.push('');
  }
  return {
    screen: 'court',
    title: 'THE LOCAL COURT, SLATEFORD',
    subtitle: `${formatDate(state.day)} · ${docket.length} cases`,
    body,
    menu: [
      item('1', 'Deal lightly with them', { type: 'rule', ruling: 'leniency' }, 'the camps go quieter, and the field loves a soft bench'),
      item('2', 'Give them the full weight of the law', { type: 'rule', ruling: 'severity' }, 'the thieves go elsewhere for a month, and nobody drinks your health'),
    ],
  };
}
