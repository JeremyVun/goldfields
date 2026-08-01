import { describe, expect, it } from 'vitest';
import { HEALTH_MAX, HOSPITAL_FEE_PER_DAY, SCURVY_DAYS } from '../src/engine/constants';
import { endDay } from '../src/engine/daily';
import {
  ILLNESS_NAMES,
  checkGrave,
  contract,
  damage,
  heal,
  hospitalStay,
  nightlyHealth,
  rollIllness,
  sicknessRisk,
} from '../src/engine/health';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState, healthWord } from '../src/engine/state';
import type { IllnessId } from '../src/engine/types';

function fresh(seed = 5) {
  const state = createInitialState(seed);
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

describe('health in words', () => {
  it('maps the scale the kitty shows', () => {
    expect(healthWord(100)).toBe('Hearty');
    expect(healthWord(80)).toBe('Hearty');
    expect(healthWord(79)).toBe('Good');
    expect(healthWord(60)).toBe('Good');
    expect(healthWord(59)).toBe('Poorly');
    expect(healthWord(40)).toBe('Poorly');
    expect(healthWord(39)).toBe('Ill');
    expect(healthWord(20)).toBe('Ill');
    expect(healthWord(19)).toBe('Gravely ill');
    expect(healthWord(1)).toBe('Gravely ill');
    expect(healthWord(0)).toBe('Dead');
  });
});

describe('damage and healing', () => {
  it('never goes below zero or above the maximum', () => {
    const { state } = fresh();
    heal(state, 500);
    expect(state.health).toBe(HEALTH_MAX);
    damage(state, 1000, 'a cave-in');
    expect(state.health).toBe(0);
    expect(state.gameOver).toBe('dead');
    expect(state.causeOfDeath).toBe('a cave-in');
  });

  it('records only the first cause of death', () => {
    const { state } = fresh();
    damage(state, 200, 'dysentery');
    damage(state, 200, 'a snakebite');
    expect(state.causeOfDeath).toBe('dysentery');
  });
});

describe('afflictions', () => {
  it('names every affliction the field hands out', () => {
    const ids: IllnessId[] = [
      'dysentery',
      'typhoid',
      'scurvy',
      'sandyBlight',
      'sunstroke',
      'snakebite',
      'spiderbite',
      'injury',
      'fever',
      'exhaustion',
    ];
    for (const id of ids) expect(ILLNESS_NAMES[id]).toBeTruthy();
  });

  it('the Sandy Blight blinds you', () => {
    const { state, rng, log } = fresh();
    contract(state, rng, log, 'sandyBlight', 1);
    expect(state.illness?.blinding).toBe(true);
  });

  it('catching the same thing twice makes it worse, not new', () => {
    const { state, rng, log } = fresh();
    contract(state, rng, log, 'dysentery', 1);
    const since = state.illness?.since;
    contract(state, rng, log, 'dysentery', 1);
    expect(state.illness?.severity).toBe(2);
    expect(state.illness?.since).toBe(since);
  });

  it('drains health day by day', () => {
    const { state, rng, log } = fresh(31);
    contract(state, rng, log, 'fever', 2);
    for (let i = 0; i < 5; i++) nightlyHealth(state, rng, log);
    expect(state.health).toBeLessThan(HEALTH_MAX);
  });

  it('is usually thrown off within a month or so', () => {
    let recovered = 0;
    for (let seed = 0; seed < 60; seed++) {
      const state = createInitialState(seed);
      const rng = makeRng(seed * 31 + 7);
      const log = new Log(rng);
      state.lodging = 'inn';
      state.provisionDays = 200;
      contract(state, rng, log, 'fever', 1);
      const started = state.illness;
      for (let d = 0; d < 40 && state.illness === started; d++) nightlyHealth(state, rng, log);
      if (state.illness !== started) recovered += 1;
    }
    expect(recovered).toBeGreaterThan(45);
  });

  it('summer brings the Sandy Blight and sunstroke; winter does not', () => {
    const summer = createInitialState(3);
    summer.day = 15; // January
    const winter = createInitialState(3);
    winter.day = 190; // July
    const rng = makeRng(3);
    const summerRolls = new Set<IllnessId>();
    const winterRolls = new Set<IllnessId>();
    for (let i = 0; i < 400; i++) {
      summerRolls.add(rollIllness(summer, rng));
      winterRolls.add(rollIllness(winter, rng));
    }
    expect(summerRolls.has('sandyBlight')).toBe(true);
    expect(summerRolls.has('sunstroke')).toBe(true);
    expect(winterRolls.has('sandyBlight')).toBe(false);
    expect(winterRolls.has('sunstroke')).toBe(false);
  });

  it('scurvy only threatens a man who has eaten no greens for months', () => {
    const fed = createInitialState(9);
    const starved = createInitialState(9);
    starved.daysWithoutGreens = SCURVY_DAYS + 10;
    const rng = makeRng(9);
    const fedRolls = new Set<IllnessId>();
    const starvedRolls = new Set<IllnessId>();
    for (let i = 0; i < 400; i++) {
      fedRolls.add(rollIllness(fed, rng));
      starvedRolls.add(rollIllness(starved, rng));
    }
    expect(fedRolls.has('scurvy')).toBe(false);
    expect(starvedRolls.has('scurvy')).toBe(true);
  });
});

describe('what makes a man sick', () => {
  it('sleeping rough is worse than the inn', () => {
    const { state } = fresh();
    state.lodging = 'inn';
    const inn = sicknessRisk(state);
    state.lodging = 'stable';
    const stable = sicknessRisk(state);
    state.lodging = 'rough';
    const rough = sicknessRisk(state);
    expect(rough).toBeGreaterThan(stable);
    expect(stable).toBeGreaterThan(inn);
  });

  it('camp squalor and no tent both tell', () => {
    const { state } = fresh();
    state.location = 'damp-camp';
    state.items.tent = 1;
    const tented = sicknessRisk(state);
    state.items.tent = 0;
    expect(sicknessRisk(state)).toBeGreaterThan(tented);
    state.items.tent = 1;
    state.location = 'snakey-gully';
    expect(sicknessRisk(state)).toBeGreaterThan(tented);
  });

  it('hunger and a weak constitution both raise the odds', () => {
    const { state } = fresh();
    state.provisionDays = 5;
    const fed = sicknessRisk(state);
    state.provisionDays = 0;
    expect(sicknessRisk(state)).toBeGreaterThan(fed);
    state.provisionDays = 5;
    state.health = 25;
    expect(sicknessRisk(state)).toBeGreaterThan(fed);
  });
});

describe('starvation and thirst', () => {
  it('an empty swag costs health every day', () => {
    const { state, rng, log } = fresh();
    state.provisionDays = 0;
    const before = state.health;
    endDay(state, rng, log, {});
    expect(state.health).toBeLessThan(before);
  });

  it('running out of water in summer is far worse than in winter', () => {
    const summer = createInitialState(1);
    summer.day = 10;
    summer.location = 'on-road';
    summer.waterDays = 0;
    const winter = createInitialState(1);
    winter.day = 190;
    winter.location = 'on-road';
    winter.waterDays = 0;
    summer.provisionDays = winter.provisionDays = 10;
    const rngA = makeRng(1);
    const rngB = makeRng(1);
    endDay(summer, rngA, new Log(rngA), { travelling: true });
    endDay(winter, rngB, new Log(rngB), { travelling: true });
    expect(100 - summer.health).toBeGreaterThan(100 - winter.health);
  });

  it('a brumby will scratch out water in a dry creek bed', () => {
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const state = createInitialState(seed);
      const rng = makeRng(seed);
      state.horse = 'brumby';
      state.waterDays = 1;
      state.provisionDays = 10;
      const log = new Log(rng);
      endDay(state, rng, log, { travelling: true });
      if (state.waterDays > 0) found = true;
    }
    expect(found).toBe(true);
  });
});

