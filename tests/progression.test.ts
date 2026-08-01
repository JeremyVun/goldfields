/**
 * The progression uplift: ground that runs out, rushes that move men about,
 * and the making of a new chum into an old hand (GAME_SPEC.md §17-§18).
 */

import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/content/say';
import {
  CLAIM_QUALITY_CLAMP,
  DEPLETION_FLOOR,
  DEPLETION_FLOOR_DAYS,
  DEPLETION_FREE_DAYS,
  FRESHNESS_DECAY_PER_DAY,
  PRICES,
  STANDING_PARTNER,
} from '../src/engine/constants';
import { freshnessTick } from '../src/engine/events';
import { priceOf } from '../src/engine/market';
import {
  abandonClaim,
  depletionFactor,
  isWorkedOut,
  mineOneDay,
  pegClaim,
  prospectDay,
  rollQuality,
  rollYield,
  takePartner,
} from '../src/engine/mining';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { SAVE_VERSION, createInitialState, skillRank } from '../src/engine/state';
import { deserialise } from '../src/engine/save';
import type { CampId, GameState } from '../src/engine/types';

function atCamp(camp: CampId, seed = 4): { state: GameState; rng: ReturnType<typeof makeRng>; log: Log } {
  const state = createInitialState(seed);
  state.location = camp;
  state.provisionDays = 200;
  state.waterDays = 200;
  state.licenceUntilDay = 10000;
  state.items.pan = state.items.cradle = state.items.shovel = 1;
  state.items.pick = state.items.ropeBucket = 1;
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

// ---------------------------------------------------------------------------
// §17.1 Claim quality and depletion
// ---------------------------------------------------------------------------

describe('claim quality', () => {
  it('is rolled at pegging, hidden, and clamped at both ends', () => {
    const { state, rng } = atCamp('damp-camp', 99);
    let lowest = 9999;
    let highest = 0;
    for (let i = 0; i < 4000; i++) {
      state.freshness['damp-camp'] = i % 2 === 0 ? 0.5 : 2.6;
      const q = rollQuality(state, rng, 'damp-camp');
      lowest = Math.min(lowest, q);
      highest = Math.max(highest, q);
      expect(q).toBeGreaterThanOrEqual(CLAIM_QUALITY_CLAMP.lo);
      expect(q).toBeLessThanOrEqual(CLAIM_QUALITY_CLAMP.hi);
    }
    // Most ground is ordinary, but the spread reaches the ceiling now and then.
    expect(highest).toBe(CLAIM_QUALITY_CLAMP.hi);
    expect(lowest).toBeLessThan(100);
  });

  it('is richer on fresher ground', () => {
    const { state, rng } = atCamp('damp-camp', 71);
    const mean = (freshness: number) => {
      state.freshness['damp-camp'] = freshness;
      let total = 0;
      for (let i = 0; i < 3000; i++) total += rollQuality(state, rng, 'damp-camp');
      return total / 3000;
    };
    expect(mean(1.8)).toBeGreaterThan(mean(0.7) * 1.5);
  });

  it('drives the yield of the ground it was rolled for', () => {
    const { state, rng } = atCamp('damp-camp', 33);
    const mean = (quality: number) => {
      state.claims['damp-camp'] = { quality, workedDays: 0, peggedOn: 1, proven: false };
      let total = 0;
      for (let i = 0; i < 6000; i++) total += rollYield(state, rng, 'pan');
      return total / 6000;
    };
    const poor = mean(50);
    const rich = mean(200);
    expect(rich).toBeGreaterThan(poor * 3);
  });
});

describe('depletion', () => {
  it('gives full measure for a dozen days, then declines to the floor at fifty', () => {
    expect(depletionFactor(0)).toBe(1);
    expect(depletionFactor(DEPLETION_FREE_DAYS)).toBe(1);
    expect(depletionFactor(DEPLETION_FLOOR_DAYS)).toBeCloseTo(DEPLETION_FLOOR, 6);
    expect(depletionFactor(200)).toBeCloseTo(DEPLETION_FLOOR, 6);
    // Straight-line between the two.
    const half = (DEPLETION_FREE_DAYS + DEPLETION_FLOOR_DAYS) / 2;
    expect(depletionFactor(half)).toBeCloseTo((1 + DEPLETION_FLOOR) / 2, 6);
    for (let d = 1; d < 60; d++) {
      expect(depletionFactor(d)).toBeLessThanOrEqual(depletionFactor(d - 1));
    }
  });

  it('counts a day for every method but fossicking', () => {
    for (const method of ['pan', 'cradle'] as const) {
      const { state, rng, log } = atCamp('damp-camp', 5);
      state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
      mineOneDay(state, rng, log, method);
      expect(state.claims['damp-camp']?.workedDays).toBe(1);
    }
    const { state, rng, log } = atCamp('damp-camp', 5);
    state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    mineOneDay(state, rng, log, 'fossick');
    expect(state.claims['damp-camp']?.workedDays).toBe(0);
  });

  it('stops the spell when the wash goes off, and says so plainly', () => {
    const rng = makeRng(17);
    let state = createInitialState(17);
    state.location = 'damp-camp';
    state.provisionDays = 200;
    state.licenceUntilDay = 10000;
    state.items.pan = 1;
    state.claims['damp-camp'] = {
      quality: 100,
      workedDays: DEPLETION_FLOOR_DAYS - 2,
      peggedOn: 1,
      proven: false,
    };
    const out = step(state, { type: 'mine', method: 'pan', days: 14 }, rng);
    state = out.state;
    expect(out.events.some((e) => e.id === 'mine.ground.gone')).toBe(true);
    expect(isWorkedOut(state.claims['damp-camp'] as NonNullable<typeof state.claims['damp-camp']>)).toBe(true);
    // The spell is cut short rather than run out to its fourteen days.
    expect(state.day).toBeLessThan(14);
  });

  it('lets a man pull his pegs and roll fresh ground on the same camp', () => {
    const { state, rng, log } = atCamp('snakey-gully', 8);
    pegClaim(state, rng, log, 'snakey-gully');
    const first = state.claims['snakey-gully'];
    expect(first).not.toBeNull();
    (first as NonNullable<typeof first>).workedDays = 40;
    expect(abandonClaim(state, log, 'snakey-gully')).toBe(true);
    expect(state.claims['snakey-gully']).toBeNull();
    pegClaim(state, rng, log, 'snakey-gully');
    expect(state.claims['snakey-gully']?.workedDays).toBe(0);
  });
});

describe('the common ground', () => {
  it('pays badly, and never runs out however long it is worked', () => {
    const { state, rng } = atCamp('damp-camp', 21);
    const mean = () => {
      let total = 0;
      for (let i = 0; i < 6000; i++) total += rollYield(state, rng, 'pan');
      return total / 6000;
    };
    const common = mean();
    state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    expect(common).toBeLessThan(mean() * 0.7);

    // Working it leaves no mark on it at all.
    const { state: s2, rng: r2, log } = atCamp('damp-camp', 22);
    for (let i = 0; i < 10; i++) mineOneDay(s2, r2, log, 'pan');
    expect(s2.claims['damp-camp']).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §17.2 Camp freshness
// ---------------------------------------------------------------------------

describe('camp freshness', () => {
  it('wears down day by day across the year, and never below its floor', () => {
    const state = createInitialState(3);
    const start = state.freshness['damp-camp'];
    for (let i = 0; i < 10; i++) {
      freshnessTick(state);
      state.day += 1;
    }
    expect(state.freshness['damp-camp']).toBeCloseTo(start - 10 * FRESHNESS_DECAY_PER_DAY, 8);
    for (let i = 0; i < 2000; i++) {
      freshnessTick(state);
      state.day += 1;
    }
    expect(state.freshness['damp-camp']).toBeGreaterThan(0.2);
  });

  it('leaves the desert working alone', () => {
    const state = createInitialState(3);
    const before = state.freshness['secret-mine'];
    for (let i = 0; i < 50; i++) {
      freshnessTick(state);
      state.day += 1;
    }
    expect(state.freshness['secret-mine']).toBe(before);
  });

  it('is lifted by a rush and falls back to what it was by the rush’s end', () => {
    const state = createInitialState(3);
    state.day = 100;
    state.freshness['snakey-gully'] = 0.9;
    state.rush = { camp: 'snakey-gully', untilDay: 120, factor: 2.4, since: 100, base: 0.9 };
    freshnessTick(state);
    expect(state.freshness['snakey-gully']).toBeCloseTo(2.4, 6);

    const seen: number[] = [];
    for (state.day = 101; state.day <= 120; state.day++) {
      freshnessTick(state);
      seen.push(state.freshness['snakey-gully']);
    }
    // Falling all the way, and back to the old ground on the last day.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
    expect(seen[seen.length - 1]).toBeCloseTo(0.9, 6);
  });

  it('pays the first men on the ground best — the point of a rush', () => {
    const state = createInitialState(3);
    const rng = makeRng(3);
    state.day = 100;
    state.location = 'deep-mountains';
    state.rush = { camp: 'deep-mountains', untilDay: 130, factor: 2.4, since: 100, base: 1 };
    const meanQualityOn = (day: number) => {
      state.day = day;
      freshnessTick(state);
      let total = 0;
      for (let i = 0; i < 2000; i++) total += rollQuality(state, rng, 'deep-mountains');
      return total / 2000;
    };
    const early = meanQualityOn(102);
    const late = meanQualityOn(126);
    expect(early).toBeGreaterThan(late * 1.5);
  });
});

// ---------------------------------------------------------------------------
// §17.3 Prospecting
// ---------------------------------------------------------------------------

describe('prospecting', () => {
  const BANDS = ['prospect.duffer', 'prospect.poor', 'prospect.fair', 'prospect.promising', 'prospect.rich'];

  function bandsFor(washDays: number, quality: number): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const b of BANDS) counts[b] = 0;
    for (let seed = 0; seed < 400; seed++) {
      const { state, rng, log } = atCamp('damp-camp', seed * 13 + 1);
      state.skill.wash = washDays;
      state.claims['damp-camp'] = { quality, workedDays: 0, peggedOn: 1, proven: false };
      prospectDay(state, rng, log);
      for (const e of log.events) if (counts[e.id] !== undefined) counts[e.id] += 1;
    }
    return counts;
  }

  it('reports the claim in period bands, and an old hand is seldom far wrong', () => {
    const chum = bandsFor(0, 200);
    const oldHand = bandsFor(120, 200);
    expect(oldHand['prospect.rich']).toBeGreaterThan(chum['prospect.rich']);
    // The new chum's guess wanders over most of the ladder; the old hand's does not.
    const chumSpread = BANDS.filter((b) => chum[b] > 0).length;
    const oldSpread = BANDS.filter((b) => oldHand[b] > 0).length;
    expect(oldSpread).toBeLessThan(chumSpread);
  });

  it('calls duffer’s ground for what it is', () => {
    const counts = bandsFor(120, 40);
    expect(counts['prospect.duffer']).toBeGreaterThan(counts['prospect.fair']);
  });

  it('samples the open ground when no claim is pegged', () => {
    const { state, rng, log } = atCamp('damp-camp', 44);
    state.freshness['damp-camp'] = 0.6;
    prospectDay(state, rng, log);
    expect(log.events.some((e) => e.id === 'prospect.ground.picked')).toBe(true);

    const fresh = atCamp('damp-camp', 45);
    fresh.state.freshness['damp-camp'] = 1.4;
    prospectDay(fresh.state, fresh.rng, fresh.log);
    expect(fresh.log.events.some((e) => e.id === 'prospect.ground.fresh')).toBe(true);
  });

  it('costs a day, counts as a digging day, and teaches the wash', () => {
    const rng = makeRng(61);
    let state = createInitialState(61);
    state.location = 'damp-camp';
    state.provisionDays = 50;
    state.licenceUntilDay = 10000;
    state.items.pan = 1;
    const before = state.day;
    state = step(state, { type: 'prospect' }, rng).state;
    expect(state.day).toBe(before + 1);
    expect(state.stats.daysDug).toBe(1);
    expect(state.skill.wash).toBe(1);
  });

  it('wants a pan, and a camp to stand in', () => {
    const rng = makeRng(62);
    const state = createInitialState(62);
    state.location = 'damp-camp';
    const noPan = step(state, { type: 'prospect' }, rng);
    expect(noPan.state.day).toBe(state.day);

    const inTown = { ...state, location: 'fields-town' as const, items: { ...state.items, pan: 1 } };
    expect(step(inTown, { type: 'prospect' }, rng).state.day).toBe(state.day);
  });
});

// ---------------------------------------------------------------------------
// §18.1 Skill
// ---------------------------------------------------------------------------

describe('new chum, digger, old hand', () => {
  it('ranks a man by the days of the trade he has done', () => {
    expect(skillRank(0)).toBe('new chum');
    expect(skillRank(29)).toBe('new chum');
    expect(skillRank(30)).toBe('digger');
    expect(skillRank(89)).toBe('digger');
    expect(skillRank(90)).toBe('old hand');
  });

  it('counts wash days for the dish and shaft days for the hole, and no others', () => {
    const { state, rng, log } = atCamp('damp-camp', 12);
    state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    mineOneDay(state, rng, log, 'pan');
    mineOneDay(state, rng, log, 'cradle');
    mineOneDay(state, rng, log, 'fossick');
    expect(state.skill.wash).toBe(2);
    expect(state.skill.shaft).toBe(0);

    const deep = atCamp('deep-mountains', 13);
    deep.state.claims['deep-mountains'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    mineOneDay(deep.state, deep.rng, deep.log, 'shaft');
    expect(deep.state.skill.shaft).toBe(1);
    expect(deep.state.skill.wash).toBe(0);
  });

  it('marks the day a man stops being a new chum', () => {
    const { state, rng, log } = atCamp('damp-camp', 14);
    state.skill.wash = 28;
    state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
    mineOneDay(state, rng, log, 'pan');
    expect(log.events.some((e) => e.id === 'skill.wash.digger')).toBe(false);
    mineOneDay(state, rng, log, 'pan');
    expect(log.events.some((e) => e.id === 'skill.wash.digger')).toBe(true);
    expect(state.journal.some((j) => j.text.includes('new chum'))).toBe(true);
  });

  it('pays an old hand better than a new chum for the same ground', () => {
    const mean = (washDays: number) => {
      const { state, rng } = atCamp('damp-camp', 15);
      state.skill.wash = washDays;
      state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
      let total = 0;
      for (let i = 0; i < 20000; i++) total += rollYield(state, rng, 'pan');
      return total / 20000;
    };
    expect(mean(120)).toBeGreaterThan(mean(0) * 1.1);
  });

  it('sinks a shaft faster in practised hands', () => {
    // Days spent getting to the bottom of a hundred shafts of the same depth.
    const daysToBottom = (shaftDays: number) => {
      let days = 0;
      for (let seed = 0; seed < 100; seed++) {
        const { state, rng, log } = atCamp('deep-mountains', seed * 11 + 4);
        state.skill.shaft = shaftDays;
        state.claims['deep-mountains'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
        state.items.timber = 40;
        for (let d = 0; d < 40; d++) {
          days += 1;
          mineOneDay(state, rng, log, 'shaft');
          if (!state.shaft || state.shaft.bottomed) break;
          state.items.timber = 40;
        }
      }
      return days;
    };
    expect(daysToBottom(120)).toBeLessThan(daysToBottom(0));
  });

  it('sets the claim proven when a shaft bottoms on payable wash', () => {
    let proven = false;
    for (let seed = 0; seed < 60 && !proven; seed++) {
      const { state, rng, log } = atCamp('deep-mountains', seed * 7 + 2);
      state.claims['deep-mountains'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
      state.items.timber = 40;
      for (let d = 0; d < 30; d++) {
        mineOneDay(state, rng, log, 'shaft');
        if (state.shaft?.payable) {
          expect(state.claims['deep-mountains']?.proven).toBe(true);
          proven = true;
          break;
        }
      }
    }
    expect(proven).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §18.2 Standing
// ---------------------------------------------------------------------------

describe('standing on the field', () => {
  it('is earned by wages, by banking gold, and by paying the licence', () => {
    const rng = makeRng(51);
    let state = createInitialState(51);
    state.location = 'fields-town';
    state.provisionDays = 60;
    state.moneyPence = pounds(5);
    state = step(state, { type: 'work', job: 'gardener', days: 7 }, rng).state;
    expect(state.standing).toBeGreaterThan(1);

    const wages = state.standing;
    state = step(state, { type: 'buyLicence' }, rng).state;
    expect(state.standing).toBeCloseTo(wages + 2, 6);

    const licensed = state.standing;
    state.goldCentiOz = 200;
    state = step(state, { type: 'sellGold', where: 'bank', watch: true }, rng).state;
    expect(state.standing).toBeCloseTo(licensed + 1, 6);
  });

  it('is lost ten points to the rung when a man’s name goes bad', () => {
    const rng = makeRng(52);
    let state = createInitialState(52);
    state.standing = 40;
    state.location = 'suze-port';
    while (state.legal === 'honest' && state.day < 100) {
      state = step(state, { type: 'steal', target: 'drunk' }, rng).state;
    }
    expect(state.legal).not.toBe('honest');
    expect(state.standing).toBeLessThanOrEqual(30);
  });

  it('never falls below nothing at all', () => {
    const rng = makeRng(53);
    let state = createInitialState(53);
    state.location = 'suze-port';
    for (let i = 0; i < 30; i++) state = step(state, { type: 'steal', target: 'store' }, rng).state;
    expect(state.standing).toBeGreaterThanOrEqual(0);
  });

  it('gates a partner at thirty', () => {
    const { state, log } = atCamp('damp-camp', 54);
    state.standing = STANDING_PARTNER - 1;
    expect(takePartner(state, log)).toBe(false);
    expect(log.events.some((e) => e.id === 'partner.refused')).toBe(true);
    state.standing = STANDING_PARTNER;
    expect(takePartner(state, log)).toBe(true);
    expect(state.partner).toBe(true);
  });

  it('earns visible Briggs discount tiers through days served, not general standing', () => {
    const state = createInitialState(55);
    state.location = 'fields-town';
    const full = priceOf(state, 'cradle');
    state.standing = 100;
    expect(priceOf(state, 'cradle')).toBe(full);
    state.briggsDays = 21;
    expect(priceOf(state, 'cradle')).toBe(Math.round(full * 0.9));
    expect(PRICES.cradle.fields).toBe(pounds(5));
  });
});

describe('a partner', () => {
  it('takes a quarter of the gold and no wage at all', () => {
    const { state, rng, log } = atCamp('damp-camp', 56);
    state.standing = 100;
    state.claims['damp-camp'] = { quality: 200, workedDays: 0, peggedOn: 1, proven: false };
    takePartner(state, log);
    const purse = state.moneyPence;
    let taken = 0;
    for (let i = 0; i < 200; i++) {
      const before = state.goldCentiOz;
      const res = mineOneDay(state, rng, log, 'pan');
      taken += res.gold;
      expect(state.goldCentiOz - before).toBe(res.gold);
    }
    expect(state.moneyPence).toBe(purse); // no wages, ever
    expect(taken).toBeGreaterThan(0);
    expect(log.events.some((e) => e.id === 'partner.share')).toBe(true);
  });

  it('works the cradle at full strength, as a hired mate does', () => {
    const mean = (setup: (s: GameState) => void) => {
      const { state, rng } = atCamp('damp-camp', 57);
      state.claims['damp-camp'] = { quality: 100, workedDays: 0, peggedOn: 1, proven: false };
      setup(state);
      let total = 0;
      for (let i = 0; i < 8000; i++) total += rollYield(state, rng, 'cradle');
      return total / 8000;
    };
    const alone = mean(() => {});
    const withPartner = mean((s) => {
      s.partner = true;
    });
    expect(withPartner).toBeGreaterThan(alone * 1.6);
  });
});

// ---------------------------------------------------------------------------
// §22 Save compatibility
// ---------------------------------------------------------------------------

describe('taking up a game saved before the ledger of quality was kept', () => {
  const v1 = JSON.stringify({
    v: 1,
    seed: 7,
    day: 200,
    moneyPence: shillings(30),
    goldCentiOz: 40,
    claims: {
      'damp-camp': true,
      'snakey-gully': false,
      'deep-mountains': false,
      'secret-mine': false,
    },
    rush: { camp: 'damp-camp', untilDay: 210, factor: 2 },
  });

  it('turns a pegged flag into ordinary unworked ground', () => {
    const back = deserialise(v1);
    expect(back).not.toBeNull();
    const claim = back?.claims['damp-camp'];
    expect(claim).not.toBeNull();
    expect(claim?.quality).toBe(100);
    expect(claim?.workedDays).toBe(0);
    expect(claim?.proven).toBe(false);
    expect(back?.claims['snakey-gully']).toBeNull();
  });

  it('defaults everything the old save never heard of, and bumps the version', () => {
    const back = deserialise(v1) as GameState;
    expect(back.v).toBe(SAVE_VERSION);
    expect(back.standing).toBe(0);
    expect(back.partner).toBe(false);
    expect(back.skill).toEqual({ wash: 0, shaft: 0, bush: 0 });
    expect(back.freshness['damp-camp']).toBe(1);
    expect(back.freshness['secret-mine']).toBeGreaterThan(1);
    expect(back.rush?.since).toBe(200);
    expect(back.rush?.base).toBe(1);
    expect(back.day).toBe(200);
    expect(back.goldCentiOz).toBe(40);
  });

  it('plays on from an old save without complaint', () => {
    const back = deserialise(v1) as GameState;
    back.location = 'damp-camp';
    back.provisionDays = 40;
    back.licenceUntilDay = 300;
    back.items.pan = 1;
    const out = step(back, { type: 'mine', method: 'pan', days: 3 }, makeRng(9));
    expect(out.state.day).toBeGreaterThan(200);
    for (const e of out.events) expect(e.text).not.toMatch(/^\[[\w.]+\]$/);
  });
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

describe('the copy for the new verbs', () => {
  it('is written, and in several variants', () => {
    const keys = [
      'mine.abandon',
      'mine.abandon.workedout',
      'mine.ground.gone',
      'prospect.duffer',
      'prospect.poor',
      'prospect.fair',
      'prospect.promising',
      'prospect.rich',
      'prospect.workedout',
      'prospect.ground.picked',
      'prospect.ground.fair',
      'prospect.ground.fresh',
      'prospect.find',
      'partner.take',
      'partner.refused',
      'partner.dissolve',
      'partner.share',
      'skill.wash.digger',
      'skill.wash.oldhand',
      'skill.shaft.digger',
      'skill.shaft.oldhand',
      'work.council.unknown',
    ];
    for (const k of keys) expect(hasKey(k), `missing content key ${k}`).toBe(true);
  });
});
