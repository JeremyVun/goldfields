import {
  CAMP_DEFS,
  FRESHNESS_DECAY_PER_DAY,
  FLUSH_ROBBERY_FACTOR,
  FRESHNESS_FLOOR,
  HUNT_WARNING_CHANCE,
  RACE_FRESHNESS_FACTOR,
  RUSH_CHANCE_PER_DAY,
  SHAMROCK_RUSH_LEAD_DAYS,
  RUSH_DAYS,
  RUSH_FACTOR,
  SECRET_GENUINE_CHANCE,
  SECRET_RUMOUR_CHANCE,
} from './constants';
import { courtCalmFactor, storekeeperFactor } from './estate';
import { damage } from './health';
import { pursuitRisk } from './law';
import { formatGold, formatMoney, goldValue, pounds } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, betrayalFactor, hasWork, isCamp } from './state';
import { season } from './time';
import { CAMPS, type CampId, type GameState } from './types';

/** The three camps a man may reasonably walk to; the desert working is another matter. */
const ORDINARY_CAMPS: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];

/**
 * Ground is picked over as the year goes on. A rush lifts a camp to its full
 * factor and then falls away to what it was — so the first men on the ground
 * peg the best of it (§17.2).
 */
export function freshnessTick(state: GameState): void {
  for (const camp of ORDINARY_CAMPS) {
    const rush = state.rush;
    if (rush && rush.camp === camp && rush.since <= state.day && rush.untilDay >= state.day) {
      const span = Math.max(1, rush.untilDay - rush.since);
      const left = Math.max(0, Math.min(span, rush.untilDay - state.day));
      state.freshness[camp] = rush.base + (rush.factor - rush.base) * (left / span);
    } else {
      // Water washes more ground, and a camp with a race in it goes off
      // slower than one where every dish is carried to the creek (§27).
      const decay =
        FRESHNESS_DECAY_PER_DAY * (hasWork(state, 'waterRace', camp) ? RACE_FRESHNESS_FACTOR : 1);
      state.freshness[camp] = Math.max(FRESHNESS_FLOOR, state.freshness[camp] - decay);
    }
  }
}

