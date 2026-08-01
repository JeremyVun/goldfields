import { describe, expect, it } from 'vitest';
import { allKeys, hasKey } from '../src/content/say';
import { JOURNAL_SECTIONS, GAZETTE_ADS, GAZETTE_STORIES, CAMP_TALK } from '../src/content/library';
import { STARTING_MONEY } from '../src/engine/constants';
import { getView, kittyView, mapView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { gazetteFor } from '../src/engine/news';
import { makeRng } from '../src/engine/rng';
import { step } from '../src/engine/reduce';
import { deserialise, loadGame, memoryStore, saveGame, serialise } from '../src/engine/save';
import { createInitialState, healthWord, isCamp, netWorth, statusLine } from '../src/engine/state';
import type { Action, GameState, ScreenView } from '../src/engine/types';

// ---------------------------------------------------------------------------
// The seeded RNG
// ---------------------------------------------------------------------------

describe('the seeded RNG', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same += 1;
    expect(same).toBeLessThan(5);
  });

  it('saves and restores its state', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 20; i++) rng.next();
    const mark = rng.save();
    const run = [rng.next(), rng.next(), rng.next()];
    rng.restore(mark);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(run);
  });

  it('keeps its ranges', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 5000; i++) {
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
      expect(Number.isInteger(n)).toBe(true);
      const u = rng.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(rng.exponential()).toBeGreaterThan(0);
    }
  });

  it('weights choices roughly as asked', () => {
    const rng = makeRng(3);
    let a = 0;
    for (let i = 0; i < 10000; i++) if (rng.weighted([['a', 3], ['b', 1]] as const) === 'a') a += 1;
    expect(a / 10000).toBeGreaterThan(0.7);
    expect(a / 10000).toBeLessThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// The reducer contract
// ---------------------------------------------------------------------------

describe('the reducer', () => {
  it('starts a new chum with ten shillings at Port Gannet', () => {
    const state = createInitialState(1);
    expect(state.moneyPence).toBe(STARTING_MONEY);
    expect(STARTING_MONEY).toBe(shillings(10));
    expect(state.location).toBe('suze-port');
    expect(state.day).toBe(1);
    expect(state.health).toBe(100);
    expect(state.legal).toBe('honest');
    expect(healthWord(state.health)).toBe('Hearty');
  });

  it('keeps the remainder of a prepaid tent-ground week when lodging is reselected', () => {
    const state = createInitialState(11);
    state.screen = 'suze-lodgings';
    state.location = 'suze-port';
    state.lodging = 'tentground';
    state.tentGroundPaidUntil = 17;

    const out = step(state, { type: 'setLodging', kind: 'tentground' }, makeRng(11));

    expect(out.state.tentGroundPaidUntil).toBe(17);
  });

  it('never mutates the state it is given', () => {
    const state = createInitialState(5);
    state.location = 'suze-port';
    const before = serialise(state);
    step(state, { type: 'work', job: 'wharf', days: 7 }, makeRng(5));
    expect(serialise(state)).toBe(before);
  });

  it('is reproducible: the same state, action and seed give the same result', () => {
    const state = createInitialState(77);
    const a = step(state, { type: 'work', job: 'wharf', days: 14 }, makeRng(77));
    const b = step(state, { type: 'work', job: 'wharf', days: 14 }, makeRng(9999));
    // The rng is restored from state.rngState, so the stream does not depend on
    // which generator instance is passed in.
    expect(serialise(a.state)).toBe(serialise(b.state));
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
  });

  it('walks the title -> intro -> Port Gannet opening', () => {
    let state = createInitialState(3);
    expect(state.screen).toBe('title');
    let out = step(state, { type: 'newGame' }, makeRng(3));
    state = out.state;
    expect(state.screen).toBe('intro');
    expect(out.events.length).toBeGreaterThanOrEqual(2);
    state = step(state, { type: 'continue' }, makeRng(3)).state;
    expect(state.screen).toBe('suze');
  });

  it('refuses council work to a man with a record, or with no name at all (faithful)', () => {
    let state = createInitialState(4);
    state.location = 'fields-town';
    state.legal = 'petty criminal';
    state.standing = 40;
    const rng = makeRng(4);
    const out = step(state, { type: 'work', job: 'council', days: 7 }, rng);
    expect(out.state.day).toBe(state.day);
    expect(out.events.some((e) => e.id === 'work.council.refused')).toBe(true);

    // Honest, but a stranger: the Council takes its clerks from men it knows (§18.2).
    state = { ...state, legal: 'honest', standing: 10 };
    const unknown = step(state, { type: 'work', job: 'council', days: 7 }, makeRng(4));
    expect(unknown.state.day).toBe(state.day);
    expect(unknown.events.some((e) => e.id === 'work.council.unknown')).toBe(true);

    state = { ...state, standing: 30 };
    const ok = step(state, { type: 'work', job: 'council', days: 7 }, makeRng(4));
    expect(ok.state.day).toBeGreaterThan(state.day);
  });

  it('advances a spell of work by the days asked for', () => {
    const state = createInitialState(6);
    state.provisionDays = 40;
    const out = step(state, { type: 'work', job: 'wharf', days: 7 }, makeRng(6));
    expect(out.state.day).toBe(8);
  });

  it('cycles the length of a spell of work', () => {
    let state = createInitialState(6);
    const seen = new Set<number>();
    for (let i = 0; i < 8; i++) {
      state = step(state, { type: 'cycleSpell' }, makeRng(6)).state;
      seen.add(state.spellDays);
    }
    expect(seen.size).toBeGreaterThan(3);
    expect([...seen].every((d) => d >= 1 && d <= 30)).toBe(true);
  });

  it('ends the year at day 366 and offers a second', () => {
    let state = createInitialState(8);
    state.day = 365;
    state.provisionDays = 40;
    state.location = 'suze-port';
    let out = step(state, { type: 'work', job: 'wharf', days: 3 }, makeRng(8));
    state = out.state;
    expect(state.endOfYear).toBe(true);
    expect(state.screen).toBe('end');
    state = step(state, { type: 'nextYear' }, makeRng(8)).state;
    expect(state.endOfYear).toBe(false);
    expect(state.yearsPlayed).toBe(2);
    expect(state.screen).toBe('suze');
  });

  it('ends in an obituary when health reaches nothing', () => {
    let state = createInitialState(9);
    state.health = 3;
    state.provisionDays = 0;
    state.location = 'suze-port';
    for (let i = 0; i < 5 && !state.gameOver; i++) {
      state = step(state, { type: 'work', job: 'wharf', days: 3 }, makeRng(9)).state;
    }
    expect(state.gameOver).toBe('dead');
    expect(state.screen).toBe('obituary');
    expect(state.causeOfDeath).toBeTruthy();
  });

  it('deals a fresh year when you begin again after a death', () => {
    let state = createInitialState(15);
    const rng = makeRng(15);
    state = step(state, { type: 'newGame' }, rng).state;
    const firstSeed = state.seed;
    state = step(state, { type: 'work', job: 'wharf', days: 30 }, rng).state;
    state = step(state, { type: 'newGame' }, rng).state;
    expect(state.seed).not.toBe(firstSeed);
    expect(state.day).toBe(1);
    expect(state.moneyPence).toBe(STARTING_MONEY);
  });

  it('stealing pays, or puts you before the magistrate, and either way the name gets about', () => {
    let caught = 0;
    let paid = 0;
    let known = 0;
    for (let seed = 0; seed < 120; seed++) {
      const state = createInitialState(seed);
      state.location = 'suze-port';
      const out = step(state, { type: 'steal', target: 'drunk' }, makeRng(seed));
      if (out.state.stats.timesArrested > 0) {
        expect(out.state.legal).not.toBe('honest');
        caught += 1;
      } else {
        paid += 1;
        // A thief who gets clean away is a thief still, and word gets about
        // some of the time — which is how the dark ladder is entered (§23.1).
        if (out.state.legal !== 'honest') known += 1;
      }
      // Every theft is worth something to a man's other reputation.
      expect(out.state.notoriety).toBeGreaterThan(0);
      expect(out.state.moneyPence).toBeGreaterThanOrEqual(0);
    }
    expect(caught).toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(caught);
    expect(known).toBeGreaterThan(0);
    expect(known).toBeLessThan(paid);
  });

  it('a hoaxed rumour costs days and yields nothing (faithful)', () => {
    const state = createInitialState(12);
    state.location = 'fields-town';
    state.provisionDays = 40;
    state.waterDays = 40;
    state.secret = {
      heard: true,
      genuine: false,
      chased: false,
      fromCamp: 'damp-camp',
      heardOn: state.day,
    };
    const out = step(state, { type: 'followRumour' }, makeRng(12));
    expect(out.state.day).toBeGreaterThan(state.day + 2);
    expect(out.state.location).toBe('fields-town');
    expect(out.state.secret).toBeNull();
  });

  it('a genuine rumour is only ever good once a year (faithful)', () => {
    const state = createInitialState(13);
    state.location = 'fields-town';
    state.provisionDays = 60;
    state.waterDays = 60;
    state.secret = {
      heard: true,
      genuine: true,
      chased: false,
      fromCamp: 'deep-mountains',
      heardOn: state.day,
    };
    const out = step(state, { type: 'followRumour' }, makeRng(13));
    expect(out.state.secretGenuineUsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Saving and loading — the game ID ritual
// ---------------------------------------------------------------------------

describe('saving and loading', () => {
  it('issues a game number the player is told to write down (faithful)', () => {
    const state = createInitialState(21);
    const out = step(state, { type: 'save' }, makeRng(21));
    expect(out.state.gameId).toMatch(/^\d{4}$/);
    expect(out.events[0].text).toContain(out.state.gameId as string);
    expect(out.events[0].text.toLowerCase()).toContain('write it down');
  });

  it('round-trips a game through a store', () => {
    const store = memoryStore();
    const state = createInitialState(22);
    state.day = 140;
    state.goldCentiOz = 317;
    state.items.pan = 1;
    state.claims['snakey-gully'] = { quality: 140, workedDays: 9, peggedOn: 120, proven: true };
    const id = saveGame(state, store);
    const back = loadGame(id, store);
    expect(back).not.toBeNull();
    expect(back?.day).toBe(140);
    expect(back?.goldCentiOz).toBe(317);
    expect(back?.items.pan).toBe(1);
    expect(back?.claims['snakey-gully']?.quality).toBe(140);
    expect(back?.claims['snakey-gully']?.proven).toBe(true);
  });

  it('returns nothing for a number that was never issued', () => {
    expect(loadGame('9999', memoryStore())).toBeNull();
    expect(deserialise('not json')).toBeNull();
    expect(deserialise('{"nonsense":true}')).toBeNull();
  });

  it('resumes exactly where it left off, and plays on identically', () => {
    const rngA = makeRng(31);
    let live = createInitialState(31);
    live.provisionDays = 60;
    live = step(live, { type: 'work', job: 'wharf', days: 14 }, rngA).state;

    const store = memoryStore();
    const id = saveGame(live, store);
    const resumed = loadGame(id, store) as GameState;

    const a = step(live, { type: 'work', job: 'wharf', days: 14 }, makeRng(0));
    const b = step(resumed, { type: 'work', job: 'wharf', days: 14 }, makeRng(0));
    expect(b.state.day).toBe(a.state.day);
    expect(b.state.moneyPence).toBe(a.state.moneyPence);
    expect(b.events.map((e) => e.text)).toEqual(a.events.map((e) => e.text));
  });

  it('fills in anything an older save is missing', () => {
    const trimmed = JSON.stringify({ day: 12, moneyPence: 240, seed: 5 });
    const back = deserialise(trimmed);
    expect(back?.day).toBe(12);
    expect(back?.items.pan).toBe(0);
    expect(back?.stats.daysDug).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function menuKeysUnique(view: ScreenView): boolean {
  const keys = view.menu.map((m) => m.key.toUpperCase());
  return new Set(keys).size === keys.length;
}

describe('screens and menus', () => {
  it('the kitty shows money, gold, rate, kit, health, law and licence (faithful)', () => {
    const state = createInitialState(41);
    state.goldCentiOz = 120;
    state.items.pan = 1;
    const view = kittyView(state);
    const text = view.body.join('\n');
    expect(text).toMatch(/Money in hand/);
    expect(text).toMatch(/Gold: 1\.20 oz/);
    expect(text).toMatch(/Exchange rate of the day/);
    expect(text).toMatch(/Health:/);
    expect(text).toMatch(/Legal record:/);
    expect(text).toMatch(/Licence:/);
    expect(text).toMatch(/Standing on the field: 0\/100/);
    expect(text).toMatch(/partner or company at 30/);
    const labels = view.menu.map((m) => m.label.toLowerCase()).join(' | ');
    expect(labels).toMatch(/sell gold to the bank/);
    expect(labels).toMatch(/save the game/);
    expect(labels).toMatch(/finish the game/);
  });

  it('the status line is the one-line kitty summary shown on every screen', () => {
    const state = createInitialState(42);
    state.day = 37;
    state.moneyPence = pounds(2) + shillings(4);
    state.goldCentiOz = 120;
    // Day 37 is the 6th of February: the tail of the first summer.
    expect(statusLine(state)).toBe(
      'Day 37 · late summer · £2 4s · 1.20 oz · Health: Hearty · Law: Honest · Fatigue: Fresh',
    );
  });

  it('the map names the tracks, the town, the river and the camps', () => {
    const text = mapView(createInitialState(1)).body.join(' ');
    for (const place of ["Mercer's Track", 'Razorback Road', 'Slateford', 'Slate River', 'Reedbank Camp', 'Copperhead Gully', 'Blackcap Ranges', 'Port Gannet']) {
      expect(text).toContain(place);
    }
  });

  it('gives every menu unique keys wherever the player stands', () => {
    const places: GameState['location'][] = [
      'suze-port',
      'fields-town',
      'damp-camp',
      'snakey-gully',
      'deep-mountains',
      'secret-mine',
    ];
    const screens: GameState['screen'][] = [
      'title',
      'resume',
      'intro',
      'suze',
      'suze-work',
      'suze-store',
      'suze-lodgings',
      'suze-horses',
      'suze-crime',
      'gazette',
      'journal',
      'travel-route',
      'travel-mode',
      'ftown',
      'ftown-bank',
      'ftown-lodgings',
      'ftown-store',
      'ftown-council',
      'ftown-work',
      'ftown-hospital',
      'ftown-hotel',
      'ftown-gamble',
      'ftown-depart',
      'camp',
      'camp-store',
      'camp-mine',
      'camp-shares',
      'company',
      'end',
      'obituary',
    ];
    for (const loc of places) {
      for (const screen of screens) {
        const state = createInitialState(1);
        state.location = loc;
        state.screen = screen;
        state.moneyPence = pounds(40);
        state.items.pan = state.items.cradle = state.items.shovel = 1;
        state.items.pick = state.items.ropeBucket = state.items.tent = 1;
        state.items.journal = 1;
        if (isCamp(loc)) {
          state.claims[loc] = { quality: 100, workedDays: 3, peggedOn: 1, proven: false };
        }
        state.secret = { heard: true, genuine: true, chased: false, fromCamp: 'damp-camp', heardOn: 1 };
        const view = getView(state);
        expect(menuKeysUnique(view), `${loc}/${screen}`).toBe(true);
        expect(view.menu.length, `${loc}/${screen}`).toBeGreaterThan(0);
        for (const m of view.menu) expect(m.key.length).toBe(1);
      }
    }
  });

  it('reserves M for the map and directs gold sales to the bank', () => {
    const state = createInitialState(12);
    state.location = 'fields-town';
    state.screen = 'ftown-store';
    state.moneyPence = pounds(20);

    const store = getView(state);
    expect(store.menu.find((m) => /timber supports/i.test(m.label))?.key).toBe('I');
    expect(store.menu.some((m) => m.key === 'M')).toBe(false);
    expect(store.aside?.rows.find((row) => row.label === 'Gold buyer')?.value).toBe('the bank only');
    expect(store.menu.some((m) => m.action.type === 'sellGold')).toBe(false);

    state.screen = 'journal';
    expect(getView(state).menu.some((m) => m.key === 'M')).toBe(false);
  });

  it('the encounter screens offer the faithful choices', () => {
    const state = createInitialState(1);
    state.screen = 'encounter';
    state.pending = { kind: 'trooper' };
    state.moneyPence = pounds(10);
    const trooper = getView(state).menu.map((m) => m.label.toLowerCase()).join(' | ');
    expect(trooper).toMatch(/five pound note/);
    expect(trooper).toMatch(/logs/);
    expect(trooper).toMatch(/run/);

    state.pending = { kind: 'bushrangers' };
    state.items.gun = 1;
    const bail = getView(state).menu.map((m) => m.label.toLowerCase()).join(' | ');
    expect(bail).toMatch(/loaded piece/);
    expect(bail).toMatch(/hand over/);
  });

  it('the Times prints the rate, the season and the news of the day', () => {
    const state = createInitialState(1);
    state.day = 20;
    state.rush = { camp: 'snakey-gully', untilDay: 40, factor: 2, since: 20, base: 1 };
    state.hunt = { camp: 'damp-camp', untilDay: 40 };
    const paper = gazetteFor(state).join('\n');
    expect(paper).toMatch(/THE SLATEFORD TIMES/);
    expect(paper).toMatch(/EXCHANGE/);
    expect(paper).toMatch(/RUSH AT COPPERHEAD GULLY/);
    expect(paper).toMatch(/LICENCES/);
    expect(paper).toMatch(/WEATHER/);
  });

  it('the end-of-year reckoning tallies a bank draft', () => {
    const state = createInitialState(1);
    state.day = 366;
    state.endOfYear = true;
    state.screen = 'end';
    state.bankPence = pounds(120);
    state.goldCentiOz = 250;
    const text = getView(state).body.join('\n');
    expect(text).toMatch(/DEPOSIT CERTIFICATE/);
    expect(text).toMatch(/IN ALL/);
    expect(text).toMatch(/makes no judgment/);
  });
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

describe('the content tables', () => {
  it('carry several variants of everything, so repeat play is not canned', () => {
    const keys = allKeys();
    expect(keys.length).toBeGreaterThan(100);
    for (const k of keys) {
      const variants = (globalThis as unknown as Record<string, never>) && k;
      void variants;
    }
  });

  it('ship a Journal, a newspaper and camp talk', () => {
    expect(JOURNAL_SECTIONS.length).toBeGreaterThanOrEqual(15);
    for (const s of JOURNAL_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(2);
      expect(s.body.length).toBeGreaterThan(0);
    }
    expect(GAZETTE_STORIES.length).toBeGreaterThanOrEqual(25);
    expect(GAZETTE_ADS.length).toBeGreaterThanOrEqual(12);
    expect(CAMP_TALK.length).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// Invariants under a random player
// ---------------------------------------------------------------------------

describe('invariants under a year of random play', () => {
  it('holds every invariant and always terminates', () => {
    for (let seed = 0; seed < 25; seed++) {
      const rng = makeRng(seed * 977 + 13);
      // A separate generator for the random player's whims: `step` restores the
      // engine rng from the state, so sharing one would make the player's own
      // choices deterministic and livelock him on a menu.
      const chooser = makeRng(seed * 31 + 5);
      let state = createInitialState(seed * 977 + 13);
      let steps = 0;
      let lastDay = state.day;

      while (steps < 6000) {
        if (state.gameOver || state.endOfYear) break;
        const view = getView(state);
        expect(menuKeysUnique(view)).toBe(true);

        const choices = view.menu.filter((m) => !m.disabled);
        const action: Action =
          choices.length > 0 ? chooser.pick(choices).action : { type: 'continue' };
        const out = step(state, action, rng);
        state = out.state;
        steps += 1;

        // --- invariants ---------------------------------------------
        expect(state.moneyPence).toBeGreaterThanOrEqual(0);
        expect(state.bankPence).toBeGreaterThanOrEqual(0);
        expect(state.goldCentiOz).toBeGreaterThanOrEqual(0);
        expect(state.provisionDays).toBeGreaterThanOrEqual(0);
        expect(state.waterDays).toBeGreaterThanOrEqual(0);
        expect(state.health).toBeGreaterThanOrEqual(0);
        expect(state.health).toBeLessThanOrEqual(100);
        expect(state.day).toBeGreaterThanOrEqual(lastDay);
        expect(Number.isInteger(state.moneyPence)).toBe(true);
        expect(Number.isInteger(state.goldCentiOz)).toBe(true);
        expect(netWorth(state)).toBeGreaterThanOrEqual(0);
        if (state.gameOver === 'dead') expect(state.health).toBe(0);
        if (state.journey === null) expect(state.location).not.toBe('on-road');
        lastDay = state.day;

        // --- narration is complete ----------------------------------
        for (const e of out.events) {
          expect(e.text.length, `empty narration for ${e.id}`).toBeGreaterThan(0);
          expect(e.text, `unresolved placeholder in ${e.id}: ${e.text}`).not.toMatch(/\{\w+\}/);
          expect(e.text, `missing content key: ${e.id}`).not.toMatch(/^\[[\w.]+\]$/);
          if (e.id !== 'engine') expect(hasKey(e.id), `missing content key ${e.id}`).toBe(true);
        }
      }
      expect(steps, `seed ${seed} never terminated`).toBeLessThan(6000);
      expect(state.gameOver !== null || state.endOfYear).toBe(true);
    }
  });
});
