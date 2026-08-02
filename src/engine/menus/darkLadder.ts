/** The dark ladder: the roads, the gang, the camp in the ranges and the stash. */

import {
  canBailUp,
  canBigJob,
  canBuyPassage,
  canMakeHideout,
  canRecruit,
  crimeVisible,
  fenceRate,
  intelCost,
} from '../bandit';
import {
  ROUTES,
  GANG_MAX,
  PASSAGE_FARE,
  LAWYER_FEE,
  SHANTY_NOTORIETY,
  SHANTY_PRICE,
} from '../constants';
import { formatGold, formatMoney, pounds } from '../money';
import {
  bushRankOf,
  heatOf,
  heatWord,
  notorietyPhrase,
  rewardFor,
  stashWorth,
  isCamp,
  titleCase,
} from '../state';
import { formatDate, seasonPhrase } from '../time';
import type { GameState, HeatZone, MenuItem, Route, ScreenView } from '../types';
import { item, back, homeScreenFor, tally, bushArticle } from './shared';

/**
 * The way onto the dark ladder, offered at every hub. Before a man is a minor
 * criminal it is greyed with the reason, which is how this game teaches
 * everything else it teaches (§23.1).
 */
export function banditEntry(state: GameState, key: string): MenuItem | null {
  if (!crimeVisible(state)) return null;
  return item(
    key,
    'Business of another kind',
    { type: 'goto', screen: 'bandit' },
    state.outlawed
      ? 'the roads, the ranges, and the gold escort'
      : 'the roads, and the men who make a living off them',
  );
}

// ---------------------------------------------------------------------------
// THE DARK LADDER (§23-§24)
// ---------------------------------------------------------------------------

function roadName(route: Route): string {
  return route === 'pass' ? 'the Razorback Road' : "Mercer's Track";
}

/** What a man's papers are worth to a harbourer, put in a line (§23.4). */
function intelLine(state: GameState): string | null {
  const i = state.intel;
  if (!i || i.untilDay < state.day) return null;
  switch (i.kind) {
    case 'escort':
      return `You hold the word on the gold escort — ${i.strength ?? 6} troopers — good until day ${i.untilDay}.`;
    case 'bank':
      return `You know the bank's gold room is full, and will be until day ${i.untilDay}.`;
    default:
      return `A fat traveller is due on ${roadName((i.route ?? 'trickeys') as Route)} before day ${i.untilDay}.`;
  }
}

/** The heat books, in the words a shanty keeper would use. */
function heatLines(state: GameState): string[] {
  const zones: [HeatZone, string][] = [
    ['trickeys', "Mercer's Track"],
    ['pass', 'the Razorback Road'],
    ['town', 'the two towns'],
    ['camps', 'the camps and ranges'],
  ];
  return zones.map(([z, name]) => `  ${tally(name, heatWord(heatOf(state, z)))}`);
}

/**
 * Everything a man may do that he would not care to explain. Options that are
 * not open to him yet are shown greyed with the reason, which is how this game
 * teaches everything else.
 */
