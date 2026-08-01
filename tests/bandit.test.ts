/**
 * THE DARK LADDER (GAME_SPEC.md §23-§24): notoriety, heat, the outlaw's
 * economy, and the four ways his road can end.
 */

import { describe, expect, it } from 'vitest';
import {
  addHeat,
  assizes,
  breakGaol,
  buyPassage,
  canBailUp,
  canBigJob,
  canBreakGaol,
  canMakeHideout,
  canRecruit,
  captured,
  crimeVisible,
  escapeChance,
  fenceGold,
  fenceRate,
  gainBush,
  gatherIntelligence,
  hideoutSearchChance,
  heatGainFactor,
  heatTick,
  lurk,
  makeHideout,
  makeOutlaw,
  offerPardon,
  pursuitChance,
  recruitGangMember,
  resolveBailUp,
  rewardNotice,
  robEscort,
  stash,
  takePardon,
  unstash,
} from '../src/engine/bandit';
import {
  BAILUP_VICTIMS,
  FENCE_RATE,
  GANG_MAX,
  HEAT_DECAY_PER_DAY,
  HEAT_PER_CRIME,
  NOTORIETY_BAILUP_GATE,
  NOTORIETY_BIGJOB_GATE,
  NOTORIETY_GANG_GATE,
  NOTORIETY_HIDEOUT_GATE,
  PASSAGE_FARE,
  ROB_ESCORT_TAKE,
} from '../src/engine/constants';
import { cleanDayTick } from '../src/engine/law';
import { sellGold } from '../src/engine/market';
import { getView } from '../src/engine/menus';
import { formatMoney, pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { deserialise, serialise } from '../src/engine/save';
import {
  SAVE_VERSION,
  bushRank,
  createInitialState,
  emptyHeat,
  netWorth,
  rewardFor,
  stashWorth,
} from '../src/engine/state';
import type { GameState } from '../src/engine/types';

function fresh(seed = 5): GameState {
  return createInitialState(seed);
}

function bandit(seed = 5): { state: GameState; rng: ReturnType<typeof makeRng>; log: Log } {
  const state = fresh(seed);
  state.legal = 'minor criminal';
  state.notoriety = 50;
  state.items.gun = 4;
  state.horse = 'brumby';
  state.location = 'suze-port';
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

// ---------------------------------------------------------------------------
// Notoriety and the reward notice (§23.2)
// ---------------------------------------------------------------------------

describe('notoriety — the dark mirror of standing (§23.2)', () => {
  it('gates each rung of the ladder in turn', () => {
    const { state } = bandit();
    state.notoriety = 0;
    expect(canBailUp(state).ok).toBe(false);
    state.notoriety = NOTORIETY_BAILUP_GATE;
    expect(canBailUp(state).ok).toBe(true);

    state.location = 'deep-mountains';
    state.items.tent = 1;
    state.provisionDays = 20;
    state.notoriety = NOTORIETY_HIDEOUT_GATE - 1;
    expect(canMakeHideout(state).ok).toBe(false);
    state.notoriety = NOTORIETY_HIDEOUT_GATE;
    expect(canMakeHideout(state).ok).toBe(true);

    state.notoriety = NOTORIETY_GANG_GATE - 1;
    expect(canRecruit(state).ok).toBe(false);
    state.notoriety = NOTORIETY_GANG_GATE;
    expect(canRecruit(state).ok).toBe(true);

    state.gang = [
      { name: 'a', joined: 1, loyalty: 0.5 },
      { name: 'b', joined: 1, loyalty: 0.5 },
    ];
    state.notoriety = NOTORIETY_BIGJOB_GATE - 1;
    expect(canBigJob(state).ok).toBe(false);
    state.notoriety = NOTORIETY_BIGJOB_GATE;
    expect(canBigJob(state).ok).toBe(true);
    // A loaded piece for every man of them.
    state.items.gun = 2;
    expect(canBigJob(state).ok).toBe(false);
  });

  it('never takes a man past three in the gang', () => {
    const { state, rng, log } = bandit();
    state.notoriety = NOTORIETY_GANG_GATE;
    for (let i = 0; i < 6; i++) recruitGangMember(state, rng, log);
    expect(state.gang.length).toBe(GANG_MAX);
    expect(new Set(state.gang.map((g) => g.name)).size).toBe(GANG_MAX);
  });

  it('offers nothing for a man who is not wanted, and round sums for one who is', () => {
    const state = fresh();
    state.notoriety = 100;
    expect(rewardFor(state)).toBe(0);
    state.legal = 'wanted criminal';
    const sums: number[] = [];
    for (const n of [0, 19, 20, 45, 65, 85, 99]) {
      state.notoriety = n;
      sums.push(rewardFor(state));
    }
    expect(sums).toEqual([0, 0, pounds(20), pounds(50), pounds(100), pounds(200), pounds(500)]);
  });

  it('prints the notice only when it rises', () => {
    const state = fresh();
    state.legal = 'wanted criminal';
    state.notoriety = 25;
    const rng = makeRng(1);
    const first = new Log(rng);
    rewardNotice(state, first);
    expect(first.length).toBe(1);
    const again = new Log(rng);
    rewardNotice(state, again);
    expect(again.length).toBe(0);
    state.notoriety = 65;
    const risen = new Log(rng);
    rewardNotice(state, risen);
    expect(risen.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Heat (§23.3)
// ---------------------------------------------------------------------------

describe('heat — the push, never the loop (§23.3)', () => {
  it('warms the district worked and splashes into the ones beside it', () => {
    const state = fresh();
    addHeat(state, 'pass', HEAT_PER_CRIME);
    expect(state.heat.pass).toBeCloseTo(HEAT_PER_CRIME);
    expect(state.heat.trickeys).toBeCloseTo(HEAT_PER_CRIME / 2);
    expect(state.heat.town).toBeCloseTo(HEAT_PER_CRIME / 2);
    // The camps are not next door to the Razorback Road.
    expect(state.heat.camps).toBe(0);
  });

  it('cools every day, and never past nothing or above a hundred', () => {
    const state = fresh();
    state.heat = { trickeys: 100, pass: 0.4, town: 50, camps: 0 };
    heatTick(state);
    expect(state.heat.trickeys).toBeCloseTo(100 - HEAT_DECAY_PER_DAY);
    expect(state.heat.pass).toBe(0);
    for (let i = 0; i < 200; i++) addHeat(state, 'town', HEAT_PER_CRIME);
    expect(state.heat.town).toBe(100);
  });

  it('is gained the slower while the licence question boils (§20 × §23.3)', () => {
    const quiet = fresh();
    const boiling = fresh();
    boiling.agitation = 100;
    expect(heatGainFactor(quiet)).toBe(1);
    expect(heatGainFactor(boiling)).toBeLessThan(1);
    addHeat(quiet, 'town', HEAT_PER_CRIME);
    addHeat(boiling, 'town', HEAT_PER_CRIME);
    expect(boiling.heat.town).toBeLessThan(quiet.heat.town);
  });

  it('drives the search of Split Rock Camp, and bushcraft blunts it', () => {
    const state = fresh();
    state.hideout = { stashPence: 0, stashGold: 0, discovered: false, madeOn: 1 };
    state.heat.camps = 100;
    const chum = hideoutSearchChance(state);
    state.skill.bush = 100;
    const captain = hideoutSearchChance(state);
    expect(captain).toBeLessThan(chum);
    // And robbing diggers turns the field informer against him (§23.5).
    state.diggersRobbed = 3;
    expect(hideoutSearchChance(state)).toBeGreaterThan(captain);
  });
});

// ---------------------------------------------------------------------------
// Entry, and the point of no return (§23.1)
// ---------------------------------------------------------------------------

describe('entry and the point of no return (§23.1)', () => {
  it('keeps the criminal hub out of sight until minor criminal', () => {
    const state = fresh();
    state.screen = 'suze';
    const shown = getView(state).menu.find((m) => m.action.type === 'goto' && m.action.screen === 'bandit');
    expect(shown).toBeUndefined();
    expect(crimeVisible(state)).toBe(false);

    state.legal = 'minor criminal';
    const open = getView(state).menu.find((m) => m.action.type === 'goto' && m.action.screen === 'bandit');
    expect(open).toBeDefined();
    expect(open?.disabled).toBeFalsy();
  });

  it('closes the bank and the honest houses to a wanted man', () => {
    const state = fresh();
    state.legal = 'wanted criminal';
    state.location = 'fields-town';
    state.goldCentiOz = 500;
    const rng = makeRng(3);
    expect(sellGold(state, rng, new Log(rng), 'bank', true)).toBe(0);
    expect(state.goldCentiOz).toBe(500);

    let s: GameState = { ...state, moneyPence: pounds(10), screen: 'ftown' };
    s = step(s, { type: 'deposit', amount: pounds(5) }, rng).state;
    expect(s.bankPence).toBe(0);
    s = step(s, { type: 'work', job: 'barman', days: 3 }, rng).state;
    expect(s.stats.daysWorked).toBe(0);
  });

  it('leaves the ninety clean days open until the man is proclaimed', () => {
    const state = fresh();
    state.legal = 'major criminal';
    const log = new Log(makeRng(1));
    for (let i = 0; i < 90; i++) cleanDayTick(state, log);
    expect(state.legal).toBe('minor criminal');

    const outlaw = fresh();
    outlaw.legal = 'major criminal';
    makeOutlaw(outlaw, log);
    expect(outlaw.outlawed).toBe(true);
    expect(outlaw.legal).toBe('wanted criminal');
    for (let i = 0; i < 400; i++) cleanDayTick(outlaw, log);
    expect(outlaw.legal).toBe('wanted criminal');
    expect(outlaw.cleanDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The verbs (§23.4)
// ---------------------------------------------------------------------------

describe('bailing up (§23.4)', () => {
  it('lurking finds nobody, a traveller, or the troopers', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const { state, rng, log } = bandit(seed);
      state.heat.trickeys = 60;
      seen.add(lurk(state, rng, log, 'trickeys'));
    }
    expect(seen).toEqual(new Set(['nobody', 'victim', 'patrol']));
  });

  it('pays, warms the road, and moves both ladders', () => {
    const { state, rng, log } = bandit(9);
    state.pending = { kind: 'bailup', data: { victim: 'squatter', route: 'trickeys', knows: false } };
    const before = state.notoriety;
    resolveBailUp(state, rng, log, 'take');
    expect(state.notoriety).toBeGreaterThan(before);
    expect(state.heat.trickeys).toBeGreaterThan(0);
    expect(state.stats.bailUps).toBe(1);
    expect(state.moneyPence).toBeGreaterThan(0);
    expect(state.legal).not.toBe('minor criminal'); // the ladder moved
  });

  it('lets a digger keep his pile, and remembers when it does not (§23.5)', () => {
    const kept = bandit(11);
    kept.state.pending = { kind: 'bailup', data: { victim: 'digger', route: 'pass', knows: false } };
    resolveBailUp(kept.state, kept.rng, kept.log, 'pass');
    expect(kept.state.diggersRobbed).toBe(0);
    expect(kept.state.moneyPence).toBe(shillings(10));

    const took = bandit(11);
    took.state.standing = 40;
    took.state.pending = { kind: 'bailup', data: { victim: 'digger', route: 'pass', knows: false } };
    resolveBailUp(took.state, took.rng, took.log, 'take');
    expect(took.state.diggersRobbed).toBe(1);
    expect(took.state.standing).toBeLessThan(40);
  });

  it('never kills a victim unless the player chose to fire', () => {
    let killed = 0;
    let shotKills = 0;
    for (let seed = 0; seed < 400; seed++) {
      const a = bandit(seed);
      a.state.pending = { kind: 'bailup', data: { victim: 'buyer', route: 'trickeys', knows: false } };
      resolveBailUp(a.state, a.rng, a.log, 'take');
      if (a.state.bloodShed) killed += 1;

      const b = bandit(seed);
      b.state.pending = { kind: 'bailup', data: { victim: 'buyer', route: 'trickeys', knows: false } };
      resolveBailUp(b.state, b.rng, b.log, 'shoot');
      if (b.state.bloodShed) shotKills += 1;
    }
    expect(killed).toBe(0);
    expect(shotKills).toBeGreaterThan(0);
  });

  it('a name that goes before a man saves him the fight', () => {
    const { state, rng, log } = bandit(13);
    state.notoriety = 70;
    state.pending = { kind: 'bailup', data: { victim: 'buyer', route: 'trickeys', knows: true } };
    const before = state.health;
    resolveBailUp(state, rng, log, 'take');
    expect(state.health).toBe(before);
    expect(state.notoriety).toBeGreaterThan(72);
  });
});

describe('the hideout and the stash (§23.4)', () => {
  it('wants a name, the ranges, a tent and a week of flour', () => {
    const { state, log } = bandit();
    expect(makeHideout(state, log)).toBe(false);
    state.location = 'deep-mountains';
    state.items.tent = 1;
    state.provisionDays = 10;
    state.notoriety = NOTORIETY_HIDEOUT_GATE;
    expect(makeHideout(state, log)).toBe(true);
    expect(state.hideout).not.toBeNull();
  });

  it('buries and lifts money and gold, and never goes below nothing', () => {
    const { state, log } = bandit();
    state.hideout = { stashPence: 0, stashGold: 0, discovered: false, madeOn: 1 };
    state.moneyPence = pounds(10);
    state.goldCentiOz = 400;
    stash(state, log, 'money', -1);
    stash(state, log, 'gold', -1);
    expect(state.moneyPence).toBe(0);
    expect(state.goldCentiOz).toBe(0);
    expect(state.hideout?.stashPence).toBe(pounds(10));
    expect(stashWorth(state)).toBeGreaterThan(pounds(10));
    unstash(state, log, 'money', pounds(100));
    expect(state.moneyPence).toBe(pounds(10));
    expect(state.hideout?.stashPence).toBe(0);
    expect(unstash(state, log, 'money', pounds(1))).toBe(false);
  });

  it('counts in what a man is worth', () => {
    const state = fresh();
    const before = netWorth(state);
    state.hideout = { stashPence: pounds(50), stashGold: 200, discovered: false, madeOn: 1 };
    expect(netWorth(state)).toBeGreaterThan(before + pounds(50));
  });
});

describe('intelligence and the fence (§23.4)', () => {
  it('costs a shilling or two and turns robbery into a plan', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      const { state, rng, log } = bandit(seed);
      state.moneyPence = pounds(1);
      gatherIntelligence(state, rng, log);
      kinds.add(state.intel?.kind ?? 'nothing');
      expect(state.moneyPence).toBeLessThan(pounds(1));
    }
    expect(kinds).toEqual(new Set(['escort', 'bank', 'traveller', 'nothing']));
  });

  it('is free to a captain of the bush (§23.6)', () => {
    const { state, rng, log } = bandit();
    state.skill.bush = 120;
    state.moneyPence = 0;
    expect(gatherIntelligence(state, rng, log)).toBe(true);
  });

  it('pays six or seven parts in ten of the bank, and short-weights him besides', () => {
    for (let day = 1; day <= 60; day++) {
      const state = fresh();
      state.day = day;
      const f = fenceRate(state) / state.bankRate;
      expect(f).toBeGreaterThanOrEqual(FENCE_RATE.lo - 0.01);
      expect(f).toBeLessThanOrEqual(FENCE_RATE.hi + 0.01);
    }
    let shorted = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state, rng, log } = bandit(seed);
      state.goldCentiOz = 1000;
      const paid = fenceGold(state, rng, log);
      expect(state.goldCentiOz).toBe(0);
      if (paid < (1000 * fenceRate(state)) / 100) shorted += 1;
    }
    expect(shorted).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bushcraft (§23.6)
// ---------------------------------------------------------------------------

describe('bushcraft — the third skill (§23.6)', () => {
  it('runs new chum → flash cove → captain', () => {
    expect(bushRank(0)).toBe('new chum');
    expect(bushRank(29)).toBe('new chum');
    expect(bushRank(30)).toBe('flash cove');
    expect(bushRank(89)).toBe('flash cove');
    expect(bushRank(90)).toBe('captain');
  });

  it('is announced when it turns', () => {
    const { state, log } = bandit();
    state.skill.bush = 29;
    gainBush(state, log, 1);
    expect(log.events.some((e) => e.id === 'bandit.skill.flash')).toBe(true);
  });

  it('makes a man harder to run down', () => {
    const chum = fresh();
    chum.horse = 'brumby';
    const captain = { ...chum, skill: { wash: 0, shaft: 0, bush: 120 } };
    expect(escapeChance(captain)).toBeGreaterThan(escapeChance(chum));
    // And a big name makes him easier.
    const famous = { ...captain, notoriety: 100 };
    expect(escapeChance(famous)).toBeLessThan(escapeChance(captain));
  });
});

// ---------------------------------------------------------------------------
// Endings (§24)
// ---------------------------------------------------------------------------

describe('the assizes (§24)', () => {
  it('hangs a man where blood was shed', () => {
    const { state, log } = bandit();
    makeOutlaw(state, log);
    state.bloodShed = true;
    state.moneyPence = pounds(40);
    state.hideout = { stashPence: pounds(90), stashGold: 0, discovered: false, madeOn: 1 };
    assizes(state, log);
    expect(state.gameOver).toBe('dead');
    expect(state.causeOfDeath).toMatch(/hanged/);
    expect(state.outlawEnd).toBe('hanged');
    // The Crown finds even the stash of a hanged man.
    expect(netWorth(state)).toBe(0);
  });

  it('sends a man who shed none to the hulks, and takes all he did not bury', () => {
    const { state, log } = bandit();
    makeOutlaw(state, log);
    state.moneyPence = pounds(40);
    state.bankPence = pounds(20);
    state.goldCentiOz = 300;
    state.hideout = { stashPence: pounds(90), stashGold: 0, discovered: false, madeOn: 1 };
    assizes(state, log);
    expect(state.gameOver).toBe('finished');
    expect(state.outlawEnd).toBe('hulks');
    expect(state.moneyPence).toBe(0);
    expect(state.bankPence).toBe(0);
    expect(state.goldCentiOz).toBe(0);
    // What is under the stone in the ranges is still under it.
    expect(netWorth(state)).toBe(pounds(90));
  });

  it('offers the gaol break once, to a man the field has no quarrel with', () => {
    const { state } = bandit();
    state.gang = [{ name: 'a', joined: 1, loyalty: 0.6 }];
    expect(canBreakGaol(state)).toBe(true);
    state.diggersRobbed = 2;
    expect(canBreakGaol(state)).toBe(false);
    state.diggersRobbed = 0;
    state.gaolBreakOffered = true;
    expect(canBreakGaol(state)).toBe(false);
  });

  it('is two chances in five, and doubles the sentence when it fails', () => {
    let out = 0;
    for (let seed = 0; seed < 300; seed++) {
      const { state, rng, log } = bandit(seed);
      makeOutlaw(state, log);
      state.hideout = { stashPence: 0, stashGold: 0, discovered: false, madeOn: 1 };
      state.pending = { kind: 'assizes' };
      if (breakGaol(state, rng, log)) {
        out += 1;
        expect(state.pending).toBeNull();
        expect(state.location).toBe('hideout');
      } else {
        assizes(state, log, true);
        expect(state.gameOver).toBeTruthy();
      }
      expect(state.gaolBreakOffered).toBe(true);
    }
    expect(out / 300).toBeGreaterThan(0.28);
    expect(out / 300).toBeLessThan(0.52);
  });

  it('takes a proclaimed man to the assizes and not to the monthly magistrate', () => {
    const { state, rng, log } = bandit(21);
    makeOutlaw(state, log);
    captured(state, rng, log, 'town');
    expect(state.pending?.kind).toBe('assizes');
    expect(state.location).toBe('fields-town');
  });
});

describe('the chosen endings (§24)', () => {
  it('sails for California with only what he carried up the gangway', () => {
    let sailed = 0;
    let caught = 0;
    for (let seed = 0; seed < 300; seed++) {
      const { state, rng, log } = bandit(seed);
      state.notoriety = 100;
      state.location = 'suze-port';
      state.moneyPence = PASSAGE_FARE + pounds(30);
      state.bankPence = pounds(50);
      state.hideout = { stashPence: pounds(10), stashGold: 0, discovered: false, madeOn: 1 };
      buyPassage(state, rng, log);
      if (state.outlawEnd === 'california') {
        sailed += 1;
        expect(state.gameOver).toBe('finished');
        // The bank keeps whatever was left in it; the stash comes with him.
        expect(state.bankPence).toBe(0);
        expect(netWorth(state)).toBe(pounds(40));
      } else {
        caught += 1;
      }
    }
    // Recognition at the gangway is notoriety/200: about one man in two at 100.
    expect(sailed / 300).toBeGreaterThan(0.4);
    expect(sailed / 300).toBeLessThan(0.6);
    expect(caught).toBeGreaterThan(0);

    // A captain of the bush is recognised half as often (§23.6).
    let captainSailed = 0;
    for (let seed = 0; seed < 300; seed++) {
      const { state, rng, log } = bandit(seed);
      state.notoriety = 100;
      state.skill.bush = 120;
      state.location = 'suze-port';
      state.moneyPence = PASSAGE_FARE + pounds(30);
      buyPassage(state, rng, log);
      if (state.outlawEnd === 'california') captainSailed += 1;
    }
    expect(captainSailed).toBeGreaterThan(sailed);
  });

  it('offers the Eureka pardon to an outlaw who stood behind the slabs, once', () => {
    const { state, log } = bandit();
    makeOutlaw(state, log);
    expect(offerPardon(state)).toBe(false);
    state.stockadeDone = true;
    state.stockadeRole = 'joined';
    expect(offerPardon(state)).toBe(true);

    state.hideout = { stashPence: pounds(120), stashGold: 0, discovered: false, madeOn: 1 };
    state.pending = { kind: 'pardon' };
    takePardon(state, log, true);
    expect(state.outlawed).toBe(false);
    expect(state.legal).toBe('petty criminal');
    expect(state.outlawEnd).toBe('pardoned');
    expect(stashWorth(state)).toBe(0);
    expect(state.notoriety).toBeGreaterThan(0); // the name lingers
    expect(offerPardon(state)).toBe(false);
  });

  it('hunts a proclaimed man harder than a merely wanted one, and never in the ranges', () => {
    const wanted = fresh();
    wanted.legal = 'wanted criminal';
    wanted.location = 'fields-town';
    const outlaw = { ...wanted, outlawed: true, notoriety: 90, heat: { ...emptyHeat(), town: 100 } };
    expect(pursuitChance(wanted)).toBe(0);
    expect(pursuitChance(outlaw)).toBeGreaterThan(0.04);
    expect(pursuitChance({ ...outlaw, location: 'hideout' })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The books (§25)
// ---------------------------------------------------------------------------

describe('save migration to v3 (§25)', () => {
  it('defaults every field the dark ladder added, and bumps the version', () => {
    const old = JSON.parse(serialise(fresh(77))) as Record<string, unknown>;
    old.v = 2;
    delete old.notoriety;
    delete old.heat;
    delete old.outlawed;
    delete old.hideout;
    delete old.gang;
    delete old.skill;
    delete old.intel;
    delete old.diggersRobbed;
    delete old.bigJobsDone;
    delete old.outlawEnd;
    const back = deserialise(JSON.stringify(old)) as GameState;
    expect(back.v).toBe(SAVE_VERSION);
    expect(back.notoriety).toBe(0);
    expect(back.heat).toEqual(emptyHeat());
    expect(back.hideout).toBeNull();
    expect(back.gang).toEqual([]);
    expect(back.skill.bush).toBe(0);
    expect(back.outlawed).toBe(false);
    expect(back.intel).toBeNull();
    expect(back.diggersRobbed).toBe(0);
    expect(back.bigJobsDone).toBe(0);
    expect(back.outlawEnd).toBeNull();
  });

  it('brings a hideout, a gang and a stash back off disk intact', () => {
    const state = fresh(78);
    state.hideout = { stashPence: pounds(30), stashGold: 250, discovered: false, madeOn: 40 };
    state.gang = [
      { name: 'Long Tom Curran', joined: 50, loyalty: 0.7 },
      { name: 'Scotty Byrne', joined: 60, loyalty: 0.3 },
    ];
    state.notoriety = 63;
    state.outlawed = true;
    state.heat = { trickeys: 40, pass: 12, town: 80, camps: 3 };
    const back = deserialise(serialise(state)) as GameState;
    expect(back.hideout).toEqual(state.hideout);
    expect(back.gang).toEqual(state.gang);
    expect(back.heat).toEqual(state.heat);
    expect(back.notoriety).toBe(63);
    expect(back.outlawed).toBe(true);
  });

  it('throws out rubbish rather than taking it in', () => {
    const back = deserialise(
      JSON.stringify({
        ...JSON.parse(serialise(fresh(79))),
        hideout: { stashPence: -500, stashGold: -3 },
        gang: [null, 7, { loyalty: 12 }],
      }),
    ) as GameState;
    expect(back.hideout?.stashPence).toBe(0);
    expect(back.hideout?.stashGold).toBe(0);
    expect(back.gang.length).toBe(1);
    expect(back.gang[0].loyalty).toBeLessThanOrEqual(1);
  });
});

describe('invariants of the dark ladder (§25)', () => {
  it('a proclaimed outlaw is always a wanted criminal', () => {
    const { state, log } = bandit();
    state.legal = 'petty criminal';
    makeOutlaw(state, log);
    expect(state.legal).toBe('wanted criminal');
  });

  it('the escort pays a fortune when it comes off, and is split with the gang', () => {
    let successes = 0;
    let grossTotal = 0;
    let lo = Infinity;
    let hi = 0;
    for (let seed = 0; seed < 400; seed++) {
      const { state, rng, log } = bandit(seed);
      state.notoriety = 100;
      state.gang = [
        { name: 'a', joined: 1, loyalty: 0.5 },
        { name: 'b', joined: 1, loyalty: 0.5 },
      ];
      state.intel = { kind: 'escort', learnedOn: 1, untilDay: 30, strength: 6 };
      const before = state.moneyPence;
      robEscort(state, rng, log);
      if (state.bigJobsDone > 0) {
        successes += 1;
        const share = state.moneyPence - before;
        const gross = share * (state.gang.length + 1);
        grossTotal += gross;
        lo = Math.min(lo, gross);
        hi = Math.max(hi, gross);
        expect(share).toBeLessThan(gross);
        expect(state.outlawed).toBe(true);
      }
    }
    expect(successes).toBeGreaterThan(100);
    const mean = grossTotal / successes;
    console.log(
      `escort            n=${successes} gross mean=${formatMoney(Math.round(mean))} lo=${formatMoney(lo)} hi=${formatMoney(hi)}`,
    );
    // The McIvor haul, scaled to this economy (§25).
    expect(lo).toBeGreaterThanOrEqual(ROB_ESCORT_TAKE.lo * 0.98);
    expect(hi).toBeLessThanOrEqual(ROB_ESCORT_TAKE.hi * 1.02);
    expect(mean).toBeGreaterThan(pounds(1500));
    expect(mean).toBeLessThan(pounds(3500));
  });

  it('every victim on the road is a person with something or nothing about him', () => {
    for (const v of BAILUP_VICTIMS) {
      expect(v.weight).toBeGreaterThan(0);
      expect(v.money.lo).toBeGreaterThanOrEqual(0);
      expect(v.money.hi).toBeGreaterThanOrEqual(v.money.lo);
      expect(v.gold.hi).toBeGreaterThanOrEqual(v.gold.lo);
      expect(v.resist).toBeGreaterThanOrEqual(0);
      expect(v.resist).toBeLessThanOrEqual(1);
    }
  });
});
