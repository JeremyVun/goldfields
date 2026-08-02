/**
 * Set type, not a torn page: one element of `ScreenView.body` is one whole
 * paragraph. Authors once hard-wrapped a paragraph across several elements,
 * and since the renderer gives every element its own <p>, the browser wrapped
 * the fragments again and left words like "tin" and "digs;" alone on a line.
 *
 * This suite walks the real screens of a dozen states and refuses any body
 * whose elements read as halves of one sentence. Deliberate shapes — blank
 * separators, indented columns, ticked requirement lists, numbered mines and
 * the dated blocks of the letters screen — are left alone.
 */

import { describe, expect, it } from 'vitest';
import { BAILUP_VICTIMS, CAMP_DEFS } from '../src/engine/constants';
import { floatCompany, hireCrew } from '../src/engine/company';
import { getView, mapView, menuView } from '../src/engine/menus';
import { pounds } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import type { CampId, GameState, PendingKind, ScreenView } from '../src/engine/types';

// ---------------------------------------------------------------------------
// What counts as a torn paragraph
// ---------------------------------------------------------------------------

/** Sentence-final punctuation, allowing for a closing quote or bracket after it. */
const ENDS_A_SENTENCE = /[.!?:…][)”"'’\]]*$/;

/** A line the engine drew rather than wrote: columns, lists, glyph charts. */
function isPreformatted(line: string): boolean {
  return /^\s/.test(line) || !/^[A-Za-z“"'£]/.test(line);
}

/** Words no paragraph ends on; a line that does was wrapped, not finished. */
const DANGLING = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'his', 'in', 'is', 'its',
  'no', 'of', 'on', 'or', 'that', 'the', 'their', 'them', 'they', 'to', 'was', 'were',
  'what', 'when', 'which', 'who', 'with', 'you', 'your',
]);

function lastWord(line: string): string {
  const words = line.trim().split(/\s+/);
  return (words[words.length - 1] ?? '').replace(/[^A-Za-z]/g, '').toLowerCase();
}

/** "Kit: a pick and a pan" — a row of the player's own ledger, not a sentence. */
function isLabelledRow(line: string): boolean {
  return /^[A-Z][^:]{0,24}: /.test(line);
}

/**
 * Every place two elements read as one torn sentence. A break is deliberate
 * when either side is drawn rather than written, or when the first element
 * closes its sentence and the second opens a new one.
 */
export function tornParagraphs(body: string[]): string[] {
  const faults: string[] = [];
  for (let i = 0; i + 1 < body.length; i++) {
    const first = body[i];
    const second = body[i + 1];
    if (!first || !second) continue;
    if (isPreformatted(first) || isPreformatted(second)) continue;
    const unfinished = !ENDS_A_SENTENCE.test(first.trim());
    if (!unfinished) continue;
    const continues = /^[a-z]/.test(second);
    if (continues || (DANGLING.has(lastWord(first)) && !isLabelledRow(first))) {
      faults.push(`…${first.slice(-48)} ⏎ ${second.slice(0, 48)}…`);
    }
  }
  return faults;
}

// ---------------------------------------------------------------------------
// States enough to reach every screen worth reading
// ---------------------------------------------------------------------------

function chum(seed = 4): GameState {
  const s = createInitialState(seed);
  s.day = 30;
  s.moneyPence = pounds(40);
  s.provisionDays = 40;
  s.licenceUntilDay = s.day + 20;
  return s;
}

function inTown(seed = 4): GameState {
  const s = chum(seed);
  s.location = 'fields-town';
  s.screen = 'ftown';
  return s;
}

function atCamp(camp: CampId = 'damp-camp', seed = 6): GameState {
  const s = chum(seed);
  s.location = camp;
  s.screen = 'camp';
  s.claims[camp] = { richnessPct: 120, workedDays: 3, peggedOn: 20, proven: true };
  return s;
}