export function banditView(state: GameState): ScreenView {
  const camp = isCamp(state.location);
  const town = state.location === 'fields-town' || state.location === 'suze-port';
  const body: string[] = [];
  body.push(
    camp || state.location === 'hideout'
      ? 'The sly-grog shanty at the back of the gully keeps no licence and no ledger, and the men in it have all been somewhere they would rather not name.'
      : 'There is a room behind the Crown & Cradle where the talk stops when a stranger comes in, and a harbourer who will sell a word to a man he knows.',
  );
  body.push('');
  body.push(`The colony reckons you ${notorietyPhrase(state.notoriety)}.`);
  body.push(`In the bush you are ${bushArticle(bushRankOf(state))}.`);
  const reward = rewardFor(state);
  if (reward > 0) body.push(`There is ${formatMoney(reward)} on your head.`);
  body.push('');
  body.push('How the traps are riding:');
  body.push(...heatLines(state));
  const intel = intelLine(state);
  if (intel) {
    body.push('');
    body.push(intel);
  }
  if (state.gang.length > 0) {
    body.push('');
    body.push(`Riding with you: ${state.gang.map((g) => g.name).join(', ')}.`);
  }
  if (state.ambush) {
    body.push('');
    body.push('Somebody has sold you, and whatever you do next they will be ready for it.');
  }

  const roads = canBailUp(state);
  const hide = canMakeHideout(state);
  const gangGate = canRecruit(state);
  const job = canBigJob(state);
  const cost = intelCost(state);
  const menu: MenuItem[] = [
    item('1', 'Take to the roads', { type: 'goto', screen: 'bandit-roads' }, roads.note, !roads.ok),
    item(
      '2',
      cost > 0 ? `Buy a word of a harbourer — ${formatMoney(cost)}` : 'Hear what the shanty has to say',
      { type: 'gatherIntelligence' },
      crimeVisible(state)
        ? 'a day, and a plan instead of a coin toss'
        : 'the harbourers keep their words for men they know',
      !crimeVisible(state) || state.moneyPence < cost,
    ),
    item(
      '3',
      'Look for a man to ride with',
      { type: 'recruitGangMember' },
      gangGate.note,
      !gangGate.ok,
    ),
  ];
  if (state.gang.length > 0) {
    menu.push(item('4', 'The men who ride with you', { type: 'goto', screen: 'gang' }, `${state.gang.length} of a possible ${GANG_MAX}`));
  }
  if (state.location === 'deep-mountains' || !state.hideout) {
    menu.push(
      item('5', 'Make camp at Split Rock', { type: 'makeHideout' }, hide.note, !hide.ok),
    );
  }
  if (state.hideout && state.location !== 'hideout') {
    menu.push(
      item('6', 'Ride up to Split Rock Camp', { type: 'travelTo', place: 'hideout' }, 'safe sleep, and the stash under the stone'),
    );
  }
  if (state.location === 'fields-town') {
    menu.push(
      item('7', 'Stick up the Bank of Australasia', { type: 'robBank' }, job.ok ? 'the safe is at the far end, by the manager’s bed' : job.note, !job.ok),
    );
  }
  menu.push(
    item(
      '8',
      "Take the gold escort on Mercer's Track",
      { type: 'robEscort' },
      !job.ok
        ? job.note
        : state.intel?.kind === 'escort' && state.intel.untilDay >= state.day
          ? 'you know the day and the strength of it'
          : 'blind, and blind is how men ambush an empty road',
      !job.ok,
    ),
  );
  if (camp || state.location === 'hideout') {
    menu.push(
      item('F', `Put your gold through the fence — ${formatMoney(fenceRate(state))} the oz`, { type: 'fenceGold' },
        state.estate.shanty === state.location
          ? 'eight parts in ten of the bank, and the scales in that hut are yours'
          : 'six or seven parts in ten of the bank, and his scales are his own',
        state.goldCentiOz <= 0),
    );
  }
  // The dark ladder's own two sinks: respectability refuses him, so he buys
  // the room the talk is spoken in, and a man to speak for him (§28.3).
  if (camp && !state.estate.shanty) {
    menu.push(
      item('S', `Buy the sly-grog shanty here — ${formatMoney(SHANTY_PRICE)}`, { type: 'buyShanty' },
        state.notoriety < SHANTY_NOTORIETY
          ? `the keeper sells to men he has heard of; ${SHANTY_NOTORIETY} notoriety, and you have ${Math.floor(state.notoriety)}`
          : 'his scales become your scales, and every word in the place is yours',
        state.notoriety < SHANTY_NOTORIETY || state.moneyPence < SHANTY_PRICE),
    );
  }
  if (state.estate.shanty) {
    menu.push(
      item('L', `Retain an attorney — ${formatMoney(LAWYER_FEE)} the quarter`, { type: 'retainLawyer' },
        state.estate.lawyerUntilDay >= state.day
          ? `retained to day ${state.estate.lawyerUntilDay}; a defended trial instead of a plea`
          : 'at the assizes it is the difference between a defence and a plea; never for blood',
        state.moneyPence < LAWYER_FEE),
    );
  }
  if (state.location === 'suze-port') {
    const passage = canBuyPassage(state);
    menu.push(
      item('P', `A berth for California — ${formatMoney(PASSAGE_FARE)}`, { type: 'buyPassage' }, passage.note, !passage.ok),
    );
  }
  if (town && state.location === 'suze-port') {
    menu.push(item('T', 'Take what is not yours', { type: 'goto', screen: 'suze-crime' }));
  }
  menu.push(back(homeScreenFor(state)));
  return {
    screen: 'bandit',
    title: 'BUSINESS OF ANOTHER KIND',
    subtitle: `${formatDate(state.day)} · ${notorietyPhrase(state.notoriety)}`,
    body,
    menu,
  };
}

/** Which road to lie above (§23.4). */
export function roadsView(state: GameState): ScreenView {
  const gate = canBailUp(state);
  const body: string[] = [
    'Two roads run inland from the coast, and everything that leaves the diggings',
    'with gold on it comes down one or the other. A man with a horse, a pistol and',
    'the patience for it may lie above either and see what the day brings.',
    '',
    ...heatLines(state).slice(0, 2),
  ];
  const intel = intelLine(state);
  if (intel && state.intel?.kind === 'traveller') {
    body.push('');
    body.push(intel);
  }
  if (state.horse === 'none') {
    body.push('');
    body.push('You have no horse. A man afoot who is seen on a road is a man taken on it.');
  }
  const routes: Route[] = ['trickeys', 'pass'];
  const menu: MenuItem[] = routes.map((r, i) =>
    item(
      String(i + 1),
      `Lie up above ${roadName(r)}`,
      { type: 'bailUp', route: r },
      `${ROUTES[r].blurb} The district is ${heatWord(heatOf(state, r === 'pass' ? 'pass' : 'trickeys'))}.`,
      !gate.ok,
    ),
  );
  menu.push(back('bandit'));
  return { screen: 'bandit-roads', title: 'THE ROADS', body, menu };
}

