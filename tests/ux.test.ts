/**
 * The UX pass: the chart of the year, the week's trend in the gold rate, a
 * man's papers at a glance, the annotated map and camps that read differently
 * one from another (GAME_SPEC.md §21).
 */

import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/content/say';
import {
  AFTERMATH_DAY,
  BANK_RATE_START,
  LICENCE_DAYS,
  RATE_TRAIL_DAYS,
  WORTH_SPARK_WIDTH,
} from '../src/engine/constants';
import { endDay } from '../src/engine/daily';
import {
  endView,
  getView,
  menuView,
  mapView,
  sparkline,
  worthChartLines,
} from '../src/engine/menus';
import { rateTrend, rateTrendPhrase, rateWeekAgo, walkRate } from '../src/engine/market';
import { licenceDiesMidSpell, licenceLapsedToday } from '../src/engine/mining';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { deserialise, serialise } from '../src/engine/save';
import { createInitialState, licenceStatus, netWorth, statusLine } from '../src/engine/state';
import { buildMap } from '../src/ui/map';
import { CAMPS, type CampId, type GameState } from '../src/engine/types';

function fresh(seed = 3): GameState {
  return { ...createInitialState(seed), screen: 'suze' };
}

function digger(camp: CampId, day = 40, seed = 7): GameState {
  const state = fresh(seed);
  state.day = day;
  state.location = camp;
  state.screen = 'camp';
  state.licenceUntilDay = day + 20;
  state.items = { ...state.items, pan: 1, shovel: 1, pick: 1, ropeBucket: 1 };
  return state;
}

// ---------------------------------------------------------------------------
// The chart of the year
// ---------------------------------------------------------------------------

describe('the sparkline of a year (§21)', () => {
  it('draws nothing at all from an empty year', () => {
    expect(sparkline([])).toBe('');
    expect(worthChartLines(fresh())).toEqual([]);
    // One reading is a dot, not a chart.
    expect(worthChartLines({ ...fresh(), worthHistory: [1200] })).toEqual([]);
  });

  it('draws a flat year flat, at whatever height it sat', () => {
    expect(sparkline([2400, 2400, 2400, 2400])).toBe('████');
    // A year of nothing whatever is drawn on the floor, not divided by zero.
    expect(sparkline([0, 0, 0])).toBe('▁▁▁');
  });

  it('scales a spike year to its best week', () => {
    const row = sparkline([0, 100, 800]);
    expect(row).toHaveLength(3);
    expect(row[0]).toBe('▁');
    expect(row[2]).toBe('█');
    // The middle week is an eighth of the peak, and drawn low.
    expect('▁▂'.includes(row[1])).toBe(true);
  });

  it('never draws wider than a year of Sundays, and keeps the peaks', () => {
    const long = Array.from({ length: 200 }, (_, i) => (i === 137 ? 100000 : 100));
    const row = sparkline(long);
    expect(row).toHaveLength(WORTH_SPARK_WIDTH);
    expect(row).toContain('█');
    expect(row.split('').filter((g) => g === '█')).toHaveLength(1);
  });

  it('labels the chart with what a man began, peaked and ended at', () => {
    const state = { ...fresh(), worthHistory: [120, 4800, 2400] };
    const lines = worthChartLines(state);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/SHAPE OF YOUR YEAR/);
    expect(lines[1]).toBe('▁█▅');
    expect(lines[2]).toBe('Began 10s · best week £20 · ended £10');
  });

  it('is printed on the reckoning at the year’s end', () => {
    const state = { ...fresh(), screen: 'end' as const, worthHistory: [120, 2400, 9600] };
    const body = endView(state).body.join('\n');
    expect(body).toMatch(/SHAPE OF YOUR YEAR/);
    expect(body).toMatch(/Began 10s/);
  });
});

