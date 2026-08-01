import {
  BANK_RATE_CEILING,
  BANK_RATE_FLOOR,
  CAMP_RATE_FACTOR,
  GOUGE_CHANCE,
  GOUGE_MULTIPLIER,
  HORSE_PRICE,
  PRICES,
  PROVISIONS_CEILING,
  PROVISIONS_CHEAP,
  PROVISIONS_DEAR,
  PROVISIONS_FLOOR,
  PROVISIONS_RUSH_CAMP,
  PROVISIONS_RUSH_TOWN,
  PROVISIONS_SEASON,
  PROVISIONS_WEEK,
  RATE_TRAIL_DAYS,
  RATE_TREND_THRESHOLD,
  RATE_TREND_WINDOW,
  RATE_WALK_STEP,
  SHORT_WEIGHT_CHANCE,
  SHORT_WEIGHT_CHANCE_WATCHED,
  SHORT_WEIGHT_LOSS,
  STANDING_GOLD_SALE,
  STORE_RATE_FACTOR,
  WATER_FILL,
} from './constants';
import { formatGold, formatMoney, goldValue, shillings } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, addStanding, isCamp, legalRung } from './state';
import { season } from './time';
import { CAMPS, type GameState, type ItemId, type LocationId } from './types';

export type PriceTier = 'suze' | 'fields' | 'camp';

/** From wanted criminal, the honest institutions close their doors (§23.1). */
export function bankRefuses(state: GameState): boolean {
  return state.legal === 'wanted criminal';
}

export function tierFor(loc: LocationId): PriceTier {
  if (loc === 'suze-port') return 'suze';
  if (loc === 'fields-town') return 'fields';
  return 'camp';
}

// ---------------------------------------------------------------------------
// A small deterministic hash so that a day's prices and rates do not flicker
// each time the player opens a menu.
// ---------------------------------------------------------------------------

function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The bank's rate performs a small daily random walk within period bounds. */
export function walkRate(state: GameState, rng: RNG): void {
  const step = rng.int(-RATE_WALK_STEP, RATE_WALK_STEP);
  let r = state.bankRate + step;
  // Gentle pull back towards the middle of the band.
  const mid = (BANK_RATE_CEILING + BANK_RATE_FLOOR) / 2;
  r += Math.round((mid - r) * 0.04);
  state.bankRate = Math.max(BANK_RATE_FLOOR, Math.min(BANK_RATE_CEILING, Math.round(r)));
  state.rateTrail.push(state.bankRate);
  while (state.rateTrail.length > RATE_TRAIL_DAYS) state.rateTrail.shift();
}

// ---------------------------------------------------------------------------
// Which way gold has been going (§21)
// ---------------------------------------------------------------------------

export type RateTrend = 'rising' | 'easing' | 'steady';

/** What the rate stood at a week since, so far as the trail remembers. */
export function rateWeekAgo(state: GameState): number {
  const trail = state.rateTrail;
  if (trail.length === 0) return state.bankRate;
  const i = Math.max(0, trail.length - 1 - RATE_TREND_WINDOW);
  return trail[i];
}

/** No arrows and no figures: the word a storekeeper would use. */
export function rateTrend(state: GameState): RateTrend {
  const move = state.bankRate - rateWeekAgo(state);
  if (move >= RATE_TREND_THRESHOLD) return 'rising';
  if (move <= -RATE_TREND_THRESHOLD) return 'easing';
  return 'steady';
}

/** The sentence the kitty, the bank and the Times all put it in. */
export function rateTrendPhrase(state: GameState): string {
  const then = rateWeekAgo(state);
  switch (rateTrend(state)) {
    case 'rising':
      return `Gold is rising this week: ${formatMoney(then)} the ounce seven days since, and ${formatMoney(state.bankRate)} today.`;
    case 'easing':
      return `Gold is easing this week: ${formatMoney(then)} the ounce seven days since, and ${formatMoney(state.bankRate)} today.`;
    default:
      return `Gold is steady this week, and has scarcely stirred from ${formatMoney(then)} the ounce.`;
  }
}

/** What an ounce fetches here today. */
export function rateAt(state: GameState, where: LocationId): number {
  if (where === 'fields-town') return state.bankRate;
  if (where === 'suze-port') {
    const f = 0.88 + hash(state.day, 991) * 0.07;
    return Math.round(state.bankRate * f);
  }
  if (isCamp(where)) {
    const idx = CAMPS.indexOf(where);
    const f =
      CAMP_RATE_FACTOR.lo + hash(state.day, 17 + idx) * (CAMP_RATE_FACTOR.hi - CAMP_RATE_FACTOR.lo);
    return Math.round(state.bankRate * f);
  }
  return Math.round(state.bankRate * 0.7);
}

