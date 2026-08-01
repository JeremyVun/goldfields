/**
 * Hearth & kin — the courtship anchor (§32).
 *
 * CONTRACT (skeleton committed ahead of parallel work; the shapes here and in
 * types.ts/constants.ts are shared and frozen — extend behaviour, not
 * signatures, and note any contract change you cannot avoid in your report).
 *
 * Ownership:
 *  - The engine agent implements every function in this file, the reduce.ts
 *    dispatch for the §32 actions, and the daily/weekly hooks.
 *  - The presentation agent builds the 'hearth' / 'ball' / 'letters' screens
 *    in menus.ts and all §32 copy in src/content/hearthText.ts, calling only
 *    the exported helpers below plus plain state reads.
 *
 * Narration keys use the 'hearth.*' namespace via log.say / say(); a missing
 * key renders as a visible [hearth.key] placeholder, never a crash.
 */

import type { Log } from './narrate';
import type { RNG } from './rng';
import type { GameState, HearthEventKind, IntendedTrade } from './types';

// ---------------------------------------------------------------------------
// Daily hook — called once from endDay before the day advances.
// Schedules balls and letters, opens/expires event windows, marks missed
// events, runs the estrangement and reconciliation rules, and fires the
// engineered calendar collision (§32.3).
// ---------------------------------------------------------------------------

export function hearthDay(state: GameState, rng: RNG, log: Log): void {
  void state;
  void rng;
  void log;
  // TODO(engine agent): implement per §32.
}

// ---------------------------------------------------------------------------
// Gates and derived readouts — the presentation layer builds menus off these.
// ---------------------------------------------------------------------------

/** Is a subscription ball on at Slateford today (§32.1)? */
export function ballTonight(state: GameState): boolean {
  void state;
  return false; // TODO(engine agent)
}

/** May the player begin paying addresses (met, not burned, not courting)? */
export function canPayAddresses(state: GameState): boolean {
  void state;
  return false; // TODO(engine agent)
}

/** Is a call window (or other hearth event window) open, and is he at the port? */
export function eventOpenHere(state: GameState): boolean {
  void state;
  return false; // TODO(engine agent)
}

/** The §32.2 verbs require the settled hearth and no estrangement. */
export function hearthVerbsOpen(state: GameState): boolean {
  void state;
  return false; // TODO(engine agent)
}

/** Unread letters waiting at a post office (Port Gannet or Slateford). */
export function lettersWaiting(state: GameState): number {
  return state.hearth.letters.filter((l) => !l.read).length;
}

/**
 * One line for the status/aside surfaces: the next dated pull, in period
 * idiom, or null when nothing is scheduled ("Mary expects you by the 14th").
 */
export function nextEventLine(state: GameState): string | null {
  void state;
  return null; // TODO(engine agent)
}

/** What the household calls itself in the kitty's resume, or null before it exists. */
export function hearthResumeLine(state: GameState): string | null {
  void state;
  return null; // TODO(engine agent)
}

/**
 * Her consent, decided when the player proposes the banns (§32.1). Weighs
 * standing, record and calls kept — and, by design law, is entirely blind to
 * money spent. The gift *pattern* (lavishGifts pressed too often or before
 * standing GIFT_LAVISH_STANDING) cools it; a rare well-earned lavish gift
 * moves nothing in either direction. Tested as an assertion (§32.6).
 */
export function consentRoll(state: GameState, rng: RNG): boolean {
  void state;
  void rng;
  return false; // TODO(engine agent)
}

/** Which §32.2 arm her trade strengthens (flavour-sized, not a ranking). */
export function tradeBonus(trade: IntendedTrade): 'consign' | 'heal' | 'hire' {
  switch (trade) {
    case 'storekeeper':
      return 'consign';
    case 'nurse':
      return 'heal';
    default:
      return 'hire';
  }
}

/** Does the §32.2 free-safe-bed rule strike the port's lodging dice tonight? */
export function sleepsAtHearth(state: GameState): boolean {
  void state;
  return false; // TODO(engine agent)
}

/** Extra healing per rest day at the cottage (0 when the hearth is not his). */
export function hearthHealBonus(state: GameState): number {
  void state;
  return 0; // TODO(engine agent)
}

// ---------------------------------------------------------------------------
// For the END screen: the Hearth section's raw material (§32.4).
// ---------------------------------------------------------------------------

export interface HearthReckoning {
  rung: GameState['hearth']['rung'];
  intendedName: string | null;
  eventsKept: number;
  eventsMissed: number;
  remittedPence: number;
  cottage: boolean;
  childBorn: boolean;
  /** The closing letter, chosen by how the year went; the epilogue reads it out. */
  finalLetterKey: string;
}

export function hearthReckoning(state: GameState): HearthReckoning {
  const h = state.hearth;
  return {
    rung: h.rung,
    intendedName: h.intended?.name ?? null,
    eventsKept: h.eventsKept,
    eventsMissed: h.eventsMissed,
    remittedPence: h.remittedPence,
    cottage: h.cottage,
    childBorn: h.childBorn,
    finalLetterKey: 'hearth.final.none', // TODO(engine agent)
  };
}

/** The event kinds, exported for tests and the presentation layer. */
export const HEARTH_EVENT_KINDS: HearthEventKind[] = [
  'call',
  'banns',
  'wedding',
  'christmas',
  'birth',
  'sickbed',
];
