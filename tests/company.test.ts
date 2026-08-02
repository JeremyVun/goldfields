/**
 * The player's own company: floating it, running it, and getting out of it
 * (GAME_SPEC.md §19).
 */

import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/content/say';
import {
  COMPANY_CREW_WAGES,
  COMPANY_FLOAT_STANDING,
  COMPANY_MAX_LEASES,
  COMPANY_REGISTRATION_FEE,
  COMPANY_SHARES,
  COMPANY_SHARE_PRICE,
} from '../src/engine/constants';
import {
  abandonLease,
  buyBackShares,
  canFloat,
  companyWeek,
  declareDividend,
  fireCrew,
  floatCompany,
  floatRequirements,
  hireCrew,
  installPlant,
  leaseWord,
  sellOut,
  sellOwnShares,
  setCrewTask,
  setLeasePlan,
  subscriptionCost,
  uptakeChance,
} from '../src/engine/company';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng, type RNG } from '../src/engine/rng';
import { deserialise, serialise } from '../src/engine/save';
import { companyWorth, createInitialState, netWorth } from '../src/engine/state';
import type { GameState, Lease } from '../src/engine/types';

/** A man with proved ground, a name, and a hundred pounds behind him. */
function promoter(seed = 5): { state: GameState; rng: RNG; log: Log } {
  const state = createInitialState(seed);
  state.location = 'deep-mountains';
  state.day = 120;
  state.provisionDays = 200;
  state.standing = 60;
  state.moneyPence = pounds(200);
  state.claims['deep-mountains'] = { richnessPct: 140, workedDays: 6, peggedOn: 40, proven: true };
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

function floated(seed = 5, shares = 12): { state: GameState; rng: RNG; log: Log } {
  const ctx = promoter(seed);
  floatCompany(ctx.state, ctx.rng, ctx.log, shares);
  return ctx;
}

function leaseAt(yieldNowPct: number): Lease {
  return {
    name: 'the Test Mine',
    reefPct: yieldNowPct,
    level: 1,
    faceCrewWeeks: 5,
    yieldNowPct,
    wet: false,
    pump: false,
    timbered: false,
    flooded: false,
    progressCrewWeeks: 0,
    plan: null,
  };
}

// ---------------------------------------------------------------------------
// §19.1 Floating
// ---------------------------------------------------------------------------

describe('floating a company', () => {
  it('is refused until standing, character, proved ground and capital all hold', () => {
    const { state } = promoter();
    expect(canFloat(state)).toBe(true);

    const noName = { ...state, standing: 20 };
    expect(canFloat(noName)).toBe(false);
    expect(floatRequirements(noName).filter((r) => !r.met)).toHaveLength(1);

    const rogue = { ...state, legal: 'major criminal' as const };
    expect(canFloat(rogue)).toBe(false);

    const unproved = { ...state, claims: { ...state.claims, 'deep-mountains': null } };
    expect(canFloat(unproved)).toBe(false);

    const duffer = {
      ...state,
      claims: {
        ...state.claims,
        'deep-mountains': { richnessPct: 140, workedDays: 0, peggedOn: 1, proven: false },
      },
    };
    expect(canFloat(duffer)).toBe(false);

    const pauper = { ...state, moneyPence: pounds(20), bankPence: 0 };
    expect(canFloat(pauper)).toBe(false);
    // The clerk names the want, and does not write the company up.
    const log = new Log(makeRng(1));
    expect(floatCompany(pauper, makeRng(1), log, 12)).toBe(false);
    expect(pauper.company).toBeNull();
  });

  it('accepts a known digger without requiring a second reputation grind', () => {
    const { state } = promoter();
    state.standing = COMPANY_FLOAT_STANDING;
    expect(canFloat(state)).toBe(true);
    state.standing -= 0.25;
    expect(canFloat(state)).toBe(false);
  });

  it('takes the fee and the subscription, and offers the rest to the public', () => {
    for (const shares of [8, 12, 16]) {
      const { state, rng, log } = promoter(7);
      const before = state.moneyPence;
      expect(floatCompany(state, rng, log, shares)).toBe(true);
      const c = state.company!;
      expect(c.sharesOwned).toBe(shares);
      expect(c.sharesUnsold).toBe(COMPANY_SHARES - shares);
      expect(c.sharesPublic).toBe(0);
      expect(c.treasuryPence).toBe(subscriptionCost(shares));
      expect(c.sharePricePence).toBe(COMPANY_SHARE_PRICE);
      expect(state.moneyPence).toBe(before - COMPANY_REGISTRATION_FEE - subscriptionCost(shares));
      expect(c.name.length).toBeGreaterThan(8);
    }
  });

  it('refuses a subscription the prospectus does not allow', () => {
    const { state, rng, log } = promoter();
    expect(floatCompany(state, rng, log, 20)).toBe(false);
    expect(state.company).toBeNull();
  });

  it('turns the proved claim into the company’s first named, bottomed mine', () => {
    const { state } = floated();
    expect(state.claims['deep-mountains']).toBeNull();
    const c = state.company!;
    expect(c.leases).toHaveLength(1);
    expect(c.leases[0].reefPct).toBe(140);
    expect(c.leases[0].name.length).toBeGreaterThan(4);
    expect(c.leases[0].level).toBe(1);
    expect(c.leases[0].faceCrewWeeks).toBeGreaterThanOrEqual(4);
  });

  it('draws the outlay from the bank when the pocket will not cover it', () => {
    const { state, rng, log } = promoter();
    state.moneyPence = pounds(10);
    state.bankPence = pounds(150);
    expect(floatCompany(state, rng, log, 8)).toBe(true);
    expect(state.moneyPence).toBe(0);
    expect(state.bankPence).toBe(pounds(150) - (pounds(90) - pounds(10)));
    expect(state.bankPence).toBeGreaterThanOrEqual(0);
  });

  it('will not be floated twice', () => {
    const { state, rng, log } = floated();
    const name = state.company!.name;
    expect(floatCompany(state, rng, log, 8)).toBe(false);
    expect(state.company!.name).toBe(name);
  });

  it('is offered at the Council Chambers and the workings, and nowhere else', () => {
    const { state } = promoter();
    state.location = 'damp-camp';
    const out = step(state, { type: 'floatCompany', shares: 8 }, makeRng(3));
    expect(out.state.company).toBeNull();
    const town = step({ ...state, location: 'fields-town' }, { type: 'floatCompany', shares: 8 }, makeRng(3));
    expect(town.state.company).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §19.1 Public uptake
// ---------------------------------------------------------------------------

describe('the public appetite for scrip', () => {
  it('rises with a man’s standing and falls as the field grows angry', () => {
    const { state } = floated();
    const base = uptakeChance(state);
    expect(uptakeChance({ ...state, standing: 100 })).toBeGreaterThan(base);
    expect(uptakeChance({ ...state, agitation: 90 })).toBeLessThan(base);
    expect(uptakeChance({ ...state, standing: 0, agitation: 100 })).toBeGreaterThan(0);
    expect(uptakeChance({ ...state, standing: 100, agitation: 0 })).toBeLessThan(1);
  });

  it('sells unsold shares week by week, and the money goes to the treasury', () => {
    const { state, rng, log } = floated(11, 8);
    const c = state.company!;
    const startTreasury = c.treasuryPence;
    for (let i = 0; i < 20 && c.sharesUnsold > 0; i++) companyWeek(state, rng, log);
    expect(c.sharesUnsold).toBeLessThan(12);
    expect(c.sharesPublic).toBeGreaterThan(0);
    expect(c.sharesOwned + c.sharesPublic + c.sharesUnsold).toBe(COMPANY_SHARES);
    expect(c.treasuryPence).toBeGreaterThan(startTreasury - pounds(50));
  });
});

// ---------------------------------------------------------------------------
// §19.2 The week
// ---------------------------------------------------------------------------

describe('a week at the workings', () => {
  it('wins money into the treasury and works out the current face', () => {
    const { state, rng, log } = floated(21);
    const c = state.company!;
    c.leases[0].wet = false;
    c.crews = [{ task: 'mine' }];
    const before = c.treasuryPence;
    let won = 0;
    for (let i = 0; i < 8; i++) {
      const t = c.treasuryPence;
      companyWeek(state, rng, log);
      won += c.treasuryPence - t;
    }
    expect(c.leases[0].faceCrewWeeks).toBe(0);
    // Over eight weeks a crew on good ground more than pays its own wages.
    expect(c.treasuryPence).toBeGreaterThan(0);
    expect(won).not.toBe(0);
    expect(before).toBeGreaterThan(0);
  });

  it('pays the wages out of the treasury, and out of the player’s pocket at a pinch', () => {
    const { state, rng, log } = floated(31);
    const c = state.company!;
    c.crews = [{ task: 'mine' }];
    c.treasuryPence = 0;
    c.leases[0].flooded = true;
    state.moneyPence = pounds(10);
    companyWeek(state, rng, log);
    expect(state.moneyPence).toBeLessThan(pounds(10));
    expect(c.crews.length).toBe(1);
    expect(c.treasuryPence).toBeGreaterThanOrEqual(0);
  });

  it('sees the men walk off when neither treasury nor pocket can pay them', () => {
    const { state, rng, log } = floated(41);
    const c = state.company!;
    c.crews = [{ task: 'mine' }, { task: 'mine' }];
    c.treasuryPence = 0;
    c.leases[0].flooded = true;
    state.moneyPence = shillings(2);
    state.standing = 70;
    const price = c.sharePricePence;
    companyWeek(state, rng, log);
    expect(c.crews).toHaveLength(0);
    expect(c.sharePricePence).toBeLessThanOrEqual(Math.round(price / 2));
    expect(state.standing).toBe(60);
    expect(state.moneyPence).toBeGreaterThanOrEqual(0);
  });

  it('pays compensation for a cave-in, and never out of an empty treasury', () => {
    const { state, log } = floated(51);
    const c = state.company!;
    c.crews = [{ task: 'mine' }];
    c.treasuryPence = shillings(4);
    state.moneyPence = 0;
    // A generator that makes every hazard roll come true.
    const cruel = makeRng(1);
    cruel.chance = () => true;
    companyWeek(state, cruel, log);
    expect(c.treasuryPence).toBeGreaterThanOrEqual(0);
    expect(state.moneyPence).toBeGreaterThanOrEqual(0);
  });

  it('removes the mining crew that quits after its cave-in, not the last crew hired', () => {
    const { state, log } = floated(52);
    const c = state.company!;
    c.crews = [{ task: 'mine' }, { task: 'prospect' }];
    c.treasuryPence = pounds(500);

    const scripted = makeRng(1);
    const outcomes = [true, true, false]; // cave-in, miner quits, no prospecting strike
    scripted.chance = () => outcomes.shift() ?? false;

    companyWeek(state, scripted, log);

    expect(c.crews).toEqual([{ task: 'prospect' }]);
  });

  it('lets a prospecting crew prove fresh leases, up to the four the company may hold', () => {
    const { state, log } = floated(61);
    const c = state.company!;
    c.crews = [{ task: 'prospect' }];
    const lucky = makeRng(2);
    lucky.chance = () => true;
    c.treasuryPence = pounds(500);
    for (let i = 0; i < 10; i++) companyWeek(state, lucky, log);
    expect(c.leases.length).toBe(COMPANY_MAX_LEASES);
    expect(c.leases.slice(1).every((l) => l.level === 0)).toBe(true);
    expect(new Set(c.leases.map((l) => l.name)).size).toBe(COMPANY_MAX_LEASES);
  });

  it('reports each mine and its stone without exposing assay values', () => {
    const { state } = floated();
    const words = [
      leaseWord(leaseAt(30)),
      leaseWord(leaseAt(140)),
      leaseWord(leaseAt(260)),
    ];
    for (const w of words) {
      expect(w).not.toMatch(/\b(?:30|140|260)\b/);
      expect(w.length).toBeGreaterThan(6);
    }
    expect(words[0]).not.toBe(words[1]);
    void state;
  });

  it('is run by the day’s end wherever the player happens to be', () => {
    const { state } = floated(71);
    state.company!.crews = [{ task: 'mine' }];
    state.location = 'suze-port';
    state.day = 69; // the seventh day falls inside a week's rest
    state.provisionDays = 40;
    const out = step(state, { type: 'rest', days: 7 }, makeRng(71));
    expect(out.state.company!.weekProfitPence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §19.2 Crews
// ---------------------------------------------------------------------------

describe('crews', () => {
  it('are taken on at the workings only, and only when the wages are there', () => {
    const { state, log } = floated();
    state.location = 'fields-town';
    expect(hireCrew(state, log)).toBe(false);
    state.location = 'deep-mountains';
    expect(hireCrew(state, log)).toBe(true);
    expect(hireCrew(state, log)).toBe(true);
    expect(hireCrew(state, log)).toBe(true);
    expect(hireCrew(state, log)).toBe(false); // three crews is the limit
    state.company!.treasuryPence = COMPANY_CREW_WAGES - 1;
    expect(fireCrew(state, log)).toBe(true);
    expect(hireCrew(state, log)).toBe(false);
  });

  it('are set to the reef or to prospecting', () => {
    const { state, log } = floated();
    state.company!.crews = [{ task: 'mine' }];
    expect(setCrewTask(state, log, 0, 'prospect')).toBe(true);
    expect(state.company!.crews[0].task).toBe('prospect');
    expect(setCrewTask(state, log, 0, 'prospect')).toBe(false);
    expect(setCrewTask(state, log, 4, 'mine')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §19.2 Dividends and dealing
// ---------------------------------------------------------------------------

describe('dividends', () => {
  it('pay every issued share, and the player pockets only his own fraction', () => {
    const { state, log } = floated(81, 12);
    const c = state.company!;
    c.sharesPublic = 4;
    c.sharesUnsold = 4;
    c.treasuryPence = pounds(40);
    state.moneyPence = 0;
    expect(declareDividend(state, log, pounds(1))).toBe(true);
    // Sixteen shares issued: £16 out of the treasury, £12 of it the player's.
    expect(c.treasuryPence).toBe(pounds(24));
    expect(state.moneyPence).toBe(pounds(12));
    expect(c.lastDividendDay).toBe(state.day);
  });

  it('are refused when the treasury will not stand them', () => {
    const { state, log } = floated(82, 8);
    const c = state.company!;
    c.treasuryPence = pounds(1);
    expect(declareDividend(state, log, pounds(5))).toBe(false);
    expect(c.treasuryPence).toBe(pounds(1));
    expect(declareDividend(state, log, 0)).toBe(false);
  });

  it('put the share price up', () => {
    const { state, log } = floated(83, 12);
    const c = state.company!;
    c.treasuryPence = pounds(60);
    const before = c.sharePricePence;
    declareDividend(state, log, shillings(10));
    expect(c.sharePricePence).toBeGreaterThan(before);
  });
});

describe('dealing in your own scrip', () => {
  it('sells at the day’s price when there is appetite for it', () => {
    const { state, log } = floated(91, 16);
    const c = state.company!;
    state.moneyPence = 0;
    const eager = makeRng(3);
    eager.chance = () => true;
    expect(sellOwnShares(state, eager, log, 4)).toBe(true);
    expect(c.sharesOwned).toBe(12);
    expect(c.sharesPublic).toBe(4);
    expect(state.moneyPence).toBe(4 * c.sharePricePence);
  });

  it('finds no buyers in a bad week, and sells nothing', () => {
    const { state, log } = floated(92, 16);
    const cold = makeRng(4);
    cold.chance = () => false;
    expect(sellOwnShares(state, cold, log, 4)).toBe(false);
    expect(state.company!.sharesOwned).toBe(16);
    expect(state.moneyPence).toBe(pounds(200) - pounds(10) - pounds(160));
  });

  it('is selling out altogether once fewer than five shares are retained', () => {
    const { state, log } = floated(93, 8);
    const price = state.company!.sharePricePence;
    const name = state.company!.name;
    const treasuryShare = Math.round((state.company!.treasuryPence * 3) / 20);
    state.moneyPence = 0;
    const eager = makeRng(5);
    eager.chance = () => true;
    sellOwnShares(state, eager, log, 5);
    expect(state.company).toBeNull();
    expect(state.soldOut?.name).toBe(name);
    // Five sold, and the remaining three bought out with them.
    expect(state.moneyPence).toBe(8 * price + treasuryShare);
    expect(state.soldOut?.amount).toBe(3 * price + treasuryShare);
  });

  it('sells out on demand, and the company leaves the state entirely', () => {
    const { state, log } = floated(94, 16);
    state.moneyPence = 0;
    const price = state.company!.sharePricePence;
    const treasuryShare = Math.round((state.company!.treasuryPence * 16) / 20);
    expect(sellOut(state, log)).toBe(true);
    expect(state.company).toBeNull();
    expect(state.moneyPence).toBe(16 * price + treasuryShare);
    expect(state.journal.some((j) => j.text.includes('Sold out'))).toBe(true);
  });

  it('buys scrip back off the company and off the public, and cannot on credit', () => {
    const { state, log } = floated(95, 8);
    const c = state.company!;
    c.sharesPublic = 6;
    c.sharesUnsold = 6;
    state.moneyPence = c.sharePricePence * 2;
    const treasury = c.treasuryPence;
    expect(buyBackShares(state, log, 2)).toBe(true);
    expect(c.sharesOwned).toBe(10);
    expect(c.sharesUnsold).toBe(4);
    expect(c.treasuryPence).toBe(treasury + 2 * c.sharePricePence);
    expect(state.moneyPence).toBe(0);
    expect(buyBackShares(state, log, 1)).toBe(false);
    expect(state.moneyPence).toBe(0);
  });
});

describe('named mines, water and development', () => {
  it('remaps every later crew assignment when an earlier lease is abandoned', () => {
    const { state, log } = floated(96);
    state.company!.leases.push({ ...leaseAt(90), name: 'the Second Mine' });
    state.company!.crews = [
      { task: 'mine', lease: 0 },
      { task: 'develop', lease: 1 },
      { task: 'mine', lease: 1 },
    ];
    expect(abandonLease(state, log, 0)).toBe(true);
    expect(state.company!.leases.map((lease) => lease.name)).toEqual(['the Second Mine']);
    expect(state.company!.crews.map((crew) => crew.lease)).toEqual([undefined, 0, 0]);
  });

  it('requires pumping plant before wet ground can be developed', () => {
    const { state, log } = floated(97);
    const lease = state.company!.leases[0];
    lease.wet = true;
    lease.pump = false;
    expect(setLeasePlan(state, log, 0, 'sink')).toBe(false);
    const before = state.company!.treasuryPence;
    expect(installPlant(state, log, 0, 'pump')).toBe(true);
    expect(state.company!.treasuryPence).toBeLessThan(before);
    expect(setLeasePlan(state, log, 0, 'sink')).toBe(true);
  });

  it('floods unpumped wet ground in winter and dewaters it in two crew-weeks', () => {
    const { state, rng, log } = floated(98);
    state.day = 180;
    const lease = state.company!.leases[0];
    lease.wet = true;
    lease.pump = false;
    rng.chance = () => true;
    companyWeek(state, rng, log);
    expect(lease.flooded).toBe(true);

    lease.pump = true;
    state.company!.crews = [{ task: 'develop', lease: 0 }];
    rng.chance = () => false;
    companyWeek(state, rng, log);
    expect(lease.flooded).toBe(true);
    companyWeek(state, rng, log);
    expect(lease.flooded).toBe(false);
  });

  it('exposes crews, ground, policy and dividends as separate company submenus', () => {
    const { state } = floated(99);
    state.company!.crews = [{ task: 'mine', lease: 0 }];
    state.company!.treasuryPence = pounds(100);
    state.screen = 'company';
    const companyMenu = getView(state).menu;
    const actions = companyMenu.map((entry) => entry.action.type);
    expect(actions).toEqual(expect.arrayContaining(['goto']));
    expect(companyMenu.filter((entry) => entry.action.type === 'goto' && entry.action.screen === 'company-dividend')).toHaveLength(1);
    for (const screen of ['company-crews', 'company-ground', 'company-policy', 'company-dividend'] as const) {
      state.screen = screen;
      expect(getView(state).screen).toBe(screen);
      expect(getView(state).menu.length).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// §19.2 Worth, screens and saves
// ---------------------------------------------------------------------------

describe('the company in the kitty', () => {
  it('counts scrip and a share of the treasury towards what a man is worth', () => {
    const { state } = floated(101, 12);
    const c = state.company!;
    c.treasuryPence = pounds(20);
    const plain = state.moneyPence + state.bankPence;
    expect(companyWorth(state)).toBe(12 * c.sharePricePence + Math.round((pounds(20) * 12) / 20));
    expect(netWorth(state)).toBe(plain + companyWorth(state));
    expect(netWorth({ ...state, company: null })).toBe(plain);
  });

  it('shows the books, in words, on the company screen', () => {
    const { state } = floated(102, 12);
    state.company!.crews = [{ task: 'mine' }, { task: 'prospect' }];
    state.screen = 'company';
    const view = getView(state);
    expect(view.title).toBe(state.company!.name.toUpperCase());
    // The books stand in the ledger pane beside the actions, not above them:
    // a dozen choices and a dozen figures will not share one column.
    const ledger = view.aside;
    expect(ledger).toBeTruthy();
    const text = [
      ...view.body,
      ...ledger!.rows.map((r) => `${r.label} ${r.value}`),
    ].join('\n');
    expect(text).toMatch(/Treasury/);
    expect(text).toMatch(/Lease 1/);
    expect(text).toMatch(/at the reef/);
    expect(text).toMatch(/prospecting/);
    const keys = view.menu.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('shows the prospectus, and marks off what the registrar still wants', () => {
    const { state } = promoter();
    state.standing = 10;
    state.screen = 'company';
    const text = getView(state).body.join('\n');
    expect(text).toMatch(/✗/);
    expect(text).toMatch(/✓/);
    expect(getView(state).menu.filter((m) => !m.disabled && m.key !== '0')).toHaveLength(0);
  });

  it('shows the registrar and checklist before the player qualifies', () => {
    const state = createInitialState(105);
    state.location = 'fields-town';
    state.screen = 'ftown-council';
    const councilEntry = getView(state).menu.find((m) => m.key === 'C');
    expect(councilEntry?.label).toMatch(/Ask about registering/);
    expect(councilEntry?.note).toMatch(/requirements met/);
    expect(councilEntry?.disabled).not.toBe(true);

    state.location = 'deep-mountains';
    state.screen = 'camp';
    const campEntry = getView(state).menu.find((m) => m.key === 'C');
    expect(campEntry?.label).toMatch(/Ask about floating/);
    expect(campEntry?.disabled).not.toBe(true);

    state.screen = 'company';
    const checklist = getView(state).body.join('\n');
    expect(checklist).toMatch(/standing of 30\/100/);
    expect(checklist).toMatch(/Blackcap Ranges/);
    expect(checklist).toMatch(/in hand and bank/);
  });

  it('has a commercial office at Port Gannet', () => {
    const { state } = floated(103);
    state.location = 'suze-port';
    state.screen = 'company';
    expect(getView(state).screen).toBe('company');
  });

  it('round-trips through a save, and an older save comes back without one', () => {
    const { state } = floated(104, 16);
    state.company!.crews = [{ task: 'prospect' }];
    const back = deserialise(serialise(state)) as GameState;
    expect(back.company?.name).toBe(state.company!.name);
    expect(back.company?.crews).toEqual([{ task: 'prospect' }]);
    expect(back.company?.leases[0].reefPct).toBe(140);
    expect(back.company?.sharePricePence).toBe(state.company!.sharePricePence);

    const old = deserialise(JSON.stringify({ v: 2, seed: 1, day: 40, moneyPence: 500 })) as GameState;
    expect(old.company).toBeNull();
    expect(old.soldOut).toBeNull();
    expect(companyWorth(old)).toBe(0);
  });
});

describe('running a company through the reducer', () => {
  it('floats, hires, works the weeks and pays a dividend, all by menu actions', () => {
    const { state } = promoter(111);
    state.screen = 'camp';
    const rng = makeRng(111);

    const menu = getView(state).menu.map((m) => m.label).join(' | ');
    expect(menu).toMatch(/Float a company of your own/);

    let s = step(state, { type: 'goto', screen: 'company' }, rng).state;
    expect(s.screen).toBe('company');
    s = step(s, { type: 'floatCompany', shares: 12 }, rng).state;
    expect(s.company).not.toBeNull();
    expect(s.screen).toBe('company');

    s = step(s, { type: 'hireCrew' }, rng).state;
    s = step(s, { type: 'hireCrew' }, rng).state;
    expect(s.company!.crews).toHaveLength(2);
    s = step(s, { type: 'setCrewTask', index: 1, task: 'prospect' }, rng).state;
    expect(s.company!.crews[1].task).toBe('prospect');

    // Twelve weeks of rest at the camp while the company works.
    for (let i = 0; i < 12; i++) s = step(s, { type: 'rest', days: 7 }, rng).state;
    expect(s.company!.weekProfitPence.length).toBeGreaterThanOrEqual(10);
    expect(s.company!.treasuryPence).toBeGreaterThanOrEqual(0);
    expect(s.moneyPence).toBeGreaterThanOrEqual(0);

    const before = s.moneyPence;
    const per = shillings(5);
    if (per * (s.company!.sharesOwned + s.company!.sharesPublic) <= s.company!.treasuryPence) {
      s = step(s, { type: 'declareDividend', perShare: per }, rng).state;
      expect(s.moneyPence).toBe(before + per * s.company!.sharesOwned);
    }

    s = step(s, { type: 'sellOut' }, rng).state;
    expect(s.company).toBeNull();
    expect(s.soldOut).not.toBeNull();
    expect(s.screen).toBe('camp');
    expect(netWorth(s)).toBeGreaterThan(0);
  });
});

describe('the copy for the company', () => {
  it('is written, and in several variants', () => {
    const keys = [
      'company.float',
      'company.float.refused',
      'company.crew.hire',
      'company.crew.fire',
      'company.crew.mine',
      'company.crew.prospect',
      'company.crew.quit',
      'company.prospect.strike',
      'company.lease.gone',
      'company.cavein',
      'company.wages.pocket',
      'company.wages.unpaid',
      'company.shares.taken',
      'company.week.report',
      'company.week.poor',
      'company.dividend',
      'company.shares.sell',
      'company.shares.buy',
      'company.shares.noappetite',
      'company.sellout',
    ];
    for (const k of keys) expect(hasKey(k), `missing content key ${k}`).toBe(true);
  });
});
