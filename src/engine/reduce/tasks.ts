import { JOBS, NO_WORK_CHANCE, REST_RECOVERY, STANDING_WAGE_DAY, WEEK_BONUS } from '../constants';
import { endDay, passKeptDays } from '../daily';
import { maybeRumour } from '../events';
import { checkGrave, damage, heal, hospitalStay, illnessVars } from '../health';
import { hearthHealBonus } from '../hearth';
import { licenceLapsedToday, mineOneDay } from '../mining';
import { formatGold, formatMoney } from '../money';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import { addJournal, addStanding, isCamp } from '../state';
import { arrive, travelOneDay } from '../travel';
import type { GameState, LocationId, Task } from '../types';
import { screenForLocation } from './screen';

// ---------------------------------------------------------------------------
// Multi-day tasks
// ---------------------------------------------------------------------------

function afterDay(state: GameState, rng: RNG, log: Log): boolean {
  if (state.gameOver) return false;
  checkGraveAfter(state, rng, log);
  if (state.gameOver) return false;
  if (state.endOfYear) return false;
  return true;
}

export function advanceKept(state: GameState, rng: RNG, log: Log, days: number): void {
  passKeptDays(state, rng, log, days);
}

export function checkGraveAfter(state: GameState, rng: RNG, log: Log): boolean {
  return checkGrave(state, rng, log, (days) => advanceKept(state, rng, log, days));
}

/**
 * A meeting or a rising raised at the end of a day breaks off whatever the
 * player was doing; the rest of the spell waits on his answer.
 */
function interrupt(state: GameState, task: Task | null): void {
  if (!state.pending || state.gameOver || state.endOfYear) return;
  state.resumeTask = task;
  state.screen = 'encounter';
}

function runWork(state: GameState, rng: RNG, log: Log, task: Task & { kind: 'work' }): void {
  const job = JOBS[task.job];
  let earned = 0;
  let daysDone = 0;
  let left = -1;
  for (let i = 0; i < task.days; i++) {
    if (state.illness?.blinding && rng.chance(0.5)) {
      log.say('ill.blind', undefined, 'bad');
      endDay(state, rng, log, {});
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = task.days - i - 1;
        break;
      }
      continue;
    }
    if (rng.chance(NO_WORK_CHANCE)) {
      log.say('work.none', undefined, 'neutral');
      endDay(state, rng, log, {});
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = task.days - i - 1;
        break;
      }
      continue;
    }
    let wage = rng.int(job.lo, job.hi);
    if (state.health < 40) wage = Math.round(wage * 0.7);
    state.moneyPence += wage;
    earned += wage;
    daysDone += 1;
    state.stats.daysWorked += 1;
    addStanding(state, STANDING_WAGE_DAY);

    switch (task.job) {
      case 'gardener':
        state.daysWithoutGreens = 0;
        if (rng.chance(0.4)) log.say('work.greens', undefined, 'good');
        heal(state, 1);
        break;
      case 'barman':
        if (rng.chance(0.05)) {
          log.say('work.barman.brawl', undefined, 'bad');
          damage(state, rng.int(3, 10), 'a brawl at the Crown & Cradle');
        }
        maybeRumour(state, rng, log, 3);
        break;
      case 'clerk':
        state.briggsDays += 1;
        if ([7, 21, 42].includes(state.briggsDays)) {
          const pct = state.briggsDays >= 42 ? 15 : state.briggsDays >= 21 ? 10 : 5;
          log.raw(`Bell enters you on a better staff tier: ${pct}% off his marked prices.`, 'good');
        }
        break;
      case 'orderly':
        if (rng.chance(0.15)) log.say('work.orderly.lesson', undefined, 'good');
        heal(state, 1);
        state.fedToday = true;
        break;
      default:
        break;
    }
    if (task.job === 'wharf') {
      state.fedToday = true;
      state.fatigue += 1;
      state.suzeStanding = Math.min(100, state.suzeStanding + 1);
    } else if (task.job === 'town') {
      state.suzeStanding = Math.min(100, state.suzeStanding + 2);
      state.horseKnowledge = Math.min(10, state.horseKnowledge + (rng.chance(0.35) ? 1 : 0));
      if (rng.chance(0.35)) state.fedToday = true;
    }
    // The Journal's own arithmetic: boom wages set against the colonial rate
    // of five shillings the week (§31.1).
    if ((task.job === 'wharf' || task.job === 'town') && rng.chance(0.12)) {
      log.say('work.boom', { wage: formatMoney(wage) }, 'good');
    }
    if (rng.chance(0.3)) {
      log.say('work.day', { job: job.name.toLowerCase(), wage: formatMoney(wage) }, 'neutral');
    }
    endDay(state, rng, log, { toil: true });
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = task.days - i - 1;
      break;
    }
  }
  if (daysDone >= 7) {
    state.moneyPence += WEEK_BONUS;
    earned += WEEK_BONUS;
    log.raw('The overseer adds a shilling for the week entire.', 'good');
  }
  log.say('work.week', { job: job.name.toLowerCase(), wage: formatMoney(earned) }, 'good');
  if (earned > 0) addJournal(state, `Earned ${formatMoney(earned)} at ${job.name.toLowerCase()}.`, 'neutral');
  if (left > 0) interrupt(state, { kind: 'work', job: task.job, days: left });
  else interrupt(state, null);
}

