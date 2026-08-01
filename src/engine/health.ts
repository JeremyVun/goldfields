import { formatMoney } from './money';
import {
  AUTO_HOSPITAL_HEALTH,
  CAMP_DEFS,
  GRAVE_HEALTH,
  HEALTH_MAX,
  HOSPITAL_FEE_PER_DAY,
  RACE_SUMMER_FACTOR,
  SCURVY_DAYS,
  WARD_DISEASE_FACTOR,
} from './constants';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, checkYearEnd, hasWork, isCamp, lodgingAt } from './state';
import { season } from './time';
import type { GameState, IllnessId } from './types';

export const ILLNESS_NAMES: Record<IllnessId, string> = {
  dysentery: 'dysentery',
  typhoid: 'typhoid fever',
  scurvy: 'scurvy',
  sandyBlight: 'the Sandy Blight',
  sunstroke: 'sunstroke',
  snakebite: 'a snakebite',
  spiderbite: 'a spider bite',
  injury: 'your injury',
  fever: 'a low fever',
  exhaustion: 'utter exhaustion',
};

/**
 * The same afflictions with the article they take in a sentence — "the Sandy
 * Blight", "your injury", "a low fever" made definite. The prose slots this in
 * whole (`{illness}`, or `{Illness}` at the head of a sentence), so that no
 * template has to guess an article and print "the the Sandy Blight".
 */
const ILLNESS_THE: Record<IllnessId, string> = {
  dysentery: 'the dysentery',
  typhoid: 'the typhoid',
  scurvy: 'the scurvy',
  sandyBlight: 'the Sandy Blight',
  sunstroke: 'the sunstroke',
  snakebite: 'the snakebite',
  spiderbite: 'the spider bite',
  injury: 'your injury',
  fever: 'the fever',
  exhaustion: 'your exhaustion',
};

/** The vars every illness line takes: the phrase, and the phrase capitalised. */
export function illnessVars(id: IllnessId): { illness: string; Illness: string } {
  const phrase = ILLNESS_THE[id];
  return { illness: phrase, Illness: phrase.charAt(0).toUpperCase() + phrase.slice(1) };
}

const ONSET_KEY: Record<IllnessId, string> = {
  dysentery: 'ill.dysentery',
  typhoid: 'ill.typhoid',
  scurvy: 'ill.scurvy',
  sandyBlight: 'ill.sandyBlight',
  sunstroke: 'ill.sunstroke',
  snakebite: 'ill.snakebite',
  spiderbite: 'ill.spiderbite',
  injury: 'ill.injury',
  fever: 'ill.fever',
  exhaustion: 'ill.exhaustion',
};

/** Daily health cost by severity. */
const DRAIN = [0, 2, 5, 8];
/** Chance per day of throwing it off. */
const RECOVERY = [0, 0.15, 0.1, 0.07];

export function damage(state: GameState, amount: number, cause: string): void {
  state.health = Math.max(0, Math.round(state.health - amount));
  if (state.health <= 0 && !state.gameOver) {
    state.gameOver = 'dead';
    state.causeOfDeath = cause;
  }
}

export function heal(state: GameState, amount: number): void {
  state.health = Math.min(HEALTH_MAX, Math.round(state.health + amount));
}

export function contract(
  state: GameState,
  _rng: RNG,
  log: Log,
  id: IllnessId,
  severity: number,
): void {
  // A fresh affliction on top of an old one simply makes matters worse.
  if (state.illness && state.illness.id === id) {
    state.illness.severity = Math.min(3, state.illness.severity + 1);
    log.say('ill.worse', illnessVars(id), 'bad');
    return;
  }
  state.illness = {
    id,
    severity: Math.max(1, Math.min(3, severity)),
    since: state.day,
    blinding: id === 'sandyBlight',
  };
  state.stats.illnesses += 1;
  log.say(ONSET_KEY[id], undefined, 'bad');
  addJournal(state, `Struck down with ${ILLNESS_NAMES[id]}.`, 'bad');
}

/**
 * What Canvas House asks a day. A man who endowed the ward is never charged in
 * it, and the field pays half of what it used to (§27) — of which the player
 * only ever feels his own half of the bargain.
 */
export function hospitalFee(state: GameState): number {
  return hasWork(state, 'ward') ? 0 : HOSPITAL_FEE_PER_DAY;
}

