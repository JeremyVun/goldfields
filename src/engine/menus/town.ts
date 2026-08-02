/** Slateford: the bank, the store, the Chambers, the hospital, the hotel and its yard. */

import { canFloat } from '../company';
import {
  CAMP_DEFS,
  COACH_FARE,
  JOBS,
  LICENCE_COST,
  MINERS_RIGHT_COST,
  PARLOUR_STAKES,
  SECRET_TRAVEL_DAYS,
  STANDING_COUNCIL_JOB,
} from '../constants';
import { ILLNESS_NAMES, hospitalFee } from '../health';
import {
  ITEM_HINTS,
  ITEM_NAMES,
  briggsDiscountLabel,
  buybackPriceOf,
  rateAt,
  rateTrendPhrase,
} from '../market';
import { parlourOpen, receptionLine, receptionTier } from '../shamrock';
import { formatGold, formatMoney, pounds, shillings } from '../money';
import { campTalk } from '../news';
import { healthWord, inAftermath, isCamp, isLicensed, licenceWord, titleCase } from '../state';
import { formatDate, seasonPhrase } from '../time';
import { localTravelDays } from '../travel';
import type { CampId, GameState, MenuItem, ScreenView } from '../types';
import { item, isMenuItem, warned, back, lodgingWord } from './shared';
import { STORE_ORDER, STORE_KEYS, storeMenu, storeAside } from './store';
import { drinkMenu, shoutMenu } from './grog';
import { estateEntry, shamrockEntry, civicCouncilItems } from './civic';
import { banditEntry } from './darkLadder';
import { hearthHubItems } from './hearthScreens';
import { companyEntryNote } from './companyOffice';

