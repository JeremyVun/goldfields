import { hasWork, rewardFor } from '../engine/state';
import { isWorkedOut } from '../engine/mining';
import { formatMoney } from '../engine/money';
import type { CampId, GameState, LocationId, Route } from '../engine/types';

/**
 * A chunky, hand-built ASCII/box-drawing map of the goldfields — the period
 * poster map the original game shipped with, faithfully low-fi.
 */

const WIDTH = 116;
const HEIGHT = 17;
/** Where a camp's annotation sits: the line under its label. */
const NOTE_COL = 76;

interface PlaceDef {
  row: number;
  col: number;
  label: string;
}

const PLACES: Record<Exclude<LocationId, 'on-road'>, PlaceDef> = {
  'suze-port': { row: 4, col: 2, label: '[ SUZE PORT ]' },
  'fields-town': { row: 4, col: 56, label: '[ FIELDS TOWN ]' },
  'damp-camp': { row: 9, col: 74, label: '[ DAMP CAMP ]' },
  'snakey-gully': { row: 11, col: 74, label: '[ SNAKEY GULLY ]' },
  'deep-mountains': { row: 13, col: 74, label: '[ DEEP MOUNTAINS ]' },
  'secret-mine': { row: 15, col: 74, label: '[ THE SECRET MINE ]' },
  // No printed map shows the camp in the ranges, and this one only shows it
  // once there is one — in a small hand, off the ruled country, without the
  // brackets the surveyed places are given.
  hideout: { row: 16, col: 92, label: 'your camp in the ranges' },
};

const BRANCH_ROW: Record<CampId, number> = {
  'damp-camp': 9,
  'snakey-gully': 11,
  'deep-mountains': 13,
  'secret-mine': 15,
};

type Grid = string[][];

function makeGrid(): Grid {
  return Array.from({ length: HEIGHT }, () => Array<string>(WIDTH).fill(' '));
}

function stamp(grid: Grid, row: number, col: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    const c = col + i;
    if (c >= 0 && c < WIDTH && row >= 0 && row < grid.length) grid[row][c] = text[i];
  }
}

function dots(grid: Grid, row: number, colStart: number, colEnd: number): void {
  for (let c = colStart; c <= colEnd; c += 2) stamp(grid, row, c, '.');
}

export interface MapResult {
  lines: string[];
  markerRow: number;
  markerCol: number;
}

/** Has the player any reason to know the secret mine is out there? */
function knowsSecretMine(state: GameState): boolean {
  return state.location === 'secret-mine' || !!state.secret?.heard;
}

/**
 * What is marked against a camp on the player's own map: a rush, his pegs, and
 * the workings of his company (§21). Kept terse; the prose below the map has
 * room for the names.
 */
function campNote(state: GameState, camp: CampId): string {
  const parts: string[] = [];
  if (state.rush && state.rush.camp === camp && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    parts.push('a RUSH');
  }
  const claim = state.claims[camp];
  if (claim) parts.push(isWorkedOut(claim) ? 'your pegs, worked out' : 'your pegs');
  if (state.company && camp === 'deep-mountains') parts.push('the workings');
  // What a man's subscriptions put on the ground, marked where they stand (§27).
  if (state.estate.store?.camp === camp) parts.push('your store');
  if (hasWork(state, 'waterRace', camp)) parts.push('your race');
  if (state.estate.shanty === camp) parts.push('the shanty');
  return parts.length ? `.. ${parts.join('; ')}` : '';
}

/**
 * What is marked against a road: the place a man is lying above it, a word
 * bought of a harbourer, and how hard the district is being ridden. Same terse
 * hand as the camp notes.
 */
function roadNote(state: GameState, route: Route, room: number): string {
  const parts: string[] = [];
  const pending = state.pending;
  const lurking =
    (pending?.kind === 'bailup' || pending?.kind === 'patrol') && pending.data?.route === route;
  if (lurking) parts.push('you lie above it');
  const intel = state.intel && state.intel.untilDay >= state.day ? state.intel : null;
  if (intel?.kind === 'traveller' && (intel.route ?? 'trickeys') === route) {
    parts.push('a traveller due');
  }
  if (intel?.kind === 'escort' && route === 'trickeys') parts.push('the escort due');
  const heat = state.heat[route === 'pass' ? 'pass' : 'trickeys'];
  if (heat >= 55) parts.push('the traps out');
  else if (heat >= 25 && (lurking || parts.length)) parts.push('patrols');
  if (!parts.length) return '';
  return `.. ${parts.join('; ')}`.slice(0, room);
}

