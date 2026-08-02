import { season } from './time';
import type { Season } from './time';
import { agitationTick } from './agitation';
import { banditDayTick, banditWeek } from './bandit';
import { companyWeek } from './company';
import { estateDay, estateWeek } from './estate';
import { hearthDay } from './hearth';
import { sleepsAtHearth } from './hearth';
import { CAMP_DEFS, LODGING, STARVATION_HEALTH, THIRST_HEALTH_OTHER, THIRST_HEALTH_SUMMER } from './constants';
import { damage, nightlyHealth, warnIfGrave } from './health';
import { cleanDayTick, toTheLogs } from './law';
import { walkRate } from './market';
import type { Log } from './narrate';
import { nightAtCamp, nightInTown, newsTick, pursuitTick, weatherTick } from './events';
import type { RNG } from './rng';
import { checkYearEnd, hasWork, isCamp, lodgingAt, recordWorth } from './state';
import type { GameState } from './types';

export { checkYearEnd };

export interface DayCtx {
  /** Hard physical labour today (digging, humping a swag). */
  toil?: boolean;
  /** On the road; water is drunk and there are no lodgings to pay for. */
  travelling?: boolean;
  /** Narrate the small weather and camp colour. */
  verbose?: boolean;
  /** In gaol or hospital: fed and housed by others. */
  kept?: boolean;
}

/**
 * What the upkeep leaves for the caller to do with the day. `turn` is the only
 * outcome that lets the world move and `endDay` is its only reader, so a day
 * already spent — under the player, or in a spell of irons that ran a whole run
 * of days through `endDay` — is handed back as a value and cannot reach
 * `turnTheWorld` by falling out of the bottom of a block.
 */
type DayOutcome =
  /** He lived the day out; the world has still to turn on it. */
  | 'turn'
  /** Death, or the year's end. Nothing further happens to this day. */
  | 'spent'
  /** The kept days already turned the world for this day and the ones after. */
  | 'turned in irons';

function payLodging(state: GameState, log: Log): boolean {
  if (state.location !== 'suze-port' && state.location !== 'fields-town') return false;
  if (sleepsAtHearth(state)) return true;
  const slateford = state.location === 'fields-town';
  const lodging = lodgingAt(state);
  const setLodging = (kind: GameState['lodging']): void => {
    if (slateford) state.slatefordLodging = kind;
    else state.lodging = kind;
  };
  const paidUntil = slateford ? state.slatefordTentGroundPaidUntil : state.tentGroundPaidUntil;
  const setPaidUntil = (day: number): void => {
    if (slateford) state.slatefordTentGroundPaidUntil = day;
    else state.tentGroundPaidUntil = day;
  };
  if (lodging === 'rough') return false;

  if (lodging === 'tentground') {
    if (state.items.tent < 1) {
      setLodging('rough');
      log.raw('You have no tent to pitch on your rented patch, so you sleep in the open.', 'bad');
      return false;
    }
    if (paidUntil < state.day) {
      const rent = LODGING.tentground.weekly;
      if (state.moneyPence < rent) {
        setLodging('rough');
        log.raw('The ground-agent wants his five shillings and you have not got it.', 'bad');
        return false;
      }
      state.moneyPence -= rent;
      setPaidUntil(state.day + 6);
    }
    return false;
  }

  const nightly = lodging === 'inn' ? LODGING.inn.nightly : LODGING.stable.nightly;
  if (state.moneyPence < nightly) {
    setLodging('rough');
    log.raw('There is no bed for a man without the money for it. You sleep rough.', 'bad');
    return false;
  }
  state.moneyPence -= nightly;
  // A bed at these extraordinary prices includes the house's plain supper.
  return true;
}

