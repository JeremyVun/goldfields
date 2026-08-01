/**
 * Life at the Shamrock (§30) — the room reads the player's name back at him.
 *
 * Everything a man buys over a counter in this game is bought here: the drink
 * table of §31.4, the reception tiers of §30.1, and shouting the bar (§30.2),
 * which is the period's most authentic way of turning gold into being liked.
 */

import { sayFixed } from '../content/say';
import {
  ADMIRER_CHANCE,
  CAMP_DEFS,
  DRINKS,
  DRINK_RELIEF,
  FLUSH_DAYS,
  GROG_TENT_ILLNESS,
  HOUSE_SHOUTS_CHANCE,
  INFORMER_DAYS,
  INFORMER_DRINK_CHANCE,
  INTEL_DAYS,
  LANDLORD_INTERVAL_DAYS,
  NEW_CHUM_DRINK_FACTOR,
  NEW_CHUM_ODDS_FACTOR,
  OWN_HOUSE_SHOUT_FACTOR,
  PARLOUR_ODDS_FACTOR,
  RECEPTION_FEARED_NOTORIETY,
  RECEPTION_FIELDS_OWN,
  RECEPTION_KNOWN,
  RECEPTION_RESPECTED,
  SHANTY_WARNING_DAYS,
  SHOUT_CAP_DAYS,
  SHOUT_GANG_LOYALTY,
  SHOUT_HEADS,
  SHOUT_HEAD_COST,
  SHOUT_HEAL,
  SHOUT_STANDING,
  SPREE_COST,
  SPREE_HEALTH,
  SPREE_STANDING,
  WARNING_DAYS,
} from './constants';
import { maybeRumour } from './events';
import { contract, damage, heal } from './health';
import { rateTrend } from './market';
import { formatMoney, pounds } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, addStanding, isCamp } from './state';
import { formatDate } from './time';
import type { CampId, DrinkId, GameState, Route } from './types';

/** Which house the player is standing in, for prices and for manners. */
export type Venue = 'suze' | 'shamrock' | 'camp';

/** How the room takes him (§30.1), tallest tale first. */
export type Reception = 'chum' | 'known' | 'respected' | 'own' | 'feared';

const TIER_ORDER: Reception[] = ['chum', 'known', 'respected', 'own'];

/**
 * What a bad night can cost a man, by how the room regards him (§30.1). The
 * stranger is fleeced to the last shilling, faithfully; the field's own man is
 * carried home with his pile intact, and nobody in that bar would dare.
 */
const LOSS_CAP: Record<Reception, number> = {
  chum: Number.MAX_SAFE_INTEGER,
  known: Number.MAX_SAFE_INTEGER,
  respected: pounds(5),
  own: pounds(2),
  feared: pounds(3),
};

export function venueFor(state: GameState): Venue | null {
  if (state.location === 'suze-port') return 'suze';
  if (state.location === 'fields-town') return 'shamrock';
  if (isCamp(state.location)) return 'camp';
  return null; // there is no bar on the road, nor in the ranges
}

export function drinkPrice(state: GameState, what: DrinkId): number {
  const venue = venueFor(state) ?? 'camp';
  return DRINKS[what][venue];
}

/**
 * Standing or notoriety, whichever tale is taller (§30.1). A feared man is
 * feared even where he is also well thought of; the benches clear regardless.
 */
export function receptionTier(state: GameState): Reception {
  if (state.notoriety >= RECEPTION_FEARED_NOTORIETY && state.notoriety >= state.standing) {
    return 'feared';
  }
  if (state.standing >= RECEPTION_FIELDS_OWN) return 'own';
  if (state.standing >= RECEPTION_RESPECTED) return 'respected';
  if (state.standing >= RECEPTION_KNOWN) return 'known';
  return 'chum';
}

/**
 * The barman *is* the room's ear (§8.4, amended by §30.1): while he is behind
 * the counter, talk reaches him a tier above his own name.
 */
export function rumourTier(state: GameState): Reception {
  const tier = receptionTier(state);
  if (tier === 'feared') return tier;
  if (state.employment?.job !== 'barman') return tier;
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, i + 1)];
}

