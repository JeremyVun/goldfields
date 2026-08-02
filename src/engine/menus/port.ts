/**
 * The screens a man sees before he is ashore and while he is still at Port
 * Gannet: the title, the arrival, the port itself, what there is to read, and
 * the two roads inland.
 */

import {
  COOKSHOP_MEAL_PRICE,
  HORSE_PRICE,
  HOSPITAL_FEE_PER_DAY,
  JOBS,
  ROUTES,
  WAGON_FARE,
} from '../constants';
import { briggsDiscountLabel } from '../market';
import { drinkPrice } from '../shamrock';
import { formatMoney, shillings } from '../money';
import { gazetteFor } from '../news';
import { titleCase } from '../state';
import { formatDate, seasonPhrase } from '../time';
import { planJourney } from '../travel';
import type { GameState, ScreenView } from '../types';
import { item, isMenuItem, back, lodgingWord } from './shared';
import { storeMenu, storeAside } from './store';
import { banditEntry } from './darkLadder';
import { hearthHubItems } from './hearthScreens';

function horseReport(state: GameState, kind: 'brumby' | 'hack'): string {
  const name = kind === 'brumby' ? 'Rough-coated bay' : 'Tall chestnut';
  const seen = (state.horseInspection[kind] ?? 0) + Math.floor(state.horseKnowledge / 5);
  if (seen <= 0) return `${name}: glossy sales talk and little else to judge by.`;
  if (seen === 1) {
    return kind === 'brumby'
      ? `${name}: plain-looking, sound feet, and used to scant feed.`
      : `${name}: long-striding and quick, though the near forefoot looks tender.`;
  }
  return kind === 'brumby'
    ? `${name}: moderate speed; exceptional endurance, footing and water sense.`
    : `${name}: exceptional speed on a made road; fair endurance, poor footing and water sense.`;
}

export function titleView(): ScreenView {
  return {
    screen: 'title',
    title: 'GOLDRUSH',
    subtitle: 'The year is 1854',
    body: [
      'A simulation of life on the diggings.',
      '',
      'Press the SPACE BAR to start.',
    ],
    menu: [
      item('1', 'Begin a new game', { type: 'newGame' }),
      item('2', 'Take up a saved game', { type: 'resumePrompt' }),
    ],
  };
}

export function resumeView(): ScreenView {
  return {
    screen: 'resume',
    title: 'TAKE UP A SAVED GAME',
    body: ['Enter the number of the game you wish to take up, and press RETURN.'],
    menu: [item('0', 'Back', { type: 'start' })],
    input: { prompt: 'Game number', kind: 'gameId' },
  };
}

export function introView(): ScreenView {
  return {
    screen: 'intro',
    title: 'NEW ARRIVALS',
    body: [],
    menu: [item(' ', 'Press the SPACE BAR to go ashore', { type: 'continue' })],
  };
}

