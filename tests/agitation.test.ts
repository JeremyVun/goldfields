/**
 * A year with a shape: the licence agitation, the monster meeting, the December
 * stockade and what followed it (GAME_SPEC.md §20).
 */

import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/content/say';
import {
  agitationTick,
  epilogueFor,
  resolveMeeting,
  resolveStockade,
  worthTier,
} from '../src/engine/agitation';
import { floatCompany } from '../src/engine/company';
import {
  AFTERMATH_DAY,
  AGITATION_PER_DAY,
  AGITATION_PER_HUNT,
  MEETING_WINDOW,
  MINERS_RIGHT_COST,
  STOCKADE_WINDOW,
} from '../src/engine/constants';
import { endDay } from '../src/engine/daily';
import { buyLicence, huntChance, troopersCome } from '../src/engine/law';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { gazetteFor } from '../src/engine/news';
import { step } from '../src/engine/reduce';
import { makeRng, type RNG } from '../src/engine/rng';
import { deserialise } from '../src/engine/save';
import {
  betrayalFactor,
  createInitialState,
  inAftermath,
  isLicensed,
  licenceWord,
} from '../src/engine/state';
import type { GameState } from '../src/engine/types';

function digger(day: number, seed = 3): { state: GameState; rng: RNG; log: Log } {
  const state = createInitialState(seed);
  state.day = day;
  state.location = 'damp-camp';
  state.provisionDays = 300;
  state.licenceUntilDay = 10000;
  state.items.pan = state.items.tent = 1;
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

/** A generator whose coin comes down as told. */
function scripted(chances: boolean[], seed = 1): RNG {
  const rng = makeRng(seed);
  const queue = chances.slice();
  rng.chance = () => (queue.length ? (queue.shift() as boolean) : false);
  return rng;
}

// ---------------------------------------------------------------------------
// The ramp
// ---------------------------------------------------------------------------

describe('the agitation', () => {
  it('is quiet until the winter, then rises day by day', () => {
    const { state, log } = digger(60);
    agitationTick(state, log);
    expect(state.agitation).toBe(0);

    state.day = 200;
    agitationTick(state, log);
    expect(state.agitation).toBeCloseTo(AGITATION_PER_DAY, 5);
    for (let i = 0; i < 9; i++) agitationTick(state, log);
    expect(state.agitation).toBeCloseTo(AGITATION_PER_DAY * 10, 5);
  });

  it('rises two points every time the troopers stop a man', () => {
    const { state, rng, log } = digger(200);
    troopersCome(state, rng, log);
    expect(state.agitation).toBe(AGITATION_PER_HUNT);
  });

  it('rises a point for every licence story read in the Angus', () => {
    const state = createInitialState(9);
    state.day = 200;
    state.agitation = 30;
    state.moneyPence = shillings(5);
    const out = step(state, { type: 'readGazette' }, makeRng(9));
    expect(out.state.agitation).toBe(31);
    expect(gazetteFor(out.state).join('\n')).toMatch(/LICENCE|MEETINGS|AGITATION|DIGGINGS/);
  });

  it('never passes a hundred, and never falls before the confrontation', () => {
    const { state, log } = digger(300);
    state.agitation = 99.5;
    for (let i = 0; i < 20; i++) agitationTick(state, log);
    expect(state.agitation).toBe(100);
  });

  it('makes the troopers ride harder as it rises', () => {
    const { state } = digger(200);
    state.licenceUntilDay = 0;
    const quiet = huntChance(state);
    state.agitation = 100;
    expect(huntChance(state)).toBeCloseTo(quiet * 1.4, 5);
  });

  it('escalates the Gazette’s stories with the temperature', () => {
    const state = createInitialState(4);
    state.day = 200;
    const seen = new Set<string>();
    for (const level of [12, 30, 55, 90]) {
      const paper = gazetteFor({ ...state, agitation: level }).join('\n');
      const line = paper.split('\n').find((l) => /LICENCE|MEETINGS|AGITATION|DIGGINGS|COMMISSIONER/.test(l));
      expect(line).toBeDefined();
      seen.add(line as string);
    }
    expect(seen.size).toBe(4);
    expect(gazetteFor({ ...state, agitation: 2 }).join('\n')).not.toMatch(/AGITATION\./);
  });
});

// ---------------------------------------------------------------------------
// The monster meeting
// ---------------------------------------------------------------------------

describe('the monster meeting', () => {
  it('finds the player on the first camp night of the window', () => {
    const { state, rng, log } = digger(MEETING_WINDOW.from - 1);
    endDay(state, rng, log, {});
    expect(state.pending).toBeNull();
    endDay(state, rng, log, {});
    expect(state.pending?.kind).toBe('meeting');
  });

  it('leaves a man in town alone, and is over when the window closes', () => {
    const { state, rng, log } = digger(MEETING_WINDOW.from);
    state.location = 'fields-town';
    for (let i = 0; i < MEETING_WINDOW.to - MEETING_WINDOW.from + 2; i++) {
      endDay(state, rng, log, {});
      expect(state.pending).toBeNull();
    }
    expect(state.meetingDone).toBe(true);
  });

  it('pays five points of standing to the man who goes, and nothing to the man who does not', () => {
    const { state, rng, log } = digger(MEETING_WINDOW.from + 2);
    state.standing = 20;
    resolveMeeting(state, rng, log, true);
    expect(state.standing).toBe(25);
    expect(state.agitation).toBe(5);
    expect(state.meetingAttended).toBe(true);
    expect(state.pending).toBeNull();

    const other = digger(MEETING_WINDOW.from + 2, 8);
    other.state.standing = 20;
    resolveMeeting(other.state, other.rng, other.log, false);
    expect(other.state.standing).toBe(20);
    expect(other.state.agitation).toBe(0);
    expect(other.state.meetingDone).toBe(true);
  });

  it('is a risk only for a man the traps already know', () => {
    const { state, log } = digger(MEETING_WINDOW.from + 2);
    state.legal = 'minor criminal';
    const day = state.day;
    resolveMeeting(state, scripted([true]), log, true);
    expect(state.day).toBeGreaterThan(day);
    expect(state.location).toBe('fields-town');
    expect(state.stats.timesArrested).toBe(1);

    const honest = digger(MEETING_WINDOW.from + 2, 12);
    resolveMeeting(honest.state, scripted([true]), honest.log, true);
    expect(honest.state.stats.timesArrested).toBe(0);
  });

  it('breaks off a spell of work, and the rest of it waits on the answer', () => {
    const state = createInitialState(17);
    state.day = MEETING_WINDOW.from - 1;
    state.location = 'damp-camp';
    state.provisionDays = 60;
    state.licenceUntilDay = 10000;
    state.items.pan = 1;
    state.claims['damp-camp'] = { quality: 120, workedDays: 0, peggedOn: 1, proven: false };
    const out = step(state, { type: 'mine', method: 'pan', days: 7 }, makeRng(17));
    expect(out.state.screen).toBe('encounter');
    expect(out.state.pending?.kind).toBe('meeting');
    expect(out.state.resumeTask).toEqual({ kind: 'mine', method: 'pan', days: 5 });
    expect(getView(out.state).menu.map((m) => m.label).join(' | ')).toMatch(/stand with them/);

    const after = step(out.state, { type: 'attendMeeting', attend: true }, makeRng(17));
    expect(after.state.pending).toBeNull();
    expect(after.state.day).toBeGreaterThan(out.state.day);
    expect(after.state.screen).not.toBe('encounter');
  });
});

// ---------------------------------------------------------------------------
// The stockade
// ---------------------------------------------------------------------------

describe('the stockade', () => {
  function atStockade(seed = 5): GameState {
    const { state } = digger(STOCKADE_WINDOW.from + 1, seed);
    state.meetingDone = true;
    state.standing = 40;
    state.pending = { kind: 'stockade' };
    state.screen = 'encounter';
    return state;
  }

  it('finds a man at any camp, or in Fields Town, and passes a man at the port by', () => {
    for (const place of ['damp-camp', 'snakey-gully', 'fields-town'] as const) {
      const { state, rng, log } = digger(STOCKADE_WINDOW.from - 1, 6);
      state.meetingDone = true;
      state.location = place;
      endDay(state, rng, log, {});
      endDay(state, rng, log, {});
      expect(state.pending?.kind, place).toBe('stockade');
    }

    const away = digger(STOCKADE_WINDOW.from - 1, 6);
    away.state.meetingDone = true;
    away.state.location = 'suze-port';
    for (let i = 0; i < STOCKADE_WINDOW.to - STOCKADE_WINDOW.from + 3; i++) {
      endDay(away.state, away.rng, away.log, {});
      expect(away.state.pending).toBeNull();
    }
    expect(away.state.stockadeDone).toBe(true);
    expect(away.state.stockadeRole).toBe('away');
    expect(gazetteFor(away.state).join('\n')).toMatch(/THE RISING AT/);
  });

  it('rewards the man who goes in and comes out again', () => {
    const state = atStockade();
    const log = new Log(makeRng(1));
    resolveStockade(state, scripted([false, false, false]), log, 'join');
    expect(state.stockadeRole).toBe('joined');
    expect(state.standing).toBe(70);
    expect(state.gameOver).toBeNull();
    expect(state.journal.some((j) => j.text.includes('slabs'))).toBe(true);
  });

  it('kills one man in twelve who goes in', () => {
    const state = atStockade();
    const log = new Log(makeRng(1));
    resolveStockade(state, scripted([true]), log, 'join');
    expect(state.gameOver).toBe('dead');
    expect(state.health).toBe(0);
    expect(state.causeOfDeath).toMatch(/stockade/);
  });

  it('wounds and arrests the others, and no jury will convict them', () => {
    const state = atStockade();
    const log = new Log(makeRng(1));
    const day = state.day;
    resolveStockade(state, scripted([false, true, true]), log, 'join');
    expect(state.health).toBeLessThan(100);
    expect(state.illness?.id).toBe('injury');
    expect(state.illness?.severity).toBe(2);
    expect(state.stats.timesArrested).toBe(1);
    expect(state.day).toBeGreaterThan(day);
    expect(state.legal).toBe('honest');
    expect(state.location).toBe('fields-town');
  });

  it('costs the chairman a fifth of his share price', () => {
    const state = atStockade(9);
    state.location = 'deep-mountains';
    state.standing = 60;
    state.moneyPence = pounds(200);
    state.claims['deep-mountains'] = { quality: 150, workedDays: 0, peggedOn: 1, proven: true };
    const log = new Log(makeRng(9));
    floatCompany(state, makeRng(9), log, 12);
    const before = state.company!.sharePrice;
    resolveStockade(state, scripted([false, false, false]), log, 'join');
    expect(state.company!.sharePrice).toBe(Math.round(before * 0.8));
  });

  it('leaves the man who keeps clear exactly as he was', () => {
    const state = atStockade();
    const log = new Log(makeRng(1));
    const standing = state.standing;
    resolveStockade(state, makeRng(1), log, 'keepClear');
    expect(state.stockadeRole).toBe('kept clear');
    expect(state.standing).toBe(standing);
    expect(state.health).toBe(100);
    expect(betrayalFactor(state)).toBe(1);
  });

  it('pays the man who sells to both sides, and the field remembers it', () => {
    const state = atStockade();
    state.provisionDays = 60;
    const log = new Log(makeRng(1));
    const money = state.moneyPence;
    resolveStockade(state, makeRng(1), log, 'sellSupplies');
    expect(state.stockadeRole).toBe('sold supplies');
    expect(state.moneyPence).toBeGreaterThanOrEqual(money + pounds(20));
    expect(state.standing).toBe(25);
    expect(state.provisionDays).toBe(46);
    expect(betrayalFactor(state)).toBe(1.5);
  });

  it('puts a company’s profit in the treasury rather than the pocket', () => {
    const state = atStockade(21);
    state.location = 'deep-mountains';
    state.standing = 60;
    state.moneyPence = pounds(200);
    state.claims['deep-mountains'] = { quality: 150, workedDays: 0, peggedOn: 1, proven: true };
    const log = new Log(makeRng(21));
    floatCompany(state, makeRng(21), log, 8);
    const treasury = state.company!.treasury;
    const money = state.moneyPence;
    resolveStockade(state, makeRng(21), log, 'sellSupplies');
    expect(state.company!.treasury).toBeGreaterThan(treasury);
    expect(state.moneyPence).toBe(money);
  });

  it('has nothing to sell a man with an empty swag and no company', () => {
    const state = atStockade();
    state.provisionDays = 2;
    const log = new Log(makeRng(1));
    resolveStockade(state, makeRng(1), log, 'sellSupplies');
    expect(state.stockadeDone).toBe(false);
    expect(state.pending?.kind).toBe('stockade');
    const view = getView(state);
    expect(view.menu.find((m) => m.action.type === 'sellSupplies')?.disabled).toBe(true);
  });

  it('is survivable, but costly, over many seeded risings (§22)', () => {
    const N = 500;
    let dead = 0;
    let hurt = 0;
    let taken = 0;
    let honoured = 0;
    for (let i = 0; i < N; i++) {
      const state = atStockade(i + 100);
      const rng = makeRng(i * 7919 + 3);
      resolveStockade(state, rng, new Log(rng), 'join');
      if (state.gameOver === 'dead') dead += 1;
      else {
        if (state.illness) hurt += 1;
        if (state.stats.timesArrested > 0) taken += 1;
        if (state.standing === 70) honoured += 1;
      }
    }
    expect(dead / N).toBeGreaterThan(0.02);
    expect(dead / N).toBeLessThan(0.16);
    expect(hurt / N).toBeGreaterThan(0.18);
    expect(taken / N).toBeGreaterThan(0.15);
    // Every man who walked out of it gained his thirty points of standing.
    expect(honoured).toBe(N - dead);
  });

  it('is answered through the pending encounter, wherever the player was', () => {
    const state = createInitialState(23);
    state.day = STOCKADE_WINDOW.from - 1;
    state.location = 'snakey-gully';
    state.meetingDone = true;
    state.provisionDays = 60;
    state.licenceUntilDay = 10000;
    const out = step(state, { type: 'rest', days: 5 }, makeRng(23));
    expect(out.state.screen).toBe('encounter');
    expect(getView(out.state).title).toMatch(/STOCKADE/);
    const after = step(out.state, { type: 'keepClear' }, makeRng(23));
    expect(after.state.stockadeRole).toBe('kept clear');
    expect(after.state.screen).not.toBe('encounter');
  });
});

// ---------------------------------------------------------------------------
// The aftermath
// ---------------------------------------------------------------------------

describe('the aftermath', () => {
  it('ends the hunts from day 350, and all through a second year', () => {
    const { state } = digger(AFTERMATH_DAY - 1);
    state.licenceUntilDay = 0;
    expect(huntChance(state)).toBeGreaterThan(0);
    state.day = AFTERMATH_DAY;
    expect(inAftermath(state)).toBe(true);
    expect(huntChance(state)).toBe(0);
    expect(huntChance({ ...state, day: 40, yearsPlayed: 2 })).toBe(0);
  });

  it('sells a miner’s right at a pound the year in place of the licence', () => {
    const { state, log } = digger(AFTERMATH_DAY);
    state.licenceUntilDay = 0;
    state.minersRightUntilDay = 0;
    state.moneyPence = pounds(3);
    expect(buyLicence(state, log)).toBe(true);
    expect(state.moneyPence).toBe(pounds(3) - MINERS_RIGHT_COST);
    expect(state.licenceUntilDay).toBe(0);
    expect(state.minersRightUntilDay).toBe(AFTERMATH_DAY + 364);
    expect(isLicensed(state)).toBe(true);
    expect(licenceWord(state)).toMatch(/miner's right/);
  });

  it('offers the right, and not the licence, at the Council Chambers', () => {
    const { state } = digger(AFTERMATH_DAY);
    state.location = 'fields-town';
    state.screen = 'ftown-council';
    state.moneyPence = pounds(3);
    const label = getView(state).menu[0].label;
    expect(label).toMatch(/miner's right/);
    expect(label).not.toMatch(/thirty days/);
  });

  it('is reported in the Angus, and noted in the journal but once', () => {
    const { state, rng, log } = digger(AFTERMATH_DAY - 1);
    state.meetingDone = true;
    state.stockadeDone = true;
    state.stockadeDay = STOCKADE_WINDOW.from;
    for (let i = 0; i < 6; i++) endDay(state, rng, log, {});
    expect(state.aftermathNoted).toBe(true);
    const notices = state.journal.filter((j) => j.text.includes('licence is dead'));
    expect(notices).toHaveLength(1);
    expect(gazetteFor(state).join('\n')).toMatch(/LICENCE ABOLISHED|MINER'S RIGHT/);
  });

  it('settles the rising off-stage if it has to, before the licence dies', () => {
    const { state, rng, log } = digger(AFTERMATH_DAY - 1);
    state.location = 'suze-port';
    state.meetingDone = true;
    endDay(state, rng, log, {});
    expect(state.stockadeDone).toBe(true);
    expect(state.stockadeRole).toBe('away');
  });
});

// ---------------------------------------------------------------------------
// The epilogue
// ---------------------------------------------------------------------------

describe('the epilogue', () => {
  it('sorts a year by what it left in the kitty', () => {
    expect(worthTier(pounds(2))).toBe('ruin');
    expect(worthTier(pounds(40))).toBe('modest');
    expect(worthTier(pounds(300))).toBe('comfort');
    expect(worthTier(pounds(900))).toBe('rich');
    expect(worthTier(pounds(4000))).toBe('nabob');
  });

  it('is chosen from worth, the stockade, the company, the law and the man’s life', () => {
    const base = createInitialState(31);
    base.day = 366;
    base.bankPence = pounds(900);
    base.stockadeRole = 'joined';
    const rich = epilogueFor(base).join(' ');
    expect(rich).not.toMatch(/^\[/);
    expect(rich).toMatch(/behind the slabs|stockade|December/i);

    const poor = epilogueFor({ ...base, bankPence: pounds(1) }).join(' ');
    expect(poor).not.toBe(rich);

    const sold = epilogueFor({ ...base, stockadeRole: 'sold supplies' }).join(' ');
    expect(sold).toMatch(/sold|profit|forgotten/i);

    const dead = epilogueFor({ ...base, gameOver: 'dead' }).join(' ');
    expect(dead).toMatch(/grave|buried|dead|Crown|courts/i);

    const wanted = epilogueFor({ ...base, legal: 'wanted criminal' }).join(' ');
    expect(wanted).toMatch(/wanted|traps/i);
    expect(epilogueFor({ ...base, legal: 'minor criminal' }).join(' ')).toMatch(/record/i);
  });

  it('remembers the company, whether it was kept or sold', () => {
    const base = createInitialState(33);
    base.day = 366;
    base.bankPence = pounds(600);
    base.soldOut = { name: 'The Band of Hope Consols', amount: pounds(120), day: 300 };
    const sold = epilogueFor(base).join(' ');
    expect(sold).toMatch(/The Band of Hope Consols/);

    const chairman = epilogueFor({
      ...base,
      soldOut: null,
      company: {
        name: 'The Golden Hope Quartz Mining Co.',
        treasury: pounds(50),
        sharesOwned: 12,
        sharesPublic: 6,
        sharesUnsold: 2,
        sharePrice: pounds(14),
        crews: [],
        leases: [],
        weekProfit: [],
        lastWeekGold: 0,
        foundedOn: 200,
        lastDividendDay: 0,
      },
    }).join(' ');
    expect(chairman).toMatch(/The Golden Hope Quartz Mining Co./);
    expect(chairman).toMatch(/12/);
  });

  it('reads the same every time the player looks at the reckoning', () => {
    const state = createInitialState(35);
    state.day = 366;
    state.endOfYear = true;
    state.screen = 'end';
    state.bankPence = pounds(300);
    state.stockadeRole = 'kept clear';
    const once = getView(state).body.join('\n');
    const twice = getView(state).body.join('\n');
    expect(once).toBe(twice);
    expect(once).toMatch(/kept clear|no part/i);
  });

  it('shows the company’s books on the reckoning', () => {
    const state = createInitialState(37);
    state.day = 366;
    state.location = 'deep-mountains';
    state.standing = 60;
    state.moneyPence = pounds(200);
    state.claims['deep-mountains'] = { quality: 150, workedDays: 0, peggedOn: 1, proven: true };
    const log = new Log(makeRng(37));
    floatCompany(state, makeRng(37), log, 16);
    state.screen = 'end';
    state.endOfYear = true;
    const text = getView(state).body.join('\n');
    expect(text).toMatch(/THE COMPANY'S BOOKS/);
    expect(text).toMatch(/Scrip and treasury/);
    expect(text).toMatch(state.company!.name.toUpperCase());
  });
});

// ---------------------------------------------------------------------------
// Saves and copy
// ---------------------------------------------------------------------------

describe('a save written before the field boiled', () => {
  it('comes back quiet, unmet, and unrisen', () => {
    const back = deserialise(
      JSON.stringify({ v: 2, seed: 3, day: 300, moneyPence: 1200, standing: 40 }),
    ) as GameState;
    expect(back.agitation).toBe(0);
    expect(back.meetingDone).toBe(false);
    expect(back.stockadeDone).toBe(false);
    expect(back.stockadeRole).toBe('none');
    expect(back.minersRightUntilDay).toBe(0);
    expect(back.aftermathNoted).toBe(false);
    expect(isLicensed(back)).toBe(false);
  });
});

describe('the copy for the agitation', () => {
  it('is written, and in several variants', () => {
    const keys = [
      'meeting.attend',
      'meeting.keep',
      'meeting.missed',
      'meeting.arrest',
      'stockade.join',
      'stockade.killed',
      'stockade.wounded',
      'stockade.arrested',
      'stockade.acquitted',
      'stockade.survived',
      'stockade.keepclear',
      'stockade.sell',
      'stockade.offstage',
      'aftermath.notice',
      'law.minersright',
      'epilogue.worth.ruin',
      'epilogue.worth.modest',
      'epilogue.worth.comfort',
      'epilogue.worth.rich',
      'epilogue.worth.nabob',
      'epilogue.dead.ruin',
      'epilogue.dead.nabob',
      'epilogue.company.chairman',
      'epilogue.company.soldout',
      'epilogue.stockade.joined',
      'epilogue.stockade.clear',
      'epilogue.stockade.sold',
      'epilogue.stockade.away',
      'epilogue.legal.criminal',
      'epilogue.legal.wanted',
      'epilogue.legal.known',
    ];
    for (const k of keys) expect(hasKey(k), `missing content key ${k}`).toBe(true);
  });
});