describe('the ledger of what a man is worth (§21)', () => {
  it('takes a reading every seventh day', () => {
    const state = fresh(11);
    state.day = 5;
    const rng = makeRng(11);
    const log = new Log(rng);
    const before = state.worthHistory.length;
    for (let i = 0; i < 14; i++) endDay(state, rng, log, {});
    // Days 7 and 14 fall inside the fortnight.
    expect(state.worthHistory.length).toBe(before + 2);
  });

  it('takes a last reading when the year is out, after the dividends are in', () => {
    const state = fresh(21);
    state.day = 365;
    state.moneyPence = pounds(40);
    const out = step(state, { type: 'rest', days: 3 }, makeRng(21)).state;
    expect(out.screen).toBe('end');
    const history = out.worthHistory;
    expect(history[history.length - 1]).toBe(netWorth(out));
  });

  it('is carried through a clone and a save, and defaulted on an old one', () => {
    const state = { ...fresh(), worthHistory: [1, 2, 3], rateTrail: [900, 910] };
    const back = deserialise(serialise(state)) as GameState;
    expect(back.worthHistory).toEqual([1, 2, 3]);
    expect(back.rateTrail).toEqual([900, 910]);

    const old = JSON.parse(serialise(state)) as Record<string, unknown>;
    delete old.worthHistory;
    delete old.rateTrail;
    const migrated = deserialise(JSON.stringify(old)) as GameState;
    expect(migrated.worthHistory).toEqual([]);
    expect(migrated.rateTrail).toEqual([state.bankRatePencePerOz]);
    // A trail of rubbish is thrown out rather than charted.
    const junk = deserialise(JSON.stringify({ ...old, rateTrail: ['x', null] })) as GameState;
    expect(junk.rateTrail).toEqual([state.bankRatePencePerOz]);
  });
});

// ---------------------------------------------------------------------------
// Which way gold has been going
// ---------------------------------------------------------------------------

describe('the trend of the gold rate (§21)', () => {
  function trail(...rates: number[]): GameState {
    const state = fresh();
    state.rateTrail = rates.slice();
    state.bankRatePencePerOz = rates[rates.length - 1];
    return state;
  }

  it('keeps no more than a fortnight of the bank’s rate', () => {
    const state = fresh(5);
    const rng = makeRng(5);
    for (let i = 0; i < 40; i++) walkRate(state, rng);
    expect(state.rateTrail).toHaveLength(RATE_TRAIL_DAYS);
    expect(state.rateTrail[RATE_TRAIL_DAYS - 1]).toBe(state.bankRatePencePerOz);
  });

  it('reads the week’s movement in words, and never in arrows', () => {
    const flat = [860, 860, 860, 860, 860, 860, 860, 860];
    expect(rateTrend(trail(...flat))).toBe('steady');
    expect(rateTrend(trail(800, 810, 820, 830, 840, 850, 860, 900))).toBe('rising');
    expect(rateTrend(trail(900, 890, 880, 870, 860, 850, 840, 800))).toBe('easing');
    // A movement smaller than sixpence in the week is no movement at all.
    expect(rateTrend(trail(860, 860, 860, 860, 860, 860, 860, 863))).toBe('steady');

    for (const state of [trail(...flat), trail(800, 900), trail(900, 800)]) {
      const phrase = rateTrendPhrase(state);
      expect(phrase).toMatch(/Gold is (rising|easing|steady)/);
      expect(phrase).not.toMatch(/[↑↓%+]/);
    }
  });

  it('reads back a week, or as far back as the trail goes', () => {
    expect(rateWeekAgo(trail(800, 810, 820, 830, 840, 850, 860, 900))).toBe(800);
    expect(rateWeekAgo(trail(700, 900))).toBe(700);
    expect(rateWeekAgo({ ...fresh(), rateTrail: [] })).toBe(BANK_RATE_START);
  });

  it('is told to the player at the bank and in the Times', () => {
    const state = fresh();
    state.rateTrail = [800, 810, 820, 830, 840, 850, 860, 900];
    state.bankRatePencePerOz = 900;
    // Not in the menu: the menu is the man's own reckoning, and the price of
    // gold is the market's. It is told where gold is actually sold.
    expect(menuView(state).body.join('\n')).not.toMatch(/Gold is rising this week/);

    const bank = getView({ ...state, screen: 'ftown-bank', location: 'fields-town' });
    expect(bank.body.join('\n')).toMatch(/Gold is rising this week/);
    const port = getView({ ...state, screen: 'ftown-bank', location: 'suze-port' });
    expect(port.body.join('\n')).toMatch(/Gold is rising this week/);

    const gazette = getView({ ...state, screen: 'gazette' });
    expect(gazette.body.join('\n')).toMatch(/EXCHANGE\..*Gold is rising this week/s);
  });
});

