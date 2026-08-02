import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { createInitialState } from '../../state';
import { DAYS_IN_YEAR } from '../../time';
import type { Action, GameState } from '../../types';
import { screenForLocation } from '../screen';
import { runTask } from '../tasks';

// ---------------------------------------------------------------------------
// Framing: beginning, saving and ending a year.
// ---------------------------------------------------------------------------

export function startNewGame(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'newGame' }>): void {
  // Beginning again after a death must not deal the same year twice over.
  const seed = action.seed ?? (s.rngState === s.seed ? s.seed : Math.floor(rng.next() * 0xffffffff));
  const fresh = createInitialState(seed);
  Object.assign(s, fresh);
  rng.restore(seed >>> 0);
  s.screen = 'intro';
  log.say('intro.arrival', undefined, 'title');
  log.say('intro.newchum', undefined, 'neutral');
}

export function cycleSpell(s: GameState, log: Log): void {
  const ladder = [1, 2, 3, 7, 14, 30];
  const i = ladder.indexOf(s.spellDays);
  s.spellDays = ladder[(i + 1) % ladder.length];
  log.raw(`A spell of work will now be ${s.spellDays} day${s.spellDays === 1 ? '' : 's'}.`, 'neutral');
}

export function saveGame(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'save' }>): void {
  const id = s.gameId ?? action.id ?? String(1000 + Math.floor(rng.next() * 8999));
  s.gameId = id;
  log.raw(
    `Your game is saved under the number ${id}. Write it down; you will need it to take up this game again.`,
    'title',
  );
}

export function beginNextYear(s: GameState, rng: RNG, log: Log): void {
  s.yearsPlayed += 1;
  s.endOfYear = false;
  log.raw(
    `Another year on the diggings. It is ${DAYS_IN_YEAR} days more, and the gold does not care who you are.`,
    'title',
  );
  // The year may have run out with the player still on the road. Finish the
  // journey rather than leaving him nowhere, standing at a town he has not
  // reached.
  if (s.journey && s.location === 'on-road') {
    runTask(s, rng, log, { kind: 'travel' });
    if (s.screen === 'encounter' || s.gameOver || s.endOfYear) return;
  }
  s.screen = screenForLocation(s.location);
}