function claimsDay(state: GameState, rng: RNG): void {
  const camps = ['damp-camp', 'snakey-gully', 'deep-mountains'] as const;
  for (const camp of camps) {
    const claim = state.claims[camp];
    if (!claim || claim.jumpedOn) continue;
    if (state.location === camp) {
      claim.lastAttendedDay = state.day;
      continue;
    }
    if (state.day - (claim.lastAttendedDay ?? claim.peggedOn) < 3) continue;
    const standingFactor = Math.max(0, 1 - state.standing / 100);
    const registeredFactor = claim.registered ? 0.45 : 1;
    const guardedFactor = (claim.guardedUntilDay ?? 0) >= state.day ? 0.15 : 1;
    const p = 0.012 * CAMP_DEFS[camp].crime * standingFactor * registeredFactor * guardedFactor;
    if (rng.chance(p)) claim.jumpedOn = state.day;
  }
}

/**
 * Troopers on the licence hunt have come up with the player: he is put to his
 * choice, taken to the logs, or left lying in a gully until they ride off.
 */
function huntedDown(state: GameState, rng: RNG, log: Log): DayOutcome {
  if (state.outlawed) {
    // A proclaimed man is put to his choice: stand, run, or give himself up.
    if (!state.pending) state.pending = { kind: 'patrol', data: { where: 'lodging' } };
    return 'turn';
  }
  if (!rng.chance(0.45)) {
    log.raw(
      'You go out the back of the tent and lie in a gully with the flies until the troopers have satisfied themselves and ridden off.',
      'good',
    );
    return 'turn';
  }
  const dayBefore = state.day;
  toTheLogs(state, rng, log, (days) => passKeptDays(state, rng, log, days));
  // Every day he lay in irons was an ordinary day for the world, and was run as
  // one; this day went by with the rest of them.
  if (state.day !== dayBefore) return 'turned in irons';
  if (state.gameOver || state.endOfYear) return 'spent';
  return 'turn';
}

/**
 * A day as it falls on the player himself: shelter, food, water, fatigue,
 * sickness, the night, the troopers — in the order a day is actually lived. It
 * turns nothing of the world; it says what is left to do with the day.
 */
function liveOutTheDay(state: GameState, rng: RNG, log: Log, ctx: DayCtx, s: Season): DayOutcome {
  weatherTick(state, rng, log, ctx.verbose || rng.chance(0.14));

  // Lodging is settled first because the inn and stable include a plain meal.
  const lodgedAndFed = !ctx.travelling && !ctx.kept ? payLodging(state, log) : false;

  // --- food -----------------------------------------------------------
  if (!ctx.kept && !lodgedAndFed && !state.fedToday) {
    if (state.provisionDays > 0) {
      state.provisionDays -= 1;
    } else {
      damage(state, STARVATION_HEALTH, 'starvation');
      if (ctx.verbose || rng.chance(0.4)) log.say('day.hungry', undefined, 'bad');
      if (state.gameOver) return 'spent';
    }
  }
  state.fedToday = false;

  // --- water ----------------------------------------------------------
  const inMajorTown = state.location === 'suze-port' || state.location === 'fields-town';
  const suppliedByRace = isCamp(state.location) && hasWork(state, 'waterRace', state.location);
  const needsWater = !inMajorTown && !suppliedByRace;
  if (needsWater && !ctx.kept) {
    if (state.waterDays > 0) {
      state.waterDays -= 1;
      if (state.horse === 'brumby' && state.waterDays === 0 && rng.chance(0.5)) {
        // Brumbies will find water, sometimes by scratching for it (faithful).
        state.waterDays = rng.int(2, 4);
        log.say('travel.water.brumby', undefined, 'good');
      }
    } else {
      const harm = s === 'summer' ? THIRST_HEALTH_SUMMER : THIRST_HEALTH_OTHER;
      damage(state, harm, 'thirst');
      log.say(s === 'summer' ? 'day.thirsty.summer' : 'day.thirsty', undefined, 'bad');
      if (state.gameOver) return 'spent';
    }
  }

  // --- greens, fatigue ------------------------------------------------
  state.daysWithoutGreens += 1;
  // Sunday is the diggers' day of rest, and even a gold-mad man takes it.
  if (ctx.toil && state.day % 7 !== 0) state.fatigue += 1;
  else state.fatigue = Math.max(0, state.fatigue - 2);
  if (ctx.toil && state.health < 40 && rng.chance(0.25)) {
    damage(state, rng.int(2, 5), 'overwork');
    if (state.gameOver) return 'spent';
  }

  // --- sickness -------------------------------------------------------
  if (!ctx.kept) {
    nightlyHealth(state, rng, log);
    if (state.gameOver) return 'spent';
  }

  // --- the night ------------------------------------------------------
  if (!ctx.travelling && !ctx.kept) {
    // A camp in the ranges that nobody knows of is the one safe bed a wanted
    // man has (§23.4): no thieves, no landlord, and no troopers.
    if (state.location === 'hideout') {
      // nothing whatever happens, which is the whole point of the place
    } else if (state.location === 'secret-mine') {
      // The expedition is not a camp: no storekeepers, thieves, troopers or camp incidents.
    } else if (isCamp(state.location)) nightAtCamp(state, rng, log);
    else if (!sleepsAtHearth(state)) nightInTown(state, rng, log);
    if (state.gameOver) return 'spent';
  }

  // --- a wanted man is hunted ------------------------------------------
  // Last on purpose: the hunt is the one path that can spend the day on its own
  // account, so there is nothing below it to fall through into.
  if (ctx.kept || !pursuitTick(state, rng, log)) return 'turn';
  return huntedDown(state, rng, log);
}