export function gangView(state: GameState): ScreenView {
  const body: string[] = [
    'No wages are paid and none are asked. Every man takes an equal share of what',
    'the jobs bring, and every man knows to a penny what is on the captain’s head.',
    '',
  ];
  if (state.gang.length === 0) {
    body.push('Nobody rides with you. Whatever is done is done alone.');
  } else {
    for (const g of state.gang) {
      const word =
        g.loyaltyFrac >= 0.75 ? 'would hang beside you' : g.loyaltyFrac >= 0.45 ? 'steady enough' : 'watches the door too often';
      body.push(`  ${g.name} — joined day ${g.joined}, ${word}`);
    }
  }
  const gate = canRecruit(state);
  const menu: MenuItem[] = [
    item('1', 'Look for another man', { type: 'recruitGangMember' }, gate.note, !gate.ok),
  ];
  state.gang.forEach((g, i) =>
    menu.push(item('ABC'[i] ?? 'D', `Pay off ${g.name}`, { type: 'dismissGangMember', index: i }, 'and one fewer mouth to tell the traps')),
  );
  menu.push(back('bandit'));
  return { screen: 'gang', title: 'THE MEN WHO RIDE WITH YOU', body, menu };
}

export function hideoutView(state: GameState): ScreenView {
  const h = state.hideout;
  const body: string[] = [
    'A saddle in the ranges with a spring in it, one way in, and four miles of',
    'country visible from the rock above the fire. Nobody comes here who has not',
    'been brought. The sleep is free and it is the only safe sleep you get.',
    '',
  ];
  if (h) {
    body.push(`Under the flat stone: ${formatMoney(h.stashPence)} and ${formatGold(h.stashCentiOz)}.`);
    body.push(`Worth of the stash at the bank's rate: ${formatMoney(stashWorth(state))}.`);
  }
  body.push(`The camps and the ranges are ${heatWord(heatOf(state, 'camps'))}.`);
  const search = state.diggersRobbed > 0
    ? 'You have robbed diggers, and the field informs on you. They will come up these gullies sooner for it.'
    : 'The field has no quarrel with you, and nobody down there has told them where this is.';
  body.push(search);

  const menu: MenuItem[] = [
    item('1', 'The stash under the stone', { type: 'goto', screen: 'stash' }, h ? `${formatMoney(stashWorth(state))} buried` : undefined),
    item('2', 'Lie up a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days, and the heat going off the districts`),
    item('3', 'Business of another kind', { type: 'goto', screen: 'bandit' }),
    item('4', 'Ride down to the Blackcap Ranges', { type: 'travelTo', place: 'deep-mountains' }),
    item('5', 'Ride down to Slateford', { type: 'travelTo', place: 'fields-town' }),
    item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
  ];
  return {
    screen: 'hideout',
    title: 'SPLIT ROCK CAMP',
    subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
    body,
    menu,
  };
}

export function stashView(state: GameState): ScreenView {
  const h = state.hideout;
  const body: string[] = [
    'An oilcloth parcel in a tin, under a flat stone at the foot of the rock, with',
    'the ground stamped back down over it. It is the only bank that will have you.',
    '',
    `Buried: ${formatMoney(h?.stashPence ?? 0)} and ${formatGold(h?.stashCentiOz ?? 0)}.`,
    `About you: ${formatMoney(state.moneyPence)} and ${formatGold(state.goldCentiOz)}.`,
  ];
  const menu: MenuItem[] = [
    item('1', 'Bury everything in your pockets', { type: 'stash', what: 'money', amount: -1 }, undefined, state.moneyPence <= 0),
    item('2', 'Bury all your gold', { type: 'stash', what: 'gold', amount: -1 }, undefined, state.goldCentiOz <= 0),
    item('3', 'Lift a pound out', { type: 'unstash', what: 'money', amount: pounds(1) }, undefined, (h?.stashPence ?? 0) < pounds(1)),
    item('4', 'Lift five pounds out', { type: 'unstash', what: 'money', amount: pounds(5) }, undefined, (h?.stashPence ?? 0) < pounds(5)),
    item('5', 'Lift the lot out', { type: 'unstash', what: 'money', amount: -1 }, undefined, (h?.stashPence ?? 0) <= 0),
    item('6', 'Lift the gold out', { type: 'unstash', what: 'gold', amount: -1 }, undefined, (h?.stashCentiOz ?? 0) <= 0),
    back('hideout'),
  ];
  return { screen: 'stash', title: 'UNDER THE FLAT STONE', body, menu };
}