export function ftownView(state: GameState): ScreenView {
  return {
    screen: 'ftown',
    title: 'SLATEFORD',
    subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
    body: [
      'A street a mile long and wide enough to turn a bullock team, lined with tin',
      'and rough-hewn wood, and beyond it nothing but tents. Only half the town digs;',
      'the rest supply the diggers, and do better out of it.',
    ],
    menu: [
      item('1', 'The Bank of Australasia', { type: 'goto', screen: 'ftown-bank' }, `gold at ${formatMoney(state.bankRatePencePerOz)} the ounce`),
      item('2', "Bell's Outfitters", { type: 'goto', screen: 'ftown-store' }, 'everything from a pick to a needle, at diggings prices'),
      item('3', 'The Council Chambers', { type: 'goto', screen: 'ftown-council' }, isLicensed(state) ? licenceWord(state) : 'no licence'),
      item('4', 'Seek work in the town', { type: 'goto', screen: 'ftown-work' }),
      item('5', 'Canvas House (the hospital)', { type: 'goto', screen: 'ftown-hospital' }),
      item('6', 'The Crown & Cradle', { type: 'goto', screen: 'ftown-hotel' }),
      item('7', `Cobb & Co. to Port Gannet — ${formatMoney(COACH_FARE)}`, { type: 'coach' }, '2 days, and mostly bushranger-proof', state.moneyPence < COACH_FARE),
      item('8', 'Out to the diggings', { type: 'goto', screen: 'ftown-depart' }),
      item('9', state.gazetteReadOn === state.day ? "Read today's Slateford Times again — free" : 'Read The Slateford Times (1d)', { type: 'readGazette' }),
      item('L', 'See about lodgings', { type: 'goto', screen: 'ftown-lodgings' }, `at present: ${lodgingWord(state, 'fields-town')}`),
      item('R', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
      item('J', "Read The New Chum's Companion", { type: 'readJournal' }, undefined, state.items.journal < 1),
      ...hearthHubItems(state),
      estateEntry(state, 'E'),
      banditEntry(state, 'B'),
      item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
    ].filter(isMenuItem),
  };
}

export function ftownLodgingsView(state: GameState): ScreenView {
  return {
    screen: 'ftown-lodgings',
    title: 'LODGINGS IN SLATEFORD',
    body: [
      'Beds and dry ground are dear wherever the rush has raised a street.',
      'The inn and stable include a plain evening meal; tent ground does not.',
    ],
    menu: [
      item('1', 'Inn dormitory — 10s a night', { type: 'setLodging', kind: 'inn' }, 'flea-ridden stretchers, but safe enough'),
      item('2', 'A stable, on clean straw — 5s a night', { type: 'setLodging', kind: 'stable' }, 'a stall shared with two others and perhaps a horse'),
      item('3', 'Rent tent ground — 5s a week', { type: 'setLodging', kind: 'tentground' }, state.items.tent ? 'the canvas town' : 'you would need a tent', state.items.tent < 1),
      item('4', 'Sleep rough — nothing', { type: 'setLodging', kind: 'rough' }, 'free, and it may cost you dear'),
      back('ftown'),
    ],
  };
}

export function ftownBankView(state: GameState): ScreenView {
  const atPort = state.location === 'suze-port';
  const rate = atPort ? rateAt(state, 'suze-port') : state.bankRatePencePerOz;
  return {
    screen: 'ftown-bank',
    title: atPort ? 'THE BANK, MAIN STREET, PORT GANNET' : 'THE BANK OF AUSTRALASIA',
    body: [
      atPort
        ? 'One of the few brick buildings in the port, and busy with importers, agents'
        : "A glass window on the street, a fireplace at one end, the manager's bed and",
      atPort
        ? 'and diggers turning their dust into notes before they take ship again.'
        : 'the safe at the other, and a few remodelled gin cases for a desk.',
      '',
      `Gold today: ${formatMoney(rate)} the ounce${atPort ? ' (the Slateford bank pays better)' : ' — the best rate in the colony'}.`,
      rateTrendPhrase(state),
      `You hold ${formatGold(state.goldCentiOz)} and ${formatMoney(state.moneyPence)}.`,
      `On deposit: ${formatMoney(state.bankPence)}.`,
    ],
    menu: [
      item('1', 'Sell all your gold', { type: 'sellGold', where: 'bank', watch: true }, undefined, state.goldCentiOz <= 0),
      item('2', 'Deposit all your money', { type: 'deposit', amount: -1 }, 'safe from thieves and bushrangers', state.moneyPence <= 0),
      item('3', 'Withdraw ten shillings', { type: 'withdraw', amount: shillings(10) }, undefined, state.bankPence < shillings(10)),
      item('4', 'Withdraw one pound', { type: 'withdraw', amount: pounds(1) }, undefined, state.bankPence < pounds(1)),
      item('5', 'Withdraw five pounds', { type: 'withdraw', amount: pounds(5) }, undefined, state.bankPence < pounds(5)),
      item('6', 'Withdraw everything', { type: 'withdraw', amount: -1 }, undefined, state.bankPence <= 0),
      back(atPort ? 'suze' : 'ftown'),
    ],
  };
}

export function ftownStoreView(state: GameState): ScreenView {
  return {
    screen: 'ftown-store',
    title: "BELL'S OUTFITTERS, SLATEFORD",
    body: [
      "Bell's Outfitters is a gold mine in itself. Demand is so great that the supply",
      'cannot keep up, and the storekeepers can charge what they like.',
      '',
      briggsDiscountLabel(state),
      ...(state.legal === 'honest' ? [] : [`Your ${state.legal} standing adds a visible risk premium to Bell's prices.`]),
    ],
    menu: storeMenu(state, 'ftown'),
    aside: storeAside(state),
  };
}

export function storeSellView(state: GameState): ScreenView {
  const storeScreen: ScreenView['screen'] =
    state.location === 'suze-port' ? 'suze-store' : isCamp(state.location) ? 'camp-store' : 'ftown-store';
  const menu: MenuItem[] = [];
  for (const it of STORE_ORDER) {
    if (state.items[it] < 1) continue;
    const price = buybackPriceOf(state, it);
    menu.push(
      warned(STORE_KEYS[it], `${titleCase(ITEM_NAMES[it])} — ${formatMoney(price)}`,
        { type: 'sellItem', item: it }, `you have ${state.items[it]}`, ITEM_HINTS[it]),
    );
  }
  menu.push(back(storeScreen));
  return {
    screen: 'store-sell',
    title: 'SELLING BACK TO THE STORE',
    body: [
      'The storekeeper values second-hand goods from the port wholesale list,',
      'and offers one quarter of that price wherever you sell them.',
    ],
    menu,
    aside: storeAside(state),
  };
}

export function ftownCouncilView(state: GameState): ScreenView {
  return {
    screen: 'ftown-council',
    title: 'THE COUNCIL CHAMBERS',
    body: [
      'Licences, claims and complaints. Attached are the police camp and the logs.',
      'A travelling magistrate hears cases once a month; until then, prisoners wait',
      'in chains.',
      '',
      `Your licence: ${licenceWord(state)}.`,
      ...(inAftermath(state)
        ? []
        : [
            'Thirty shillings the month is one shilling a day, or eighteen pounds a year,',
            "when a labourer's wage is five shillings a week and a shepherd receives a",
            'miserable ten pounds a year.',
          ]),
    ],
    menu: [
      inAftermath(state)
        ? item('1', `Take out a miner's right — ${formatMoney(MINERS_RIGHT_COST)} for the year`, { type: 'buyLicence' }, 'a pound the year, and the vote with it; the licence is abolished', state.moneyPence < MINERS_RIGHT_COST)
        : item('1', `Take out a miner's licence — ${formatMoney(LICENCE_COST)} for thirty days`, { type: 'buyLicence' }, 'one shilling a day, when a labourer earns five shillings a week', state.moneyPence < LICENCE_COST),
      item('2', 'Lodge a complaint', { type: 'complain' }, 'it will be written in a fine round hand and filed'),
      ...(['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[])
        .filter((camp) => !!state.claims[camp] && !state.claims[camp]?.registered)
        .map((camp, i) => item('RTY'[i], `Register the claim at ${CAMP_DEFS[camp].name} — 5s`, { type: 'registerClaim', camp }, 'the Council ledger gives you a strong remedy against jumpers', state.moneyPence < shillings(5))),
      item(
        'C',
        state.company
          ? `The books of ${state.company.name}`
          : canFloat(state)
            ? 'Register a mining company'
            : 'Ask about registering a mining company',
        { type: 'goto', screen: 'company' },
        companyEntryNote(state),
      ),
      ...civicCouncilItems(state),
      back('ftown'),
    ],
  };
}

export function ftownWorkView(state: GameState): ScreenView {
  const menu: MenuItem[] = [];
  const jobs: (keyof typeof JOBS)[] = ['orderly', 'clerk', 'barman', 'gardener', 'council'];
  jobs.forEach((j, i) => {
    const def = JOBS[j];
    const record = j === 'council' && state.legal !== 'honest';
    const unknown = j === 'council' && state.standing < STANDING_COUNCIL_JOB;
    const blocked = record || unknown;
    menu.push(
      item(
        String(i + 1),
        `${def.name} — ${formatMoney(def.lo)} to ${formatMoney(def.hi)} a day`,
        { type: 'work', job: j, days: state.spellDays },
        record
          ? 'they will not have a man with a record'
          : unknown
            ? 'the Council takes its clerks from men it has heard of'
            : def.blurb,
        blocked,
      ),
    );
  });
  menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
  menu.push(back('ftown'));
  return {
    screen: 'ftown-work',
    title: 'WORK IN SLATEFORD',
    body: [
      'If you are wondering where to begin to make your fortune, consider trying',
      'short-term work in Slateford. No licence is wanted for honest wages.',
    ],
    menu,
  };
}

export function ftownHospitalView(state: GameState): ScreenView {
  return {
    screen: 'ftown-hospital',
    title: 'CANVAS HOUSE',
    body: [
      'A collection of tents packed with stretchers on earthen floors. My advice to',
      'diggers is not to get sick.',
      '',
      `Health: ${healthWord(state.health)}${state.illness ? ` — ${ILLNESS_NAMES[state.illness.id]}` : ''}.`,
      hospitalFee(state) === 0
        ? 'Nothing is asked of the man who endowed the ward, and half of it of the field. The days are lost to you all the same.'
        : `Ten shillings the day, and the days are lost to you.`,
    ],
    menu: [
      item('1', `Three days under care — ${formatMoney(hospitalFee(state) * 3)}`, { type: 'hospital', days: 3 }, undefined, state.moneyPence < hospitalFee(state)),
      item('2', `Seven days under care — ${formatMoney(hospitalFee(state) * 7)}`, { type: 'hospital', days: 7 }, undefined, state.moneyPence < hospitalFee(state)),
      item('3', 'Rest instead, and save the money', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
      back('ftown'),
    ],
  };
}

export function ftownHotelView(state: GameState): ScreenView {
  return {
    screen: 'ftown-hotel',
    title: 'THE CROWN & CRADLE',
    body: [
      'Bell Street is lined on both sides with buildings, and they centre on the',
      'Crown & Cradle. Half the town does not dig at all; a good deal of what it knows is',
      'known here first.',
      '',
      receptionLine(state),
      '',
      campTalk(state),
    ],
    menu: [
      ...drinkMenu(state, '1234'),
      item('5', 'Two-up in the yard', { type: 'goto', screen: 'ftown-gamble' }, parlourOpen(state) ? 'and the parlour, if you are wanted in it' : undefined),
      ...shoutMenu(state, 'SP'),
      // The deed is done across this counter and no other (§26): a man
      // asks Mrs. Doyle in her own bar, not at a desk in the Chambers.
      shamrockEntry(state, 'H'),
      back('ftown'),
    ],
  };
}

export function ftownGambleView(state: GameState): ScreenView {
  const stakes = [12, 60, 240, 1200];
  const menu = stakes.map((st, i) =>
    item(String(i + 1), `Two-up for ${formatMoney(st)}`, { type: 'startGamble', game: 'twoup', stake: st }, i === 0 && receptionTier(state) === 'chum' ? 'call heads or tails, then collect or let the winnings ride' : 'call heads or tails, then decide whether to press', state.moneyPence < st),
  );
  stakes.forEach((st, i) =>
    menu.push(item('ABCD'[i], `Cards for ${formatMoney(st)}`, { type: 'startGamble', game: 'cards', stake: st }, 'read your hand and the other man, then fold, call, raise or bluff', state.moneyPence < st)),
  );
  // The settlers' corner will play for pounds, and plays them straight (§30.1).
  if (parlourOpen(state)) {
    PARLOUR_STAKES.forEach((st, i) =>
      menu.push(
        item('EFG'[i], `Cards in the parlour for ${formatMoney(st)}`, { type: 'startGamble', game: 'cards', stake: st }, 'squatters and warders, and a straight deck', state.moneyPence < st),
      ),
    );
  }
  menu.push(back('ftown-hotel'));
  return {
    screen: 'ftown-gamble',
    title: 'THE YARD BEHIND THE CROWN & CRADLE',
    body: [
      'Diggers come to town to exchange their gold, then spend up big — gambling and',
      'carousing, often losing a small fortune overnight.',
      ...(parlourOpen(state)
        ? ['', 'The parlour door is open to you. They play for pounds in there.']
        : []),
    ],
    menu,
  };
}

export function ftownTwoUpView(state: GameState): ScreenView {
  const g = state.gambling;
  return {
    screen: 'ftown-twoup',
    title: 'TWO-UP IN THE YARD',
    body: [
      'The spinner sets two pennies on the kip. Heads wins your call; tails wins the other.',
      'Odds are tossed again. There is no house hand to read—only the call and whether',
      'you have the nerve to leave a winning stake down.',
      '',
      g && g.pot > 0 ? `${formatMoney(g.pot)} is waiting on your side of the ring.` : `Your stake is ${formatMoney(g?.stake ?? 0)}. Make the call.`,
    ],
    menu: g && g.pot > 0
      ? [
          item('1', 'Collect the winnings', { type: 'twoUpCollect' }),
          item('2', 'Let it all ride on heads', { type: 'twoUpCall', side: 'heads' }),
          item('3', 'Let it all ride on tails', { type: 'twoUpCall', side: 'tails' }),
        ]
      : [
          item('1', 'Call heads', { type: 'twoUpCall', side: 'heads' }),
          item('2', 'Call tails', { type: 'twoUpCall', side: 'tails' }),
          back('ftown-gamble'),
        ],
  };
}

export function ftownCardsView(state: GameState): ScreenView {
  const g = state.gambling;
  const hand = !g ? 'No hand is dealt.' : g.hand <= 3 ? 'A poor hand.' : g.hand <= 6 ? 'A middling hand.' : g.hand <= 8 ? 'A strong hand.' : 'A hand fit to break a man.';
  const tell = !g ? '' : g.tell === 'eager' ? 'The other man reaches for his money before you speak.' : g.tell === 'uneasy' ? 'The other man keeps rubbing his thumb along the card edge.' : 'The other man sits very still.';
  return {
    screen: 'ftown-cards',
    title: 'A HAND OF CARDS',
    body: [hand, tell, '', `The stake is ${formatMoney(g?.stake ?? 0)}. A winning hand returns seven shillings for every five risked.`],
    menu: [
      item('1', 'Fold', { type: 'cardsDecision', choice: 'fold' }, 'lose half the stake and keep the rest'),
      item('2', 'Call', { type: 'cardsDecision', choice: 'call' }, 'show the hands for the original stake'),
      item('3', 'Raise', { type: 'cardsDecision', choice: 'raise' }, 'the same rate of return, with another stake at risk', !g || state.moneyPence < g.stake),
      item('4', 'Bluff', { type: 'cardsDecision', choice: 'bluff' }, 'best against a weak-looking opponent; costly when called'),
    ],
  };
}

export function ftownDepartView(state: GameState): ScreenView {
  const menu: MenuItem[] = [];
  // There is no sense in setting out for the camp you are already standing in.
  const camps: CampId[] = (['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]).filter(
    (c) => c !== state.location,
  );
  let n = 1;
  for (const c of camps) {
    const days = localTravelDays(state, c);
    menu.push(
      item(String(n++), `${CAMP_DEFS[c].name} — ${days} day${days === 1 ? '' : 's'}`, { type: 'travelTo', place: c }, CAMP_DEFS[c].blurb),
    );
  }
  if (isCamp(state.location)) {
    menu.push(item(String(n++), 'Back to Slateford', { type: 'travelTo', place: 'fields-town' }));
  }
  if (state.secret && !state.secret.chased) {
    menu.push(
      item(String(n++), "Follow the talk of Widow's Reef", { type: 'followRumour' }, `${SECRET_TRAVEL_DAYS} days out, and it may be nothing at all`),
    );
  }
  menu.push(item(String(n), 'Back to Port Gannet on foot', { type: 'travel', route: 'trickeys', mode: state.horse !== 'none' ? 'horse' : 'walk' }));
  menu.push(back(isCamp(state.location) ? 'camp' : 'ftown'));
  return {
    screen: 'ftown-depart',
    title: 'OUT TO THE DIGGINGS',
    body: ['In the scattered camps of the Slate River diggings the work is tough, but there is always a chance to make a fortune.'],
    menu,
  };
}
