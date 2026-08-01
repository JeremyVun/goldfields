import { describe, expect, it } from 'vitest';
import { JOBS, PRICES } from '../src/engine/constants';
import {
  briggsDiscount,
  buybackPriceOf,
  provisionsPrice,
  provisionsQuote,
} from '../src/engine/market';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';

describe('the Suze Port redesign', () => {
  it('makes its two jobs competitive and mechanically distinct', () => {
    expect(JOBS.wharf.lo).toBeGreaterThan(JOBS.clerk.lo);
    expect(JOBS.town.hi).toBeGreaterThan(JOBS.clerk.hi);

    let wharf = createInitialState(11);
    wharf.provisionDays = 0;
    wharf = step(wharf, { type: 'work', job: 'wharf', days: 1 }, makeRng(11)).state;
    expect(wharf.stats.daysWorked).toBe(1);
    expect(wharf.provisionDays).toBe(0); // the shift meal prevented starvation
    expect(wharf.suzeStanding).toBe(1);

    let town = createInitialState(12);
    town.provisionDays = 5;
    town = step(town, { type: 'work', job: 'town', days: 1 }, makeRng(12)).state;
    expect(town.suzeStanding).toBe(2);
  });

  it('offers food outside the provisions store', () => {
    const state = createInitialState(4);
    const labels = getView({ ...state, screen: 'suze' }).menu.map((m) => m.label).join(' ');
    expect(labels).toMatch(/hot meal/i);
    expect(labels).toMatch(/fish/i);
  });

  it('lets horse knowledge be earned instead of giving the answer away', () => {
    let state = createInitialState(5);
    state.screen = 'suze-horses';
    const first = getView(state);
    expect([...first.body, ...first.menu.map((m) => m.label)].join(' ')).not.toMatch(/\bhack\b/i);
    expect(first.body.join(' ')).not.toMatch(/buy a brumby/i);
    state = step(state, { type: 'inspectHorse', kind: 'brumby', method: 'look' }, makeRng(5)).state;
    expect(getView(state).body.join(' ')).toMatch(/sound feet/i);
  });
});

describe('prices and provisions', () => {
  it('buys used goods at 25% of the port price everywhere', () => {
    const state = createInitialState(1);
    for (const location of ['suze-port', 'fields-town', 'damp-camp'] as const) {
      state.location = location;
      expect(buybackPriceOf(state, 'pan')).toBe(Math.round(PRICES.pan.suze * 0.25));
    }
  });

  it('discounts a full four-week order and never charges beyond the 84-day cap', () => {
    const state = createInitialState(2);
    const bulk = provisionsQuote(state, 4);
    expect(bulk.days).toBe(28);
    expect(bulk.cost).toBe(Math.round(provisionsPrice(state) * 4 * 0.9));

    state.provisionDays = 80;
    const topUp = provisionsQuote(state, 4);
    expect(topUp.days).toBe(4);
    expect(topUp.cost).toBe(Math.round(provisionsPrice(state) * 4 / 7));
  });

  it('uses visible Briggs service tiers and legal markups', () => {
    const state = createInitialState(3);
    state.location = 'fields-town';
    state.briggsDays = 21;
    expect(briggsDiscount(state)).toBe(0.1);
    const honest = getView({ ...state, screen: 'ftown-store' });
    expect(honest.body.join(' ')).toMatch(/21 days served — 10%/);
    const honestPrice = honest.menu.find((m) => /tin pan/i.test(m.label))?.label;
    state.legal = 'major criminal';
    const criminal = getView({ ...state, screen: 'ftown-store' });
    expect(criminal.body.join(' ')).toMatch(/risk premium/i);
    expect(criminal.menu.find((m) => /tin pan/i.test(m.label))?.label).not.toBe(honestPrice);
  });
});