// ---------------------------------------------------------------------------
// A man's papers at a glance
// ---------------------------------------------------------------------------

describe('the licence in the status line (§21)', () => {
  it('counts the days down at a camp, and says nothing about it in town', () => {
    const state = digger('damp-camp', 40);
    state.licenceUntilDay = 51;
    expect(licenceStatus(state)).toBe('Licence 12d');
    expect(statusLine(state)).toContain('· Licence 12d');
    expect(statusLine({ ...state, location: 'fields-town' })).not.toContain('Licence');
    expect(statusLine({ ...state, location: 'suze-port' })).not.toContain('Licence');
  });

  it('shouts about it when there is none', () => {
    const state = digger('snakey-gully', 40);
    state.licenceUntilDay = 0;
    expect(licenceStatus(state)).toBe('NO LICENCE');
    expect(statusLine(state)).toContain('· NO LICENCE');
    // The last day of a licence still counts as a day.
    expect(licenceStatus({ ...state, licenceUntilDay: 40 })).toBe('Licence 1d');
    expect(licenceStatus({ ...state, licenceUntilDay: 39 })).toBe('NO LICENCE');
  });

  it('names the miner’s right once the licence is dead', () => {
    const state = digger('damp-camp', AFTERMATH_DAY + 2);
    state.licenceUntilDay = 0;
    expect(licenceStatus(state)).toBe("No miner's right");
    state.minersRightUntilDay = state.day + 300;
    expect(licenceStatus(state)).toBe("Miner's right");
    expect(statusLine(state)).toContain("· Miner's right");
  });
});

describe('a licence that dies mid-spell (§21)', () => {
  it('warns before the pick goes in the ground', () => {
    const state = digger('damp-camp', 40);
    state.licenceUntilDay = 45;
    expect(licenceDiesMidSpell(state, 3)).toBeNull();
    const warning = licenceDiesMidSpell(state, 14) as string;
    expect(warning).toMatch(/licence dies on the 14th of February, mid-spell/);
    // A one-day spell outlives nothing, and a miner's right runs the year.
    expect(licenceDiesMidSpell(state, 1)).toBeNull();
    expect(
      licenceDiesMidSpell({ ...state, minersRightUntilDay: state.day + 300 }, 30),
    ).toBeNull();
    expect(licenceDiesMidSpell({ ...state, licenceUntilDay: 0 }, 30)).toBeNull();
  });

  it('says so again on the morning it lapses', () => {
    const state = digger('damp-camp', 40);
    expect(licenceLapsedToday({ ...state, licenceUntilDay: 39 })).toBe(true);
    expect(licenceLapsedToday({ ...state, licenceUntilDay: 40 })).toBe(false);
    expect(licenceLapsedToday({ ...state, licenceUntilDay: 38 })).toBe(false);
    expect(licenceLapsedToday({ ...state, licenceUntilDay: 39, day: AFTERMATH_DAY + 1 })).toBe(
      false,
    );
  });

  it('puts both lines to the player in the course of a spell', () => {
    const state = digger('damp-camp', 40, 12);
    state.licenceUntilDay = 42;
    state.provisionDays = 40;
    state.items = { ...state.items, pan: 1 };
    const out = step(state, { type: 'mine', method: 'pan', days: 7 }, makeRng(12));
    const text = out.events.map((e) => e.text).join('\n');
    expect(text).toMatch(/licence dies on the .* mid-spell/);
    expect(text).toMatch(/licence ran out with yesterday/);
  });

  it('says nothing of the sort when the licence outlasts the work', () => {
    const state = digger('damp-camp', 40, 13);
    state.licenceUntilDay = 40 + LICENCE_DAYS;
    state.provisionDays = 40;
    const out = step(state, { type: 'mine', method: 'pan', days: 7 }, makeRng(13));
    const text = out.events.map((e) => e.text).join('\n');
    expect(text).not.toMatch(/mid-spell/);
    expect(text).not.toMatch(/ran out with yesterday/);
  });
});

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