/** Bell's Outfitters in Slateford will take gold too, at a shave off the bank. */
export function storeRate(state: GameState): number {
  const f =
    STORE_RATE_FACTOR.lo + hash(state.day, 313) * (STORE_RATE_FACTOR.hi - STORE_RATE_FACTOR.lo);
  return Math.round(state.bankRate * f);
}

export function bestLocalRate(state: GameState): number {
  return rateAt(state, state.location);
}

// ---------------------------------------------------------------------------
// Goods
// ---------------------------------------------------------------------------

/** A visible staff discount earned behind Bell's counter. */
export function briggsDiscount(state: GameState): number {
  if (state.briggsBlacklisted) return 0;
  if (state.briggsDays >= 42) return 0.15;
  if (state.briggsDays >= 21) return 0.1;
  if (state.briggsDays >= 7) return 0.05;
  return 0;
}

export function briggsDiscountLabel(state: GameState): string {
  const pct = Math.round(briggsDiscount(state) * 100);
  const next = state.briggsDays < 7 ? 7 : state.briggsDays < 21 ? 21 : state.briggsDays < 42 ? 42 : null;
  if (state.briggsBlacklisted) return 'Blacklisted — no staff discount';
  if (next === null) return `Top staff standing — ${pct}% discount`;
  return `${state.briggsDays} days served — ${pct}% discount; next tier at ${next}`;
}

function briggsFactor(state: GameState): number {
  const discount = briggsDiscount(state);
  const recordMarkup = [0, 0.05, 0.1, 0.2, 0.35][Math.max(0, legalRung(state.legal))] ?? 0;
  return 1 - discount + recordMarkup;
}

export function priceOf(state: GameState, item: ItemId): number {
  // A man buying his own kit off his own shelves pays what the dray cost him
  // at Port Gannet, and not a farthing of the diggings margin (§26).
  const own = state.estate.store && state.estate.store.camp === state.location;
  const tier = own ? 'suze' : tierFor(state.location);
  const base = PRICES[item][tier];
  const isBriggs = !own && (state.location === 'suze-port' || state.location === 'fields-town');
  const shave = isBriggs ? briggsFactor(state) : 1;
  if (tier === 'suze') return Math.round(base * shave);
  // The Times recorded a miner's pan selling for £16 (faithful) — rare gouging.
  const roll = hash(state.day * 31 + item.length * 7, item.charCodeAt(0) * 13 + 5);
  if (roll < GOUGE_CHANCE) {
    const mult =
      GOUGE_MULTIPLIER.lo +
      hash(item.charCodeAt(1) ?? 3, state.day) * (GOUGE_MULTIPLIER.hi - GOUGE_MULTIPLIER.lo);
    return Math.round(base * mult * shave);
  }
  return Math.round(base * shave);
}

export function isGouged(state: GameState, item: ItemId): boolean {
  const isBriggs = state.location === 'suze-port' || state.location === 'fields-town';
  return priceOf(state, item) > Math.round(PRICES[item][tierFor(state.location)] * (isBriggs ? briggsFactor(state) : 1));
}

/**
 * Freight is the villain at the diggings (§31.3). A week's flour, tea and salt
 * mutton runs from 12s to 25s inland, according to the season and to whether
 * every dray on the road is bound for somebody else's rush. The wharf price at
 * Port Gannet never moves: the ships land there.
 */
export function provisionsPrice(state: GameState): number {
  const tier = tierFor(state.location);
  const base = PROVISIONS_WEEK[tier];
  if (tier === 'suze') return base;

  let price = base * PROVISIONS_SEASON[season(state.day)];
  // A rush prices flour only once it is running — the two days a landlord has
  // his word early are days the bullockies know nothing (§26, §31.3).
  const rush =
    state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day ? state.rush : null;
  if (rush) {
    price *= rush.camp === state.location ? PROVISIONS_RUSH_CAMP : PROVISIONS_RUSH_TOWN;
  }
  // A week's price holds for the week; the bullockies do not re-reckon daily.
  const wobble = 0.94 + hash(Math.floor(state.day / 7), tier.length * 17) * 0.12;
  price *= wobble;
  return Math.round(
    Math.max(PROVISIONS_FLOOR, Math.min(PROVISIONS_CEILING, price)) / 6,
  ) * 6; // to the nearest sixpence, as a storekeeper would write it
}

/**
 * What the storekeeper says about his own prices when they are at either
 * extreme — the faithful 5s loaf, the 5s bucket, £20 the hundredweight (§31.3).
 */
export function provisionsNote(state: GameState): string | undefined {
  if (tierFor(state.location) === 'suze') return undefined;
  const price = provisionsPrice(state);
  if (price >= PROVISIONS_DEAR) {
    return 'bread at five shillings the four-pound loaf, flour at £20 the hundredweight, and five shillings for a bucket of water';
  }
  if (price <= PROVISIONS_CHEAP) {
    return 'the drays are through and flour is as cheap as it has been; lay in while it lasts';
  }
  return undefined;
}

