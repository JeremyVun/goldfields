import { Log } from '../narrate';
import { recordWorth } from '../state';
import type { GameState, LocationId, Screen } from '../types';

// ---------------------------------------------------------------------------
// Where the player stands, and what the state insists he is looking at
// ---------------------------------------------------------------------------

export function screenForLocation(loc: LocationId): Screen {
  if (loc === 'suze-port') return 'suze';
  if (loc === 'fields-town') return 'ftown';
  if (loc === 'on-road') return 'ftown';
  if (loc === 'hideout') return 'hideout';
  if (loc === 'secret-mine') return 'secret-expedition';
  return 'camp';
}

export function settle(state: GameState, log: Log): void {
  if (state.gameOver) state.pending = null;
  // The camp in the ranges is the one screen that can outlive the place it
  // belongs to: a raid takes it away under the player's feet.
  if (
    (state.screen === 'hideout' || state.screen === 'stash') &&
    (state.location !== 'hideout' || !state.hideout)
  ) {
    state.screen = screenForLocation(state.location === 'hideout' ? 'deep-mountains' : state.location);
  }
  // A question raised anywhere in the engine is put to the player, whatever he
  // thought he was doing.
  if (state.pending && !state.endOfYear && state.screen !== 'encounter') {
    state.screen = 'encounter';
  }
  if (state.gameOver === 'dead') {
    // The Times prints a man's death once, not every time he is spoken to.
    if (state.screen !== 'obituary') {
      state.screen = 'obituary';
      log.say('end.obituary', undefined, 'grave');
    }
    return;
  }
  if (state.gameOver === 'finished') {
    if (state.screen !== 'end') {
      state.screen = 'end';
      recordWorth(state);
    }
    return;
  }
  if (state.endOfYear && state.screen !== 'end') {
    state.screen = 'end';
    log.say('end.summary', undefined, 'title');
    // The last reading of the year, taken after the dividends are in, so the
    // chart ends where the tally does (§21).
    recordWorth(state);
  }
}
