import { describe, expect, it } from 'vitest';
import { COACH_FARE, HOSPITAL_FEE_PER_DAY } from '../src/engine/constants';
import { endDay } from '../src/engine/daily';
import { pounds } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { deserialise, serialise } from '../src/engine/save';
import { createInitialState } from '../src/engine/state';
import { getView } from '../src/engine/menus';
import { localTravelDays, travelOneDay } from '../src/engine/travel';
import type { Pending } from '../src/engine/types';

function supplied(day = 1) {
  const state = createInitialState(42);
  state.screen = 'ftown';
  state.location = 'fields-town';
  state.day = day;
  state.moneyPence = pounds(100);
  state.provisionDays = 100;
  state.waterDays = 100;
  state.items.swag = 1;
  return state;
}

describe('saving at a decision', () => {
  it.each<Pending['kind']>([
    'trooper', 'bushrangers', 'patrol', 'hideoutRaid', 'assizes',
    'meeting', 'stockade', 'pardon', 'bailup', 'shantyRaid',
  ])('preserves the %s encounter without choosing an answer', (kind) => {
    const state = supplied(150);
    state.screen = 'encounter';
    state.pending = { kind };
    state.resumeTask = { kind: 'rest', days: 2 };
    const saved = step(state, { type: 'save', id: '1234' }, makeRng(42));
    expect(saved.state).toEqual({ ...state, gameId: '1234' });
    expect(deserialise(serialise(saved.state))).toEqual(saved.state);
    expect(saved.events[0].text).toContain('saved under the number 1234');
  });

  it('ignores unrelated actions rather than surrendering to a trooper', () => {
    const state = supplied();
    state.screen = 'encounter';
    state.pending = { kind: 'trooper' };
    expect(step(state, { type: 'buyGreens' }, makeRng(42)).state).toEqual(state);
  });

  it('can explicitly finish a game while an encounter is waiting', () => {
    const state = supplied();
    state.screen = 'encounter';
    state.pending = { kind: 'trooper' };
    const out = step(state, { type: 'finish' }, makeRng(42)).state;
    expect(out.screen).toBe('end');
    expect(out.gameOver).toBe('finished');
    expect(out.stats.timesArrested).toBe(0);
    expect(out.day).toBe(state.day);
  });
});

