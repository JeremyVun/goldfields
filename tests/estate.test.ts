/**
 * Property, the press, the public works and the bench (GAME_SPEC.md §26-§28).
 */

import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/content/say';
import {
  CALLED_RUSH_BURN_DAYS,
  CALLED_RUSH_DELAY_DAYS,
  CALLED_RUSH_STANDING_LOSS,
  GAZETTE_WEEK_INCOME,
  JP_FEE,
  LAWYER_FEE,
  PRESS_AGITATION_UP,
  PRESS_SOOTHE_FLOOR,
  PRESS_SOOTHE_FLOOR_DAY,
  SHAMROCK_PRICE,
  SHAMROCK_RUSH_LEAD_DAYS,
  SHANTY_FENCE_RATE,
  SHANTY_PRICE,
  STORE_PRICE,
  STORE_STOCK_PRICE,
  STORE_WEEK_BASE,
  STORY_COOLDOWN_DAYS,
  WORK_DEFS,
} from '../src/engine/constants';
import { assizes, fenceRate, intelCost } from '../src/engine/bandit';
import {
  acceptCommission,
  buyGazetteShare,
  buyShamrock,
  buyShanty,
  courtCalmFactor,
  courtDocket,
  courtDue,
  estateDay,
  estateDeeds,
  estateWeek,
  holdCourt,
  openStore,
  placeStory,
  respectable,
  retainLawyer,
  ruleOn,
  setStorePolicy,
  storeWeekProfit,
  storekeeperFactor,
  fundWork,
} from '../src/engine/estate';
import { freshnessTick } from '../src/engine/events';
import { hireMate } from '../src/engine/mining';
import { hospitalFee, rollIllness, sicknessRisk } from '../src/engine/health';
import { getView } from '../src/engine/menus';
import { priceOf } from '../src/engine/market';
import { pounds } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng, type RNG } from '../src/engine/rng';
import { deserialise } from '../src/engine/save';
import { createInitialState, hasWork, netWorth } from '../src/engine/state';
import { travelOneDay } from '../src/engine/travel';
import type { GameState } from '../src/engine/types';

