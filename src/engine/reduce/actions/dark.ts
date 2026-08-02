import { HIDEOUT_DAYS, ROB_ESCORT_DAYS } from '../../constants';
import {
  canBailUp,
  crimeVisible,
  gatherIntelligence,
  lurk,
  makeHideout,
  robBank,
  robEscort,
} from '../../bandit';
import { endDay } from '../../daily';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import type { Action, GameState } from '../../types';
import { advanceKept, checkGraveAfter } from '../tasks';

// ---------------------------------------------------------------------------
// The dark ladder (§23-§24): the road, the hideout and the robberies.
// ---------------------------------------------------------------------------

export function bailUpOnTheRoad(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'bailUp' }>): void {
  const gate = canBailUp(s);
  if (!gate.ok) {
    log.raw(`${gate.note.charAt(0).toUpperCase()}${gate.note.slice(1)}.`, 'bad');
    return;
  }
  if (s.location === 'on-road') {
    log.raw('You are on the road already, and going somewhere.', 'neutral');
    return;
  }
  const from = s.location;
  lurk(s, rng, log, action.route);
  endDay(s, rng, log, { toil: true });
  checkGraveAfter(s, rng, log);
  if (s.gameOver || s.endOfYear) return;
  // He rides back to whatever roof he keeps; the road is a day's work.
  s.location = from;
  if (s.pending) s.screen = 'encounter';
}

export function makeHideoutAction(s: GameState, rng: RNG, log: Log): void {
  if (!makeHideout(s, log)) return;
  for (let i = 0; i < HIDEOUT_DAYS; i++) {
    endDay(s, rng, log, { toil: true });
    if (s.gameOver || s.endOfYear) return;
  }
  s.location = 'hideout';
  s.screen = 'hideout';
}

export function gatherIntelligenceAction(s: GameState, rng: RNG, log: Log): void {
  if (!crimeVisible(s)) {
    log.raw('The harbourers keep their words for men they know.', 'bad');
    return;
  }
  if (!gatherIntelligence(s, rng, log)) return;
  endDay(s, rng, log, {});
  checkGraveAfter(s, rng, log);
}

export function robBankAction(s: GameState, rng: RNG, log: Log): void {
  if (!robBank(s, rng, log, (days) => advanceKept(s, rng, log, days))) return;
  if (s.pending?.kind === 'assizes') {
    s.screen = 'encounter';
    return;
  }
  endDay(s, rng, log, { toil: true });
  checkGraveAfter(s, rng, log);
  if (s.pending) s.screen = 'encounter';
}

export function robEscortAction(s: GameState, rng: RNG, log: Log): void {
  if (!robEscort(s, rng, log, (days) => advanceKept(s, rng, log, days))) return;
  if (s.pending?.kind === 'assizes') {
    s.screen = 'encounter';
    return;
  }
  for (let i = 0; i < ROB_ESCORT_DAYS; i++) {
    endDay(s, rng, log, { toil: true });
    if (s.gameOver || s.endOfYear) return;
  }
  checkGraveAfter(s, rng, log);
  if (s.pending) s.screen = 'encounter';
}