// --- Port Gannet -----------------------------------------------------
export function suzeView(state: GameState): ScreenView {
  return {
    screen: 'suze',
    title: 'PORT GANNET',
    subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
    body: [
      'Dirty, unlit streets, garish signs, and horses hitched to wooden railings. The place exists only for gold. There is plenty of work for those who stay, and because workers are scarce the wages are good.',
    ],
    menu: [
      item('1', 'Seek work about the port', { type: 'goto', screen: 'suze-work' }),
      item('2', "Bell's Outfitters", { type: 'goto', screen: 'suze-store' }, 'goods are much cheaper here than at the diggings'),
      item('3', 'See about lodgings', { type: 'goto', screen: 'suze-lodgings' }, `at present: ${lodgingWord(state, 'suze-port')}`),
      item('4', 'The horse dealer', { type: 'goto', screen: 'suze-horses' }),
      item(
        'C',
        `A hot meal at the cookshop — ${formatMoney(COOKSHOP_MEAL_PRICE)}`,
        { type: 'buyMeal' },
        state.fedToday
          ? 'you already have a meal waiting today'
          : 'covers your next day\'s food; buying it takes no time',
        state.fedToday || state.moneyPence < COOKSHOP_MEAL_PRICE,
      ),
      item('F', 'Fish the harbour for the day', { type: 'fishForFood' }, 'no wage; you may catch nothing, but a catch leaves food to store'),
      item('5', state.gazetteReadOn === state.day ? "Read today's Slateford Times again — free" : 'Read The Slateford Times (1d)', { type: 'readGazette' }),
      item('6', "Read The New Chum's Companion", { type: 'readJournal' }, state.items.journal ? undefined : 'you have no copy', state.items.journal < 1),
      item('7', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
      item('H', `A doctor in Main Street — ${formatMoney(HOSPITAL_FEE_PER_DAY)} the day`, { type: 'hospital', days: 3 }, 'three days under his care', state.moneyPence < HOSPITAL_FEE_PER_DAY),
      item('K', `A nobbler in a Main Street public house — ${formatMoney(drinkPrice(state, 'nobbler'))}`, { type: 'drink', what: 'nobbler' }, 'the port has not yet learned to charge diggings prices for it', state.moneyPence < drinkPrice(state, 'nobbler')),
      item('8', 'Take what is not yours', { type: 'goto', screen: 'suze-crime' }),
      item('9', 'The bank', { type: 'goto', screen: 'ftown-bank' }, 'safe from thieves; the diggings are a long way from your money'),
      item('G', 'Set out for the diggings', { type: 'goto', screen: 'travel-route' }),
      ...(state.company
        ? [item('O', `Attend to ${state.company.name}`, { type: 'goto', screen: 'company' }, 'investors and shipping agents do business at the port')]
        : []),
      ...hearthHubItems(state),
      banditEntry(state, 'B'),
      item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
    ].filter(isMenuItem),
  };
}

export function suzeWorkView(state: GameState): ScreenView {
  return {
    screen: 'suze-work',
    title: 'WORK AT PORT GANNET',
    body: [
      'Ships lie in the harbour short-handed, their crews gone to the diggings. A man who will stay and work can always find a day\'s wage.',
    ],
    menu: [
      item('1', `${JOBS.wharf.name} — ${formatMoney(JOBS.wharf.lo)} to ${formatMoney(JOBS.wharf.hi)} a day`, { type: 'work', job: 'wharf', days: state.spellDays }, JOBS.wharf.blurb),
      item('2', `${JOBS.town.name} — ${formatMoney(JOBS.town.lo)} to ${formatMoney(JOBS.town.hi)} a day`, { type: 'work', job: 'town', days: state.spellDays }, JOBS.town.blurb),
      item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
      back('suze'),
    ].filter(isMenuItem),
  };
}

export function suzeStoreView(state: GameState): ScreenView {
  return {
    screen: 'suze-store',
    title: "BELL'S OUTFITTERS, PORT GANNET",
    body: [
      'Prices keep rising, but equipment and supplies are much cheaper here than at the goldfields. Buy before you go, and buy carefully.',
      '',
      briggsDiscountLabel(state),
      ...(state.legal === 'honest' ? [] : [`Bell adds a visible risk premium because your standing is ${state.legal}.`]),
    ],
    menu: storeMenu(state, 'suze'),
    aside: storeAside(state),
  };
}

export function suzeLodgingsView(state: GameState): ScreenView {
  return {
    screen: 'suze-lodgings',
    title: 'LODGINGS',
    body: [
      'Lodgings are scarce. There were no beds at the inn for us, at least none that we could afford. The inn and stable include a plain evening meal; tent ground does not.',
      ...(state.hearth.cottage
        ? []
        : [
            '',
            'Every bed in the port is let by the night. The one house a man may own here is the cottage a married man buys, and that road begins at a Slateford subscription ball.',
          ]),
    ],
    menu: [
      item('1', 'Inn dormitory — 10s a night', { type: 'setLodging', kind: 'inn' }, 'flea-ridden stretchers, but safe enough'),
      item('2', 'A stable, on clean straw — 5s a night', { type: 'setLodging', kind: 'stable' }, 'a stall shared with two others and perhaps a horse'),
      item('3', 'Rent tent ground — 5s a week', { type: 'setLodging', kind: 'tentground' }, state.items.tent ? 'the canvas town' : 'you would need a tent', state.items.tent < 1),
      item('4', 'Sleep rough — nothing', { type: 'setLodging', kind: 'rough' }, 'free, and it may cost you dear'),
      back('suze'),
    ],
  };
}

export function suzeHorsesView(state: GameState): ScreenView {
  const alreadyMounted = state.horse !== 'none';
  return {
    screen: 'suze-horses',
    title: 'THE HORSE DEALER',
    body: [
      'Two horses stand at the rail. Their prices are chalked up; their virtues are not. Horse knowledge comes from looking, work around the port, or paying someone whose livelihood does not depend on selling either animal.',
      '',
      horseReport(state, 'brumby'),
      horseReport(state, 'hack'),
    ],
    menu: [
      item('1', `The rough-coated bay — ${formatMoney(HORSE_PRICE.brumby)}`, { type: 'buyHorse', kind: 'brumby' }, alreadyMounted ? 'you already have a horse, and nowhere to keep a second' : undefined, alreadyMounted || state.moneyPence < HORSE_PRICE.brumby),
      item('2', `The tall chestnut — ${formatMoney(HORSE_PRICE.hack)}`, { type: 'buyHorse', kind: 'hack' }, alreadyMounted ? 'you already have a horse, and nowhere to keep a second' : undefined, alreadyMounted || state.moneyPence < HORSE_PRICE.hack),
      item('3', 'Inspect the rough-coated bay', { type: 'inspectHorse', kind: 'brumby', method: 'look' }, 'look at teeth, legs and feet; no time or money'),
      item('4', 'Inspect the tall chestnut', { type: 'inspectHorse', kind: 'hack', method: 'look' }, 'look at teeth, legs and feet; no time or money'),
      item('5', 'Pay an independent ostler to judge both — 1s', { type: 'inspectHorse', kind: 'brumby', method: 'ostler' }, 'a plain account of speed, stamina and bush sense', state.moneyPence < shillings(1)),
      item('6', 'Trial both horses for a day — 5s', { type: 'inspectHorse', kind: 'hack', method: 'trial' }, 'the road tells what the rail conceals', state.moneyPence < shillings(5)),
      back('suze'),
    ],
  };
}

export function suzeCrimeView(state: GameState): ScreenView {
  return {
    screen: 'suze-crime',
    title: 'AN OPPORTUNITY',
    body: [
      'The streets are dark and unlit, and there are drunks enough in them. Most people happily tolerate grog sellers and licence dodgers. Thieves are another matter: harming your fellows is deeply despised.',
    ],
    menu: [
      item('1', 'Lift goods from a store', { type: 'steal', target: 'store' }, 'the better prize, the greater risk'),
      item('2', "Go through a drunk's pockets", { type: 'steal', target: 'drunk' }),
      banditEntry(state, '3'),
      back('suze'),
    ].filter(isMenuItem),
  };
}

// --- reading -------------------------------------------------------
export function gazetteView(state: GameState): ScreenView {
  return {
    screen: 'gazette',
    title: 'THE SLATEFORD TIMES',
    body: gazetteFor(state),
    menu: [item('0', 'Put the paper down', { type: 'continue' })],
  };
}

export function journalView(): ScreenView {
  return {
    screen: 'journal',
    title: "THE NEW CHUM'S COMPANION",
    subtitle: 'Nicholas Jacob Rowe, lately returned from the Gold Rushes',
    body: ['Choose a chapter.'],
    menu: [item('0', 'Close the book', { type: 'continue' })],
  };
}

// --- travel ---------------------------------------------------------
export function travelRouteView(): ScreenView {
  return {
    screen: 'travel-route',
    title: 'THE ROAD TO THE DIGGINGS',
    body: [
      'The roads to the diggings are bad, summer or winter: raw dirt tracks winding through the bush, following the paths forced by the first diggers.',
    ],
    menu: [
      item('1', `${ROUTES.trickeys.name} — ${ROUTES.trickeys.walkDays} days afoot`, { type: 'chooseRoute', route: 'trickeys' }, ROUTES.trickeys.blurb),
      item('2', `${ROUTES.pass.name} — ${ROUTES.pass.walkDays} days afoot`, { type: 'chooseRoute', route: 'pass' }, ROUTES.pass.blurb),
      back('suze'),
    ],
  };
}

export function travelModeView(state: GameState): ScreenView {
  const route = state.journey?.route ?? 'trickeys';
  const walk = planJourney(state, route, 'walk');
  const wagon = planJourney(state, route, 'wagon');
  const horse = planJourney(state, route, 'horse');
  return {
    screen: 'travel-mode',
    title: `HOW WILL YOU TRAVEL ${route === 'trickeys' ? "MERCER'S TRACK" : 'THE RAZORBACK ROAD'}?`,
    body: [
      'Prepare carefully. Some travellers are stark, staring, gold mad and head off with nothing. If they do not die on the way, they arrive with no tools, money or shelter. Others take far too much.',
      '',
      ...walk.problems.map((p) => `— ${p}`),
    ],
    menu: [
      item('1', `Walk — ${walk.days} days, nothing to pay`, { type: 'travel', route, mode: 'walk' }, 'hump your swag; you can carry no cradle without a barrow'),
      item('2', `Ride on a wagon — ${wagon.days} days, ${formatMoney(WAGON_FARE)}`, { type: 'travel', route, mode: 'wagon' }, 'faster than walking; all kit carried, and company makes robbery less likely; wagons bog in winter', state.moneyPence < WAGON_FARE),
      item('3', `On horseback — ${horse.days} days`, { type: 'travel', route, mode: 'horse' }, state.horse === 'none' ? 'you have no horse' : 'ride your own horse; fastest, but exposed to the road', state.horse === 'none'),
      back('suze'),
    ],
  };
}
