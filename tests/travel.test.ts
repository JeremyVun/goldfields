import { describe, expect, it } from 'vitest';
import { COACH_FARE, ROUTES, WAGON_FARE } from '../src/engine/constants';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { beginJourney, localTravelDays, planJourney, travelOneDay } from '../src/engine/travel';
import type { GameState } from '../src/engine/types';

function traveller(seed = 8): GameState {
  const state = createInitialState(seed);
  state.location = 'suze-port';
  state.provisionDays = 80;
  state.waterDays = 40;
  state.items.swag = 1;
  state.moneyPence = pounds(20);
  return state;
}

describe('the two roads', () => {
  it("Trickey's Track is longer and safer; the Pass Road shorter and rougher (faithful)", () => {
    expect(ROUTES.trickeys.walkDays).toBeGreaterThan(ROUTES.pass.walkDays);
    expect(ROUTES.pass.danger).toBeGreaterThan(ROUTES.trickeys.danger);
    expect(ROUTES.trickeys.walkDays).toBe(8);
    expect(ROUTES.pass.walkDays).toBe(5);
  });

  it('horseback is the quickest way to the diggings', () => {
    const state = traveller();
    state.horse = 'brumby';
    for (const route of ['trickeys', 'pass'] as const) {
      const walk = planJourney(state, route, 'walk');
      const horse = planJourney(state, route, 'horse');
      expect(horse.days).toBeLessThan(walk.days);
      expect(horse.days).toBe(3);
    }
  });

  it('warns a footslogger about his cradle and his water', () => {
    const state = traveller();
    state.items.cradle = 1;
    state.day = 15; // high summer
    state.waterDays = 0;
    const plan = planJourney(state, 'pass', 'walk');
    expect(plan.problems.join(' ')).toMatch(/cradle/);
    expect(plan.problems.join(' ')).toMatch(/thirst/i);
  });

  it('a wagon costs twelve shillings, beats walking, and carries everything', () => {
    expect(WAGON_FARE).toBe(shillings(12));
    const state = traveller();
    state.items.cradle = 1;
    const log = new Log(makeRng(1));
    expect(beginJourney(state, log, 'trickeys', 'wagon', 'fields-town')).toBe(true);
    expect(state.moneyPence).toBe(pounds(20) - shillings(12));
    expect(state.items.cradle).toBe(1);
    expect(planJourney(traveller(), 'trickeys', 'wagon').days).toBeLessThan(
      planJourney(traveller(), 'trickeys', 'walk').days,
    );
  });

  it('a walker must leave the cradle by the road unless he has a barrow', () => {
    const state = traveller();
    state.items.cradle = 1;
    const log = new Log(makeRng(1));
    beginJourney(state, log, 'trickeys', 'walk', 'fields-town');
    expect(state.items.cradle).toBe(0);

    const withBarrow = traveller();
    withBarrow.items.cradle = 1;
    withBarrow.items.barrow = 1;
    beginJourney(withBarrow, new Log(makeRng(1)), 'trickeys', 'walk', 'fields-town');
    expect(withBarrow.items.cradle).toBe(1);
  });

  it('will not put a man on a horse he does not own', () => {
    const state = traveller();
    const log = new Log(makeRng(1));
    expect(beginJourney(state, log, 'trickeys', 'horse', 'fields-town')).toBe(false);
    expect(state.journey).toBeNull();
  });
});

describe('the journey itself', () => {
  it('always arrives, dies, or is interrupted — it never runs forever', () => {
    for (let seed = 0; seed < 120; seed++) {
      const state = traveller(seed);
      const rng = makeRng(seed);
      const log = new Log(rng);
      beginJourney(state, log, seed % 2 ? 'pass' : 'trickeys', 'walk', 'fields-town');
      let guard = 0;
      let stop: ReturnType<typeof travelOneDay> = null;
      while (stop === null && guard < 200) {
        stop = travelOneDay(state, rng, log);
        guard += 1;
      }
      expect(guard).toBeLessThan(200);
      expect(state.moneyPence).toBeGreaterThanOrEqual(0);
    }
  });

  it('eats provisions and water as it goes', () => {
    const state = traveller(3);
    const rng = makeRng(3);
    const log = new Log(rng);
    beginJourney(state, log, 'trickeys', 'walk', 'fields-town');
    const food = state.provisionDays;
    const water = state.waterDays;
    travelOneDay(state, rng, log);
    expect(state.provisionDays).toBeLessThan(food);
    expect(state.waterDays).toBeLessThan(water);
  });

  it('the Pass Road bails up more travellers than Trickey’s Track', () => {
    const bailups = (route: 'trickeys' | 'pass') => {
      let n = 0;
      for (let seed = 0; seed < 300; seed++) {
        const state = traveller(seed * 3 + 5);
        const rng = makeRng(seed * 3 + 5);
        const log = new Log(rng);
        beginJourney(state, log, route, 'walk', 'fields-town');
        let stop: ReturnType<typeof travelOneDay> = null;
        let guard = 0;
        while (stop === null && guard < 40) {
          stop = travelOneDay(state, rng, log);
          guard += 1;
        }
        if (stop === 'bushrangers') n += 1;
      }
      return n;
    };
    expect(bailups('pass')).toBeGreaterThan(bailups('trickeys'));
  });

  it('lands the traveller at Fields Town through the reducer', () => {
    let state = traveller(11);
    const rng = makeRng(11);
    let guard = 0;
    while (state.location !== 'fields-town' && guard < 12 && !state.gameOver) {
      const out = step(state, { type: 'travel', route: 'trickeys', mode: 'walk' }, rng);
      state = out.state;
      if (state.pending) {
        state = step(state, { type: 'submit' }, rng).state;
      }
      guard += 1;
    }
    expect(state.location).toBe('fields-town');
    expect(state.journey).toBeNull();
    expect(state.screen).toBe('ftown');
  });
});

describe('short journeys about the goldfields', () => {
  it('are a day to the near camps and two to the mountains, halved on horseback', () => {
    const state = traveller();
    state.location = 'fields-town';
    expect(localTravelDays(state, 'damp-camp')).toBe(1);
    expect(localTravelDays(state, 'snakey-gully')).toBe(1);
    expect(localTravelDays(state, 'deep-mountains')).toBe(2);
    state.horse = 'brumby';
    expect(localTravelDays(state, 'deep-mountains')).toBe(1);
    expect(localTravelDays(state, 'damp-camp')).toBe(1);
  });

  it('the secret mine is a long way out', () => {
    const state = traveller();
    expect(localTravelDays(state, 'secret-mine')).toBeGreaterThanOrEqual(5);
  });
});

describe('Cobb & Co.', () => {
  it('carries travellers with money, at two pounds and two days', () => {
    expect(COACH_FARE).toBe(pounds(2));
    const state = traveller(2);
    state.location = 'fields-town';
    state.moneyPence = pounds(3);
    const rng = makeRng(2);
    const out = step(state, { type: 'coach' }, rng);
    expect(out.state.location).toBe('suze-port');
    expect(out.state.moneyPence).toBeLessThanOrEqual(pounds(1));
    expect(out.state.day).toBe(state.day + 2);
  });

  it('will not carry an ordinary digger with no fare', () => {
    const state = traveller(2);
    state.location = 'fields-town';
    state.moneyPence = shillings(5);
    const out = step(state, { type: 'coach' }, makeRng(2));
    expect(out.state.location).toBe('fields-town');
    expect(out.state.moneyPence).toBe(shillings(5));
  });
});