export function waterPrice(state: GameState): number {
  return WATER_FILL[tierFor(state.location)];
}

export function greensPrice(state: GameState): number {
  if (state.location === 'fields-town') return shillings(2); // Lin Wu's garden, just out of town
  if (state.location === 'suze-port') return shillings(1);
  return shillings(4);
}

export function buyItem(state: GameState, log: Log, item: ItemId, qty = 1): boolean {
  const unit = priceOf(state, item);
  const total = unit * qty;
  if (state.moneyPence < total) {
    log.raw('You count your money twice over. It is still not enough.', 'bad');
    return false;
  }
  state.moneyPence -= total;
  state.items[item] += qty;
  log.raw(`Bought ${qty > 1 ? qty + ' × ' : ''}${ITEM_NAMES[item]} for ${formatMoney(total)}.`, 'good');
  return true;
}

export const ITEM_NAMES: Record<ItemId, string> = {
  pan: 'a tin pan',
  cradle: 'a cradle',
  pick: 'a pick',
  shovel: 'a shovel',
  ropeBucket: 'rope and bucket',
  tent: 'a tent',
  swag: 'a blanket and swag',
  gun: 'a gun, loaded',
  waterBags: 'water bags',
  barrow: 'a wheelbarrow',
  timber: 'timber supports',
  pump: 'a pump',
  journal: "The New Chum's Companion",
};

/** What a thing is for — a new chum cannot be expected to know. */
export const ITEM_HINTS: Record<ItemId, string> = {
  pan: 'for washing a creek, and for trying the ground',
  cradle: 'washes far more dirt in a day than any pan',
  pick: 'wanted for dry digging and for sinking a shaft',
  shovel: 'wanted for puddling and for sinking a shaft',
  ropeBucket: 'for hauling washdirt up out of a shaft',
  tent: 'a roof of sorts; sickness and thieves favour the man without one',
  swag: 'a blanket for sleeping rough; winter is cruel without it',
  gun: 'thieves and bushrangers think better of an armed man',
  waterBags: 'each bag carries ten days of water',
  barrow: 'carries the cradle or the pump on the road, or they stay behind',
  timber: 'shores a shaft against collapse, one sinking per load',
  pump: 'keeps a wet shaft dry enough to work',
  journal: 'a book of sound advice on the fields, worth the reading',
};

/** Second-hand kit is valued from the port wholesale price, preventing inland arbitrage. */
export function buybackPriceOf(state: GameState, item: ItemId): number {
  void state;
  return Math.round(PRICES[item].suze / 4);
}

export function sellItem(state: GameState, log: Log, item: ItemId): boolean {
  if (state.items[item] < 1) {
    log.raw('You have none to sell.', 'neutral');
    return false;
  }
  const price = buybackPriceOf(state, item);
  state.items[item] -= 1;
  state.moneyPence += price;
  log.raw(`The storekeeper looks it over and gives you ${formatMoney(price)} for ${ITEM_NAMES[item]}.`, 'good');
  return true;
}

/** No man can hump more than about twelve weeks of flour and mutton. */
export const MAX_PROVISION_DAYS = 84;

export function provisionsQuote(state: GameState, weeks: number): { days: number; cost: number } {
  const days = Math.min(weeks * 7, Math.max(0, MAX_PROVISION_DAYS - state.provisionDays));
  const fullBulk = weeks === 4 && days === 28;
  const cost = Math.round((provisionsPrice(state) * days / 7) * (fullBulk ? 0.9 : 1));
  return { days, cost };
}

export function buyProvisions(state: GameState, log: Log, weeks: number): boolean {
  if (state.provisionDays >= MAX_PROVISION_DAYS) {
    log.raw(
      'You cannot carry another ounce of flour. Beginners who start out with too many belongings are forced to throw them away down the road.',
      'neutral',
    );
    return false;
  }
  const quote = provisionsQuote(state, weeks);
  const total = quote.cost;
  if (state.moneyPence < total) {
    log.raw('Flour, tea and mutton at these prices are beyond you today.', 'bad');
    return false;
  }
  state.moneyPence -= total;
  state.provisionDays += quote.days;
  log.raw(
    `Laid in ${quote.days} day${quote.days === 1 ? '' : 's'} of flour, tea and salt mutton for ${formatMoney(total)}${weeks === 4 && quote.days === 28 ? ', including the four-week discount' : ''}.`,
    'good',
  );
  // The extremes of the freight are worth saying aloud (§31.3).
  const note = provisionsNote(state);
  if (note) {
    log.raw(
      provisionsPrice(state) >= PROVISIONS_DEAR
        ? `The storekeeper charges what he likes and says so: ${note}.`
        : `He is almost apologetic about it: ${note}.`,
      provisionsPrice(state) >= PROVISIONS_DEAR ? 'bad' : 'good',
    );
  }
  return true;
}