/** Odds of falling sick tonight, given where and how the player is living. */
export function sicknessRisk(state: GameState): number {
  let risk = 0.005;
  const s = season(state.day);
  // A race at the camp halves what the summer does to a man: water at the head
  // of the flat, and no drinking out of the hole he washed dirt in (§27).
  const raced = isCamp(state.location) && hasWork(state, 'waterRace', state.location);

  if (state.location === 'suze-port' || state.location === 'fields-town') {
    const atHome = state.location === 'suze-port' && state.hearth.cottage &&
      (state.hearth.rung === 'wed' || state.hearth.rung === 'settled');
    const lodging = lodgingAt(state);
    if (atHome) risk += 0;
    else if (lodging === 'rough') risk += 0.014;
    else if (lodging === 'stable') risk += 0.008;
    else if (lodging === 'tentground') risk += 0.005;
    else risk += 0.002;
  } else if (isCamp(state.location)) {
    risk += 0.011 * CAMP_DEFS[state.location].squalor;
    if (state.items.tent < 1) risk += 0.009;
  } else {
    risk += 0.008; // on the road
  }

  if (state.provisionDays <= 0) risk += 0.012;
  if (state.waterDays <= 0 && s === 'summer' && !raced) risk += 0.01;
  if (s === 'summer') risk += 0.005 * (raced ? RACE_SUMMER_FACTOR : 1);
  if (s === 'winter') risk += 0.006;
  if (state.health < 50) risk *= 1.6;
  if (state.health < 30) risk *= 1.4;
  return risk;
}

/** Which affliction the field hands out, given season and place. */
export function rollIllness(state: GameState, rng: RNG): IllnessId {
  const s = season(state.day);
  // The diggers' ward carts the sick out before they infect a gully (§27).
  const ward = hasWork(state, 'ward') ? WARD_DISEASE_FACTOR : 1;
  const raced = isCamp(state.location) && hasWork(state, 'waterRace', state.location);
  const table: [IllnessId, number][] = [
    ['dysentery', 30 * ward], // the big killer (faithful)
    ['fever', 16],
    ['typhoid', 8 * ward],
  ];
  if (s === 'summer') {
    // Water at the camp strikes the Sandy Blight from its table altogether.
    if (!raced) table.push(['sandyBlight', 18]);
    table.push(['sunstroke', raced ? 14 * RACE_SUMMER_FACTOR : 14]);
  }
  if (s === 'winter') {
    table.push(['fever', 14]);
  }
  if (state.daysWithoutGreens > SCURVY_DAYS) table.push(['scurvy', 22]);
  if (state.location === 'snakey-gully') table.push(['snakebite', 8], ['spiderbite', 6]);
  else if (isCamp(state.location)) table.push(['snakebite', 3], ['spiderbite', 3]);
  return rng.weighted(table);
}

/** The overnight illness roll and the progress of any existing affliction. */
export function nightlyHealth(state: GameState, rng: RNG, log: Log): void {
  const s = season(state.day);

  if (state.illness) {
    const sev = state.illness.severity;
    damage(state, DRAIN[sev], ILLNESS_NAMES[state.illness.id]);
    if (state.gameOver) return;
    if (rng.chance(RECOVERY[sev])) {
      log.say('ill.recover', illnessVars(state.illness.id), 'good');
      state.illness = null;
    } else if (rng.chance(0.05) && sev < 3) {
      state.illness.severity = sev + 1;
      log.say('ill.worse', illnessVars(state.illness.id), 'bad');
    } else if (sev > 1 && rng.chance(0.08)) {
      // Convalescence: the worst of it passes even before the man is well.
      state.illness.severity = sev - 1;
    }
  } else {
    // Health mends slowly of its own accord, given food and a roof.
    if (state.health < HEALTH_MAX && state.provisionDays > 0) {
      heal(state, lodgingAt(state) === 'rough' && !isCamp(state.location) ? 2 : 3);
    }
  }

  if (rng.chance(sicknessRisk(state))) {
    const id = rollIllness(state, rng);
    const severity = rng.weighted([
      [1, 73],
      [2, 21],
      [3, 6],
    ]);
    contract(state, rng, log, id, severity);
  }

  if (state.fatigue > 20 && rng.chance(0.012 + (state.health < 40 ? 0.02 : 0))) {
    contract(state, rng, log, 'exhaustion', state.health < 35 ? 2 : 1);
    state.fatigue = 0;
  }

  // Now and then the player is shown the ward doing what the ward was
  // funded, since a rule struck from the dice is otherwise invisible.
  if (!state.illness && isCamp(state.location) && hasWork(state, 'ward') && rng.chance(0.012)) {
    log.say('works.ward.absence', undefined, 'good');
  }

  if (s === 'winter' && lodgingAt(state) === 'rough' && state.items.swag < 1) {
    damage(state, 2, 'exposure');
    log.say('day.cold.rough', undefined, 'bad');
  }
}