/** A man with a name on the field and money enough to be a nuisance with. */
function notable(seed = 11): { state: GameState; rng: RNG; log: Log } {
  const state = createInitialState(seed);
  state.location = 'fields-town';
  state.day = 200;
  state.provisionDays = 300;
  state.standing = 70;
  state.moneyPence = pounds(900);
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

// ---------------------------------------------------------------------------
// §26 The premises
// ---------------------------------------------------------------------------

describe('buying a seat at the table (§26)', () => {
  it('sells the Crown & Cradle only at Slateford, to a known and honest man with the money', () => {
    const { state, log } = notable();
    expect(buyShamrock({ ...state, location: 'damp-camp' }, log)).toBe(false);
    expect(buyShamrock({ ...state, standing: 20 }, log)).toBe(false);
    expect(buyShamrock({ ...state, legal: 'major criminal' }, log)).toBe(false);
    expect(buyShamrock({ ...state, moneyPence: pounds(10), bankPence: 0 }, log)).toBe(false);

    expect(buyShamrock(state, log)).toBe(true);
    expect(state.estate.shamrock).toBe(true);
    expect(state.moneyPence).toBe(pounds(900) - SHAMROCK_PRICE);
    // A wanted man is refused everywhere; his sinks are §28.3's.
    expect(respectable({ ...state, legal: 'wanted criminal' })).toBe(false);
    expect(respectable({ ...state, legal: 'petty criminal' })).toBe(true);
  });

  it('counts the deeds in what a man is worth, at what he paid', () => {
    const { state, log } = notable();
    const before = netWorth(state);
    buyShamrock(state, log);
    expect(netWorth(state)).toBe(before);
    expect(estateDeeds(state)).toHaveLength(1);
  });

  it('opens a store on the ground it stands on, one to a man', () => {
    const { state, log } = notable();
    state.location = 'snakey-gully';
    expect(openStore(state, log, 'damp-camp')).toBe(false);
    expect(openStore(state, log, 'snakey-gully')).toBe(true);
    expect(state.moneyPence).toBe(pounds(900) - STORE_PRICE - STORE_STOCK_PRICE);
    expect(openStore(state, log, 'snakey-gully')).toBe(false);
  });

  it('inverts the rush: the storekeeper is the one selling the sixteen-pound pans', () => {
    const { state, log } = notable();
    state.location = 'snakey-gully';
    openStore(state, log, 'snakey-gully');
    state.freshness['snakey-gully'] = 1;
    const quiet = storeWeekProfit(state);
    expect(quiet).toBe(STORE_WEEK_BASE);

    state.rush = { camp: 'snakey-gully', since: state.day - 1, untilDay: state.day + 8, factor: 2, base: 1 };
    expect(storeWeekProfit(state)).toBe(STORE_WEEK_BASE * 3);

    setStorePolicy(state, log, 'gouge');
    expect(storeWeekProfit(state)).toBe(STORE_WEEK_BASE * 6);

    // A worked-over camp is a dying concern, whatever the prices.
    state.rush = null;
    state.freshness['snakey-gully'] = 0.4;
    expect(storeWeekProfit(state)).toBeLessThan(quiet);
  });

  it('sets the camp\'s thieves on the gouger and off the honest man, at his own camp only', () => {
    const { state, log } = notable();
    state.location = 'snakey-gully';
    expect(storekeeperFactor(state)).toBe(1);
    openStore(state, log, 'snakey-gully');
    expect(storekeeperFactor(state)).toBeLessThan(1);
    setStorePolicy(state, log, 'gouge');
    expect(storekeeperFactor(state)).toBeGreaterThan(1);
    expect(storekeeperFactor(state, 'damp-camp')).toBe(1);
  });

  it('quiets the diggings for thirty days after a hard bench, and not after a soft one', () => {
    const { state, log } = notable();
    state.day = 355;
    buyShamrock(state, log);
    acceptCommission(state, log);
    holdCourt(state, log);
    expect(courtCalmFactor(state)).toBe(1);

    const severe = { ...state, estate: { ...state.estate }, heat: { ...state.heat } };
    ruleOn(severe, log, 'severity');
    expect(courtCalmFactor(severe)).toBeLessThan(1);
    expect(courtCalmFactor({ ...severe, day: severe.day + 31 })).toBe(1);

    const lenient = { ...state, estate: { ...state.estate }, heat: { ...state.heat } };
    ruleOn(lenient, log, 'leniency');
    expect(courtCalmFactor(lenient)).toBe(1);
  });

  it('sells the storekeeper his own kit at what the dray cost him', () => {
    const { state, log } = notable();
    state.location = 'snakey-gully';
    const camp = priceOf(state, 'cradle');
    openStore(state, log, 'snakey-gully');
    expect(priceOf(state, 'cradle')).toBeLessThan(camp);
    expect(priceOf({ ...state, location: 'damp-camp' }, 'cradle')).toBe(camp);
  });

  it('pays the policy in standing, week by week', () => {
    const { state, rng, log } = notable();
    state.location = 'snakey-gully';
    openStore(state, log, 'snakey-gully');
    const fairFrom = state.standing;
    estateWeek(state, rng, log);
    expect(state.standing).toBeGreaterThan(fairFrom);

    setStorePolicy(state, log, 'gouge');
    const gougeFrom = state.standing;
    estateWeek(state, rng, log);
    expect(state.standing).toBeLessThan(gougeFrom);
  });

  it('pays the house, the counter and the paper on a Sunday, wherever the man stands', () => {
    const { state, rng, log } = notable();
    buyShamrock(state, log);
    buyGazetteShare(state, log);
    state.location = 'deep-mountains';
    const before = state.moneyPence;
    estateWeek(state, rng, log);
    expect(state.moneyPence).toBeGreaterThanOrEqual(before + GAZETTE_WEEK_INCOME);
  });
});

// ---------------------------------------------------------------------------
// §26 The press
// ---------------------------------------------------------------------------

describe('the press (§26)', () => {
  function proprietor(seed = 21) {
    const ctx = notable(seed);
    buyGazetteShare(ctx.state, ctx.log);
    return ctx;
  }

  it('is refused to a man who does not own half of it, or is not in Bell Street', () => {
    const { state, rng, log } = notable();
    expect(placeStory(state, rng, log, 'soothe')).toBe(false);
    const { state: p, rng: r2, log: l2 } = proprietor();
    p.location = 'damp-camp';
    expect(placeStory(p, r2, l2, 'soothe')).toBe(false);
  });

  it('runs one story a fortnight and no more', () => {
    const { state, rng, log } = proprietor();
    expect(placeStory(state, rng, log, 'soothe')).toBe(true);
    expect(placeStory(state, rng, log, 'soothe')).toBe(false);
    state.day += STORY_COOLDOWN_DAYS;
    expect(placeStory(state, rng, log, 'soothe')).toBe(true);
  });

  it('calls a rush that begins in two days and is believed by everyone but the caller', () => {
    const { state, rng, log } = proprietor();
    state.freshness['damp-camp'] = 1.1;
    expect(placeStory(state, rng, log, 'talkUp', 'damp-camp')).toBe(true);
    expect(state.rush?.camp).toBe('damp-camp');
    expect(state.rush?.since).toBe(state.day + CALLED_RUSH_DELAY_DAYS);
    // Not a word of it in the world until it starts.
    const before = state.freshness['damp-camp'];
    freshnessTick(state);
    expect(state.freshness['damp-camp']).toBeLessThanOrEqual(before);
    expect(getView(state).body.join(' ')).not.toMatch(/RUSH at Reedbank Camp/i);

    // And then it is a real rush, and lifts the ground.
    state.day += CALLED_RUSH_DELAY_DAYS;
    freshnessTick(state);
    expect(state.freshness['damp-camp']).toBeGreaterThan(before);
  });

  it('costs the caller his name when the ground was duffer, and shuts the press for sixty days', () => {
    const { state, rng, log } = proprietor();
    state.freshness['snakey-gully'] = 0.4; // stale ground, and he never tried it
    placeStory(state, rng, log, 'talkUp', 'snakey-gully');
    const standing = state.standing;

    // A called rush on duffer ground lifts nothing while it runs.
    expect(state.rush?.factor).toBe(state.rush?.base);
    state.day += 7 + CALLED_RUSH_DELAY_DAYS;
    estateDay(state, log);
    expect(state.rush).toBeNull();
    expect(state.standing).toBe(standing - CALLED_RUSH_STANDING_LOSS);
    expect(state.estate.calledRushBurnedOn).toBe(state.day);

    state.day += STORY_COOLDOWN_DAYS;
    expect(placeStory(state, rng, log, 'talkUp', 'damp-camp')).toBe(false);
    state.day += CALLED_RUSH_BURN_DAYS;
    expect(placeStory(state, rng, log, 'talkUp', 'damp-camp')).toBe(true);
  });

  it('leaves a rush on genuinely fresh ground entirely unremarked', () => {
    const { state, rng, log } = proprietor();
    state.freshness['damp-camp'] = 1.0;
    placeStory(state, rng, log, 'talkUp', 'damp-camp');
    const standing = state.standing;
    state.day += 7 + CALLED_RUSH_DELAY_DAYS;
    estateDay(state, log);
    expect(state.rush).not.toBeNull();
    expect(state.standing).toBe(standing);
  });

  it('steers the year toward the stockade, and prints the next sweep before it runs', () => {
    const { state, rng, log } = proprietor();
    state.agitation = 30;
    expect(placeStory(state, rng, log, 'pressLicence')).toBe(true);
    expect(state.agitation).toBe(30 + PRESS_AGITATION_UP);
    expect(state.hunt).not.toBeNull();
  });

  it('cannot print the boil-over away after the spring', () => {
    const { state, rng, log } = proprietor();
    state.day = PRESS_SOOTHE_FLOOR_DAY + 5;
    state.agitation = PRESS_SOOTHE_FLOOR + 2;
    placeStory(state, rng, log, 'soothe');
    expect(state.agitation).toBe(PRESS_SOOTHE_FLOOR);

    state.day += STORY_COOLDOWN_DAYS;
    placeStory(state, rng, log, 'soothe');
    expect(state.agitation).toBe(PRESS_SOOTHE_FLOOR);
  });

  it('kills a notice once a year, for a criminal but never for a proclaimed man', () => {
    const { state, rng, log } = proprietor();
    expect(placeStory(state, rng, log, 'killNotice')).toBe(false); // nothing to kill
    state.legal = 'minor criminal';
    expect(placeStory(state, rng, log, 'killNotice')).toBe(true);
    expect(state.estate.noticeKillUntilDay).toBeGreaterThan(state.day);

    state.day += STORY_COOLDOWN_DAYS;
    expect(placeStory(state, rng, log, 'killNotice')).toBe(false);
    state.outlawed = true;
    expect(placeStory(state, rng, log, 'killNotice')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §27 Public works
// ---------------------------------------------------------------------------

describe('public works strike rules from the dice (§27)', () => {
  function subscriber(seed = 31) {
    const ctx = notable(seed);
    return ctx;
  }

  it('is subscribed at the Chambers, once, and pays +standing and no income at all', () => {
    const { state, log } = subscriber();
    const standing = state.standing;
    expect(fundWork({ ...state, location: 'damp-camp' }, log, 'bridge')).toBe(false);
    expect(fundWork(state, log, 'bridge')).toBe(true);
    expect(state.moneyPence).toBe(pounds(900) - WORK_DEFS.bridge.cost);
    expect(state.standing).toBe(standing + WORK_DEFS.bridge.standing);
    expect(fundWork(state, log, 'bridge')).toBe(false);
    // Subscriptions are not investments (§26 valuation).
    expect(netWorth(state)).toBe(pounds(900) - WORK_DEFS.bridge.cost);
  });

  it('will not cut a race to nowhere in particular', () => {
    const { state, log } = subscriber();
    expect(fundWork(state, log, 'waterRace')).toBe(false);
    expect(fundWork(state, log, 'waterRace', 'snakey-gully')).toBe(true);
    expect(hasWork(state, 'waterRace', 'snakey-gully')).toBe(true);
    expect(hasWork(state, 'waterRace', 'damp-camp')).toBe(false);
  });

  it('takes the winter out of the Reedbank Camp leg for everybody on it', () => {
    const { state, log } = subscriber();
    const winterRun = (s: GameState, seed: number): number => {
      let bogged = 0;
      for (let i = 0; i < 60; i++) {
        const t = { ...s, journey: { route: 'trickeys' as const, mode: 'wagon' as const, daysLeft: 3, daysTravelled: 0, to: 'damp-camp' as const, from: 'fields-town' as const, salvage: 0 } };
        t.location = 'on-road';
        t.day = 170; // deep winter
        t.provisionDays = 40;
        const rng = makeRng(seed + i);
        const log2 = new Log(rng);
        travelOneDay(t, rng, log2);
        if (log2.events.some((e) => e.id === 'travel.bogged' || e.id === 'travel.flood')) bogged += 1;
      }
      return bogged;
    };
    const before = winterRun(state, 900);
    fundWork(state, log, 'bridge');
    const after = winterRun(state, 900);
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
  });

  it('strikes the Sandy Blight from the raced camp and halves what the summer does', () => {
    const { state, log } = subscriber();
    state.location = 'snakey-gully';
    state.day = 30; // high summer
    const rng = makeRng(7);
    const before = sicknessRisk(state);
    const blightsBefore = Array.from({ length: 400 }, () => rollIllness(state, rng)).filter(
      (i) => i === 'sandyBlight',
    ).length;
    expect(blightsBefore).toBeGreaterThan(0);

    fundWork({ ...state, location: 'fields-town' }, log, 'waterRace', 'snakey-gully');
    state.estate.works.push({ id: 'waterRace', day: state.day, camp: 'snakey-gully' });
    expect(sicknessRisk(state)).toBeLessThan(before);
    const blightsAfter = Array.from({ length: 400 }, () => rollIllness(state, rng)).filter(
      (i) => i === 'sandyBlight',
    ).length;
    expect(blightsAfter).toBe(0);
  });

  it('slows the raced camp going off, and washes more ground', () => {
    const { state, log } = subscriber();
    const plain = { ...state, freshness: { ...state.freshness }, estate: { ...state.estate, works: [] } };
    fundWork(state, log, 'waterRace', 'damp-camp');
    for (let i = 0; i < 100; i++) {
      freshnessTick(state);
      freshnessTick(plain);
    }
    expect(state.freshness['damp-camp']).toBeGreaterThan(plain.freshness['damp-camp']);
    expect(state.freshness['snakey-gully']).toBeCloseTo(plain.freshness['snakey-gully'], 6);
  });

  it('sends the school\'s first youngster out in year two, and he takes no wages', () => {
    const { state, log } = subscriber();
    state.location = 'damp-camp';
    fundWork({ ...state, location: 'fields-town' }, log, 'school');
    state.estate.works.push({ id: 'school', day: state.day });
    state.yearsPlayed = 2;
    const money = state.moneyPence;
    const lad = new Log(makeRng(2));
    expect(hireMate(state, lad, 7)).toBe(true);
    expect(state.moneyPence).toBe(money);
    expect(state.mateUntilDay).toBeGreaterThanOrEqual(state.day);
    expect(lad.events.some((e) => e.id === 'works.school.lad')).toBe(true);
  });

  it('makes Canvas House free to the man who endowed the ward', () => {
    const { state, log } = subscriber();
    expect(hospitalFee(state)).toBeGreaterThan(0);
    fundWork(state, log, 'ward');
    expect(hospitalFee(state)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §28.1 The bench
// ---------------------------------------------------------------------------

describe('the notable of the fields (§28.1)', () => {
  function commissioned(seed = 41) {
    const ctx = notable(seed);
    ctx.state.day = 355; // the aftermath
    buyShamrock(ctx.state, ctx.log);
    return ctx;
  }

  it('is offered only in the aftermath, to an honest man of property with standing', () => {
    const { state, log } = commissioned();
    expect(acceptCommission({ ...state, day: 100 }, log)).toBe(false);
    expect(acceptCommission({ ...state, standing: 30 }, log)).toBe(false);
    expect(acceptCommission({ ...state, legal: 'petty criminal' }, log)).toBe(false);
    const money = state.moneyPence;
    expect(acceptCommission(state, log)).toBe(true);
    expect(state.estate.jpSince).toBe(state.day);
    expect(state.moneyPence).toBe(money - JP_FEE);
  });

  it('sits a monthly court on two or three cases, and the docket does not flicker', () => {
    const { state, log } = commissioned();
    acceptCommission(state, log);
    expect(courtDue(state)).toBe(true);
    expect(holdCourt(state, log)).toBe(true);
    expect(courtDue(state)).toBe(false);

    const docket = courtDocket(state);
    expect(docket.length).toBeGreaterThanOrEqual(2);
    expect(docket.length).toBeLessThanOrEqual(3);
    expect(courtDocket(state).map((c) => c.charge)).toEqual(docket.map((c) => c.charge));
    expect(new Set(docket.map((c) => c.id)).size).toBe(docket.length);
    for (const c of docket) expect(c.charge).not.toMatch(/^\[/);
  });

  it('buys the field with leniency and the diggings with severity', () => {
    const { state, log } = commissioned();
    acceptCommission(state, log);
    holdCourt(state, log);
    const lenient = { ...state, heat: { ...state.heat, camps: 40 }, agitation: 40 };
    ruleOn(lenient, log, 'leniency');
    expect(lenient.heat.camps).toBeLessThan(40);
    expect(lenient.agitation).toBeLessThan(40);
    expect(lenient.standing).toBeGreaterThan(state.standing);

    const severe = { ...state, heat: { ...state.heat, town: 40 }, estate: { ...state.estate } };
    ruleOn(severe, log, 'severity');
    expect(severe.heat.town).toBeLessThan(40);
    expect(severe.standing).toBeLessThan(state.standing);
  });

  it('no-bills the magistrate’s own scrapes, and is struck off for a real conviction', () => {
    const { state, log } = commissioned();
    acceptCommission(state, log);
    const standing = state.standing;
    const rng = makeRng(3);
    state.bloodShed = false;
    state.legal = 'major criminal';
    assizes(state, log, false, rng);
    expect(state.estate.jpSince).toBeNull();
    expect(state.standing).toBeLessThan(standing);
  });
});

// ---------------------------------------------------------------------------
// §28.3 The dark mirror
// ---------------------------------------------------------------------------

describe('the dark mirror (§28.3)', () => {
  function flash(seed = 51) {
    const state = createInitialState(seed);
    state.location = 'snakey-gully';
    state.day = 200;
    state.provisionDays = 300;
    state.legal = 'major criminal';
    state.notoriety = 45;
    state.moneyPence = pounds(300);
    const rng = makeRng(seed);
    return { state, rng, log: new Log(rng) };
  }

  it('sells the shanty to a man with a name, and not to anybody else', () => {
    const { state, log } = flash();
    expect(buyShanty({ ...state, notoriety: 5 }, log, 'snakey-gully')).toBe(false);
    expect(buyShanty(state, log, 'snakey-gully')).toBe(true);
    expect(state.moneyPence).toBe(pounds(300) - SHANTY_PRICE);
    expect(buyShanty(state, log, 'damp-camp')).toBe(false);
  });

  it('puts his own scales under the gold, and makes the word free', () => {
    const { state, log } = flash();
    const strangerRate = fenceRate(state);
    const strangerIntel = intelCost(state);
    buyShanty(state, log, 'snakey-gully');
    expect(fenceRate(state)).toBe(Math.round(state.bankRate * SHANTY_FENCE_RATE));
    expect(fenceRate(state)).toBeGreaterThan(strangerRate);
    expect(intelCost(state)).toBe(0);
    expect(strangerIntel).toBeGreaterThan(0);
    // His own scales are at his own shanty, and nowhere else.
    expect(fenceRate({ ...state, location: 'damp-camp' })).toBeLessThan(fenceRate(state));
  });

  it('burns for eighty pounds when the camps grow too hot', () => {
    const { state, log } = flash();
    buyShanty(state, log, 'snakey-gully');
    state.heat.camps = 90;
    let burnt = false;
    for (let i = 0; i < 200 && !burnt; i++) {
      const rng = makeRng(1000 + i);
      const s = { ...state, estate: { ...state.estate }, heat: { ...state.heat } };
      estateWeek(s, rng, new Log(rng));
      if (s.estate.shanty === null) burnt = true;
    }
    expect(burnt).toBe(true);
  });

  it('defends a trial at the assizes, but never a hanging', () => {
    const { state, log } = flash();
    buyShanty(state, log, 'snakey-gully');
    expect(retainLawyer(state, log)).toBe(true);
    expect(state.estate.lawyerUntilDay).toBeGreaterThan(state.day);
    expect(state.moneyPence).toBe(pounds(300) - SHANTY_PRICE - LAWYER_FEE);

    let acquittals = 0;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(500 + i);
      const s = { ...state, estate: { ...state.estate }, claims: { ...state.claims }, gang: [], moneyPence: pounds(50) };
      assizes(s, new Log(rng), false, rng);
      if (s.outlawEnd === null) acquittals += 1;
    }
    expect(acquittals).toBeGreaterThan(40);
    expect(acquittals).toBeLessThan(160);

    const rng = makeRng(9);
    const bloody = { ...state, bloodShed: true, claims: { ...state.claims }, gang: [] };
    assizes(bloody, new Log(rng), false, rng);
    expect(bloody.outlawEnd).toBe('hanged');
  });
});

// ---------------------------------------------------------------------------
// The reducer, the save, and the content
// ---------------------------------------------------------------------------

describe('the civic ladder through the reducer', () => {
  it('buys, prints and subscribes through the real verbs, and the story costs a day', () => {
    let state = notable(61).state;
    const rng = makeRng(61);
    state.screen = 'ftown';

    state = step(state, { type: 'buyShamrock' }, rng).state;
    expect(state.estate.shamrock).toBe(true);
    state = step(state, { type: 'buyGazetteShare' }, rng).state;
    expect(state.estate.gazetteShare).toBe(true);
    state = step(state, { type: 'fundWork', work: 'school' }, rng).state;
    expect(hasWork(state, 'school')).toBe(true);

    const day = state.day;
    state = step(state, { type: 'placeStory', kind: 'soothe' }, rng).state;
    expect(state.day).toBe(day + 1);
  });

  it('shows the deeds, the plaques and the commission at the reckoning', () => {
    const { state, log } = notable(71);
    state.day = 355;
    buyShamrock(state, log);
    fundWork(state, log, 'bridge');
    acceptCommission(state, log);
    const view = getView({ ...state, screen: 'end' });
    const body = view.body.join('\n');
    expect(body).toMatch(/THE ESTATE — WHAT YOUR NAME IS ON/);
    expect(body).toMatch(/Crown & Cradle/);
    expect(body).toMatch(/SLATE RIVER BRIDGE/);
    expect(body).toMatch(/Justice of the Peace/);
    expect(body).toMatch(/sits on the Slateford bench now/);
  });

  it('gives the notable his own last paragraph, above a company still held', () => {
    const { state, log } = notable(73);
    state.day = 355;
    buyShamrock(state, log);
    acceptCommission(state, log);
    const body = getView({ ...state, screen: 'end' }).body.join('\n');
    expect(body).toMatch(/bench|subscribers/i);
  });

  it('carries the estate through a save, and reads an old one back a man of no property', () => {
    const { state, log } = notable(81);
    buyShamrock(state, log);
    fundWork(state, log, 'ward');
    const back = deserialise(JSON.stringify(state));
    expect(back?.estate.shamrock).toBe(true);
    expect(back?.estate.works).toHaveLength(1);

    // A version 3 save, written before any of this was kept.
    const old = JSON.parse(JSON.stringify(createInitialState(5))) as Record<string, unknown>;
    old.v = 3;
    delete old.estate;
    const migrated = deserialise(JSON.stringify(old));
    expect(migrated?.v).toBe(6);
    expect(migrated?.estate.shamrock).toBe(false);
    expect(migrated?.estate.store).toBeNull();
    expect(migrated?.estate.works).toEqual([]);
    expect(migrated?.estate.jpSince).toBeNull();
  });

  it('gives the landlord of the Crown & Cradle the rush two days before the Times has it', () => {
    const { state, rng, log } = notable(91);
    buyShamrock(state, log);
    state.rush = {
      camp: 'damp-camp',
      since: state.day + SHAMROCK_RUSH_LEAD_DAYS,
      untilDay: state.day + 20,
      factor: 2,
      base: 1,
    };
    // estateDay is run at the close of every day inside endDay; here directly.
    const before = new Log(rng);
    estateDay(state, before);
    expect(before.events.some((e) => e.id === 'estate.shamrock.rushword')).toBe(true);
  });

  it('ships period prose for every line the ladder can print', () => {
    const keys = [
      'estate.refused',
      'estate.shamrock.buy',
      'estate.shamrock.week',
      'estate.shamrock.week.rush',
      'estate.shamrock.brawl',
      'estate.shamrock.shakedown.paid',
      'estate.shamrock.shakedown.refused',
      'estate.shamrock.rushword',
      'estate.shamrock.rumour.genuine',
      'estate.shamrock.rumour.hoax',
      'estate.store.open',
      'estate.store.week',
      'estate.store.week.rush',
      'estate.store.week.dying',
      'estate.store.fair',
      'estate.store.gouge',
      'estate.gazette.buy',
      'estate.gazette.week',
      'estate.press.talkup',
      'estate.press.collapse',
      'estate.press.disbelieved',
      'estate.press.licence',
      'estate.press.soothe',
      'estate.press.soothe.floor',
      'estate.press.killnotice',
      'estate.press.exposed',
      'estate.work.bridge',
      'estate.work.waterRace',
      'estate.work.ward',
      'estate.work.school',
      'works.bridge.absence',
      'works.race.absence',
      'works.ward.absence',
      'works.ward.free',
      'works.school.lad',
      'estate.jp.gazetted',
      'estate.jp.forfeit',
      'estate.jp.nobill',
      'estate.court.open',
      'estate.court.lenient',
      'estate.court.severe',
      'estate.shanty.buy',
      'estate.shanty.raid',
      'estate.lawyer.retain',
      'estate.lawyer.acquit',
      'estate.lawyer.fail',
      'epilogue.notable.bench',
      'epilogue.notable.town',
    ];
    for (const k of keys) expect(hasKey(k), `missing content key ${k}`).toBe(true);
    for (const id of ['licence', 'vagrant', 'jumper', 'drunk', 'bushranger', 'candle', 'grog']) {
      for (const part of ['charge', 'leniency', 'severity']) {
        expect(hasKey(`court.case.${id}.${part}`), `missing court.case.${id}.${part}`).toBe(true);
      }
    }
  });
});
