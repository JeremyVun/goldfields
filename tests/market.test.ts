import { describe, expect, it } from 'vitest';
import {
  BANK_RATE_CEILING,
  BANK_RATE_FLOOR,
  HORSE_PRICE,
  PRICES,
  PROVISIONS_WEEK,
} from '../src/engine/constants';
import { lsd, pounds, shillings } from '../src/engine/money';
import {
  MAX_PROVISION_DAYS,
  buyGreens,
  buyHorse,
  buyItem,
  buyProvisions,
  fillWater,
  priceOf,
  rateAt,
  sellGold,
  storeRate,
  tierFor,
} from '../src/engine/market';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { walkRate } from '../src/engine/market';
import type { ItemId } from '../src/engine/types';

function fresh(seed = 21) {
  const state = createInitialState(seed);
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

const ALL_ITEMS = Object.keys(PRICES) as ItemId[];

describe('prices', () => {
  it('are much cheaper at Suze Port than at the diggings (the Journal’s first lesson)', () => {
    for (const it of ALL_ITEMS) {
      if (it === 'timber' || it === 'pump') continue; // only sold at the diggings
      expect(PRICES[it].fields).toBeGreaterThan(PRICES[it].suze);
      expect(PRICES[it].camp).toBeGreaterThanOrEqual(PRICES[it].fields);
    }
  });

  it('match the faithful price list', () => {
    expect(PRICES.pan.suze).toBe(shillings(8));
    expect(PRICES.pan.fields).toBe(lsd(1, 4));
    expect(PRICES.cradle.suze).toBe(pounds(2));
    expect(PRICES.cradle.fields).toBe(pounds(5));
    expect(PRICES.tent.suze).toBe(lsd(1, 10));
    expect(PRICES.journal.suze).toBe(6); // sixpence, as printed on the cover
    expect(PROVISIONS_WEEK.suze).toBe(shillings(5));
    expect(HORSE_PRICE.brumby).toBe(pounds(15));
    expect(HORSE_PRICE.hack).toBe(pounds(25));
  });

  it('choose the tier from where you are standing', () => {
    expect(tierFor('suze-port')).toBe('suze');
    expect(tierFor('fields-town')).toBe('fields');
    expect(tierFor('snakey-gully')).toBe('camp');
  });

  it('do not flicker within a day but do move between days', () => {
    const { state } = fresh();
    state.location = 'fields-town';
    const a = priceOf(state, 'pan');
    expect(priceOf(state, 'pan')).toBe(a);
    let differed = false;
    for (let d = 2; d < 400 && !differed; d++) {
      state.day = d;
      if (priceOf(state, 'pan') !== a) differed = true;
    }
    expect(differed).toBe(true); // Briggs gouges now and then
  });

  it('gouge only at the diggings, and rarely', () => {
    const state = createInitialState(3);
    state.location = 'suze-port';
    for (let d = 1; d < 400; d++) {
      state.day = d;
      expect(priceOf(state, 'pan')).toBe(PRICES.pan.suze);
    }
    state.location = 'fields-town';
    let gouged = 0;
    for (let d = 1; d < 2000; d++) {
      state.day = d;
      if (priceOf(state, 'pan') > PRICES.pan.fields) gouged++;
    }
    expect(gouged).toBeGreaterThan(0);
    expect(gouged / 2000).toBeLessThan(0.12);
  });
});

describe('buying', () => {
  it('will not sell to a man without the money', () => {
    const { state, log } = fresh();
    state.moneyPence = 1;
    expect(buyItem(state, log, 'cradle')).toBe(false);
    expect(state.items.cradle).toBe(0);
    expect(state.moneyPence).toBe(1);
  });

  it('takes exactly the price', () => {
    const { state, log } = fresh();
    state.moneyPence = pounds(5);
    buyItem(state, log, 'pan');
    expect(state.moneyPence).toBe(pounds(5) - shillings(8));
    expect(state.items.pan).toBe(1);
  });

  it('will not let a man hump more than twelve weeks of flour', () => {
    const { state, log } = fresh();
    state.moneyPence = pounds(50);
    for (let i = 0; i < 30; i++) buyProvisions(state, log, 4);
    expect(state.provisionDays).toBeLessThanOrEqual(MAX_PROVISION_DAYS);
  });

  it('needs water bags before it will sell you water', () => {
    const { state, log } = fresh();
    state.moneyPence = pounds(1);
    expect(fillWater(state, log)).toBe(false);
    state.items.waterBags = 1;
    expect(fillWater(state, log)).toBe(true);
    expect(state.waterDays).toBeGreaterThan(0);
  });

  it('greens from the garden reset the scurvy clock', () => {
    const { state, log } = fresh();
    state.location = 'fields-town';
    state.moneyPence = pounds(1);
    state.daysWithoutGreens = 120;
    expect(buyGreens(state, log)).toBe(true);
    expect(state.daysWithoutGreens).toBe(0);
  });

  it('sells brumbies and showy hacks', () => {
    const { state, rng, log } = fresh();
    state.moneyPence = pounds(30);
    expect(buyHorse(state, rng, log, 'brumby')).toBe(true);
    expect(state.horse).toBe('brumby');
    expect(state.moneyPence).toBe(pounds(15));
    expect(buyHorse(state, rng, log, 'hack')).toBe(false); // £25 and only £15 left
  });
});

describe('exchange rates', () => {
  it('stay within period bounds under a long random walk', () => {
    const { state, rng } = fresh();
    for (let i = 0; i < 5000; i++) {
      walkRate(state, rng);
      expect(state.bankRate).toBeGreaterThanOrEqual(BANK_RATE_FLOOR);
      expect(state.bankRate).toBeLessThanOrEqual(BANK_RATE_CEILING);
      expect(Number.isInteger(state.bankRate)).toBe(true);
    }
  });

  it('the ceiling is the period standard of £3 17s 10d', () => {
    expect(BANK_RATE_CEILING).toBe(lsd(3, 17, 10));
  });

  it('the Fields Town bank pays best; camp storekeepers pay worst', () => {
    const { state, rng } = fresh();
    for (let d = 1; d < 300; d++) {
      state.day = d;
      walkRate(state, rng);
      const bank = rateAt(state, 'fields-town');
      const port = rateAt(state, 'suze-port');
      const briggs = storeRate(state);
      for (const camp of ['damp-camp', 'snakey-gully', 'deep-mountains'] as const) {
        expect(rateAt(state, camp)).toBeLessThan(bank);
        expect(rateAt(state, camp)).toBeLessThan(port);
      }
      expect(briggs).toBeLessThan(bank);
      expect(port).toBeLessThan(bank);
    }
  });
});

describe('selling gold', () => {
  it('pays the rate and clears the pouch', () => {
    const { state, rng, log } = fresh();
    state.location = 'fields-town';
    state.goldCentiOz = 200;
    const rate = state.bankRate;
    const got = sellGold(state, rng, log, 'bank', true);
    expect(state.goldCentiOz).toBe(0);
    expect(got).toBe(2 * rate);
    expect(state.moneyPence).toBeGreaterThan(0);
  });

  it('only banks buy gold, at honest scales', () => {
    const bankState = createInitialState(20);
    bankState.location = 'fields-town';
    bankState.goldCentiOz = 1000;
    const rngA = makeRng(20);
    expect(sellGold(bankState, rngA, new Log(rngA), 'bank', false)).toBe(10 * bankState.bankRate);

    const campState = createInitialState(21);
    campState.location = 'damp-camp';
    campState.goldCentiOz = 1000;
    const rngB = makeRng(21);
    expect(sellGold(campState, rngB, new Log(rngB), 'camp', false)).toBe(0);
    expect(campState.goldCentiOz).toBe(1000);
  });

  it('selling nothing is harmless', () => {
    const { state, rng, log } = fresh();
    expect(sellGold(state, rng, log, 'bank', true)).toBe(0);
    expect(state.moneyPence).toBe(shillings(10));
  });
});