describe('the sheet, marked up (§21)', () => {
  it('names the country on the drawing itself, and puts the star where the player stands', () => {
    const state = digger('snakey-gully', 40);
    const { svg, words } = buildMap(state);
    // Everything a player must be able to find is engraved on the sheet, not
    // left to the prose beneath it.
    for (const place of [
      'PORT GANNET',
      'SLATEFORD',
      'REEDBANK CAMP',
      'COPPERHEAD GULLY',
      'BLACKCAP RANGES',
      "MERCER'S TRACK",
      'RAZORBACK ROAD',
      'SLATE RIVER',
    ]) {
      expect(words, place).toContain(place);
    }
    // The star is drawn last of all, at the gully the player is standing in.
    const gully = svg.slice(svg.indexOf('COPPERHEAD GULLY'));
    expect(gully).toMatch(/class="gf-c-here gf-blink"/);
    expect(svg).toMatch(/viewBox="0 0 1000 660"/);
  });

  it('keeps the sheet to one drawing, whole, with no scrolling to be done', () => {
    const { svg } = buildMap(fresh());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    // One star, and one only: a man cannot stand in two places.
    expect(svg.match(/gf-c-here gf-blink/g)?.length).toBe(1);
  });

  it('marks pegged ground, a rush, and the company’s workings in the player’s own hand', () => {
    const state = digger('deep-mountains', 200);
    state.claims['damp-camp'] = { richnessPct: 120, workedDays: 3, peggedOn: 100, proven: false };
    state.claims['snakey-gully'] = { richnessPct: 80, workedDays: 60, peggedOn: 60, proven: false };
    state.rush = { camp: 'snakey-gully', untilDay: 214, factor: 2, since: 198, base: 1 };
    state.company = {
      name: 'The Golden Hope Quartz Mining Co.',
      treasuryPence: pounds(50),
      sharesOwned: 12,
      sharesPublic: 4,
      sharesUnsold: 4,
      sharePricePence: pounds(14),
      crews: [{ task: 'mine' }],
      leases: [{
        name: 'the North Star', reefPct: 140, level: 1, faceCrewWeeks: 5, yieldNowPct: 140,
        wet: false, pump: false, timbered: false, flooded: false, progressCrewWeeks: 0, plan: null,
      }],
      weekProfitPence: [],
      lastWeekGoldCentiOz: 0,
      foundedOn: 150,
      lastDividendDay: 0,
      battery: false,
      driving: 'ordinary',
      lastWeek: null,
    };
    const written = buildMap(state).words.join('\n');
    expect(written).toMatch(/your pegs/);
    expect(written).toMatch(/your pegs, worked out/);
    expect(written).toMatch(/a RUSH/);
    expect(written).toMatch(/the workings/);

    const prose = mapView(state).body.join('\n');
    expect(prose).toMatch(/a RUSH at Copperhead Gully/);
    expect(prose).toMatch(/Your stakes are in the ground at Reedbank Camp and Copperhead Gully \(worked out\)/);
    expect(prose).toMatch(/The workings of The Golden Hope Quartz Mining Co\. lie in the Blackcap Ranges/);
    expect(prose).toMatch(/The star marks where you are: Blackcap Ranges/);
  });

  it('says plainly when a man has pegs in no ground anywhere', () => {
    expect(mapView(fresh()).body.join('\n')).toMatch(/pegs in no ground anywhere/);
  });

  it('keeps the notes beneath the sheet short enough to sit on one page with it', () => {
    // Six short lines at the very most, and none of them a paragraph: the
    // drawing is the map, and the prose is only what a man's year has added.
    const state = digger('deep-mountains', 300);
    state.claims['damp-camp'] = { richnessPct: 120, workedDays: 3, peggedOn: 100, proven: false };
    state.rush = { camp: 'snakey-gully', untilDay: 320, factor: 2, since: 298, base: 1 };
    const body = mapView(state).body;
    expect(body.length).toBeLessThanOrEqual(6);
    for (const line of body) expect(line.length, line).toBeLessThanOrEqual(110);
  });

  it('leaves Widow’s Reef off the sheet until a man has heard of it', () => {
    const quiet = fresh();
    expect(buildMap(quiet).words).not.toContain("WIDOW'S REEF");
    const told = fresh();
    told.secret = {
      heard: true, genuine: true, chased: false, fromCamp: 'deep-mountains', heardOn: 10,
    };
    expect(buildMap(told).words).toContain("WIDOW'S REEF");
  });

  it('pins the reward notice on the sheet of a man who is worth one, and nobody else', () => {
    const honest = fresh();
    expect(buildMap(honest).words).not.toContain('REWARD');
    expect(buildMap(honest).svg).not.toMatch(/gf-c-notice-paper/);

    const wanted = fresh();
    wanted.legal = 'wanted criminal';
    wanted.notoriety = 80;
    const drawn = buildMap(wanted);
    expect(drawn.words).toContain('REWARD');
    expect(drawn.words).toContain('£200');
    expect(drawn.words).toContain('GOD SAVE THE QUEEN');
    expect(drawn.svg).toMatch(/gf-c-notice-paper/);
  });

  it('draws the country nobody surveyed only once the player has made it', () => {
    const straight = fresh();
    expect(straight.hideout).toBeFalsy();
    expect(buildMap(straight).words).not.toContain('Split Rock Camp');
    expect(mapView(straight).body.join('\n')).not.toMatch(/Split Rock/);
  });
});