/** World news ticks along whether the player hears of it or not. */
export function newsTick(state: GameState, rng: RNG): void {
  if (state.rush && state.rush.untilDay < state.day) state.rush = null;
  if (state.hunt && state.hunt.untilDay < state.day) state.hunt = null;

  if (!state.rush && rng.chance(RUSH_CHANCE_PER_DAY)) {
    const camp = rng.pick(ORDINARY_CAMPS);
    // Word of heavy wash takes a couple of days to reach the other camps and
    // the Angus's compositor; the ground is not rushed until it does. A man
    // who keeps the Shamrock hears it the night it happens (§26).
    const since = state.day + SHAMROCK_RUSH_LEAD_DAYS;
    state.rush = {
      camp,
      untilDay: since + rng.int(RUSH_DAYS.lo, RUSH_DAYS.hi),
      factor: rng.range(RUSH_FACTOR.lo, RUSH_FACTOR.hi),
      since,
      base: state.freshness[camp],
    };
  }

  freshnessTick(state);
  if (!state.hunt && rng.chance(HUNT_WARNING_CHANCE)) {
    state.hunt = {
      camp: rng.pick(['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]),
      untilDay: state.day + rng.int(3, 9),
    };
  }
  if (state.secret && state.day - state.secret.heardOn > 60 && !state.secret.chased) {
    state.secret = null; // stale talk
  }
}

/**
 * Rumours of a secret mine reach the player through the Gazette, the bar of the
 * Shamrock, or talk around a camp fire. At most one genuine chance a year.
 */
export function maybeRumour(state: GameState, rng: RNG, log: Log, boost = 1): boolean {
  if (state.secret) return false;
  if (!rng.chance(SECRET_RUMOUR_CHANCE * boost)) return false;
  const genuine = !state.secretGenuineUsed && rng.chance(SECRET_GENUINE_CHANCE);
  const from: CampId = isCamp(state.location)
    ? (state.location as CampId)
    : rng.pick(['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]);
  state.secret = { heard: true, genuine, chased: false, fromCamp: from, heardOn: state.day };
  log.say('rumour.secret', { camp: CAMP_DEFS[from].name }, 'neutral');
  // All the rumour traffic of the field runs across the landlord's own bar,
  // and his barman knows which teller was drunk (§26).
  if (state.estate.shamrock) {
    log.say(genuine ? 'estate.shamrock.rumour.genuine' : 'estate.shamrock.rumour.hoax', undefined, genuine ? 'good' : 'neutral');
  }
  addJournal(state, `Heard talk of a secret mine out beyond ${CAMP_DEFS[from].name}.`, 'neutral');
  return true;
}

/**
 * A man who shouted champagne for the house on Tuesday is a man worth robbing
 * on Wednesday. Every theft and bail-up roll against him is the dearer for it
 * while the town remembers (§30.2).
 */
export function flushFactor(state: GameState): number {
  return state.day <= state.estate.flushUntilDay ? FLUSH_ROBBERY_FACTOR : 1;
}

/** Night in a camp: candle-lighters, fires, grog tents, and the Snakey Gully din. */
export function nightAtCamp(state: GameState, rng: RNG, log: Log): void {
  if (!isCamp(state.location)) return;
  const def = CAMP_DEFS[state.location];

  // Tent robbery. A tent and a loaded gun both help (faithful advice).
  let theft =
    0.022 * def.crime * betrayalFactor(state) * storekeeperFactor(state) * courtCalmFactor(state) * flushFactor(state);
  if (state.items.gun > 0) theft *= 0.45;
  if (state.items.tent < 1) theft *= 1.6;
  if (state.partner) theft *= 0.5; // one of you is always at the tent
  if (rng.chance(theft)) {
    if (state.items.gun > 0 && rng.chance(0.35)) {
      log.say('night.thief.deterred', undefined, 'good');
    } else {
      state.stats.timesRobbed += 1;
      const takeGold = state.goldCentiOz > 0 && rng.chance(0.6);
      if (takeGold) {
        const lost = Math.floor(state.goldCentiOz * rng.range(0.3, 0.9));
        state.goldCentiOz -= lost;
        log.say('night.robbed.gold', { gold: formatGold(lost) }, 'bad');
        addJournal(state, `Candle-lighters took ${formatGold(lost)} from the tent.`, 'bad');
      } else {
        const lost = Math.floor(state.moneyPence * rng.range(0.25, 0.8));
        state.moneyPence -= lost;
        log.say('night.robbed', { loss: formatMoney(lost) }, 'bad');
        addJournal(state, `Robbed of ${formatMoney(lost)} in the night.`, 'bad');
      }
    }
    return;
  }

  // Fire in the canvas town.
  if (rng.chance(0.004) && state.items.tent > 0) {
    state.items.tent = Math.max(0, state.items.tent - 1);
    const lost = Math.floor(state.moneyPence * rng.range(0, 0.15));
    state.moneyPence -= lost;
    log.say('night.fire', { loss: formatMoney(lost) }, 'bad');
    return;
  }

  if (state.location === 'snakey-gully' && rng.chance(0.16)) {
    log.say('night.snakey.din', undefined, 'neutral');
    if (rng.chance(0.05)) damage(state, rng.int(2, 6), 'a drunken brawl');
    return;
  }

  const roll = rng.next();
  if (roll < 0.1) log.say('night.rumour', undefined, 'neutral');
  else if (roll < 0.14) log.say('night.grogtent', undefined, 'neutral');
  else if (roll < 0.2) log.say('night.quiet', undefined, 'neutral');

  maybeRumour(state, rng, log, 0.9);
}

/** Theft and mischief for those living rough in the towns. */
export function nightInTown(state: GameState, rng: RNG, log: Log): void {
  const safety =
    state.lodging === 'inn'
      ? 0.97
      : state.lodging === 'tentground'
        ? 0.93
        : state.lodging === 'stable'
          ? 0.9
          : 0.85;
  const p = (1 - safety) * 0.12 * flushFactor(state);
  if (rng.chance(p) && state.moneyPence > 0) {
    state.stats.timesRobbed += 1;
    const lost = Math.floor(state.moneyPence * rng.range(0.2, 0.6));
    state.moneyPence -= lost;
    log.say('night.robbed', { loss: formatMoney(lost) }, 'bad');
    addJournal(state, `Robbed of ${formatMoney(lost)} while you slept.`, 'bad');
  }
}

/**
 * Wanted men are hunted; proclaimed men are hunted harder, and by parties that
 * come with warrants and carbines (§24). A man on the road has the road's own
 * troubles and is left to them.
 */
export function pursuitTick(state: GameState, rng: RNG, log: Log): boolean {
  if (state.legal !== 'wanted criminal') return false;
  if (state.location === 'on-road') return false;

  // An informer slipped out of the bar three nights ago; the traps come of
  // that, and they come inside the three days (§30.1).
  const informed = state.estate.informerUntilDay >= state.day;
  const sold = informed && (state.estate.informerUntilDay === state.day || rng.chance(0.5));
  if (!sold && !rng.chance(pursuitRisk(state))) return false;
  if (informed) state.estate.informerUntilDay = 0;

  // A word from an admirer, or from your own harbourers, is worth a night's
  // start on them (§30.1, §30.2).
  if (state.estate.warnedUntilDay >= state.day) {
    state.estate.warnedUntilDay = 0;
    log.say('shamrock.warned.dodge', undefined, 'good');
    return false;
  }
  log.say(state.outlawed ? 'bandit.pursuit' : 'police.pursuit', undefined, 'bad');
  return true;
}

/** Weather colour for the day, and the small tolls it takes. */
export function weatherTick(state: GameState, rng: RNG, log: Log, verbose: boolean): void {
  const s = season(state.day);
  if (!verbose) return;
  // Where a race has been cut the summer is a different season entirely, and
  // the player is shown the rule he struck out of the dice (§27).
  if (s === 'summer' && isCamp(state.location) && hasWork(state, 'waterRace', state.location) && rng.chance(0.5)) {
    log.say('works.race.absence', undefined, 'good');
    return;
  }
  if (s === 'summer' && rng.chance(0.3)) log.say('day.heat', undefined, 'neutral');
  else if (s === 'winter' && rng.chance(0.3)) log.say('day.mud', undefined, 'neutral');
  else if (rng.chance(0.12)) log.say('day.fair', undefined, 'neutral');
}

/** Claim-jumpers take unattended ground (faithful). */
export function claimJumpCheck(state: GameState, rng: RNG, log: Log, camp: CampId): void {
  if (!state.claims[camp]) return;
  const mate = state.partner || state.mateUntilDay >= state.day;
  let p =
    0.012 *
    CAMP_DEFS[camp].crime *
    betrayalFactor(state) *
    storekeeperFactor(state, camp) *
    courtCalmFactor(state);
  if (state.items.gun > 0) p *= 0.5;
  if (mate) p *= 0.5;
  if (!rng.chance(p)) return;
  if ((state.items.gun > 0 || mate) && rng.chance(0.5)) {
    log.say('mine.claimjump.deterred', undefined, 'good');
    return;
  }
  state.claims[camp] = null;
  if (state.shaft && state.shaft.camp === camp) state.shaft = null;
  log.say('mine.claimjump', undefined, 'bad');
  addJournal(state, `Claim-jumpers took the ground at ${CAMP_DEFS[camp].name}.`, 'bad');
}

/** Year-end dividend on mining company shares. */
export function payDividends(state: GameState, rng: RNG, log: Log): void {
  if (state.shares <= 0) return;
  const fortune = rng.next();
  const mult = fortune < 0.28 ? 0 : rng.range(0.4, 4.5);
  const amount = Math.round(state.shares * pounds(5) * mult);
  if (amount <= 0) {
    log.say('shares.nothing', undefined, 'bad');
    return;
  }
  state.bankPence += amount;
  log.say('shares.dividend', { amount: formatMoney(amount) }, 'good');
  addJournal(state, `The company paid a dividend of ${formatMoney(amount)}.`, 'good');
}

/** Value of the chests of finery scavenged along the track. */
export function salvageValue(state: GameState, rng: RNG): number {
  let total = 0;
  for (let i = 0; i < state.salvage; i++) total += rng.int(pounds(1), pounds(4));
  return total;
}

export function goldWorth(state: GameState): number {
  return goldValue(state.goldCentiOz, state.bankRate);
}

export function randomCamp(rng: RNG): CampId {
  return rng.pick(CAMPS.filter((c) => c !== 'secret-mine'));
}