/**
 * A spell taken up again after an interruption may find the player carted,
 * gaoled or marched off the ground he meant to work.
 */
function standingOnDiggableGround(state: GameState): boolean {
  return isCamp(state.location);
}

/** Carted off to Canvas House, or otherwise no longer on the ground. */
function stillOnTheSameGround(state: GameState, camp: LocationId): boolean {
  return state.location === camp;
}

/**
 * The day the papers expire is a day the player is told about, even in the
 * middle of a fortnight's work (§21).
 */
function announceLicenceLapse(state: GameState, log: Log): void {
  if (licenceLapsedToday(state)) {
    log.raw(
      'Your licence ran out with yesterday. You are on this ground unlicensed now, and the troopers ride through it as they please.',
      'bad',
    );
  }
}

function runMine(state: GameState, rng: RNG, log: Log, task: Task & { kind: 'mine' }): void {
  if (!standingOnDiggableGround(state)) return;
  let remaining = task.days;
  let won = 0;
  let left = -1;
  const camp = state.location;
  while (remaining > 0) {
    if (!stillOnTheSameGround(state, camp)) break;
    if (state.illness?.blinding && rng.chance(0.6)) {
      log.say('ill.blind', undefined, 'bad');
      endDay(state, rng, log, {});
      remaining -= 1;
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = remaining;
        break;
      }
      continue;
    }
    announceLicenceLapse(state, log);
    const res = mineOneDay(state, rng, log, task.method);
    won += res.gold;
    if (res.stop === 'trooper') {
      state.resumeTask = { kind: 'mine', method: task.method, days: remaining - 1 };
      state.screen = 'encounter';
      return;
    }
    if (res.stop === 'dead') return;
    if (
      res.stop === 'cannotPay' ||
      res.stop === 'noClaim' ||
      res.stop === 'shaftGone' ||
      res.stop === 'workedOut'
    ) {
      remaining -= 1;
      endDay(state, rng, log, { toil: true });
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = remaining;
        break;
      }
      if (res.stop !== 'shaftGone') break;
      continue;
    }
    remaining -= 1;
    endDay(state, rng, log, { toil: true });
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = remaining;
      break;
    }
  }
  if (won > 0) {
    log.raw(`In all you won ${formatGold(won)} of gold.`, 'good');
  }
  if (left > 0) interrupt(state, { kind: 'mine', method: task.method, days: left });
  else interrupt(state, null);
}

function runRest(state: GameState, rng: RNG, log: Log, days: number): void {
  let left = -1;
  for (let i = 0; i < days; i++) {
    heal(state, rng.int(REST_RECOVERY.lo, REST_RECOVERY.hi));
    heal(state, hearthHealBonus(state));
    if (state.illness && rng.chance(0.16)) {
      log.say('ill.recover', illnessVars(state.illness.id), 'good');
      state.illness = null;
    }
    endDay(state, rng, log, {});
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = days - i - 1;
      break;
    }
  }
  log.say('health.rest', { days }, 'neutral');
  if (left > 0) interrupt(state, { kind: 'rest', days: left });
  else interrupt(state, null);
}

function runTravel(state: GameState, rng: RNG, log: Log): void {
  while (state.journey && !state.gameOver) {
    const stop = travelOneDay(state, rng, log);
    if (stop === 'bushrangers' || stop === 'trooper') {
      state.resumeTask = { kind: 'travel' };
      state.screen = 'encounter';
      return;
    }
    if (stop === 'dead') return;
    if (stop === 'yearEnd') return;
    if (stop === 'arrived') {
      arrive(state, log);
      state.screen = screenForLocation(state.location);
      return;
    }
    checkGraveAfter(state, rng, log);
    if (state.gameOver) return;
  }
}

export function runTask(state: GameState, rng: RNG, log: Log, task: Task): void {
  switch (task.kind) {
    case 'travel':
      runTravel(state, rng, log);
      break;
    case 'work':
      runWork(state, rng, log, task);
      break;
    case 'mine':
      runMine(state, rng, log, task);
      break;
    case 'rest':
      runRest(state, rng, log, task.days);
      break;
    case 'hospital': {
      // Only the days actually paid for are spent under care.
      const stayed = hospitalStay(state, rng, log, task.days);
      passKeptDays(state, rng, log, stayed);
      break;
    }
  }
}
