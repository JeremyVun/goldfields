import { describe, expect, it } from 'vitest';
import { endDay, passKeptDays } from '../src/engine/daily';
import { daysUntilMagistrate } from '../src/engine/law';
import { pounds } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import type { GameState } from '../src/engine/types';

/**
 * A wanted man standing where the informer has sold him, with everything else
 * about the day made quiet: he is in the ranges, so no night in town and no
 * night in camp; watered and provisioned, so nothing takes his health; and in
 * funds, so the magistrate fines him rather than putting him on the gang.
 *
 * `informerUntilDay === state.day` is the one door into the pursuit that costs
 * no dice at all, which is what makes the day the troopers take him repeatable.
 */
function soldToTheTraps(seed: number, day: number): GameState {
  const state = createInitialState(seed);
  state.day = day;
  state.location = 'hideout';
  state.legal = 'wanted criminal';
  state.outlawed = false;
  state.estate.informerUntilDay = day;
  state.health = 95;
  state.provisionDays = 400;
  state.waterDays = 400;
  state.moneyPence = pounds(80);
  state.bankPence = pounds(80);
  return state;
}

/** Sundays turned over by a run of days [from, to). */
function sundaysIn(from: number, to: number): number {
  let n = 0;
  for (let d = from; d < to; d++) if (d % 7 === 0) n += 1;
  return n;
}

describe('a day is turned once and once only', () => {
  // Day 200 is chosen so the magistrate sits on day 210 — which is a Sunday.
  // A day run twice would turn the world again on that Sunday, and the weekly
  // reckoning of a man's worth would be written down a second time.
  const DAY = 200;

  it('the day the troopers take him is spent in gaol, not again on top of it', () => {
    const wait = daysUntilMagistrate(DAY);
    expect(DAY + wait).toBe(210);
    expect((DAY + wait) % 7).toBe(0);

    let taken = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const state = soldToTheTraps(seed, DAY);
      const rng = makeRng(seed);
      const log = new Log(rng);
      const worthBefore = state.worthHistory.length;
      const greensBefore = state.daysWithoutGreens;

      endDay(state, rng, log, {});

      expect(state.gameOver).toBeFalsy();
      if (state.stats.timesArrested === 0) continue; // the traps missed him
      taken += 1;

      // He comes out on the magistrate's day, not the day after it: the run of
      // kept days spent this one, and the caller did not spend it again.
      expect(state.day).toBe(DAY + wait);
      // He lives the outer day out before the traps come for him at the end of
      // it, and then lives each gaol day as well: one more day's upkeep than
      // days on the calendar, which is how it has always run.
      expect(state.daysWithoutGreens - greensBefore).toBe(wait + 1);
      // And one turn of the world for each of them: the Sunday on day 203 only,
      // never day 210 as well.
      expect(state.worthHistory.length - worthBefore).toBe(sundaysIn(DAY, DAY + wait));
    }
    // Enough seeds land in irons that this is a real sample, not a fluke.
    expect(taken).toBeGreaterThan(20);
  });

  it('a run of kept days advances the calendar exactly as far as it is told to', () => {
    for (const days of [0, 1, 5, 30]) {
      const state = createInitialState(9);
      const rng = makeRng(9);
      const log = new Log(rng);
      const worthBefore = state.worthHistory.length;
      const day = state.day;

      passKeptDays(state, rng, log, days);

      expect(state.day).toBe(day + days);
      expect(state.daysWithoutGreens).toBe(days);
      expect(state.worthHistory.length - worthBefore).toBe(sundaysIn(day, day + days));
    }
  });

  it('an ordinary day turns the world once', () => {
    const state = createInitialState(3);
    const rng = makeRng(3);
    const log = new Log(rng);
    const day = state.day;
    endDay(state, rng, log, {});
    expect(state.day).toBe(day + 1);
    expect(state.daysWithoutGreens).toBe(1);
  });

  it('a day the player does not live through turns the world not at all', () => {
    const state = createInitialState(4);
    const rng = makeRng(4);
    const log = new Log(rng);
    state.day = 100;
    state.health = 1;
    state.provisionDays = 0;
    state.fedToday = false;
    state.location = 'damp-camp';
    const worthBefore = state.worthHistory.length;

    endDay(state, rng, log, {});

    expect(state.gameOver).toBeTruthy();
    // Death stops the day where it stands: the calendar does not move on.
    expect(state.day).toBe(100);
    expect(state.worthHistory.length).toBe(worthBefore);
  });
});