describe('Canvas House', () => {
  it('carts a gravely ill digger off the field and charges him for it', () => {
    const { state, rng, log } = fresh(17);
    state.location = 'damp-camp';
    state.health = 10;
    state.moneyPence = pounds(10);
    const before = state.day;
    expect(checkGrave(state, rng, log)).toBe(true);
    expect(state.location).toBe('fields-town');
    expect(state.day).toBeGreaterThan(before);
    expect(state.moneyPence).toBeLessThan(pounds(10));
    expect(state.health).toBeGreaterThan(10);
  });

  it('leaves a man in town to his own devices', () => {
    const { state, rng, log } = fresh();
    state.location = 'fields-town';
    state.health = 10;
    expect(checkGrave(state, rng, log)).toBe(false);
  });

  it('charges ten shillings a day and mends you', () => {
    const { state, rng, log } = fresh();
    state.health = 30;
    state.moneyPence = pounds(10);
    hospitalStay(state, rng, log, 3);
    expect(state.moneyPence).toBe(pounds(10) - HOSPITAL_FEE_PER_DAY * 3);
    expect(HOSPITAL_FEE_PER_DAY).toBe(shillings(10));
    expect(state.health).toBeGreaterThan(30);
  });

  it('takes what it can when the patient is short', () => {
    const { state, rng, log } = fresh();
    state.health = 30;
    state.moneyPence = shillings(15);
    hospitalStay(state, rng, log, 7);
    expect(state.moneyPence).toBeGreaterThanOrEqual(0);
    expect(state.moneyPence).toBeLessThanOrEqual(shillings(15));
  });
});