describe('expeditions, claims and company business', () => {
  it('turns the secret mine into a trail for a named giant nugget', () => {
    let state = createInitialState(20);
    state.location = 'secret-mine';
    state.screen = 'secret-expedition';
    state.secretExpedition = { trail: 0, daysSearched: 0, nuggetFound: false, exhausted: false };
    state.provisionDays = 20;
    state.waterDays = 20;
    expect(getView(state).body.join(' ')).toMatch(/Southern Cross/);
    expect(getView(state).menu.map((m) => m.label).join(' ')).toMatch(/Winnow.*by hand/i);
    for (let i = 0; i < 4; i++) {
      state = step(state, { type: 'searchSecret', approach: 'search' }, makeRng(20 + i)).state;
    }
    expect(state.secretExpedition?.trail).toBe(4);
    expect(getView(state).menu.find((m) => /Dig the black leader/.test(m.label))?.disabled).toBe(false);
  });

  it('registers and guards claims, then gives a jumped owner a choice', () => {
    let state = createInitialState(30);
    state.location = 'fields-town';
    state.screen = 'ftown-council';
    state.moneyPence = pounds(2);
    state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    state = step(state, { type: 'registerClaim', camp: 'damp-camp' }, makeRng(30)).state;
    expect(state.claims['damp-camp']?.registered).toBe(true);

    state.location = 'damp-camp';
    state = step(state, { type: 'guardClaim', camp: 'damp-camp', days: 7 }, makeRng(31)).state;
    expect(state.claims['damp-camp']?.guardedUntilDay).toBeGreaterThanOrEqual(7);
    if (state.claims['damp-camp']) state.claims['damp-camp'].jumpedOn = state.day;
    state.pending = { kind: 'claimJumper', data: { camp: 'damp-camp' } };
    state.screen = 'encounter';
    expect(getView(state).menu.map((m) => m.label).join(' ')).toMatch(/Council/);
    state = step(state, { type: 'answerClaimJumper', choice: 'abandon' }, makeRng(32)).state;
    expect(state.claims['damp-camp']).toBeNull();
  });

  it('makes Suze Port the place to cultivate company relations and freight', () => {
    let state = createInitialState(40);
    state.location = 'suze-port';
    state.moneyPence = pounds(20);
    state.provisionDays = 10;
    state.company = {
      name: 'The Test Company', treasury: pounds(20), sharesOwned: 8, sharesPublic: 0,
      sharesUnsold: 12, sharePrice: pounds(10), crews: [], leases: [], weekProfit: [],
      lastWeekGold: 0, foundedOn: 1, lastDividendDay: 0, relations: 0,
      supplyContractUntilDay: 0,
    };
    const company = getView({ ...state, screen: 'company' });
    expect(company.menu.map((m) => m.label).join(' ')).toMatch(/investors.*supply contract/i);
    state = step(state, { type: 'companyRelations' }, makeRng(40)).state;
    expect(state.company?.relations).toBeGreaterThan(0);
    state = step(state, { type: 'companySupplyContract' }, makeRng(41)).state;
    expect(state.company?.supplyContractUntilDay).toBeGreaterThan(state.day);
  });
});

describe('playable gambling', () => {
  it('separates two-up calls from cards decisions without consuming a day', () => {
    let state = createInitialState(50);
    state.location = 'fields-town';
    state.moneyPence = pounds(10);
    const day = state.day;
    state = step(state, { type: 'startGamble', game: 'twoup', stake: shillings(5) }, makeRng(50)).state;
    expect(state.screen).toBe('ftown-twoup');
    expect(getView(state).menu.map((m) => m.label).join(' ')).toMatch(/heads.*tails/i);
    expect(state.day).toBe(day);

    state = step(state, { type: 'startGamble', game: 'cards', stake: shillings(5) }, makeRng(51)).state;
    expect(state.screen).toBe('ftown-cards');
    expect(getView(state).menu.map((m) => m.label).join(' ')).toMatch(/Fold.*Call.*Raise.*Bluff/i);
    expect(state.day).toBe(day);
  });
});
