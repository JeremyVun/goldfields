import { resolveMeeting, resolveStockade, type StockadeChoice } from '../agitation';
import { takePardon } from '../bandit';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import type { Action, GameState } from '../types';
import {
  handleAssizesChoice,
  handleBailUpChoice,
  handleClaimJumper,
  handlePatrolChoice,
} from './darkEncounters';
import { handleBushrangerChoice, handleTrooperChoice, resumePending } from './encounters';
import { screenForLocation } from './screen';
import { advanceKept } from './tasks';

// ---------------------------------------------------------------------------
// Answering what is pending
// ---------------------------------------------------------------------------

/**
 * Encounters swallow everything until answered: whatever the player asked for,
 * the standing question takes his action first. True when the question has been
 * put and answered here, and the ordinary reducer must not run.
 */
export function answerPendingEncounter(s: GameState, rng: RNG, log: Log, action: Action): boolean {
  const pending = s.pending;
  if (!pending || s.screen !== 'encounter') return false;
  if (pending.kind === 'claimJumper') {
    handleClaimJumper(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'trooper') {
    handleTrooperChoice(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'bushrangers') {
    handleBushrangerChoice(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'patrol' || pending.kind === 'hideoutRaid') {
    handlePatrolChoice(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'bailup') {
    handleBailUpChoice(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'shantyRaid') {
    // Nothing to answer: the place is ash, and there is nobody to complain
    // to about it (§28.3).
    s.pending = null;
    s.screen = screenForLocation(s.location);
    resumePending(s, rng, log);
    return true;
  }
  if (pending.kind === 'assizes') {
    handleAssizesChoice(s, rng, log, action);
    return true;
  }
  if (pending.kind === 'pardon') {
    takePardon(s, log, action.type === 'takePardon' && action.take);
    resumePending(s, rng, log);
    return true;
  }
  if (pending.kind === 'meeting') {
    resolveMeeting(s, rng, log, action.type === 'attendMeeting' && action.attend, (days) => advanceKept(s, rng, log, days));
    resumePending(s, rng, log);
    return true;
  }
  if (pending.kind === 'stockade') {
    const choice: StockadeChoice =
      action.type === 'joinStockade'
        ? 'join'
        : action.type === 'sellSupplies'
          ? 'sellSupplies'
          : 'keepClear';
    resolveStockade(s, rng, log, choice, (days) => advanceKept(s, rng, log, days));
    // A refused sale leaves the question standing.
    if (s.pending) return true;
    resumePending(s, rng, log);
    return true;
  }
  return false;
}