/**
 * A man at death's door ought to be told so, plainly, while there is still time
 * to rest or pay for a bed at Canvas House. Called at the close of every day,
 * after the night's mischief has had its turn.
 */
export function warnIfGrave(state: GameState, log: Log): void {
  if (state.gameOver) return;
  if (state.health > 0 && state.health <= GRAVE_HEALTH) {
    log.say('health.grave', undefined, 'bad');
  }
}

/**
 * Gravely ill away from town: the diggers cart you to Canvas House whether you
 * will or no, and the fees come out of your pocket (faithful).
 */
export function checkGrave(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept: (days: number) => void = (days) => { state.day += days; },
): boolean {
  if (state.gameOver) return false;
  if (state.health > AUTO_HOSPITAL_HEALTH) return false;
  // Only from the diggings and the road: the towns have their own doctors.
  if (!isCamp(state.location) && state.location !== 'on-road' && state.location !== 'hideout') {
    return false;
  }

  const days = rng.int(4, 10);
  const goesHome = state.hearth.cottage &&
    (state.hearth.rung === 'wed' || state.hearth.rung === 'settled');
  if (goesHome) {
    log.raw(`${state.hearth.intended?.name ?? 'Your people'} has you carried to the cottage at Port Gannet, not to Canvas House.`, 'good');
    state.location = 'suze-port';
    state.screen = 'hearth';
    state.journey = null;
    advanceKept(days);
    heal(state, rng.int(28, 44));
    if (state.illness && rng.chance(0.85)) state.illness = null;
    state.fatigue = 0;
    addJournal(state, `Carted home insensible; ${days} days under the cottage roof.`, 'neutral');
    checkYearEnd(state);
    return true;
  }
  const fee = hospitalFee(state) * days;
  const paid = Math.min(fee, state.moneyPence + state.bankPence);
  if (paid > state.moneyPence) {
    state.bankPence -= paid - state.moneyPence;
    state.moneyPence = 0;
  } else {
    state.moneyPence -= paid;
  }
  log.say('health.carted', { fee: formatMoney(paid) }, 'bad');
  state.location = 'fields-town';
  state.screen = 'ftown';
  state.journey = null;
  advanceKept(days);
  heal(state, rng.int(22, 38));
  if (state.illness && rng.chance(0.75)) state.illness = null;
  state.fatigue = 0;
  addJournal(state, `Carted insensible to Canvas House; ${days} days lost.`, 'bad');
  checkYearEnd(state);
  return true;
}

/**
 * A stay at Canvas House. Returns the number of days actually spent under care,
 * which is what the caller must advance the calendar by: a man who can only pay
 * for one day is turned out after one day, not kept (and charged) for seven.
 */
export function hospitalStay(state: GameState, rng: RNG, log: Log, days: number): number {
  const perDay = hospitalFee(state);
  if (state.moneyPence < perDay) {
    log.raw('Canvas House is charity in name only. Without ten shillings for the day, they cannot take you in.', 'bad');
    return 0;
  }
  const affordable = perDay === 0 ? days : Math.floor(state.moneyPence / perDay);
  const actualDays = Math.max(1, Math.min(days, affordable));
  const paid = perDay * actualDays;
  state.moneyPence -= paid;
  if (perDay === 0) log.say('works.ward.free', { days: actualDays }, 'good');
  else log.say('health.hospital', { days: actualDays, fee: formatMoney(paid) }, 'neutral');
  if (actualDays < days) {
    log.raw(
      `Your money runs to ${actualDays} day${actualDays === 1 ? '' : 's'} and no more, and out you go.`,
      'neutral',
    );
  }
  for (let i = 0; i < actualDays; i++) {
    heal(state, rng.int(9, 16));
    if (state.illness && rng.chance(0.35)) {
      log.say('ill.recover', illnessVars(state.illness.id), 'good');
      state.illness = null;
    }
  }
  state.fatigue = 0;
  return actualDays;
}