/** A promoter with a company, a crew, and a quarter of weekly figures behind him. */
function chairman(seed = 5): GameState {
  const s = chum(seed);
  s.location = 'deep-mountains';
  s.day = 120;
  s.standing = 60;
  s.moneyPence = pounds(200);
  s.claims['deep-mountains'] = { richnessPct: 140, workedDays: 6, peggedOn: 40, proven: true };
  const rng = makeRng(seed);
  const log = new Log(rng);
  floatCompany(s, rng, log, 12);
  hireCrew(s, log);
  hireCrew(s, log);
  const c = s.company!;
  c.weekProfitPence = [-1200, 400, 9600, -800, 2400, 14400];
  c.lastWeekGoldCentiOz = 640;
  c.leases[0].plan = 'sink';
  c.crews[1] = { task: 'develop', lease: 0 };
  return s;
}

/** A man of property: deeds, works, the paper and the bench. */
function notable(seed = 9): GameState {
  const s = inTown(seed);
  s.day = 300;
  s.standing = 80;
  s.moneyPence = pounds(400);
  s.estate.shamrock = true;
  s.estate.gazetteShare = true;
  s.estate.store = { camp: 'damp-camp', policy: 'fair', openedOn: 100 };
  s.estate.works = [{ id: 'bridge', camp: undefined, day: 200 }];
  s.estate.jpSinceDay = 250;
  s.estate.nextCourtDay = s.day;
  return s;
}

/** A proclaimed man, with a camp in the ranges and men riding with him. */
function outlaw(seed = 13): GameState {
  const s = chum(seed);
  s.location = 'hideout';
  s.screen = 'hideout';
  s.outlawed = true;
  s.notoriety = 55;
  s.horse = 'brumby';
  s.skill = { ...s.skill, bush: 30 };
  s.hideout = { stashPence: pounds(90), stashCentiOz: 500, discovered: false, madeOn: 60 };
  s.gang = [{ name: 'Ginger Tom', joined: 70, loyaltyFrac: 0.8 }];
  s.intel = { kind: 'escort', learnedOn: s.day - 1, untilDay: s.day + 4, strength: 6 };
  return s;
}

/** A courtship far enough along to have a household, a ball and a post office. */
function married(seed = 21): GameState {
  const s = chum(seed);
  s.location = 'suze-port';
  s.screen = 'hearth';
  s.day = 200;
  s.standing = 60;
  s.hearth.nextBallDay = s.day + 10;
  s.hearth.intended = {
    name: 'Ellen Doyle',
    trade: 'storekeeper',
    manner: 'plain speaking',
    metOn: 100,
    metAt: 'ball',
    callsKept: 2,
    lavishGifts: 0,
    lastGiftOn: 0,
  };
  s.hearth.rung = 'courting';
  s.hearth.nextEvent = { kind: 'call', openDay: s.day + 2, closeDay: s.day + 6, announced: true };
  s.hearth.letters = [
    { day: 150, text: 'She writes that the port is quiet and the work steady.', tone: 'good', read: false },
    { day: 170, text: 'A second letter, in the same round hand, asking when you are next at the port.', tone: 'neutral', read: false },
  ];
  return s;
}

function withScreen(state: GameState, screen: ScreenView['screen']): GameState {
  return { ...state, screen };
}

function pending(state: GameState, kind: PendingKind, data?: Record<string, string | number | boolean>): GameState {
  return { ...state, screen: 'encounter', pending: { kind, data } };
}