// ---------------------------------------------------------------------------
// Camps that read differently
// ---------------------------------------------------------------------------

describe('camps that read like different places (§21)', () => {
  it('has period prose of its own for every camp, and for the seasons that matter', () => {
    for (const camp of CAMPS) expect(hasKey(`camp.${camp}.lead`), camp).toBe(true);
    expect(hasKey('camp.damp-camp.winter')).toBe(true);
    expect(hasKey('camp.snakey-gully.summer')).toBe(true);
    expect(hasKey('camp.deep-mountains.winter')).toBe(true);
    expect(hasKey('camp.secret-mine.summer')).toBe(true);
  });

  it('leads with what is distinct, and surfaces what can be done about it', () => {
    const damp = getView(digger('damp-camp', 190)).body.join('\n'); // winter
    expect(damp).toMatch(/creek|flat/i);
    expect(damp).toMatch(/flood|rain|swamp|water/i);

    const snakey = getView(digger('snakey-gully', 40)).body.join('\n');
    expect(snakey).toMatch(/din|noise|noisiest|rowdy|crowded/i);
    expect(snakey).toMatch(/puddling machine/);

    const deep = getView(digger('deep-mountains', 40)).body.join('\n');
    expect(deep).toMatch(/reef|quartz|shaft/i);
    expect(deep).toMatch(/company office|office of/i);

    const secret = getView(digger('secret-mine', 40)).body.join('\n');
    expect(secret).toMatch(/desert|sand/i);
    expect(secret).toMatch(/no water within forty miles/);
  });

  it('reads differently at every camp, so moving feels like arriving', () => {
    const bodies = CAMPS.map((c) => getView(digger(c, 40)).body.join('\n'));
    expect(new Set(bodies).size).toBe(CAMPS.length);
  });

  it('leads with the rush when there is one', () => {
    const state = digger('snakey-gully', 200);
    state.rush = { camp: 'snakey-gully', untilDay: 210, factor: 2.2, since: 196, base: 1 };
    expect(getView(state).body[0]).toMatch(/A RUSH is on here/);
  });

  it('tells the chairman his own office is at the end of the flat', () => {
    const state = digger('deep-mountains', 200);
    state.company = {
      name: 'The Try Again Consols',
      treasuryPence: shillings(40),
      sharesOwned: 12,
      sharesPublic: 0,
      sharesUnsold: 8,
      sharePricePence: pounds(10),
      crews: [],
      leases: [],
      weekProfitPence: [],
      lastWeekGoldCentiOz: 0,
      foundedOn: 150,
      lastDividendDay: 0,
      battery: false,
      driving: 'ordinary',
      lastWeek: null,
    };
    expect(getView(state).body.join('\n')).toMatch(/office of The Try Again Consols/);
  });
});