describe('time and travel boundaries', () => {
  it('continues on foot when a horse dies on the road', () => {
    const state = supplied();
    state.location = 'on-road';
    state.horse = 'hack';
    state.journey = { route: 'trickeys', mode: 'horse', from: 'suze-port', to: 'fields-town', daysLeft: 3, daysTravelled: 0, salvage: 0 };
    const rng = makeRng(42);
    rng.chance = (p) => p === 0.05 || p === 0.25;
    travelOneDay(state, rng, new Log(rng));
    expect(state.horse).toBe('none');
    expect(state.journey.mode).toBe('walk');
  });

  it('keeps paid nugget-recovery work across New Year without charging twice', () => {
    const state = supplied(365);
    state.location = 'secret-mine';
    state.screen = 'secret-expedition';
    state.secretExpedition = { trail: 4, daysSearched: 9, nuggetFound: true, nuggetCentiOz: 60000, exhausted: false };
    let out = step(state, { type: 'recoverNugget' }, makeRng(42)).state;
    expect(out.secretExpedition?.recoveryDays).toBe(1);
    expect(out.moneyPence).toBe(state.moneyPence - pounds(10));
    out = deserialise(serialise(out))!;
    out = step(out, { type: 'nextYear' }, makeRng(42)).state;
    out = step(out, { type: 'recoverNugget' }, makeRng(42)).state;
    expect(out.day).toBe(368);
    expect(out.moneyPence).toBe(state.moneyPence - pounds(10));
    expect(out.goldCentiOz).toBe(60000);
    expect(out.secretExpedition?.nuggetRecovered).toBe(true);
    expect(getView(out).menu.filter((m) => m.action.type === 'searchSecret').every((m) => m.disabled)).toBe(true);
  });

  it('returns a two-up stake withdrawn before the first toss', () => {
    const state = supplied();
    const bet = step(state, { type: 'startGamble', game: 'twoup', stake: 60 }, makeRng(42)).state;
    const out = step(bet, { type: 'goto', screen: 'ftown-gamble' }, makeRng(42)).state;
    expect(out.moneyPence).toBe(state.moneyPence);
    expect(out.gambling).toBeNull();
    expect(out.stats.gamblingNet).toBe(0);
    expect(out.day).toBe(state.day);
  });

  it('does not reroll rumours when rereading the same newspaper', () => {
    const state = supplied();
    state.gazetteReadOn = state.day;
    const out = step(state, { type: 'readGazette' }, makeRng(42)).state;
    expect(out.secret).toBeNull();
    expect(out.rngState).toBe(state.rngState);
    expect(out.moneyPence).toBe(state.moneyPence);
  });

  it('allows another genuine rumour in a new year', () => {
    const state = supplied(366);
    state.endOfYear = true;
    state.secretGenuineUsed = true;
    expect(step(state, { type: 'nextYear' }, makeRng(42)).state.secretGenuineUsed).toBe(false);
  });

  it('counts one arrest and turns the world when theft is caught', () => {
    const state = supplied(100);
    const rng = makeRng(42);
    rng.chance = () => true;
    const out = step(state, { type: 'steal', target: 'store' }, rng).state;
    expect(out.stats.timesArrested).toBe(1);
    expect(out.daysWithoutGreens - state.daysWithoutGreens).toBe(out.day - state.day);
  });

  it('charges and heals for only the hospital day left in the year', () => {
    const state = supplied(365);
    state.health = 40;
    const out = step(state, { type: 'hospital', days: 7 }, makeRng(42)).state;
    expect(out.day).toBe(366);
    expect(out.moneyPence).toBe(state.moneyPence - HOSPITAL_FEE_PER_DAY);
    expect(out.health).toBeGreaterThanOrEqual(49);
    expect(out.health).toBeLessThanOrEqual(56);
    expect(out.endOfYear).toBe(true);
  });

  it('stops the daily loop while the reckoning is open', () => {
    const state = supplied(366);
    state.endOfYear = true;
    const before = structuredClone(state);
    const rng = makeRng(42);
    endDay(state, rng, new Log(rng));
    expect(state).toEqual(before);
  });

  it('reports the rest actually taken before the year ends', () => {
    const state = supplied(365);
    const out = step(state, { type: 'rest', days: 14 }, makeRng(42));
    expect(out.state.day).toBe(366);
    expect(out.events.map((e) => e.text).join(' ')).toMatch(/1 day\b/);
    expect(out.events.map((e) => e.text).join(' ')).not.toContain('14 days');
  });

  it.each([364, 365])('preserves a paid coach journey across New Year from day %s', (day) => {
    const state = supplied(day);
    let out = step(state, { type: 'coach' }, makeRng(42)).state;
    expect(out.endOfYear).toBe(true);
    expect(out.location).toBe('on-road');
    expect(out.journey?.mode).toBe('coach');
    expect(out.moneyPence).toBe(state.moneyPence - COACH_FARE);
    out = deserialise(serialise(out))!;
    out = step(out, { type: 'nextYear' }, makeRng(42)).state;
    expect(out.location).toBe('suze-port');
    expect(out.journey).toBeNull();
    expect(out.day).toBe(day + 2);
    expect(out.moneyPence).toBe(state.moneyPence - COACH_FARE);
    expect(out.waterDays).toBe(state.waterDays - 2);
  });

  it('shows the shorter downhill return from Blackcap before departure', () => {
    const state = supplied();
    state.location = 'deep-mountains';
    state.screen = 'ftown-depart';
    const row = getView(state).menu.find((m) => m.action.type === 'travelTo' && m.action.place === 'fields-town');
    expect(row?.label).toContain(`${localTravelDays(state, 'fields-town')} day`);
    expect(row?.note).toContain('downhill');
  });

  it('turns the world during a surrender and prison stay', () => {
    const state = supplied(100);
    state.screen = 'encounter';
    state.pending = { kind: 'patrol' };
    const out = step(state, { type: 'submit' }, makeRng(42)).state;
    expect(out.day).toBeGreaterThan(state.day);
    expect(out.daysWithoutGreens - state.daysWithoutGreens).toBe(out.day - state.day);
  });
});

describe('damaged save rejection', () => {
  it('rejects illness severity that would turn health into NaN', () => {
    const state = supplied();
    state.illness = { id: 'fever', severity: 4, since: 1, blinding: false };
    expect(deserialise(serialise(state))).toBeNull();
  });

  it('rejects a journey whose route cannot be looked up', () => {
    const state = supplied();
    const raw = { ...state, journey: { route: 'lost', mode: 'walk', daysLeft: 2, daysTravelled: 0, from: 'fields-town', to: 'suze-port', salvage: 0 } };
    expect(deserialise(JSON.stringify(raw))).toBeNull();
  });
});