/** Every screen this suite reads, named for the failure message. */
function screensUnderTest(): { name: string; view: ScreenView }[] {
  const out: { name: string; view: ScreenView }[] = [];
  const add = (name: string, view: ScreenView) => out.push({ name, view });
  const walk = (name: string, state: GameState, screens: ScreenView['screen'][]) => {
    for (const screen of screens) add(`${name}/${screen}`, getView(withScreen(state, screen)));
  };

  walk('port', chum(), ['title', 'resume', 'suze', 'suze-work', 'suze-store', 'suze-lodgings', 'suze-horses', 'suze-crime', 'travel-route', 'travel-mode', 'gazette', 'journal']);
  walk('town', inTown(), ['ftown', 'ftown-lodgings', 'ftown-bank', 'ftown-store', 'store-sell', 'ftown-council', 'ftown-work', 'ftown-hospital', 'ftown-hotel', 'ftown-gamble', 'ftown-twoup', 'ftown-cards', 'ftown-depart']);
  walk('camp', atCamp(), ['camp', 'camp-mine', 'camp-store', 'camp-grog']);
  walk('ranges', atCamp('deep-mountains', 8), ['camp', 'camp-mine']);

  // The same screens for a man with a house of his own and no licence to show.
  const sly = atCamp('snakey-gully', 11);
  sly.licenceUntilDay = 0;
  sly.notoriety = 40;
  sly.estate.shanty = 'snakey-gully';
  walk('shanty', sly, ['camp', 'camp-grog']);

  walk('company', chairman(), ['company', 'company-crews', 'company-ground', 'company-policy', 'company-dividend']);
  // The registrar's prospectus, before there is any company at all.
  const promoter = { ...chairman(), company: null };
  walk('registrar', promoter, ['company']);
  // And the books of a company with neither men nor ground on them.
  const bare = chairman(15);
  bare.company = { ...bare.company!, crews: [], leases: [], weekProfitPence: [] };
  walk('barecompany', bare, ['company', 'company-crews', 'company-ground']);

  walk('hearth', married(), ['hearth', 'ball', 'letters']);
  const ballNight = married(22);
  ballNight.location = 'fields-town';
  ballNight.hearth.nextBallDay = ballNight.day;
  walk('ballnight', ballNight, ['ball']);
  const mailRead = married(23);
  mailRead.hearth.letters = mailRead.hearth.letters.map((l) => ({ ...l, read: true }));
  walk('mailread', mailRead, ['letters']);

  walk('estate', notable(), ['estate', 'press', 'court', 'ftown-council', 'ftown']);
  walk('pauper', inTown(31), ['estate']);

  walk('outlaw', outlaw(), ['hideout', 'stash', 'bandit', 'bandit-roads', 'gang']);
  const inTheStreet = outlaw(14);
  inTheStreet.location = 'fields-town';
  walk('outlawintown', inTheStreet, ['bandit', 'bandit-roads']);

  const desert = chum(17);
  desert.location = 'secret-mine';
  desert.screen = 'secret-expedition';
  desert.secretExpedition = { trail: 3, daysSearched: 4, exhausted: false, nuggetFound: false, nuggetRecovered: false };
  walk('desert', desert, ['secret-expedition']);

  // Every encounter, each of which is a page of prose with two or three answers.
  const encounters: PendingKind[] = ['trooper', 'bushrangers', 'claimJumper', 'meeting', 'stockade', 'patrol', 'hideoutRaid', 'assizes', 'pardon', 'shantyRaid'];
  for (const kind of encounters) {
    const base = kind === 'hideoutRaid' ? outlaw(19) : atCamp('damp-camp', 19);
    add(`encounter/${kind}`, getView(pending(base, kind, { camp: 'damp-camp' })));
  }
  for (const victim of BAILUP_VICTIMS) {
    const road = outlaw(20);
    road.location = 'on-road';
    add(`bailup/${victim.id}`, getView(pending(road, 'bailup', { victim: victim.id, knows: true })));
    add(`bailup/${victim.id} (unknown)`, getView(pending(road, 'bailup', { victim: victim.id, knows: false })));
  }

  // The reckoning, the death notice, the player's own menu and the map.
  const veteran = chairman(25);
  veteran.day = 365;
  veteran.worthHistory = [120, 800, 2400, 9600, 4800, 14400];
  veteran.journal = [
    { day: 40, text: 'Pegged the flat at Reedbank Camp.', tone: 'good' },
    { day: 90, text: 'Robbed on the Razorback Road.', tone: 'bad' },
  ];
  add('end/reckoning', getView(withScreen(veteran, 'end')));
  const dead = outlaw(26);
  dead.day = 210;
  dead.gameOver = 'dead';
  dead.causeOfDeath = 'a cave-in at the Blackcap Ranges';
  add('end/obituary', getView(withScreen(dead, 'obituary')));
  add('menu/figures', menuView(chairman(27)));
  add('menu/map', mapView(outlaw(28)));

  return out;
}

