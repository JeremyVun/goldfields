import { describe, expect, it } from 'vitest';
import { CARDS_PAYOUT, JOBS, PARTNER_SHARE, PRICES } from '../src/engine/constants';
import { endDay, passKeptDays } from '../src/engine/daily';
import {
  briggsDiscount,
  buybackPriceOf,
  provisionsPrice,
  provisionsQuote,
} from '../src/engine/market';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { payDividends } from '../src/engine/events';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { deserialise } from '../src/engine/save';
import { createInitialState } from '../src/engine/state';

describe('the Port Gannet redesign', () => {
  it('makes wharf labour the fed fallback and town jobs the better-paid advancement path', () => {
    expect(JOBS.wharf.lo).toBe(shillings(2));
    expect(JOBS.wharf.hi).toBe(shillings(3));
    expect(JOBS.wharf.hi).toBeLessThan(JOBS.town.lo);
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

  it('uses visible Bell service tiers and legal markups', () => {
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

describe('approved timing fixes', () => {
  it('charges for the Times once per issue, not once per opening', () => {
    let state = createInitialState(8);
    state.moneyPence = shillings(1);
    state = step(state, { type: 'readGazette' }, makeRng(8)).state;
    const afterFirst = state.moneyPence;
    state = step(state, { type: 'readGazette' }, makeRng(9)).state;
    expect(state.moneyPence).toBe(afterFirst);
  });

  it('does not pay a full-year dividend on scrip bought in the final month', () => {
    const state = createInitialState(9);
    state.day = 365;
    state.shares = 3;
    state.sharesBoughtOn = 350;
    const rng = makeRng(9);
    payDividends(state, rng, new Log(rng));
    expect(state.bankPence).toBe(0);
  });
});

describe('expeditions, claims and company business', () => {
  it("turns Widow's Reef into a trail for a named giant nugget", () => {
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

  it('makes Port Gannet the place to cultivate company relations and freight', () => {
    let state = createInitialState(40);
    state.location = 'suze-port';
    state.moneyPence = pounds(20);
    state.provisionDays = 10;
    state.company = {
      name: 'The Test Company', treasury: pounds(20), sharesOwned: 8, sharesPublic: 0,
      sharesUnsold: 12, sharePrice: pounds(10), crews: [], leases: [], weekProfit: [],
      lastWeekGold: 0, foundedOn: 1, lastDividendDay: 0, relations: 0,
      supplyContractUntilDay: 0, battery: false, driving: 'ordinary', lastWeek: null,
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

  it('returns 1.4 times the cards risk on a win and still consumes no time', () => {
    const state = createInitialState(52);
    state.location = 'fields-town';
    state.moneyPence = shillings(20);
    state.gambling = { game: 'cards', stake: shillings(5), pot: 0, round: 1, hand: 10, tell: 'steady' };
    const before = state.moneyPence;
    const out = step(state, { type: 'cardsDecision', choice: 'call' }, makeRng(52)).state;
    const returned = Math.round(shillings(5) * CARDS_PAYOUT);
    expect(out.moneyPence).toBe(before + returned);
    expect(out.stats.gamblingNet).toBe(returned - shillings(5));
    expect(out.day).toBe(state.day);
  });

  it('keeps optimal play across the visible hands slightly negative', () => {
    let expected = 0;
    for (let hand = 1; hand <= 10; hand++) {
      for (const tell of ['steady', 'eager', 'uneasy'] as const) {
        const tellBonus = tell === 'uneasy' ? 1 : tell === 'eager' ? -1 : 0;
        const callChance = hand / 10; // ties win
        let bluffChance = 0;
        for (let swing = -2; swing <= 4; swing++) {
          bluffChance += Math.max(0, Math.min(10, hand + swing + tellBonus)) / 70;
        }
        expected += Math.max(
          -0.5, // fold
          CARDS_PAYOUT * callChance - 1,
          2 * CARDS_PAYOUT * callChance - 2, // raise doubles risk and return
          CARDS_PAYOUT * bluffChance - 1,
        );
      }
    }
    expected /= 30;
    expect(expected).toBeLessThan(0);
    expect(expected).toBeGreaterThan(-0.03);
  });
});

describe('town survival and lodging', () => {
  it('uses carried water outside the two towns, unless a water race supplies the camp', () => {
    const tick = (location: 'suze-port' | 'fields-town' | 'damp-camp', raced = false) => {
      const state = createInitialState(60);
      state.location = location;
      state.provisionDays = 10;
      state.waterDays = 3;
      if (raced) state.estate.works.push({ id: 'waterRace', day: 1, camp: 'damp-camp' });
      const rng = makeRng(60);
      endDay(state, rng, new Log(rng));
      return state.waterDays;
    };
    expect(tick('suze-port')).toBe(3);
    expect(tick('fields-town')).toBe(3);
    expect(tick('damp-camp')).toBe(2);
    expect(tick('damp-camp', true)).toBe(3);
  });

  it('keeps Slateford lodging and tent rent separate from Port Gannet', () => {
    let state = createInitialState(61);
    state.location = 'suze-port';
    state = step(state, { type: 'setLodging', kind: 'inn' }, makeRng(61)).state;
    state.location = 'fields-town';
    state.screen = 'ftown-lodgings';
    state = step(state, { type: 'setLodging', kind: 'stable' }, makeRng(62)).state;
    expect(state.lodging).toBe('inn');
    expect(state.slatefordLodging).toBe('stable');
    expect(getView(state).menu.map((m) => m.label).join(' ')).toMatch(/Inn.*stable.*tent ground.*rough/i);

    const old = { ...state } as Partial<typeof state>;
    delete old.slatefordLodging;
    delete old.slatefordTentGroundPaidUntil;
    const migrated = deserialise(JSON.stringify(old));
    expect(migrated?.slatefordLodging).toBe('rough');
    expect(migrated?.lodging).toBe('inn');
  });

  it('feeds a successful Canvas House orderly for the day', () => {
    let state = createInitialState(11);
    state.location = 'fields-town';
    state.provisionDays = 0;
    state = step(state, { type: 'work', job: 'orderly', days: 1 }, makeRng(11)).state;
    expect(state.stats.daysWorked).toBe(1);
    expect(state.health).toBe(100);
    expect(state.provisionDays).toBe(0);
  });

  it('splits a partner haul equally and charges no wage', () => {
    expect(PARTNER_SHARE).toBe(0.5);
  });
});

describe('detention time', () => {
  it('turns the daily world loop while the prisoner waits for the magistrate', () => {
    const state = createInitialState(63);
    state.day = 6;
    state.location = 'damp-camp';
    state.screen = 'encounter';
    state.pending = { kind: 'trooper' };
    state.moneyPence = pounds(50);
    state.provisionDays = 12;
    const out = step(state, { type: 'submit' }, makeRng(63)).state;
    expect(out.day).toBe(30);
    expect(out.worthHistory.length).toBeGreaterThan(1);
    expect(out.provisionDays).toBe(12); // gaol rations, not the prisoner's swag
    expect(out.pending).toBeNull();
  });

  it('does not offer a detained player an event they cannot attend', () => {
    const state = createInitialState(64);
    state.day = 330;
    state.location = 'fields-town';
    const rng = makeRng(64);
    passKeptDays(state, rng, new Log(rng), 3);
    expect(state.pending).toBeNull();
    expect(state.stockadeDone).toBe(false); // it can still be offered after release
  });
});
