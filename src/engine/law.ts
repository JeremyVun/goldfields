import {
  AGITATION_PER_HUNT,
  BRIBE_AMOUNT,
  BRIBE_SUCCESS,
  BRIBE_SUCCESS_WANTED,
  CLEAN_DAYS_TO_REFORM,
  FINE,
  HARD_LABOUR_DAYS,
  HUNT_CHANCE,
  HUNT_CHANCE_WARNED,
  LICENCE_COST,
  LICENCE_DAYS,
  MAGISTRATE_INTERVAL,
  MINERS_RIGHT_COST,
  MINERS_RIGHT_DAYS,
  SKILL_EVASION,
  STANDING_LICENCE,
  STANDING_PER_RUNG,
} from './constants';
import { captured, pursuitChance } from './bandit';
import { forfeitCommission, isJP, noBilled } from './estate';
import { damage } from './health';
import { formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import {
  addJournal,
  addStanding,
  agitationHuntFactor,
  bumpAgitation,
  checkYearEnd,
  inAftermath,
  isLicensed,
  legalRung,
  skillRank,
} from './state';
import { LEGAL_LADDER, type GameState } from './types';

/**
 * After the stockade the Council sells a miner's right — £1 for the year — and
 * the thirty-shilling licence is not offered at all (§20).
 */
function buyMinersRight(state: GameState, log: Log): boolean {
  if (state.moneyPence < MINERS_RIGHT_COST) {
    log.raw('A pound for the year, and you cannot raise a pound.', 'bad');
    return false;
  }
  state.moneyPence -= MINERS_RIGHT_COST;
  const from = Math.max(state.day, state.minersRightUntilDay + 1);
  state.minersRightUntilDay = from + MINERS_RIGHT_DAYS - 1;
  addStanding(state, STANDING_LICENCE);
  log.say('law.minersright', { until: state.minersRightUntilDay }, 'good');
  addJournal(state, 'Took out a miner’s right, one pound the year.', 'good');
  return true;
}

export function buyLicence(state: GameState, log: Log): boolean {
  if (inAftermath(state)) return buyMinersRight(state, log);
  if (state.moneyPence < LICENCE_COST) {
    log.raw('The clerk shakes his head. Thirty shillings, and you have not got it.', 'bad');
    return false;
  }
  state.moneyPence -= LICENCE_COST;
  const from = Math.max(state.day, state.licenceUntilDay + 1);
  state.licenceUntilDay = from + LICENCE_DAYS - 1;
  addStanding(state, STANDING_LICENCE);
  log.raw(
    `You pay thirty shillings and the clerk writes out a miner's licence, good until day ${state.licenceUntilDay}. Keep it about you; it must be produced whenever a trooper demands it.`,
    'good',
  );
  addJournal(state, 'Took out a miner’s licence.', 'neutral');
  return true;
}

export function worsen(state: GameState, log: Log, rungs = 1): void {
  const was = legalRung(state.legal);
  const idx = Math.min(LEGAL_LADDER.length - 1, was + rungs);
  const before = state.legal;
  state.legal = LEGAL_LADDER[idx];
  state.cleanDays = 0;
  // Anything worse than a petty scrape and the commission of the peace goes
  // with it, publicly (§28.1).
  if (idx >= 2) forfeitCommission(state, log);
  // A name is lost faster than it is made.
  addStanding(state, -STANDING_PER_RUNG * (idx - was));
  if (state.legal !== before) {
    log.raw(`Word gets about. You are reckoned a ${state.legal} now.`, 'bad');
    addJournal(state, `Reckoned a ${state.legal}.`, 'bad');
  }
}

export function cleanDayTick(state: GameState, log: Log): void {
  if (state.legal === 'honest') return;
  // Once a man is proclaimed there is no reforming him by keeping quiet: the
  // only ways off this road are the ones in §24.
  if (state.outlawed) return;
  state.cleanDays += 1;
  if (state.cleanDays >= CLEAN_DAYS_TO_REFORM) {
    state.cleanDays = 0;
    const idx = Math.max(0, legalRung(state.legal) - 1);
    state.legal = LEGAL_LADDER[idx];
    log.raw(
      state.legal === 'honest'
        ? 'Three clean months. The troopers have found fresher game, and your name is your own again.'
        : `Three clean months. They have you down as a ${state.legal} now, which is an improvement.`,
      'good',
    );
  }
}

/** Chance of a digger hunt on a given day's digging at a camp. */
export function huntChance(state: GameState): number {
  // The licence died with the stockade, and the hunts died with the licence.
  if (inAftermath(state)) return 0;
  let p = HUNT_CHANCE;
  if (state.hunt && state.hunt.camp === state.location && state.hunt.untilDay >= state.day) {
    p = HUNT_CHANCE_WARNED;
  }
  const rung = legalRung(state.legal);
  p += rung * 0.012; // a record draws attention
  return p * agitationHuntFactor(state);
}

export type HuntOutcome = 'none' | 'shown' | 'evaded' | 'caught';

/**
 * A trooper sweep. Returns 'caught' when the player must answer for it, in
 * which case the caller should raise the 'trooper' encounter.
 */
export function troopersCome(state: GameState, rng: RNG, log: Log): HuntOutcome {
  log.say('trooper.hunt', undefined, 'bad');
  // Every man stopped in a hunt is one more man for the meetings (§20).
  if (!state.stockadeDone) bumpAgitation(state, AGITATION_PER_HUNT);
  if (isLicensed(state)) {
    log.say('trooper.licence.ok', undefined, 'neutral');
    return 'shown';
  }
  // Some have made an art of hiding during the regular digger hunts (faithful).
  const known = Math.max(state.skill.wash, state.skill.shaft);
  const evade =
    0.32 -
    legalRung(state.legal) * 0.04 +
    (state.health > 60 ? 0.06 : -0.06) +
    SKILL_EVASION[skillRank(known)];
  if (rng.chance(Math.max(0.05, evade))) {
    state.stats.huntsEvaded += 1;
    log.say('trooper.evade', undefined, 'good');
    return 'evaded';
  }
  log.say('trooper.caught', undefined, 'bad');
  return 'caught';
}

export function daysUntilMagistrate(day: number): number {
  const r = day % MAGISTRATE_INTERVAL;
  return r === 0 ? MAGISTRATE_INTERVAL : MAGISTRATE_INTERVAL - r;
}

export function offerBribe(state: GameState, rng: RNG, log: Log): 'released' | 'logs' | 'nomoney' {
  if (state.moneyPence < BRIBE_AMOUNT) {
    log.raw('You reach for a five pound note and find you have not got one.', 'bad');
    return 'nomoney';
  }
  const p = state.legal === 'wanted criminal' ? BRIBE_SUCCESS_WANTED : BRIBE_SUCCESS;
  state.moneyPence -= BRIBE_AMOUNT;
  state.stats.bribesPaid += 1;
  if (rng.chance(p)) {
    log.say('trooper.bribe.ok', { amount: formatMoney(BRIBE_AMOUNT) }, 'good');
    addJournal(state, 'Bought a trooper off with a fiver.', 'neutral');
    return 'released';
  }
  log.say('trooper.bribe.fail', { amount: formatMoney(BRIBE_AMOUNT) }, 'bad');
  worsen(state, log, 1);
  return 'logs';
}

/** Bolt for the scrub. */
export function makeRun(state: GameState, rng: RNG, log: Log): 'escaped' | 'logs' {
  const p = 0.4 + (state.health > 70 ? 0.12 : -0.1) - (state.horse === 'none' ? 0 : -0.08);
  if (rng.chance(Math.max(0.08, p))) {
    log.raw(
      'You go over the mullock heaps and into the scrub with a trooper roaring behind you. He gives it up before you do.',
      'good',
    );
    worsen(state, log, 1);
    return 'escaped';
  }
  log.raw('You are run down within fifty yards and handled roughly for the trouble.', 'bad');
  damage(state, rng.int(3, 9), 'a trooper’s baton');
  worsen(state, log, 1);
  return 'logs';
}

/**
 * Chained to the logs to await the travelling magistrate (faithful), then the
 * fine, or thirty days' hard labour if you cannot pay.
 */
export function toTheLogs(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept: (days: number) => void = (days) => { state.day += days; },
): void {
  state.stats.timesArrested += 1;
  log.say('trooper.logs', undefined, 'bad');
  const wait = daysUntilMagistrate(state.day);
  state.onLogs = true;
  state.logsSince = state.day;
  state.location = 'fields-town';
  state.journey = null;
  advanceKept(wait);
  damage(state, Math.round(wait * 0.5), 'the logs');
  checkYearEnd(state);
  log.raw(
    `You wait ${wait} day${wait === 1 ? '' : 's'} in irons, fed on gaol rations, while the field goes on being dug by other men.`,
    'bad',
  );
  if (state.gameOver) return;

  log.say('court.magistrate', undefined, 'neutral');
  // A gentleman who sits on this bench himself on the first Monday of the
  // month is not fined by it (§28.1).
  if (isJP(state)) {
    noBilled(state, log);
    state.onLogs = false;
    state.fineOwed = 0;
    checkYearEnd(state);
    return;
  }
  const fine = rng.int(FINE.lo, FINE.hi);
  const purse = state.moneyPence + state.bankPence;
  if (purse >= fine) {
    let owed = fine;
    const fromHand = Math.min(owed, state.moneyPence);
    state.moneyPence -= fromHand;
    owed -= fromHand;
    state.bankPence -= owed;
    log.say('court.fine', { fine: formatMoney(fine) }, 'bad');
    log.say('court.released', undefined, 'neutral');
    worsen(state, log, 1);
    addJournal(state, `Fined ${formatMoney(fine)} for digging without a licence.`, 'bad');
  } else {
    log.say('court.hardlabour', undefined, 'bad');
    advanceKept(HARD_LABOUR_DAYS);
    damage(state, rng.int(10, 22), 'the chain gang');
    worsen(state, log, 2);
    addJournal(state, 'Thirty days on the chain gang, breaking rock.', 'bad');
  }
  state.onLogs = false;
  state.fineOwed = 0;
  checkYearEnd(state);
}

/**
 * Being wanted brings the troopers looking for you. For a proclaimed outlaw the
 * flat risk is replaced by the escalating pursuit of §24, which rises with the
 * heat of the district he is standing in and with his own name.
 */
export function pursuitRisk(state: GameState): number {
  if (state.outlawed) return pursuitChance(state);
  if (state.legal !== 'wanted criminal') return 0;
  if (state.location === 'fields-town' || state.location === 'suze-port') return 0.035;
  return 0.015;
}

/**
 * What follows being taken. A proclaimed outlaw does not wait on the monthly
 * magistrate; he waits on the assizes, and they hang men (§24).
 */
export function toGaol(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept?: (days: number) => void,
): void {
  if (state.outlawed) {
    captured(state, rng, log, 'town', advanceKept);
    return;
  }
  toTheLogs(state, rng, log, advanceKept);
}