// ---------------------------------------------------------------------------
// The season, which decides half of what a day's work is worth
// ---------------------------------------------------------------------------

describe('the season is visible without being looked for', () => {
  it('stands in the status line beside the day, all year', () => {
    for (const [day, said] of [
      [1, 'high summer'],
      [37, 'late summer'],
      [190, 'deep winter'],
      [300, 'spring'],
    ] as const) {
      expect(statusLine({ ...fresh(), day })).toContain(`Day ${day} · ${said} ·`);
    }
  });

  it('is said on the row of every method it changes, and on no other', () => {
    const notes = (day: number) => {
      const state = digger('snakey-gully', day);
      state.items = { ...state.items, cradle: 1 };
      state.screen = 'camp-mine';
      const rows = getView(state).menu;
      const of = (label: string) => rows.find((r) => r.label.startsWith(label))?.note ?? '';
      return { pan: of('Pan'), cradle: of('Work the cradle'), puddle: of('Rent'), fossick: of('Fossick') };
    };

    // February: the creeks are down and the machine is short of water.
    const summer = notes(40);
    expect(summer.pan).toMatch(/creeks are low/);
    expect(summer.cradle).toMatch(/creeks are low/);
    expect(summer.puddle).toMatch(/scarcely water/);

    // July: the same three rows, and the opposite news.
    const winter = notes(190);
    expect(winter.pan).toMatch(/running well/);
    expect(winter.puddle).toMatch(/winter water/);

    // Fossicking over a mullock heap cares nothing for the weather, and says so
    // by saying nothing.
    expect(summer.fossick).toBe('');
    expect(winter.fossick).toBe('');
  });

  it('announces its own turning, four times in a year and no more', () => {
    const state = fresh(11);
    const rng = makeRng(11);
    const turned: string[] = [];
    for (let i = 0; i < 365; i++) {
      const log = new Log(rng);
      // Kept days: fed, housed and doctored, so that nothing but the calendar
      // can end this run early.
      endDay(state, rng, log, { kept: true });
      for (const e of log.events) if (e.id.startsWith('season.turn.')) turned.push(e.id);
    }
    expect(turned).toEqual([
      'season.turn.autumn',
      'season.turn.winter',
      'season.turn.spring',
      'season.turn.summer',
    ]);
  });

  it('has prose for every turning', () => {
    for (const s of ['summer', 'autumn', 'winter', 'spring']) {
      expect(hasKey(`season.turn.${s}`)).toBe(true);
    }
  });
});
