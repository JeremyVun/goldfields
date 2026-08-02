import { endDay } from '../../daily';
import { buyShanty, holdCourt, placeStory, ruleOn } from '../../estate';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { isCamp } from '../../state';
import type { Action, CampId, GameState } from '../../types';
import { screenForLocation } from '../screen';
import { checkGraveAfter } from '../tasks';

// ---------------------------------------------------------------------------
// The civic ladder (§26-§28): the press, the bench and the sly-grog tent.
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

export function ruleAction(s: GameState, log: Log, action: Extract<Action, { type: 'rule' }>): void {
  if (s.screen !== 'court') {
    log.raw('The court is not sitting.', 'neutral');
    return;
  }
  ruleOn(s, log, action.ruling);
  s.screen = screenForLocation(s.location);
}

export function buyShantyAction(s: GameState, log: Log): void {
  if (!isCamp(s.location)) {
    log.raw('Sly grog is sold at the diggings, not in a town with a licensed house in it.', 'bad');
    return;
  }
  buyShanty(s, log, s.location as CampId);
}