// ---------------------------------------------------------------------------

describe('screen prose is set as paragraphs', () => {
  const screens = screensUnderTest();

  it('reads a good many screens, so the guard is worth something', () => {
    expect(screens.length).toBeGreaterThan(60);
    expect(screens.every((s) => Array.isArray(s.view.body))).toBe(true);
  });

  it('never breaks a sentence across two elements of a body', () => {
    const faults = screens.flatMap(({ name, view }) =>
      tornParagraphs(view.body).map((f) => `${name}: ${f}`),
    );
    expect(faults).toEqual([]);
  });

  it('leaves the wrapping to the browser: no line breaks inside an element', () => {
    const faults = screens
      .flatMap(({ name, view }) => view.body.map((line) => ({ name, line })))
      .filter(({ line }) => line.includes('\n'))
      .map(({ name, line }) => `${name}: ${line.slice(0, 60)}`);
    expect(faults).toEqual([]);
  });

  it('keeps the deliberate shapes: blank separators and ruled columns', () => {
    const slateford = getView(inTown()).body;
    expect(slateford).toHaveLength(1);
    expect(slateford[0]).toMatch(/^A street a mile long .* do better out of it\.$/);

    // A ticked requirement list is one line to a requirement, indented.
    const registrar = getView(withScreen({ ...chairman(), company: null }, 'company')).body;
    expect(registrar.filter((l) => /^ {2}[✓✗] /.test(l)).length).toBeGreaterThan(0);
    expect(registrar).toContain('');

    // The company's quarter is ruled off in aligned columns, three to a row.
    const books = getView(withScreen(chairman(), 'company')).body;
    expect(books.filter((l) => /^\s+[-+]/.test(l)).length).toBeGreaterThan(0);

    // The mines are numbered, with their state indented beneath each.
    const mines = getView(withScreen(chairman(), 'company-ground')).body;
    expect(mines.some((l) => /^\d+\. /.test(l))).toBe(true);
    expect(mines.some((l) => /^ {3}\S/.test(l))).toBe(true);

    // Mail keeps its date, its letter and a space between the letters.
    const mail = getView(withScreen((() => {
      const s = married(23);
      s.hearth.letters = s.hearth.letters.map((l) => ({ ...l, read: true }));
      return s;
    })(), 'letters')).body;
    expect(mail.length).toBeGreaterThanOrEqual(6);
    expect(mail.filter((l) => l === '').length).toBeGreaterThanOrEqual(2);
  });

  it('bites when a paragraph is torn in two', () => {
    const torn = [
      'A street a mile long and wide enough to turn a bullock team, lined with tin',
      'and rough-hewn wood, and beyond it nothing but tents.',
    ];
    expect(tornParagraphs(torn)).toHaveLength(1);
    // And says nothing about prose that was set whole.
    expect(tornParagraphs([torn.join(' ')])).toEqual([]);
    expect(tornParagraphs(['A rush is on at Reedbank Camp.', 'You have pegged no claim here.'])).toEqual([]);
    expect(tornParagraphs(['THE MINES', '  1. the North Star, bottomed'])).toEqual([]);
  });
});

describe('the camps read differently, and each in whole paragraphs', () => {
  it('sets every camp lead as one paragraph', () => {
    for (const camp of Object.keys(CAMP_DEFS) as CampId[]) {
      for (const day of [10, 100, 200, 300]) {
        const s = atCamp(camp, 3);
        s.day = day;
        s.licenceUntilDay = day + 10;
        const view = getView(s);
        expect(tornParagraphs(view.body), `${camp} on day ${day}`).toEqual([]);
      }
    }
  });
});