/**
 * The world turns one day. This is the only caller of the day's and the week's
 * ticks and the only place `state.day` moves, and `endDay` calls it from one
 * line only, on the one outcome that permits it: one call is one day.
 */
function turnTheWorld(state: GameState, rng: RNG, log: Log, ctx: DayCtx, s: Season): void {
  cleanDayTick(state, log);
  newsTick(state, rng);
  walkRate(state, rng);

  // Sunday: the diggers' day of rest, and the day the company settles its
  // books, pays its men and finds out what its scrip is worth (§19.2). The
  // books balanced, a man may reckon what he is worth (§21).
  if (state.day % 7 === 0) {
    companyWeek(state, rng, log);
    // The house, the counter, the paper and the shanty (§26, §28.3).
    estateWeek(state, rng, log);
    banditWeek(state, rng, log);
    recordWorth(state);
  }
  agitationTick(state, log, !ctx.kept);
  banditDayTick(state, log);
  estateDay(state, log);
  hearthDay(state, rng, log);
  claimsDay(state, rng);

  state.day += 1;

  // The season turning is the one calendar event a digger genuinely feels, and
  // it changes what every method and every price is worth. It gets said out
  // loud, four times a year, wherever the player happens to be standing.
  if (season(state.day) !== s) log.say(`season.turn.${season(state.day)}`, undefined, 'neutral');

  checkYearEnd(state);
}

/**
 * One day's upkeep, applied after whatever the player did with the day.
 * Every multi-day action loops through this.
 *
 * The day falls on the player first; the world turns on it after, and only if
 * the upkeep says the day is still there to be turned.
 */
export function endDay(state: GameState, rng: RNG, log: Log, ctx: DayCtx = {}): void {
  if (state.gameOver) return;
  const s = season(state.day);
  if (liveOutTheDay(state, rng, log, ctx, s) !== 'turn') return;
  warnIfGrave(state, log);
  turnTheWorld(state, rng, log, ctx, s);
}

/** Advance a run of days that the player has no say in (gaol, hospital, fever). */
export function passKeptDays(state: GameState, rng: RNG, log: Log, days: number): void {
  for (let i = 0; i < days && !state.gameOver && !state.endOfYear; i++) {
    endDay(state, rng, log, { kept: true });
  }
}
