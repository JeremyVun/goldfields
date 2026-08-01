/**
 * The balance contract of GAME_SPEC.md §14, checked by auto-playing strategy
 * bots over hundreds of seeded years.
 */

import { describe, expect, it } from 'vitest';
import { resolveStockade } from '../src/engine/agitation';
import {
  AFTERMATH_DAY,
  BANK_RATE_START,
  JOBS,
  MINERS_RIGHT_COST,
  PROVISIONS_WEEK,
  STOCKADE_WINDOW,
} from '../src/engine/constants';
import { endDay } from '../src/engine/daily';
import { placeStory } from '../src/engine/estate';
import { buyLicence, huntChance } from '../src/engine/law';
import { provisionsPrice } from '../src/engine/market';
import { mineOneDay, pegClaim } from '../src/engine/mining';
import { formatMoney, goldValue, pounds } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { shoutTheBar } from '../src/engine/shamrock';
import { createInitialState, inAftermath, isLicensed } from '../src/engine/state';
import { travelOneDay } from '../src/engine/travel';
import type { CampId, GameState, LocationId, PublicWork } from '../src/engine/types';
import {
  aggressiveShafter,
  bushranger,
  cautiousCradler,
  cautiousPanner,
  companyMagnate,
  idler,
  licenceDodger,
  notable,
  rushChaser,
  runBot,
  summarise,
  type Bot,
  type RunResult,
  type Summary,
} from './bots';

declare const process: { env: Record<string, string | undefined> } | undefined;

const RUNS = Number(
  (typeof process !== 'undefined' ? process?.env?.GOLDFIELDS_RUNS : undefined) ?? 300,
);

function report(s: Summary): string {
  return [
    `${s.bot.padEnd(20)}`,
    `n=${s.runs}`,
    `median=${formatMoney(s.median).padEnd(14)}`,
    `mean=${formatMoney(s.mean).padEnd(14)}`,
    `p10=${formatMoney(s.p10).padEnd(12)}`,
    `p25=${formatMoney(s.p25).padEnd(12)}`,
    `p75=${formatMoney(s.p75).padEnd(14)}`,
    `p90=${formatMoney(s.p90).padEnd(14)}`,
    `max=${formatMoney(s.max).padEnd(14)}`,
    `deaths=${(s.deathRate * 100).toFixed(1)}%`,
    `broke=${((s.broke / s.runs) * 100).toFixed(1)}%`,
    `arrests/yr=${s.arrestRate.toFixed(2)}`,
    `dugDays=${s.medianDaysDug}`,
    `standing=${s.medianStanding.toFixed(0)}`,
    `floated=${(s.floatRate * 100).toFixed(0)}%`,
  ].join(' ');
}

const summaries: Summary[] = [];

describe('balance targets (§14)', () => {
  it('steady port work is a viable living but not a company fortune (£60-£100)', () => {
    const s = summarise(idler, runBot(idler, RUNS, 11));
    summaries.push(s);
    console.log(report(s));
    expect(s.median).toBeGreaterThanOrEqual(pounds(60));
    expect(s.median).toBeLessThanOrEqual(pounds(100));
    expect(s.p90).toBeLessThan(pounds(120));
    expect(s.deathRate).toBeLessThan(0.1);
  });

  it('a cautious licensed panner at Damp Camp typically ends with £50-£250', () => {
    const s = summarise(cautiousPanner, runBot(cautiousPanner, RUNS, 101));
    summaries.push(s);
    console.log(report(s));
    expect(s.median).toBeGreaterThanOrEqual(pounds(50));
    expect(s.median).toBeLessThanOrEqual(pounds(250));
    expect(s.p25).toBeGreaterThan(pounds(15));
    // Death is visible but not the usual outcome for a careful player.
    expect(s.deathRate).toBeLessThan(0.1);
  });

  it('a cradler with a mate does better than a lone panner, and is still not rich', () => {
    const s = summarise(cautiousCradler, runBot(cautiousCradler, RUNS, 211));
    summaries.push(s);
    console.log(report(s));
    const panner = summaries.find((x) => x.bot === 'cautious panner');
    expect(panner).toBeDefined();
    expect(s.median).toBeGreaterThan((panner as Summary).median);
    expect(s.deathRate).toBeLessThan(0.1);
  });

  it('a capitalised shafter can reach £500-£2000, with rare windfalls beyond', () => {
    const s = summarise(aggressiveShafter, runBot(aggressiveShafter, RUNS, 307));
    summaries.push(s);
    console.log(report(s));
    expect(s.median).toBeGreaterThanOrEqual(pounds(250));
    // A quarter of shafters get into the range the spec calls "skilled".
    expect(s.p75).toBeGreaterThanOrEqual(pounds(500));
    expect(s.max).toBeGreaterThan(pounds(1000));
    // The lottery kills: visible, but not the majority outcome.
    expect(s.deathRate).toBeGreaterThan(0.005);
    expect(s.deathRate).toBeLessThan(0.25);
  });

  it('the licence dodger is frequently broke, gaoled, or dead', () => {
    const s = summarise(licenceDodger, runBot(licenceDodger, RUNS, 401));
    summaries.push(s);
    console.log(report(s));
    const panner = summaries.find((x) => x.bot === 'cautious panner') as Summary;
    expect(s.arrestRate).toBeGreaterThan(1.0);
    expect(s.median).toBeLessThan(panner.median);
    const bad = s.broke / s.runs + s.deathRate;
    expect(bad).toBeGreaterThan(0.1);
  });

  it('nothing is a guaranteed win: every strategy has losing years', () => {
    for (const s of summaries) {
      expect(s.min).toBeLessThan(s.median);
      expect(s.max).toBeGreaterThan(s.median);
    }
  });
});

