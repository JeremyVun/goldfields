import { endDay } from '../../daily';
import { holdCourt, placeStory } from '../../estate';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import type { Action, GameState } from '../../types';
import { screenForLocation } from '../screen';
import { checkGraveAfter } from '../tasks';

// ---------------------------------------------------------------------------
// The civic ladder (§26-§28): the press and the bench.
// ---------------------------------------------------------------------------

export function placeStoryAction(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'placeStory' }>): void {
  // Setting a story costs the day it takes to write, set and print it.
  if (!placeStory(s, rng, log, action.kind, action.camp)) return;
  endDay(s, rng, log, {});
  checkGraveAfter(s, rng, log);
  if (!s.gameOver && !s.endOfYear) s.screen = screenForLocation(s.location);
}

export function holdCourtAction(s: GameState, rng: RNG, log: Log): void {
  if (!holdCourt(s, log)) return;
  endDay(s, rng, log, {});
  checkGraveAfter(s, rng, log);
  if (s.gameOver || s.endOfYear) return;
  s.screen = 'court';
}
