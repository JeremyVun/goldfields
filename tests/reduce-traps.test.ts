/**
 * The reducer's state-machine traps, each one a bug the code carries a named
 * guard against. Remove the guard and the matching test here must fail.
 */

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { _internal, finalWorth, screenForLocation, step } from '../src/engine/reduce';
import { createInitialState } from '../src/engine/state';
import type { GameState } from '../src/engine/types';

/** A player halfway through a fortnight at the face, carted off to town. */
function marchedOffTheGround(): GameState {
  const s = createInitialState(4242);
  s.screen = 'encounter';
  s.location = 'fields-town';
  s.pending = { kind: 'bushrangers' };
  s.resumeTask = { kind: 'mine', method: 'pan', days: 3 };
  s.items.pan = 1;
  s.moneyPence = 0;
  s.goldCentiOz = 0;
  return s;
}

describe('a resumed task that has nothing left to run (the pending-encounter softlock)', () => {
  it('puts the player back on an answerable screen instead of stranding him', () => {
    const before = marchedOffTheGround();
    const { state } = step(before, { type: 'submit' }, makeRng(before.seed));

    // Nothing is pending, so the encounter screen would have no answer on it.
    expect(state.pending).toBeNull();
    expect(state.screen).not.toBe('encounter');
    expect(state.screen).toBe(screenForLocation('fields-town'));
  });

  it('still holds the encounter screen when the resumed task raised a fresh one', () => {
    // A spell at the face that runs until the troopers stop it: the task is
    // resumed, a new question is raised, and the player must answer that one.
    const before = createInitialState(1);
    before.screen = 'encounter';
    before.location = 'damp-camp';
    before.pending = { kind: 'bushrangers' };
    before.resumeTask = { kind: 'mine', method: 'pan', days: 30 };
    before.items.pan = 1;
    before.provisionDays = 60;
    before.moneyPence = 0;
    before.goldCentiOz = 0;
    before.licenceUntilDay = 0;

    const { state } = step(before, { type: 'submit' }, makeRng(before.seed));
    expect(state.pending).not.toBeNull();
    expect(state.screen).toBe('encounter');
  });
});

describe('a spell resumed after the player was marched off the ground', () => {
  it('does not put him back to work on ground he is no longer standing on', () => {
    const before = marchedOffTheGround();
    const { state } = step(before, { type: 'submit' }, makeRng(before.seed));

    // He is in the town, not at the face: no day is dug, and no day passes.
    expect(state.stats.daysDug).toBe(0);
    expect(state.day).toBe(before.day);
    expect(state.goldCentiOz).toBe(0);
    expect(state.resumeTask).toBeNull();
  });
});

describe('a licence that runs out in the middle of a spell', () => {
  it('is announced on the day it lapses, not only when the spell is ordered', () => {
    const before = createInitialState(31);
    before.location = 'damp-camp';
    before.screen = 'camp';
    before.items.pan = 1;
    before.provisionDays = 60;
    before.day = 100;
    // Good for today and tomorrow; the day after, the papers are dead.
    before.licenceUntilDay = 101;

    const { events } = step(before, { type: 'mine', method: 'pan', days: 6 }, makeRng(before.seed));
    const lapse = events.filter((e) => e.text.startsWith('Your licence ran out with yesterday.'));
    expect(lapse.length).toBeGreaterThan(0);
  });

  it('says nothing of the sort while the licence is still good', () => {
    const before = createInitialState(31);
    before.location = 'damp-camp';
    before.screen = 'camp';
    before.items.pan = 1;
    before.provisionDays = 60;
    before.day = 100;
    before.licenceUntilDay = 140;

    const { events } = step(before, { type: 'mine', method: 'pan', days: 6 }, makeRng(before.seed));
    expect(events.some((e) => e.text.startsWith('Your licence ran out with yesterday.'))).toBe(false);
  });
});

describe('the reducer barrel', () => {
  it('offers the same public surface the single file did', () => {
    expect(typeof step).toBe('function');
    expect(typeof finalWorth).toBe('function');
    expect(typeof screenForLocation).toBe('function');
    expect(Object.keys(_internal).sort()).toEqual(
      ['CAMP_DEFS', 'contract', 'runTask', 'screenForLocation', 'shillings'].sort(),
    );
  });
});