/**
 * The reward notice, pinned in the margin of the outlaw's own map in the words
 * the Government Gazette uses for them (§23.2).
 */
function rewardNotice(amount: number): string[] {
  const inner = 30;
  const centre = (s: string) => {
    const pad = Math.max(0, Math.floor((inner - s.length) / 2));
    return `|${' '.repeat(pad)}${s}${' '.repeat(Math.max(0, inner - pad - s.length))}|`;
  };
  return [
    `+${'-'.repeat(inner)}+`,
    centre(`${formatMoney(amount)} REWARD`),
    centre('- - - - - - -'),
    centre('Will be paid by the Crown'),
    centre('for such information as'),
    centre('shall lead to the taking of'),
    centre('the man known on this field'),
    centre('GOD SAVE THE QUEEN'),
    `+${'-'.repeat(inner)}+`,
  ];
}

export function buildMap(state: GameState): MapResult {
  const grid = makeGrid();

  // Suze Port, on the coast.
  stamp(grid, 3, 2, '~~~~~~~~~~~~~');
  stamp(grid, 5, 2, '~~~~~~~~~~~~~');
  stamp(grid, 4, PLACES['suze-port'].col, PLACES['suze-port'].label);

  // The two roads inland, and whatever is doing on them.
  stamp(grid, 1, 30, "TRICKEY'S TRACK");
  dots(grid, 2, 16, 54);
  dots(grid, 6, 20, 50);
  stamp(grid, 7, 34, 'PASS ROAD');
  // Each road's news hangs under its name, short of the spine at column 71.
  const trickeys = roadNote(state, 'trickeys', 39);
  if (trickeys) stamp(grid, 3, 30, trickeys);
  const pass = roadNote(state, 'pass', 33);
  if (pass) stamp(grid, 8, 36, pass);

  // Fields Town, on Blue River, where the roads meet.
  stamp(grid, 4, PLACES['fields-town'].col, PLACES['fields-town'].label);
  stamp(grid, 5, 56, 'on Blue River');

  // The spine down to the camps beyond.
  for (let r = 5; r <= 14; r++) stamp(grid, r, 71, '|');
  const camps: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];
  if (knowsSecretMine(state)) camps.push('secret-mine');
  for (const camp of camps) {
    const row = BRANCH_ROW[camp];
    stamp(grid, row, 71, '+--');
    stamp(grid, row, PLACES[camp].col, PLACES[camp].label);
    const note = campNote(state, camp);
    if (note) stamp(grid, row + 1, NOTE_COL, note);
  }

  // The camp in the ranges, drawn only by the man who made it: a trail off the
  // end of the surveyed country, and no brackets round the name.
  if (state.hideout) {
    stamp(grid, 13, 93, '..');
    stamp(grid, 14, 94, '.');
    stamp(grid, 14, 98, '^ ^ ^');
    stamp(grid, 15, 93, '.');
    stamp(grid, 15, 96, '^ ^ ^ ^ ^');
    stamp(grid, 16, PLACES.hideout.col, PLACES.hideout.label);
  }

  // The notice, pinned in the margin where the sea room ends.
  const reward = rewardFor(state);
  if (reward > 0) {
    rewardNotice(reward).forEach((line, i) => stamp(grid, 8 + i, 2, line));
  }

  const { row: markerRow, col: markerCol } = markerPosition(state);
  stamp(grid, markerRow, markerCol, '*');

  return { lines: grid.map((row) => row.join('')), markerRow, markerCol };
}

function markerPosition(state: GameState): { row: number; col: number } {
  if (state.location === 'on-road' && state.journey) {
    const total = state.journey.daysTravelled + state.journey.daysLeft;
    const progress = total > 0 ? state.journey.daysTravelled / total : 0;
    const to = state.journey.to;
    if (to === 'suze-port' || to === 'fields-town') {
      const onTrickeys = state.journey.route === 'trickeys';
      const row = onTrickeys ? 2 : 6;
      const [c0, c1] = onTrickeys ? [16, 54] : [20, 50];
      return { row, col: Math.round(c0 + progress * (c1 - c0)) };
    }
    const destRow = BRANCH_ROW[to as CampId] ?? 4;
    return { row: Math.round(4 + progress * (destRow - 4)), col: 71 };
  }
  const def = PLACES[state.location as Exclude<LocationId, 'on-road'>] ?? PLACES['suze-port'];
  const col = def.col - 2 >= 0 ? def.col - 2 : def.col + def.label.length + 1;
  return { row: def.row, col };
}
