import { describe, expect, it } from 'vitest';
import { BRIBE_AMOUNT, LICENCE_COST, LICENCE_DAYS, MAGISTRATE_INTERVAL } from '../src/engine/constants';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import {
  buyLicence,
  cleanDayTick,
  daysUntilMagistrate,
  huntChance,
  offerBribe,
  toTheLogs,
  troopersCome,
  worsen,
} from '../src/engine/law';
import { makeRng } from '../src/engine/rng';
import { createInitialState, isLicensed } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { LEGAL_LADDER } from '../src/engine/types';

function fresh() {
  const state = createInitialState(42);
  const rng = makeRng(42);
  return { state, rng, log: new Log(rng) };
}

describe('the miner’s licence', () => {
  it('costs thirty shillings and runs thirty days (faithful)', () => {
    expect(LICENCE_COST).toBe(shillings(30));
    expect(LICENCE_DAYS).toBe(30);
    const { state, log } = fresh();
    state.moneyPence = pounds(5);
    expect(buyLicence(state, log)).toBe(true);
    expect(state.moneyPence).toBe(pounds(5) - shillings(30));
    expect(state.licenceUntilDay).toBe(30);
    expect(isLicensed(state)).toBe(true);
  });

  it('cannot be had without the money', () => {
    const { state, log } = fresh();
    state.moneyPence = shillings(29);
    expect(buyLicence(state, log)).toBe(false);
    expect(isLicensed(state)).toBe(false);
  });

  it('renews from the end of the current licence, not from today', () => {
    const { state, log } = fresh();
    state.moneyPence = pounds(5);
    buyLicence(state, log);
    state.day = 10;
    buyLicence(state, log);
    expect(state.licenceUntilDay).toBe(60);
  });

  it('lapses when the day passes', () => {
    const { state, log } = fresh();
    state.moneyPence = pounds(5);
    buyLicence(state, log);
    state.day = 31;
    expect(isLicensed(state)).toBe(false);
  });
});

describe('the legal ladder', () => {
  it('climbs honest -> petty -> minor -> major -> wanted', () => {
    const { state, log } = fresh();
    expect(state.legal).toBe('honest');
    for (let i = 1; i < LEGAL_LADDER.length; i++) {
      worsen(state, log, 1);
      expect(state.legal).toBe(LEGAL_LADDER[i]);
    }
    worsen(state, log, 1);
    expect(state.legal).toBe('wanted criminal'); // and no further
  });

  it('improves one rung per ninety clean days', () => {
    const { state, log } = fresh();
    worsen(state, log, 2);
    expect(state.legal).toBe('minor criminal');
    for (let i = 0; i < 90; i++) cleanDayTick(state, log);
    expect(state.legal).toBe('petty criminal');
    for (let i = 0; i < 90; i++) cleanDayTick(state, log);
    expect(state.legal).toBe('honest');
    for (let i = 0; i < 200; i++) cleanDayTick(state, log);
    expect(state.legal).toBe('honest');
  });

  it('a record draws more trooper attention', () => {
    const { state, log } = fresh();
    const honest = huntChance(state);
    worsen(state, log, 3);
    expect(huntChance(state)).toBeGreaterThan(honest);
  });

  it('warned sweeps are far more likely', () => {
    const { state } = fresh();
    state.location = 'damp-camp';
    const quiet = huntChance(state);
    state.hunt = { camp: 'damp-camp', untilDay: state.day + 3 };
    expect(huntChance(state)).toBeGreaterThan(quiet * 2);
  });
});

describe('digger hunts', () => {
  it('a licensed digger simply shows his paper', () => {
    const { state, rng, log } = fresh();
    state.location = 'damp-camp';
    state.moneyPence = pounds(5);
    buyLicence(state, log);
    expect(troopersCome(state, rng, log)).toBe('shown');
  });

  it('an unlicensed digger is either caught or gets away', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const state = createInitialState(seed);
      const rng = makeRng(seed);
      state.location = 'damp-camp';
      outcomes.add(troopersCome(state, rng, new Log(rng)));
    }
    expect(outcomes).toEqual(new Set(['evaded', 'caught']));
  });
});

describe('bribes, the logs and the magistrate', () => {
  it('a fiver is the going rate (faithful)', () => {
    expect(BRIBE_AMOUNT).toBe(pounds(5));
    const { state, rng, log } = fresh();
    state.moneyPence = pounds(4);
    expect(offerBribe(state, rng, log)).toBe('nomoney');
    expect(state.moneyPence).toBe(pounds(4));
  });

  it('usually works, but not always', () => {
    let released = 0;
    let failed = 0;
    for (let seed = 0; seed < 400; seed++) {
      const state = createInitialState(seed);
      const rng = makeRng(seed * 13 + 1);
      state.moneyPence = pounds(20);
      const r = offerBribe(state, rng, new Log(rng));
      if (r === 'released') released++;
      else failed++;
      expect(state.moneyPence).toBe(pounds(15));
    }
    expect(released).toBeGreaterThan(failed * 2);
    expect(failed).toBeGreaterThan(0);
  });

  it('the magistrate comes once a month, and never more than thirty days off', () => {
    expect(MAGISTRATE_INTERVAL).toBe(30);
    for (let day = 1; day <= 400; day++) {
      const wait = daysUntilMagistrate(day);
      expect(wait).toBeGreaterThanOrEqual(1);
      expect(wait).toBeLessThanOrEqual(30);
      expect((day + wait) % 30).toBe(0);
    }
  });

  it('a man who can pay is fined; a man who cannot breaks rock for thirty days', () => {
    const rich = createInitialState(7);
    const rngA = makeRng(7);
    rich.moneyPence = pounds(50);
    rich.location = 'damp-camp';
    const beforeRich = rich.day;
    toTheLogs(rich, rngA, new Log(rngA));
    expect(rich.moneyPence).toBeLessThan(pounds(50));
    expect(rich.location).toBe('fields-town');
    expect(rich.day - beforeRich).toBeLessThanOrEqual(30);
    expect(rich.onLogs).toBe(false);

    const poor = createInitialState(7);
    const rngB = makeRng(7);
    poor.moneyPence = 0;
    poor.location = 'damp-camp';
    const beforePoor = poor.day;
    toTheLogs(poor, rngB, new Log(rngB));
    expect(poor.day - beforePoor).toBeGreaterThanOrEqual(30);
    expect(poor.moneyPence).toBe(0);
  });

  it('never leaves the player with negative money', () => {
    for (let seed = 0; seed < 60; seed++) {
      const state = createInitialState(seed);
      const rng = makeRng(seed);
      state.moneyPence = seed * 37;
      state.bankPence = seed * 11;
      state.location = 'snakey-gully';
      toTheLogs(state, rng, new Log(rng));
      expect(state.moneyPence).toBeGreaterThanOrEqual(0);
      expect(state.bankPence).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the trooper encounter, through the reducer', () => {
  it('offers bribe, submission or a run, and always resolves', () => {
    for (const choice of ['bribe', 'submit', 'resist'] as const) {
      let state = createInitialState(99);
      const rng = makeRng(99);
      state.location = 'damp-camp';
      state.screen = 'encounter';
      state.pending = { kind: 'trooper' };
      state.moneyPence = pounds(10);
      const out = step(state, { type: choice }, rng);
      state = out.state;
      expect(state.pending).toBeNull();
      expect(state.screen).not.toBe('encounter');
      expect(out.events.length).toBeGreaterThan(0);
    }
  });
});