// ---------------------------------------------------------------------------
// The progression additions (§22)
// ---------------------------------------------------------------------------

describe('balance additions (§22)', () => {
  it('the rush chaser beats the man who sits still by a quarter and more', () => {
    const s = summarise(rushChaser, runBot(rushChaser, RUNS, 503));
    summaries.push(s);
    console.log(report(s));
    const still = summaries.find((x) => x.bot === 'cautious cradler') as Summary;
    expect(still).toBeDefined();
    // Moving must pay: the same cradle, the same mate, fresher ground.
    expect(s.median).toBeGreaterThanOrEqual(still.median * 1.25);
    expect(s.deathRate).toBeLessThan(0.1);
  });

  it('the company magnate is the richest strategy in the game (£800-£3500)', () => {
    const s = summarise(companyMagnate, runBot(companyMagnate, RUNS, 607));
    summaries.push(s);
    console.log(report(s));
    expect(s.median).toBeGreaterThanOrEqual(pounds(800));
    expect(s.median).toBeLessThanOrEqual(pounds(3500));
    expect(s.p90).toBeGreaterThanOrEqual(pounds(2000));
    // The ones who really made money floated companies — and some of them died.
    expect(s.deathRate).toBeLessThan(0.2);
    expect(s.floatRate).toBeGreaterThan(0.5);
    const shafter = summaries.find((x) => x.bot === 'aggressive shafter') as Summary;
    expect(s.median).toBeGreaterThan(shafter.median);
  });

  it('every strategy still has its losing years, the new ones included', () => {
    for (const s of summaries) {
      expect(s.min).toBeLessThan(s.median);
      expect(s.max).toBeGreaterThan(s.median);
    }
  });

  it('the stockade is survivable, and costly, and it kills the licence', () => {
    const RISINGS = 400;
    let killed = 0;
    let hurt = 0;
    let gaoled = 0;
    let untouched = 0;
    for (let i = 0; i < RISINGS; i++) {
      const seed = 90001 + i * 7919;
      const state: GameState = {
        ...createInitialState(seed),
        day: STOCKADE_WINDOW.from + 1,
        location: 'snakey-gully',
        standing: 40,
        meetingDone: true,
        pending: { kind: 'stockade' },
        screen: 'encounter',
      };
      const rng = makeRng(seed);
      resolveStockade(state, rng, new Log(rng), 'join');
      if (state.gameOver === 'dead') killed += 1;
      else {
        if (state.illness?.id === 'injury') hurt += 1;
        if (state.stats.timesArrested > 0) gaoled += 1;
        if (state.health === 100 && state.stats.timesArrested === 0) untouched += 1;
        // Whatever it cost, the field remembers the men who stood there.
        expect(state.standing).toBeGreaterThan(40);
        expect(state.stockadeRole).toBe('joined');
      }
    }
    console.log(
      `stockade (joined)   n=${RISINGS} killed=${((killed / RISINGS) * 100).toFixed(1)}% wounded=${((hurt / RISINGS) * 100).toFixed(1)}% arrested=${((gaoled / RISINGS) * 100).toFixed(1)}% unscathed=${((untouched / RISINGS) * 100).toFixed(1)}%`,
    );
    // Survivable: most men who go in behind the slabs come out again.
    expect(killed / RISINGS).toBeLessThan(0.15);
    expect(1 - killed / RISINGS).toBeGreaterThan(0.8);
    // But costly: a good half of the survivors are wounded or taken.
    expect(hurt / RISINGS).toBeGreaterThan(0.15);
    expect(gaoled / RISINGS).toBeGreaterThan(0.1);
    expect(untouched / RISINGS).toBeLessThan(0.6);

    // And the licence dies with it: no hunts, and a pound the year in its place.
    const after: GameState = {
      ...createInitialState(4242),
      day: AFTERMATH_DAY,
      location: 'fields-town',
      licenceUntilDay: 0,
      moneyPence: pounds(3),
      stockadeDone: true,
    };
    expect(inAftermath(after)).toBe(true);
    expect(huntChance(after)).toBe(0);
    const log = new Log(makeRng(1));
    expect(buyLicence(after, log)).toBe(true);
    expect(after.moneyPence).toBe(pounds(3) - MINERS_RIGHT_COST);
    expect(isLicensed(after)).toBe(true);
    expect(huntChance(after)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The dark ladder (§25)
// ---------------------------------------------------------------------------

/** Dead, hanged, or in the hulks: the worst tail in the game (§25). */
function badEnds(runs: RunResult[]): number {
  return runs.filter((r) => r.died || r.outlawEnd === 'hanged' || r.outlawEnd === 'hulks').length;
}

describe('balance additions (§25) — the dark ladder', () => {
  it('the bushranger ends the year between the cradler and the magnate (£300-£1500)', () => {
    const runs = runBot(bushranger, RUNS, 809);
    const s = summarise(bushranger, runs);
    summaries.push(s);
    const bad = badEnds(runs) / runs.length;
    const ends = runs.filter((r) => r.outlawEnd !== null).length;
    console.log(
      `${report(s)} bad=${(bad * 100).toFixed(1)}% outlawed=${((runs.filter((r) => r.outlawed).length / runs.length) * 100).toFixed(0)}% ended=${((ends / runs.length) * 100).toFixed(0)}% bailups=${runs.map((r) => r.bailUps).sort((a, b) => a - b)[Math.floor(runs.length / 2)]}`,
    );

    // Crime pays better per day than digging, and dramatically worse per life.
    expect(s.median).toBeGreaterThanOrEqual(pounds(300));
    expect(s.median).toBeLessThanOrEqual(pounds(1500));
    const cradler = summaries.find((x) => x.bot === 'cautious cradler') as Summary;
    const magnate = summaries.find((x) => x.bot === 'company magnate') as Summary;
    expect(s.median).toBeGreaterThan(cradler.median);
    expect(s.median).toBeLessThan(magnate.median);

    // The worst tail in the game: dead, hanged, or in the hulks.
    expect(bad).toBeGreaterThanOrEqual(0.35);
    expect(bad).toBeLessThanOrEqual(0.5);
    expect(bad).toBeGreaterThan(
      (summaries.find((x) => x.bot === 'aggressive shafter') as Summary).deathRate,
    );

    // The ladder is actually climbed: roads, then a name, then the big work.
    expect(runs.filter((r) => r.notoriety >= 60).length / runs.length).toBeGreaterThan(0.5);
    expect(runs.filter((r) => r.bigJobsDone > 0).length / runs.length).toBeGreaterThan(0.15);
    // And nothing is a guaranteed win here either.
    expect(s.min).toBeLessThan(s.median);
    expect(s.max).toBeGreaterThan(s.median);
  });

  it('an honest man never sees the dark ladder at all (§25)', () => {
    for (const bot of [cautiousCradler, idler]) {
      for (const r of runBot(bot, 60, 3301)) {
        expect(r.notoriety, `${bot.name} picked up a name of the wrong sort`).toBe(0);
        expect(r.outlawed).toBe(false);
        expect(r.outlawEnd).toBeNull();
        expect(r.bailUps).toBe(0);
        expect(r.bigJobsDone).toBe(0);
        expect(r.takings).toBe(0);
        expect(r.diggersRobbed).toBe(0);
        expect(r.hadHideout).toBe(false);
      }
    }
  });

  it('money, the stash and the gang stay within their bounds all year (§25)', () => {
    for (const r of runBot(bushranger, 60, 5501)) {
      expect(r.worth).toBeGreaterThanOrEqual(0);
      expect(r.stash).toBeGreaterThanOrEqual(0);
      expect(r.notoriety).toBeLessThanOrEqual(100);
      // A proclaimed outlaw is a wanted criminal, always (§25).
      if (r.outlawed) expect(r.legal).toBe('wanted criminal');
      if (r.outlawEnd === 'hanged') expect(r.died).toBe(true);
      // The year always ends.
      expect(r.steps).toBeLessThan(4000);
    }
  });
});

// ---------------------------------------------------------------------------
// The civic ladder (§29-§31)
// ---------------------------------------------------------------------------

/**
 * A man set up for a scenario: fed, watered, licensed, in health, and with the
 * tools of his trade in the tent. Everything the §29 assertions measure is
 * measured against a man in this condition, so that what moves is the rule and
 * not his stomach.
 */
function scenario(seed: number, day: number, where: LocationId): GameState {
  const s = createInitialState(seed);
  s.day = day;
  s.location = where;
  s.health = 90;
  s.provisionDays = 500;
  s.waterDays = 500;
  s.moneyPence = pounds(20);
  s.licenceUntilDay = day + 400;
  s.items = { ...s.items, pan: 1, cradle: 1, barrow: 1, swag: 1, tent: 1, waterBags: 1 };
  return s;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
}

function tally(log: Log): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of log.events) out[e.id] = (out[e.id] ?? 0) + 1;
  return out;
}

/**
 * A note on the notable's shape, for whoever tunes this next.
 *
 * §29 describes him as a cradler who buys the store by day ~150. On this
 * economy he cannot be: measured over 200 seeded years, a rush-chasing cradler
 * — the best of the safe strategies — first holds the £158 the store and its
 * opening stock cost in only a third of his years, and never before day 274.
 * A cautious cradler's *whole year* comes to about £90. So the notable earns
 * his capital where the game says capital is earned (§14: "shaft or shares
 * when capitalised"), with his shaft properly slabbed and propped, and quits
 * the reef the day the counter is paid for. That is what keeps his deaths
 * under §29's 8% — measured 6.5% over 3,200 seeded years, and nobody in the
 * cohort dies after the store is bought.
 */
describe('balance additions (§29) — the notable', () => {
  it('the notable ends the year a man of property (£250-£900), and seldom in the ground', () => {
    const runs = runBot(notable, RUNS, 907);
    const s = summarise(notable, runs);
    summaries.push(s);
    const withStore = runs.filter((r) => r.storeDay !== null);
    console.log(
      `${report(s)} store=${((withStore.length / runs.length) * 100).toFixed(0)}%@day${median(withStore.map((r) => r.storeDay as number))} works=${(runs.reduce((a, r) => a + r.works, 0) / runs.length).toFixed(2)} jp=${((runs.filter((r) => r.jp).length / runs.length) * 100).toFixed(0)}%`,
    );

    // The storekeeper beats the average digger and loses to the lucky one:
    // the thesis of the whole civic ladder (§31.5).
    expect(s.median).toBeGreaterThanOrEqual(pounds(250));
    expect(s.median).toBeLessThanOrEqual(pounds(900));
    const cradler = summaries.find((x) => x.bot === 'cautious cradler') as Summary;
    const magnate = summaries.find((x) => x.bot === 'company magnate') as Summary;
    expect(s.median).toBeGreaterThan(cradler.median);
    // Property income must never beat mining capital (§29).
    expect(s.median).toBeLessThan(magnate.median);

    // Respectability is the safest late game there is: nothing kills him after
    // the counter is bought, and the counter is bought by the spring.
    expect(s.deathRate).toBeLessThan(0.08);
    expect(withStore.length / runs.length).toBeGreaterThan(0.5);
    expect(median(withStore.map((r) => r.storeDay as number))).toBeLessThan(260);
    // The ladder is actually climbed: the list, and the bench.
    expect(runs.filter((r) => r.jp).length / runs.length).toBeGreaterThan(0.25);
    expect(runs.some((r) => r.works > 0)).toBe(true);
    // And nothing is a guaranteed win here either.
    expect(s.min).toBeLessThan(s.median);
    expect(s.max).toBeGreaterThan(s.median);
  });
});

// ---------------------------------------------------------------------------
// The press: what a called rush is worth, and what a lie costs (§26, §29)
// ---------------------------------------------------------------------------

interface CalledRushRun {
  gold: number;
  standing: number;
}

/**
 * A proprietor of the Angus with a worked-over claim under him and thirty days
 * to spend. Either he cries up the ground at Snakey Gully and walks over to
 * peg it himself, or he says nothing and keeps working what he has.
 */
function calledRushCohort(seed: number, freshness: number, call: boolean): CalledRushRun {
  const rng = makeRng(seed);
  const s = scenario(seed, 100, 'fields-town');
  s.standing = 55;
  s.estate.gazetteShare = true;
  s.mateUntilDay = s.day + 400;
  s.freshness['damp-camp'] = 0.6;
  s.freshness['snakey-gully'] = freshness;
  s.claims['damp-camp'] = { quality: 70, workedDays: 20, peggedOn: 60, proven: false };
  const log = new Log(rng);
  const before = s.standing;
  let gold = 0;
  let spent = 0;
  const DAYS = 30;

  if (call) {
    // The story, the two days the paper takes to reach the field, and the walk.
    placeStory(s, rng, log, 'talkUp', 'snakey-gully');
    for (let i = 0; i < 3 && !s.gameOver && !s.endOfYear; i++) {
      endDay(s, rng, log, {});
      spent += 1;
    }
    s.location = 'snakey-gully';
    pegClaim(s, rng, log, 'snakey-gully');
  } else {
    s.location = 'damp-camp';
  }

  while (spent < DAYS && !s.gameOver && !s.endOfYear) {
    const result = mineOneDay(s, rng, log, 'cradle');
    gold += result.gold;
    s.pending = null; // the troopers see his licence and are satisfied
    endDay(s, rng, log, { toil: true });
    spent += 1;
  }
  return { gold, standing: s.standing - before };
}

describe('the press and the called rush (§26, §29)', () => {
  const N = 300;

  it('a rush cried over genuinely fresh ground pays the man who called it', () => {
    const called: number[] = [];
    const stayed: number[] = [];
    for (let i = 0; i < N; i++) {
      const seed = 31013 + i * 7919;
      called.push(calledRushCohort(seed, 0.95, true).gold);
      stayed.push(calledRushCohort(seed, 0.95, false).gold);
    }
    const a = median(called);
    const b = median(stayed);
    console.log(
      `called rush (fresh)  n=${N} re-pegged=${formatMoney(goldValue(a, BANK_RATE_START))} stayed=${formatMoney(goldValue(b, BANK_RATE_START))} ratio=${(a / b).toFixed(2)}x`,
    );
    // Print truth about fresh ground and the press is a rifle (§26).
    expect(a / b).toBeGreaterThanOrEqual(1.3);
  });

  it('a rush cried over duffer ground costs the caller his name', () => {
    const standings: number[] = [];
    for (let i = 0; i < N; i++) {
      const seed = 41011 + i * 7919;
      standings.push(calledRushCohort(seed, 0.45, true).standing);
    }
    const lost = median(standings);
    console.log(`called rush (stale)  n=${N} median standing change=${lost.toFixed(1)}`);
    // Lying to the field is never free: the collapse is printed with the
    // paper's name on it, and the paper is his (§26).
    expect(lost).toBeLessThan(0);
    expect(standings.filter((x) => x < 0).length / N).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// The works: rules struck out of the dice, and struck for good (§27, §29)
// ---------------------------------------------------------------------------

/** Sixty nights at a camp, and what the field did to the man standing in it. */
function campNights(seed: number, camp: CampId, day: number, works: PublicWork[]): Record<string, number> {
  const rng = makeRng(seed);
  const s = scenario(seed, day, camp);
  s.yearsPlayed = day > 365 ? 2 : 1;
  s.estate.works = works;
  const log = new Log(rng);
  for (let i = 0; i < 60 && !s.gameOver && !s.endOfYear; i++) {
    // The illness of the moment is nursed elsewhere: what is counted here is
    // how often the field hands out a new one.
    s.illness = null;
    s.health = 90;
    endDay(s, rng, log, {});
  }
  return tally(log);
}

/** The winter crossing of the Blue River, by dray, with and without the bridge. */
function winterCrossing(seed: number, bridge: boolean): Record<string, number> {
  const rng = makeRng(seed);
  const s = scenario(seed, 190, 'on-road'); // the depth of winter
  if (bridge) s.estate.works = [{ id: 'bridge', day: 1 }];
  s.journey = {
    route: 'trickeys',
    mode: 'wagon',
    daysLeft: 3,
    daysTravelled: 0,
    to: 'damp-camp',
    from: 'fields-town',
    salvage: 0,
  };
  const log = new Log(rng);
  while (s.journey && s.journey.daysLeft > 0 && !s.gameOver && !s.endOfYear) {
    const stop = travelOneDay(s, rng, log);
    if (stop === 'dead' || stop === 'yearEnd' || stop === 'arrived') break;
    if (stop) break;
  }
  return tally(log);
}

function totalOver(counts: Record<string, number>[], keys: string[]): number {
  let sum = 0;
  for (const c of counts) for (const k of keys) sum += c[k] ?? 0;
  return sum;
}

describe('the works strike their rules out of the dice (§27, §29)', () => {
  const N = 300;

  it('the bridge takes the winter out of the Damp Camp road', () => {
    const without: Record<string, number>[] = [];
    const with_: Record<string, number>[] = [];
    for (let i = 0; i < N; i++) {
      const seed = 51001 + i * 7919;
      without.push(winterCrossing(seed, false));
      with_.push(winterCrossing(seed, true));
    }
    const keys = ['travel.bogged', 'travel.flood'];
    const a = totalOver(without, keys);
    const b = totalOver(with_, keys);
    console.log(`bridge  n=${N} bogged+flooded: without=${a} with=${b} absences narrated=${totalOver(with_, ['works.bridge.absence'])}`);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(a * 0.5);
    expect(totalOver(with_, ['works.bridge.absence'])).toBeGreaterThan(0);
  });

  it('the race strikes the Sandy Blight from the summer, this year and next', () => {
    for (const [label, day] of [
      ['year one', 20],
      ['year two', 385],
    ] as [string, number][]) {
      const without: Record<string, number>[] = [];
      const with_: Record<string, number>[] = [];
      for (let i = 0; i < N; i++) {
        const seed = 61001 + i * 7919;
        without.push(campNights(seed, 'snakey-gully', day, []));
        with_.push(campNights(seed, 'snakey-gully', day, [{ id: 'waterRace', day: 1, camp: 'snakey-gully' }]));
      }
      const blightA = totalOver(without, ['ill.sandyBlight']);
      const blightB = totalOver(with_, ['ill.sandyBlight']);
      const sickA = totalOver(without, ['ill.sandyBlight', 'ill.sunstroke', 'ill.dysentery', 'ill.typhoid', 'ill.fever']);
      const sickB = totalOver(with_, ['ill.sandyBlight', 'ill.sunstroke', 'ill.dysentery', 'ill.typhoid', 'ill.fever']);
      console.log(
        `race (${label})  n=${N} blight: without=${blightA} with=${blightB}; summer sickness: without=${sickA} with=${sickB}`,
      );
      expect(blightA).toBeGreaterThan(0);
      expect(blightB).toBe(0); // struck from the table altogether (§27)
      expect(sickB).toBeLessThan(sickA);
    }
  });

  it('the ward carts the sick out before they infect a gully, in both years', () => {
    for (const [label, day] of [
      ['year one', 120],
      ['year two', 485],
    ] as [string, number][]) {
      const without: Record<string, number>[] = [];
      const with_: Record<string, number>[] = [];
      for (let i = 0; i < N; i++) {
        const seed = 71003 + i * 7919;
        without.push(campNights(seed, 'damp-camp', day, []));
        with_.push(campNights(seed, 'damp-camp', day, [{ id: 'ward', day: 1 }]));
      }
      const keys = ['ill.dysentery', 'ill.typhoid'];
      const a = totalOver(without, keys);
      const b = totalOver(with_, keys);
      console.log(`ward (${label})  n=${N} dysentery+typhoid: without=${a} with=${b}`);
      expect(a).toBeGreaterThan(0);
      expect(b).toBeLessThan(a);
    }
  });
});

// ---------------------------------------------------------------------------
// The honest control, and the relativities (§29, §31)
// ---------------------------------------------------------------------------

describe('the civic ladder disturbs nothing that was there before (§29)', () => {
  it('a year in which no estate is bought is the year §14/§22/§25 already measured', () => {
    const controls: [Bot, number][] = [
      [idler, 11],
      [cautiousPanner, 101],
      [cautiousCradler, 211],
      [aggressiveShafter, 307],
      [rushChaser, 503],
      [companyMagnate, 607],
      [bushranger, 809],
    ];
    for (const [bot, seedBase] of controls) {
      const runs = runBot(bot, RUNS, seedBase);
      for (const r of runs) {
        expect(r.properties, `${bot.name} bought a deed he has no business with`).toBe(0);
        expect(r.works).toBe(0);
        expect(r.jp).toBe(false);
      }
      // Same bots, same seeds, same year: the numbers the earlier targets were
      // asserted against, to the penny.
      const now = summarise(bot, runs);
      const before = summaries.find((x) => x.bot === bot.name) as Summary;
      expect(before, `${bot.name} was never measured`).toBeDefined();
      expect(now.median).toBe(before.median);
      expect(now.deaths).toBe(before.deaths);
      expect(now.p90).toBe(before.p90);
    }
  });
});

describe('price relativities (§31)', () => {
  it('a day at the wash is worth the town wage and not three times it', () => {
    // What the Journal argues about: digging must tempt a man off the wharves
    // without being a certainty (§31.1, §31.6).
    const wage = Math.round((JOBS.clerk.lo + JOBS.clerk.hi) / 2); // 4s the day in Fields Town
    // The wage is what one man earns in a day, so the take is reckoned the same
    // way: a cradle is two men's work and its gold is two men's gold (§18, §31.1).
    for (const [bot, seedBase, hands] of [
      [cautiousPanner, 101, 1],
      [cautiousCradler, 211, 2],
    ] as [Bot, number, number][]) {
      const runs = runBot(bot, 120, seedBase).filter((r) => r.daysDug > 30);
      const perDay = runs.map((r) => goldValue(r.goldWon, BANK_RATE_START) / r.daysDug / hands);
      const take = median(perDay);
      console.log(
        `${bot.name.padEnd(20)} honest take per digging day and man=${formatMoney(Math.round(take))} (town wage ${formatMoney(wage)}, ${(take / wage).toFixed(2)}x)`,
      );
      expect(take).toBeGreaterThanOrEqual(wage);
      expect(take).toBeLessThanOrEqual(wage * 3);
    }
  });

  it('a week of camp provisions never prices below twice the wharf price (§31.3)', () => {
    let cheapest = Number.MAX_SAFE_INTEGER;
    for (const camp of ['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]) {
      for (let day = 1; day <= 365; day += 1) {
        for (const rushing of [false, true]) {
          const s = scenario(1234, day, camp);
          if (rushing) {
            s.rush = { camp, since: day - 1, untilDay: day + 5, factor: 1.6, base: 0.8 };
          }
          cheapest = Math.min(cheapest, provisionsPrice(s));
        }
      }
    }
    console.log(
      `camp provisions floor=${formatMoney(cheapest)} against Suze Port at ${formatMoney(PROVISIONS_WEEK.suze)} the week`,
    );
    expect(cheapest).toBeGreaterThanOrEqual(PROVISIONS_WEEK.suze * 2);
  });
});

describe('the bar cannot buy a name (§30.3)', () => {
  it('shouting and spreeing together yield at most +5 standing in fourteen days', () => {
    for (let i = 0; i < 60; i++) {
      const seed = 81001 + i * 7919;
      const rng = makeRng(seed);
      const s = scenario(seed, 100, 'fields-town');
      s.standing = 30;
      s.moneyPence = pounds(400);
      const log = new Log(rng);
      const before = s.standing;
      for (let d = 0; d < 14; d++) {
        s.health = 90; // a sore head is not what is being measured
        shoutTheBar(s, rng, log, false);
        shoutTheBar(s, rng, log, true);
        s.day += 1;
      }
      expect(s.standing - before).toBeLessThanOrEqual(5);
      expect(s.moneyPence).toBeLessThan(pounds(400)); // and it cost him plenty
    }
  });
});
