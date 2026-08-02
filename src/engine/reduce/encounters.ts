import { damage } from '../health';
import { makeRun, offerBribe, toTheLogs } from '../law';
import { formatGold, formatMoney } from '../money';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import { addJournal } from '../state';
import type { Action, GameState } from '../types';
import { screenForLocation } from './screen';
import { advanceKept, runTask } from './tasks';

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

/**
 * Only stay on the encounter screen if a *fresh* encounter was raised while the
 * interrupted task ran. Without the `pending` test, a task that had no days left
 * to run (a one-day spell, or the last day of a spell) would leave the player
 * stranded on an encounter screen with nothing pending and no action that
 * answers it — an unrecoverable softlock.
 */
function heldByAFreshEncounter(state: GameState): boolean {
  return Boolean(state.pending) && state.screen === 'encounter';
}

export function resumePending(state: GameState, rng: RNG, log: Log): void {
  const task = state.resumeTask;
  state.resumeTask = null;
  state.pending = null;
  if (task && !state.gameOver && !state.endOfYear) {
    runTask(state, rng, log, task);
    if (heldByAFreshEncounter(state)) return;
  }
  if (!state.gameOver && state.screen === 'encounter') {
    state.screen = screenForLocation(state.location);
  }
}

export function handleTrooperChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  if (action.type === 'bribe') {
    const outcome = offerBribe(state, rng, log);
    if (outcome === 'nomoney') return;
    if (outcome === 'released') {
      resumePending(state, rng, log);
      return;
    }
    toTheLogs(state, rng, log, (days) => advanceKept(state, rng, log, days));
  } else if (action.type === 'resist') {
    const outcome = makeRun(state, rng, log);
    if (outcome === 'escaped') {
      resumePending(state, rng, log);
      return;
    }
    toTheLogs(state, rng, log, (days) => advanceKept(state, rng, log, days));
  } else {
    toTheLogs(state, rng, log, (days) => advanceKept(state, rng, log, days));
  }
  state.pending = null;
  state.resumeTask = null;
  state.journey = null;
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

export function handleBushrangerChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  const hasGun = state.items.gun > 0;
  if (action.type === 'resist') {
    if (hasGun) {
      if (rng.chance(0.82)) {
        log.say('bushranger.gun', undefined, 'good');
        resumePending(state, rng, log);
        return;
      }
      log.raw('You are slower than he is. The pistol is knocked from your hand.', 'bad');
      damage(state, rng.int(6, 20), 'bushrangers');
    } else {
      log.say('bushranger.resist.hurt', undefined, 'bad');
      damage(state, rng.int(8, 26), 'bushrangers');
      if (state.gameOver) {
        state.pending = null;
        state.resumeTask = null;
        return;
      }
    }
  }
  state.stats.timesRobbed += 1;
  if (state.goldCentiOz > 0 && rng.chance(0.7)) {
    const lost = Math.floor(state.goldCentiOz * rng.range(0.5, 1));
    state.goldCentiOz -= lost;
    log.say('bushranger.gold', { gold: formatGold(lost) }, 'bad');
  }
  if (state.moneyPence > 0) {
    const lost = Math.floor(state.moneyPence * rng.range(0.5, 1));
    state.moneyPence -= lost;
    log.say('bushranger.robbed', { loss: formatMoney(lost) }, 'bad');
    addJournal(state, `Bailed up and robbed of ${formatMoney(lost)}.`, 'bad');
  } else if (state.goldCentiOz === 0) {
    log.say('bushranger.nothing', undefined, 'neutral');
  }
  resumePending(state, rng, log);
}
