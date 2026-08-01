/**
 * The frame on a small glass. Layout itself is a matter for the stylesheet and
 * the eye, but the words are not: an instruction to press a key the player has
 * not got is a dead end, and one that would be easy to reintroduce by editing
 * the engine's prose without a thought for the phone.
 *
 * These walk the screens that carry such instructions and insist that every
 * one of them is caught by the rewriting table in `src/ui/phrasing.ts`.
 */

import { describe, expect, it } from 'vitest';
import { getView } from '../src/engine/menus';
import { createInitialState } from '../src/engine/state';
import { forTouch, isTouch, KEYBOARD_PHRASE, keyLabel } from '../src/ui/phrasing';
import type { GameState, Screen } from '../src/engine/types';

/** Every screen a player may meet before the game has a keyboard's worth of menus. */
const SCREENS: Screen[] = ['title', 'resume', 'intro'];

function screenLines(screen: Screen): string[] {
  const state: GameState = { ...createInitialState(3), screen };
  const view = getView(state);
  return [...view.body, ...view.menu.map((m) => m.label)];
}

describe('words for a glass with no keys (responsiveness)', () => {
  it('finds a key named on every screen that opens the game', () => {
    // If the engine's prose stops naming keys the rewriting has nothing to do,
    // and the test below would pass while proving nothing at all.
    for (const screen of SCREENS) {
      expect(screenLines(screen).some((l) => KEYBOARD_PHRASE.test(l)), screen).toBe(true);
    }
  });

  it('leaves none of them standing once said for touch', () => {
    for (const screen of SCREENS) {
      for (const line of screenLines(screen)) {
        expect(forTouch(line), `${screen}: ${line}`).not.toMatch(KEYBOARD_PHRASE);
      }
    }
  });

  it('rewrites the frame’s own prompts as well as the engine’s', () => {
    expect(forTouch('— press the SPACE BAR for more —')).toBe('— touch the page for more —');
    expect(forTouch('Press the SPACE BAR to start.')).toBe('Touch a line below to start.');
    expect(forTouch('Press the SPACE BAR to go ashore')).toBe('Touch here to go ashore');
    expect(forTouch('Enter the number of the game you wish to take up, and press RETURN.')).toBe(
      'Enter the number of the game you wish to take up, then touch “Take it up”.',
    );
  });

  it('leaves a line that names no key exactly as it stands', () => {
    const plain = 'Dirty, unlit streets, garish signs, and horses hitched to wooden railings.';
    expect(forTouch(plain)).toBe(plain);
    expect(forTouch('')).toBe('');
    // The digging is not a key, whatever it looks like.
    expect(forTouch('You press on through the spinifex.')).toBe(
      'You press on through the spinifex.',
    );
  });

  it('writes the SPACE key differently on each sort of glass', () => {
    expect(keyLabel(' ', false)).toBe('SPACE');
    expect(keyLabel(' ', true)).toBe('TAP');
    expect(keyLabel('1', true)).toBe('1');
    expect(keyLabel('0', false)).toBe('0');
  });

  it('takes a machine with no glass at all for one with a keyboard', () => {
    // Under the test runner there is no window; nothing may throw on that
    // account, and the frame must fall back to its keyed self.
    expect(isTouch()).toBe(false);
  });
});