/** The parlour is for men the settlers' corner will sit down with (§30.1). */
export function parlourOpen(state: GameState): boolean {
  const tier = rumourTier(state);
  return tier === 'respected' || tier === 'own';
}

/** What the house does to a man's luck: watered odds for a new chum (§30.1). */
export function oddsFactor(state: GameState, stake: number): number {
  const tier = receptionTier(state);
  if (tier === 'chum') return NEW_CHUM_ODDS_FACTOR;
  if (parlourOpen(state) && stake >= 240) return PARLOUR_ODDS_FACTOR;
  return 1;
}

/** The line the room greets him with, steady for the day so it cannot flicker. */
export function receptionLine(state: GameState): string {
  const venue = venueFor(state) ?? 'camp';
  const key = `${venue === 'shamrock' ? 'shamrock' : 'grogtent'}.recv.${receptionTier(state)}`;
  return sayFixed(key, state.day * 17 + state.standing + state.notoriety);
}

// ---------------------------------------------------------------------------
// What the room knows
// ---------------------------------------------------------------------------

/**
 * A Gazette-grade item, three days before the Gazette has it (§30.1). Drawn
 * from what is actually true of the world, so the word is worth having.
 */
export function houseNews(state: GameState, rng: RNG, avoid?: string): string {
  const items: string[] = [];
  // The room only knows of a rush once it is running: the two days before it
  // are the landlord's own, and are told him at his own bar and nowhere else
  // (§26, the Shamrock lead).
  if (state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    items.push(
      `Word at the good end of the room is of the rush at ${CAMP_DEFS[state.rush.camp].name}: drays on the road all night, and the ground going as fast as men can drive a stake.`,
    );
  }
  if (state.hunt && state.hunt.untilDay >= state.day) {
    items.push(
      `A man who drinks with the camp clerks says the troopers mean to inspect licences at ${CAMP_DEFS[state.hunt.camp].name} within the week. He says it quietly, and twice.`,
    );
  }
  const trend = rateTrend(state);
  if (trend === 'rising') {
    items.push(
      'The bank clerks are drinking together, which they do when gold is going up. A man with dust in his tent is advised to hold it a week.',
    );
  } else if (trend === 'easing') {
    items.push(
      'Talk is that the bank is paying less each morning than it did the morning before. Sell what you have, is the advice, and sell it early.',
    );
  }
  const camps = ['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[];
  const best = camps.reduce((a, b) => (state.freshness[a] >= state.freshness[b] ? a : b));
  const worst = camps.reduce((a, b) => (state.freshness[a] <= state.freshness[b] ? a : b));
  items.push(
    `The talk turns to which ground is worth pegging. The men who have been everywhere say ${CAMP_DEFS[best].name}, and they are not selling anything, which is a recommendation.`,
    `A party in from ${CAMP_DEFS[worst].name} says the wash there is going off and half of them mean to shift. They tell you before they tell the Angus, which is the whole use of standing here.`,
    `The price of flour is gone over in detail by three men who all buy from Briggs and all hate him. What comes of it is that a week's provisions at the diggings costs what a labourer in the towns earns in three.`,
    `Somebody has the licence question again, and the arithmetic of it: thirty shillings the month, one shilling the day, eighteen pounds the year. The room has heard it a hundred times and listens every time.`,
  );
  if (state.agitation >= 40) {
    items.push(
      'Talk at the good end of the room is of the fee, and of what is meant to be done about it. Names are used freely, which they were not a month ago.',
    );
  }
  const choices = avoid ? items.filter((i) => i !== avoid) : items;
  return rng.pick(choices.length > 0 ? choices : items);
}

/**
 * The landlord's table: one word a week, free, to the field's own man (§30.1).
 * An honest man is told what an honest man wants; a hunted one is told where
 * the traps are — the same table, the same fee, and it is nothing either way.
 */
export function landlordsTable(state: GameState, rng: RNG, log: Log, said?: string): boolean {
  // There is one landlord's table on this field and it is in Briggs Street.
  // A bark-roofed tent has no such institution, and at his own sly-grog shanty
  // the player is himself the landlord (§30.1; the shanty's own word is §28.3).
  if (venueFor(state) !== 'shamrock') return false;
  if (rumourTier(state) !== 'own') return false;
  if (state.estate.landlordOn > 0 && state.day - state.estate.landlordOn < LANDLORD_INTERVAL_DAYS) {
    return false;
  }
  state.estate.landlordOn = state.day;

  const hunted = state.legal === 'wanted criminal' || state.notoriety >= RECEPTION_FEARED_NOTORIETY;
  if (hunted) {
    const kind = rng.weighted([
      ['escort', 4],
      ['bank', 3],
      ['traveller', 4],
    ] as [string, number][]);
    if (kind === 'escort') {
      state.intel = {
        kind: 'escort',
        learnedOn: state.day,
        untilDay: state.day + INTEL_DAYS,
        strength: rng.int(4, 9),
      };
      log.say('shamrock.landlord.escort', { men: state.intel.strength ?? 6 }, 'good');
    } else if (kind === 'bank') {
      state.intel = { kind: 'bank', learnedOn: state.day, untilDay: state.day + INTEL_DAYS };
      log.say('shamrock.landlord.bank', undefined, 'good');
    } else {
      const route: Route = rng.chance(0.5) ? 'trickeys' : 'pass';
      state.intel = { kind: 'traveller', learnedOn: state.day, untilDay: state.day + 3, route };
      log.say(
        'shamrock.landlord.traveller',
        { road: route === 'pass' ? 'the Pass Road' : "Trickey's Track" },
        'good',
      );
    }
    return true;
  }

  log.say('shamrock.landlord.honest', undefined, 'good');
  if (!maybeRumour(state, rng, log, 12)) log.raw(houseNews(state, rng, said), 'good');
  return true;
}

/** What the room is willing to tell him tonight, by tier (§30.1). */
function talkOfTheRoom(state: GameState, rng: RNG, log: Log, boost = 1): void {
  const tier = rumourTier(state);
  if (tier === 'feared') {
    // Benches clear and talk stops: there is nothing to hear from a room that
    // has stopped speaking.
    return;
  }
  if (tier === 'chum') {
    // Nobody talks to a stranger; a shout will buy a word out of them.
    if (rng.chance(0.4)) log.say('shamrock.talk.vague', undefined, 'neutral');
    if (boost > 1) maybeRumour(state, rng, log, boost * 0.5);
    return;
  }
  if (tier === 'known') {
    maybeRumour(state, rng, log, 2 * boost);
    return;
  }
  // Respected and better: word arrives unasked, one item a visit.
  const said = houseNews(state, rng);
  log.raw(said, 'neutral');
  maybeRumour(state, rng, log, 3 * boost);
  landlordsTable(state, rng, log, said);
}

// ---------------------------------------------------------------------------
// Drinking (§8.6, priced by §31.4)
// ---------------------------------------------------------------------------

/**
 * An evening's drinking. Returns the days it cost, or zero if the player was
 * turned away for want of the money.
 */
export function drinkAt(state: GameState, rng: RNG, log: Log, what: DrinkId): number {
  const venue = venueFor(state);
  if (!venue) {
    log.raw('There is no house here to drink in.', 'bad');
    return 0;
  }
  const cost = DRINKS[what][venue];
  if (state.moneyPence < cost) {
    log.raw('The grog seller has heard your sort of promise before.', 'bad');
    return 0;
  }
  state.moneyPence -= cost;
  const tier = receptionTier(state);

  // Some nights the room shouts the field's own man, and it is worth more than
  // the drink (§30.1).
  if (tier === 'own' && venue !== 'suze' && rng.chance(HOUSE_SHOUTS_CHANCE)) {
    state.moneyPence += cost;
    log.say('shamrock.house.shouts', undefined, 'good');
    heal(state, 1);
  }
  // The dark mirror: an admirer stands the wild colonial boy a drink, and a
  // word about who has been asking after him (§30.1, §23.5).
  if (
    tier === 'feared' &&
    state.diggersRobbed === 0 &&
    state.estate.warnedUntilDay < state.day && // one friend at a time is plenty
    rng.chance(ADMIRER_CHANCE)
  ) {
    state.moneyPence += cost;
    state.estate.warnedUntilDay = state.day + WARNING_DAYS;
    log.say('shamrock.admirer', undefined, 'good');
  }

  let relief = DRINK_RELIEF[what];
  if (tier === 'chum') relief = Math.max(1, Math.floor(relief * NEW_CHUM_DRINK_FACTOR));

  const house = venue !== 'camp';
  if (rng.chance(0.7)) {
    log.say(house ? 'drink.good.house' : 'drink.good', undefined, 'good');
    heal(state, relief);
  } else {
    // A stranger is turned out into the mud with his pockets emptied. A man the
    // room knows is walked home, and counted short only what he spent (§30.1).
    let lost = Math.floor(state.moneyPence * rng.range(0.2, 0.7));
    const looked = LOSS_CAP[tier];
    const minded = lost > looked;
    if (minded) lost = looked;
    state.moneyPence -= lost;
    log.say(
      minded
        ? tier === 'feared'
          ? 'drink.bad.feared'
          : 'drink.bad.minded'
        : house
          ? 'drink.bad.house'
          : 'drink.bad',
      { loss: formatMoney(lost) },
      'bad',
    );
    if (rng.chance(minded ? 0.08 : 0.2)) damage(state, rng.int(3, 10), 'a drunken fall');
    if (state.gameOver) return 1;
  }

  // The grog tent's liquor is its own hazard: colonial rum, and what is in it
  // was never in a cask (§31.4).
  if (venue === 'camp' && rng.chance(GROG_TENT_ILLNESS)) {
    log.say('shamrock.grog.bad', undefined, 'bad');
    contract(state, rng, log, 'dysentery', 1);
    if (state.gameOver) return 1;
  }

  talkOfTheRoom(state, rng, log);
  informerRoll(state, rng, log);
  return 1;
}

/** A wanted man drinking in a public room is a wanted man being looked at. */
export function informerRoll(state: GameState, rng: RNG, log: Log): void {
  if (state.legal !== 'wanted criminal') return;
  if (!rng.chance(INFORMER_DRINK_CHANCE)) return;
  state.estate.informerUntilDay = state.day + INFORMER_DAYS;
  log.say('shamrock.informer', undefined, 'bad');
}

// ---------------------------------------------------------------------------
// Shouting the bar (§30.2)
// ---------------------------------------------------------------------------

export interface ShoutResult {
  /** Days the night cost; zero if he could not pay for it. */
  days: number;
  cost: number;
  heads: number;
}

/** The heads in the room, by house. */
export function headsPresent(state: GameState, rng: RNG): number {
  const venue = venueFor(state);
  const band = venue === 'shamrock' ? SHOUT_HEADS.town : SHOUT_HEADS.camp;
  return rng.int(band.lo, band.hi);
}

export function ownsThisHouse(state: GameState): boolean {
  return state.location === 'fields-town' && state.estate.shamrock;
}

export function ownsThisShanty(state: GameState): boolean {
  return isCamp(state.location) && state.estate.shanty === state.location;
}

/**
 * Shout the room, or go the whole gold-mad performance. The sources are full
 * of men who ate £10 notes in mutton sandwiches; this is where that money went.
 */
export function shoutTheBar(state: GameState, rng: RNG, log: Log, spree: boolean): ShoutResult {
  const venue = venueFor(state);
  if (venue !== 'shamrock' && venue !== 'camp') {
    log.raw('There is no room here worth the shouting.', 'bad');
    return { days: 0, cost: 0, heads: 0 };
  }
  const heads = headsPresent(state, rng);
  let cost = spree ? rng.int(SPREE_COST.lo, SPREE_COST.hi) : SHOUT_HEAD_COST * heads;
  // The wholesale price of generosity: a man's own house sells to him at cost.
  if (ownsThisHouse(state)) cost = Math.round(cost * OWN_HOUSE_SHOUT_FACTOR);
  if (state.moneyPence < cost) {
    log.raw(
      spree
        ? 'A spree wants fifteen or twenty pounds in your hand before it wants anything else, and you have not got it.'
        : 'You count the heads, and then your money, and think better of it.',
      'bad',
    );
    return { days: 0, cost: 0, heads };
  }
  state.moneyPence -= cost;

  if (spree) return spreeNight(state, rng, log, cost, heads);
  return shoutRound(state, rng, log, cost, heads);
}

function shoutRound(
  state: GameState,
  rng: RNG,
  log: Log,
  cost: number,
  heads: number,
): ShoutResult {
  log.say(
    ownsThisHouse(state) ? 'shout.ownhouse' : venueFor(state) === 'shamrock' ? 'shout.town' : 'shout.camp',
    { heads, cost: formatMoney(cost) },
    'good',
  );
  if (ownsThisShanty(state)) {
    darkHouse(state, log, false);
  } else {
    payStanding(state, log, SHOUT_STANDING);
  }
  heal(state, SHOUT_HEAL);
  // The room talks, and talks better to a man who has just filled its glasses.
  talkOfTheRoom(state, rng, log, venueFor(state) === 'shamrock' ? 2 : 1.5);
  informerRoll(state, rng, log);
  return { days: 1, cost, heads };
}

function spreeNight(
  state: GameState,
  rng: RNG,
  log: Log,
  cost: number,
  heads: number,
): ShoutResult {
  log.say('shout.spree', { heads, cost: formatMoney(cost) }, 'good');
  if (ownsThisShanty(state)) {
    darkHouse(state, log, true);
  } else {
    payStanding(state, log, SPREE_STANDING);
  }
  // The town knows he is flush, and the town includes men who take an interest
  // in that sort of information (§30.2).
  state.estate.flushUntilDay = state.day + FLUSH_DAYS;
  // A night under his own roof is a week's custom for the house after it; a
  // night in somebody else's tent is only a hole in his pocket (§30.2).
  if (ownsThisHouse(state)) state.estate.houseSpreeOn = state.day;
  addJournal(
    state,
    `Shouted champagne for the whole house at ${venueFor(state) === 'shamrock' ? 'the Shamrock' : 'the grog tent'} — ${formatMoney(cost)} gone in a night, and worth it at the time.`,
    'neutral',
  );
  talkOfTheRoom(state, rng, log);
  informerRoll(state, rng, log);
  damage(state, SPREE_HEALTH, 'a night of champagne');
  if (state.gameOver) return { days: 1, cost, heads };
  log.say('shout.spree.morning', { date: formatDate(state.day + 1) }, 'neutral');
  return { days: 2, cost, heads }; // the night, and the day that is no use to anybody
}

/** Generosity is remembered; extravagance twice in a fortnight is mocked (§30.3). */
function payStanding(state: GameState, log: Log, amount: number): void {
  // Nought means he has never shouted at all, not that he shouted on day nought.
  if (state.estate.shoutedOn > 0 && state.day - state.estate.shoutedOn < SHOUT_CAP_DAYS) {
    log.say('shout.capped', undefined, 'neutral');
    return;
  }
  state.estate.shoutedOn = state.day;
  addStanding(state, amount);
  log.say('shout.standing', undefined, 'good');
}

/**
 * A wanted man shouting his own sly-grog shanty buys loyalty, not standing
 * (§30.2): the men in that room have no name to give him.
 */
function darkHouse(state: GameState, log: Log, spree: boolean): void {
  let bought = 0;
  for (const member of state.gang) {
    member.loyalty = Math.min(1, member.loyalty + SHOUT_GANG_LOYALTY * (spree ? 2 : 1));
    bought += 1;
  }
  state.estate.warnedUntilDay = state.day + SHANTY_WARNING_DAYS;
  log.say(bought > 0 ? 'shout.shanty' : 'shout.shanty.alone', { men: bought }, 'good');
}