export function fillWater(state: GameState, log: Log): boolean {
  if (state.items.waterBags < 1) {
    log.raw('You have nothing to carry water in.', 'bad');
    return false;
  }
  const total = waterPrice(state);
  if (state.moneyPence < total) {
    log.raw('Even water must be paid for here, and you cannot.', 'bad');
    return false;
  }
  state.moneyPence -= total;
  state.waterDays = 10 * state.items.waterBags;
  log.raw(`Filled the water bags for ${formatMoney(total)}.`, 'good');
  return true;
}

export function buyGreens(state: GameState, log: Log): boolean {
  const total = greensPrice(state);
  if (state.moneyPence < total) {
    log.raw('Lin Wu is civil about it, but he will not give cabbages away.', 'bad');
    return false;
  }
  state.moneyPence -= total;
  state.daysWithoutGreens = 0;
  state.health = Math.min(100, state.health + 3);
  log.raw(
    `Cabbages, onions and a bunch of greens from Lin Wu's garden, ${formatMoney(total)}. Your gums will thank you.`,
    'good',
  );
  return true;
}

export function buyHorse(state: GameState, rng: RNG, log: Log, kind: 'brumby' | 'hack'): boolean {
  const price = HORSE_PRICE[kind];
  if (state.moneyPence < price) {
    log.raw('The dealer looks you over, and looks away.', 'bad');
    return false;
  }
  state.moneyPence -= price;
  state.horse = kind;
  if (kind === 'brumby') {
    log.raw(
      'The rough-coated bay is yours. Away from the dealer’s rail, its endurance and bush sense begin to show.',
      'good',
    );
  } else {
    log.raw(
      'The tall chestnut is yours: fast on a made road, long-striding, and less certain when the track breaks up.',
      rng.chance(0.5) ? 'neutral' : 'bad',
    );
  }
  addJournal(state, `Bought ${kind === 'brumby' ? 'the rough-coated bay' : 'the tall chestnut'} for ${formatMoney(price)}.`, 'neutral');
  return true;
}

// ---------------------------------------------------------------------------
// Selling gold
// ---------------------------------------------------------------------------

export function sellGold(
  state: GameState,
  rng: RNG,
  log: Log,
  where: 'bank' | 'store' | 'camp',
  watch: boolean,
): number {
  if (state.goldCentiOz <= 0) {
    log.raw('You have no gold to weigh.', 'neutral');
    return 0;
  }
  if (where !== 'bank') {
    log.raw('Only the bank buys gold. The storekeeper points you towards its scales.', 'neutral');
    return 0;
  }
  // The banks will not weigh a wanted man's gold; there is a notice of him
  // pinned up behind the counter (§23.1). The shanty fence will, at his price.
  if (where === 'bank' && bankRefuses(state)) {
    log.say('bandit.bank.refused', undefined, 'bad');
    return 0;
  }
  const rate =
    where === 'bank'
      ? // The Slateford bank pays best in the colony; the Port Gannet branch shaves a little.
        state.location === 'suze-port'
        ? rateAt(state, 'suze-port')
        : state.bankRate
      : where === 'store'
        ? storeRate(state)
        : rateAt(state, state.location);

  let weighed = state.goldCentiOz;
  const cheatChance =
    where === 'bank' ? 0 : watch ? SHORT_WEIGHT_CHANCE_WATCHED : SHORT_WEIGHT_CHANCE;
  if (rng.chance(cheatChance)) {
    const loss = rng.range(SHORT_WEIGHT_LOSS.lo, SHORT_WEIGHT_LOSS.hi);
    weighed = Math.floor(weighed * (1 - loss));
    log.say('sell.shortweight', undefined, 'bad');
  } else if (watch && where !== 'bank') {
    log.say('sell.watched', undefined, 'neutral');
  }

  const money = goldValue(weighed, rate);
  state.goldCentiOz = 0;
  state.moneyPence += money;
  // A man who banks his gold is a man the field has heard of.
  if (where === 'bank') addStanding(state, STANDING_GOLD_SALE);
  const key = where === 'bank' ? 'sell.bank' : where === 'store' ? 'sell.store' : 'sell.camp';
  log.say(key, { gold: formatGold(weighed), money: formatMoney(money) }, 'good');
  log.raw(`The rate today was ${formatMoney(rate)} the ounce.`, 'neutral');
  addJournal(state, `Sold ${formatGold(weighed)} for ${formatMoney(money)}.`, 'good');
  return money;
}
