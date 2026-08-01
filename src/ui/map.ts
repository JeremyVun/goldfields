import { hasWork, rewardFor } from '../engine/state';
import { isWorkedOut } from '../engine/mining';
import { formatMoney } from '../engine/money';
import type { CampId, GameState, LocationId, Route } from '../engine/types';

/**
 * The map, drawn as the sheet itself: an engraved survey chart of the kind
 * sold at a port for a shilling in 1854 — water-lined sea, hachured ranges,
 * a made road in twin lines and a bush track in dashes, place names in spaced
 * roman capitals, a reference table and a scale of miles in the margin.
 *
 * It is built here as a string of SVG so that it can be reasoned about (and
 * tested) without a document, and drawn to a fixed sheet of 1000 x 660 units
 * that the frame scales to whatever glass it finds — a map that shrinks whole
 * is a map; one that scrolls is a wall chart.
 *
 * Everything printed on it is also handed back in `words`, which is what the
 * tests read and what the frame gives a screen reader.
 */

const W = 1000;
const H = 660;

type Pt = [number, number];
type Anchor = 'start' | 'middle' | 'end';

/** A curve, kept as data so a marker can be walked along it. */
interface Curve {
  from: Pt;
  segs: Array<{ c1: Pt; c2: Pt; to: Pt }>;
}

function d(curve: Curve): string {
  const n = (p: Pt) => `${p[0]},${p[1]}`;
  return (
    `M ${n(curve.from)} ` +
    curve.segs.map((s) => `C ${n(s.c1)} ${n(s.c2)} ${n(s.to)}`).join(' ')
  );
}

/** A point some fraction of the way along a curve; segments count as equal. */
function pointAt(curve: Curve, t: number): Pt {
  const clamped = Math.max(0, Math.min(1, t));
  const span = 1 / curve.segs.length;
  const i = Math.min(curve.segs.length - 1, Math.floor(clamped / span));
  const u = (clamped - i * span) / span;
  const p0 = i === 0 ? curve.from : curve.segs[i - 1].to;
  const { c1, c2, to } = curve.segs[i];
  const v = 1 - u;
  const at = (a: number, b: number, c: number, e: number) =>
    v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * e;
  return [at(p0[0], c1[0], c2[0], to[0]), at(p0[1], c1[1], c2[1], to[1])];
}

// ---------------------------------------------------------------------------
// The country
// ---------------------------------------------------------------------------

/** The coast, drawn from the north-west corner down to the south, sea to the west. */
const COAST: Curve = {
  from: [264, 16],
  segs: [
    { c1: [240, 76], c2: [220, 124], to: [206, 180] },
    { c1: [194, 228], c2: [186, 262], to: [206, 290] },
    { c1: [232, 326], c2: [282, 318], to: [300, 344] },
    { c1: [310, 360], c2: [296, 378], to: [268, 384] },
    { c1: [240, 390], c2: [216, 404], to: [206, 432] },
    { c1: [194, 468], c2: [196, 506], to: [210, 548] },
    { c1: [222, 584], c2: [234, 614], to: [244, 644] },
  ],
};

/** Slate River, down out of the north-east and away to the south. */
const RIVER: Curve = {
  from: [792, 16],
  segs: [
    { c1: [760, 70], c2: [716, 110], to: [690, 160] },
    { c1: [664, 210], c2: [630, 232], to: [604, 258] },
    { c1: [580, 284], c2: [568, 320], to: [562, 362] },
    { c1: [554, 412], c2: [520, 452], to: [486, 494] },
    { c1: [452, 536], c2: [430, 580], to: [418, 644] },
  ],
};

/** The creek that comes down out of the ranges through the gully. */
const CREEK: Curve = {
  from: [900, 462],
  segs: [
    { c1: [844, 468], c2: [796, 466], to: [752, 462] },
    { c1: [700, 448], c2: [640, 412], to: [592, 386] },
    { c1: [580, 380], c2: [570, 374], to: [562, 370] },
  ],
};

/** The two roads inland, each drawn whole from the port so a traveller can be put on it. */
const MERCERS: Curve = {
  from: [322, 352],
  segs: [
    { c1: [352, 344], c2: [374, 332], to: [392, 318] },
    { c1: [424, 272], c2: [470, 214], to: [520, 204] },
    { c1: [548, 198], c2: [566, 222], to: [572, 250] },
  ],
};

const RAZORBACK: Curve = {
  from: [322, 352],
  segs: [
    { c1: [352, 344], c2: [374, 332], to: [392, 318] },
    { c1: [430, 330], c2: [466, 356], to: [506, 346] },
    { c1: [538, 338], c2: [556, 306], to: [566, 282] },
  ],
};

/** The tracks out of Slateford to the diggings. */
const TRACKS: Record<CampId, Curve> = {
  'damp-camp': {
    from: [556, 292],
    segs: [
      { c1: [540, 356], c2: [508, 434], to: [462, 486] },
      { c1: [458, 492], c2: [454, 500], to: [452, 506] },
    ],
  },
  'snakey-gully': {
    from: [576, 284],
    segs: [
      { c1: [636, 324], c2: [706, 398], to: [740, 448] },
      { c1: [744, 454], c2: [748, 458], to: [752, 462] },
    ],
  },
  'deep-mountains': {
    from: [574, 258],
    segs: [
      { c1: [640, 228], c2: [706, 220], to: [762, 236] },
      { c1: [774, 240], c2: [784, 242], to: [794, 244] },
    ],
  },
  'secret-mine': {
    from: [806, 268],
    segs: [
      { c1: [866, 306], c2: [910, 366], to: [918, 420] },
      { c1: [919, 424], c2: [920, 427], to: [920, 430] },
    ],
  },
};

/** The trail the player made himself, off the end of the surveyed country. */
const HIDEOUT_TRAIL: Curve = {
  from: [800, 320],
  segs: [
    { c1: [836, 400], c2: [858, 488], to: [864, 546] },
    { c1: [866, 554], c2: [868, 560], to: [870, 566] },
  ],
};

/** The razorback the second road climbs over, and the ridges of the reef country. */
const RIDGES: Pt[][] = [
  [
    [444, 292],
    [464, 338],
    [482, 386],
    [494, 424],
  ],
  [
    [746, 112],
    [784, 176],
    [820, 248],
    [852, 330],
    [878, 414],
  ],
  [
    [710, 192],
    [742, 254],
    [768, 320],
    [786, 384],
  ],
];

interface Place {
  /** Where the symbol is drawn. */
  x: number;
  y: number;
  /** The engraved name, and where it is set. */
  label: string;
  lx: number;
  ly: number;
  anchor: Anchor;
  rot?: number;
  /** Where the hand's own marks are written. */
  nx: number;
  ny: number;
  nAnchor: Anchor;
  /** Where the star sits when the player is standing there. */
  sx: number;
  sy: number;
}

const PLACES: Record<Exclude<LocationId, 'on-road'>, Place> = {
  'suze-port': {
    x: 330, y: 356,
    label: 'PORT GANNET', lx: 302, ly: 406, anchor: 'start',
    nx: 302, ny: 426, nAnchor: 'start',
    sx: 352, sy: 334,
  },
  'fields-town': {
    x: 566, y: 270,
    label: 'SLATEFORD', lx: 542, ly: 246, anchor: 'end',
    nx: 542, ny: 226, nAnchor: 'end',
    sx: 540, sy: 292,
  },
  'damp-camp': {
    x: 452, y: 506,
    label: 'REEDBANK CAMP', lx: 422, ly: 500, anchor: 'end',
    nx: 422, ny: 522, nAnchor: 'end',
    sx: 452, sy: 478,
  },
  'snakey-gully': {
    x: 752, y: 462,
    label: 'COPPERHEAD GULLY', lx: 752, ly: 512, anchor: 'middle',
    nx: 752, ny: 534, nAnchor: 'middle',
    sx: 724, sy: 444,
  },
  'deep-mountains': {
    // The range carries its own name along its length, as an engraver would set it.
    x: 794, y: 244,
    label: 'BLACKCAP RANGES', lx: 844, ly: 234, anchor: 'middle', rot: 65,
    nx: 780, ny: 194, nAnchor: 'middle',
    sx: 766, sy: 226,
  },
  'secret-mine': {
    x: 920, y: 430,
    label: "WIDOW'S REEF", lx: 900, ly: 408, anchor: 'end',
    nx: 900, ny: 388, nAnchor: 'end',
    sx: 894, sy: 446,
  },
  // No surveyor has been out there, and this sheet only shows the place once
  // there is one: a trail in a private hand, and no capitals to it.
  hideout: {
    x: 872, y: 570,
    label: 'Split Rock Camp', lx: 850, ly: 566, anchor: 'end',
    nx: 850, ny: 590, nAnchor: 'end',
    sx: 872, sy: 542,
  },
};

/** What is written along each track, in the printed hand: how far it is. */
const TRACK_DISTANCE: Record<CampId, { text: string; x: number; y: number; rot: number }> = {
  'damp-camp': { text: 'a day', x: 552, y: 378, rot: 72 },
  'snakey-gully': { text: 'a day', x: 714, y: 380, rot: 50 },
  'deep-mountains': { text: 'two days', x: 672, y: 212, rot: -10 },
  'secret-mine': { text: 'five days out', x: 934, y: 344, rot: 70 },
};

// ---------------------------------------------------------------------------
// Drawing the sheet
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The sheet under the pen: markup as it is laid down, and every word of it. */
class Sheet {
  readonly parts: string[] = [];
  readonly words: string[] = [];

  add(markup: string): void {
    this.parts.push(markup);
  }

  path(dAttr: string, cls: string, extra = ''): void {
    this.add(`<path class="${cls}" d="${dAttr}"${extra ? ' ' + extra : ''}/>`);
  }

  line(a: Pt, b: Pt, cls: string): void {
    this.path(`M ${r1(a[0])},${r1(a[1])} L ${r1(b[0])},${r1(b[1])}`, cls);
  }

  text(
    x: number,
    y: number,
    s: string,
    cls: string,
    opts: { anchor?: Anchor; rot?: number } = {},
  ): void {
    if (!s) return;
    this.words.push(s);
    const anchor = opts.anchor ?? 'start';
    const rot = opts.rot ? ` transform="rotate(${opts.rot} ${r1(x)} ${r1(y)})"` : '';
    this.add(
      `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}"${rot}>${esc(s)}</text>`,
    );
  }
}

/**
 * Hachures: the short tapered strokes an engraver rules down the fall of a
 * range. Struck at right angles to the ridge, longer at the crest's steep
 * side, and irregular enough not to look ruled by a machine.
 */
function hachure(sheet: Sheet, ridge: Pt[], side: 1 | -1, step = 9, len = 15): void {
  let n = 0;
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x0, y0] = ridge[i];
    const [x1, y1] = ridge[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const span = Math.hypot(dx, dy);
    const count = Math.max(1, Math.round(span / step));
    for (let k = 0; k < count; k++) {
      const t = k / count;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      // Both sides of the crest, the lee side kept shorter.
      const nx = (-dy / span) * side;
      const ny = (dx / span) * side;
      const wobble = 0.55 + 0.45 * (((n * 37) % 11) / 10);
      const l = len * wobble;
      sheet.line([px, py], [px + nx * l, py + ny * l], 'gf-c-hachure');
      if (n % 2 === 0) {
        sheet.line([px, py], [px - nx * l * 0.45, py - ny * l * 0.45], 'gf-c-hachure');
      }
      n++;
    }
  }
}

/** A five-pointed star, in the hand of a man marking where he stands. */
function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.4 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${r1(cx + rad * Math.cos(a))},${r1(cy + rad * Math.sin(a))}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/** A township: a few blocks of building, ruled square as the plan-makers draw them. */
function township(sheet: Sheet, x: number, y: number, big: boolean, scale = 1): void {
  const blocks: Array<[number, number, number, number]> = big
    ? [
        [-16, -12, 12, 9],
        [-1, -13, 15, 10],
        [-18, 1, 10, 8],
        [-5, 1, 13, 9],
        [11, 3, 8, 7],
      ]
    : [
        [-12, -9, 10, 8],
        [1, -10, 11, 8],
        [-8, 2, 12, 8],
      ];
  for (const [bx, by, bw, bh] of blocks) {
    sheet.add(
      `<rect class="gf-c-block" x="${r1(x + bx * scale)}" y="${r1(y + by * scale)}" ` +
        `width="${r1(bw * scale)}" height="${r1(bh * scale)}"/>`,
    );
  }
  if (big) {
    // A church, since a place with a court and a bank will have one.
    sheet.line([x + 5, y - 22], [x + 5, y - 13], 'gf-c-ink');
    sheet.line([x + 1, y - 18], [x + 9, y - 18], 'gf-c-ink');
  }
}

/** Diggings: canvas, as they are shown on every sheet of the period. */
function tents(sheet: Sheet, x: number, y: number, scale = 1): void {
  const at: Pt[] = [
    [-13, 4],
    [1, 7],
    [11, -2],
  ];
  const s = 7.5 * scale;
  for (const [ox, oy] of at) {
    const cx = x + ox * scale;
    const cy = y + oy * scale;
    sheet.path(
      `M ${r1(cx - s)},${r1(cy + s * 0.7)} L ${r1(cx)},${r1(cy - s)} L ${r1(cx + s)},${r1(cy + s * 0.7)} Z`,
      'gf-c-tent',
    );
  }
}

/** A poppet head over a shaft: the mark of reef country, where the gold is deep. */
function poppet(sheet: Sheet, x: number, y: number): void {
  sheet.path(`M ${x - 10},${y + 8} L ${x},${y - 14} L ${x + 10},${y + 8}`, 'gf-c-ink');
  sheet.line([x - 6, y - 1], [x + 6, y - 1], 'gf-c-ink');
  sheet.line([x - 14, y + 8], [x + 14, y + 8], 'gf-c-ink');
  sheet.add(`<circle class="gf-c-fill" cx="${x}" cy="${y - 16}" r="2.6"/>`);
}

/** Reeds on a wet flat. */
function reeds(sheet: Sheet, spots: Pt[]): void {
  for (const [x, y] of spots) {
    sheet.line([x - 7, y], [x + 7, y], 'gf-c-thin');
    sheet.line([x - 4, y], [x - 5, y - 6], 'gf-c-thin');
    sheet.line([x, y], [x, y - 8], 'gf-c-thin');
    sheet.line([x + 4, y], [x + 5, y - 6], 'gf-c-thin');
  }
}

/** Scrub: the engraver's shorthand for country with nothing else in it. */
function scrub(sheet: Sheet, spots: Pt[]): void {
  for (const [x, y] of spots) {
    sheet.path(`M ${x - 5},${y} Q ${x - 2},${y - 7} ${x + 1},${y}`, 'gf-c-thin');
    sheet.path(`M ${x + 1},${y} Q ${x + 4},${y - 5} ${x + 7},${y}`, 'gf-c-thin');
  }
}

/** Where a track takes a river: two ticks across the water, and no bridge. */
function ford(sheet: Sheet, x: number, y: number, rot: number): void {
  sheet.add(`<g transform="rotate(${rot} ${x} ${y})">`);
  sheet.line([x - 7, y - 5], [x + 7, y - 5], 'gf-c-ink');
  sheet.line([x - 7, y + 5], [x + 7, y + 5], 'gf-c-ink');
  sheet.add('</g>');
}

// ---------------------------------------------------------------------------
// What the player's own hand has added to the sheet
// ---------------------------------------------------------------------------

/** Has the player any reason to know Widow's Reef is out there? */
function knowsSecretMine(state: GameState): boolean {
  return state.location === 'secret-mine' || !!state.secret?.heard;
}

/**
 * What is marked against a camp on the player's own map: a rush, his pegs, and
 * the workings of his company (§21). Kept terse; the prose below the sheet has
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
  return parts.join('; ');
}

/**
 * What is marked against a road: the place a man is lying above it, a word
 * bought of a harbourer, and how hard the district is being ridden. Same terse
 * hand as the camp notes.
 */
function roadNote(state: GameState, route: Route): string {
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
  return parts.join('; ');
}

// ---------------------------------------------------------------------------
// The margin: title, reference, scale, compass, and a notice when there is one
// ---------------------------------------------------------------------------

function cartouche(sheet: Sheet): void {
  sheet.add('<g class="gf-c-cartouche">');
  sheet.add('<rect class="gf-c-panel" x="336" y="26" width="360" height="78"/>');
  sheet.add('<rect class="gf-c-panel-inner" x="342" y="32" width="348" height="66"/>');
  sheet.text(516, 50, 'A CHART OF THE', 'gf-c-small-caps', { anchor: 'middle' });
  sheet.text(516, 74, 'SLATE RIVER GOLD FIELD', 'gf-c-title', { anchor: 'middle' });
  sheet.line([400, 82], [632, 82], 'gf-c-thin');
  sheet.text(
    516,
    94,
    "From the Surveyor-General's chart, and the diggers' own. 1854.",
    'gf-c-credit',
    { anchor: 'middle' },
  );
  sheet.add('</g>');
}

function compass(sheet: Sheet): void {
  const cx = 918;
  const cy = 82;
  sheet.add('<g class="gf-c-compass">');
  sheet.add(`<circle class="gf-c-ring" cx="${cx}" cy="${cy}" r="30"/>`);
  sheet.add(`<circle class="gf-c-ring" cx="${cx}" cy="${cy}" r="25"/>`);
  // The four points, the north one long and half-inked as an engraver draws it.
  sheet.path(`M ${cx},${cy - 34} L ${cx + 7},${cy} L ${cx},${cy + 23} L ${cx - 7},${cy} Z`, 'gf-c-ink');
  sheet.path(`M ${cx},${cy - 34} L ${cx + 7},${cy} L ${cx},${cy} Z`, 'gf-c-fill');
  sheet.path(`M ${cx - 23},${cy} L ${cx},${cy - 6} L ${cx + 23},${cy} L ${cx},${cy + 6} Z`, 'gf-c-ink');
  sheet.path(`M ${cx},${cy + 6} L ${cx + 23},${cy} L ${cx},${cy} Z`, 'gf-c-fill');
  sheet.text(cx, cy - 40, 'N', 'gf-c-compass-letter', { anchor: 'middle' });
  sheet.add('</g>');
}

function scaleBar(sheet: Sheet): void {
  // Under the title, where a printer would set it, and out of the sea's way.
  const unit = 30;
  const x = 516 - unit * 2.5;
  const y = 124;
  sheet.add('<g class="gf-c-scale">');
  sheet.text(516, 118, 'SCALE OF MILES', 'gf-c-small-caps', { anchor: 'middle' });
  for (let i = 0; i < 5; i++) {
    sheet.add(
      `<rect class="${i % 2 ? 'gf-c-fill' : 'gf-c-panel-inner'}" x="${x + i * unit}" y="${y}" width="${unit}" height="7"/>`,
    );
  }
  sheet.text(x, y + 20, '0', 'gf-c-tiny', { anchor: 'middle' });
  sheet.text(x + unit * 2, y + 20, '20', 'gf-c-tiny', { anchor: 'middle' });
  sheet.text(x + unit * 5, y + 20, '50', 'gf-c-tiny', { anchor: 'middle' });
  sheet.add('</g>');
}

/** The reference table, as every sheet of the period carries in its margin. */
function reference(sheet: Sheet, state: GameState): void {
  const x = 30;
  const y = 30;
  const w = 178;
  const rows: Array<[string, (cx: number, cy: number) => void]> = [
    ['The made road', (cx, cy) => {
      sheet.line([cx - 13, cy - 2.5], [cx + 13, cy - 2.5], 'gf-c-road');
      sheet.line([cx - 13, cy + 2.5], [cx + 13, cy + 2.5], 'gf-c-road');
    }],
    ['A bush track', (cx, cy) => sheet.line([cx - 13, cy], [cx + 13, cy], 'gf-c-track')],
    ['Township', (cx, cy) => township(sheet, cx, cy + 2, false, 0.62)],
    ['Diggings', (cx, cy) => tents(sheet, cx - 1, cy - 1, 0.62)],
    ['Reef country', (cx, cy) => {
      hachure(sheet, [[cx - 12, cy + 4], [cx + 10, cy - 4]], 1, 7, 8);
    }],
    ['Where you stand', (cx, cy) => sheet.path(starPath(cx, cy, 8), 'gf-c-here-legend')],
  ];
  const h = 32 + rows.length * 21;
  sheet.add('<g class="gf-c-reference">');
  sheet.add(`<rect class="gf-c-panel" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  sheet.add(`<rect class="gf-c-panel-inner" x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}"/>`);
  sheet.text(x + w / 2, y + 22, 'REFERENCE', 'gf-c-small-caps', { anchor: 'middle' });
  rows.forEach(([label, glyph], i) => {
    const cy = y + 42 + i * 21;
    glyph(x + 28, cy - 4);
    sheet.text(x + 50, cy, label, 'gf-c-legend');
  });
  sheet.add('</g>');
  // The unsurveyed country only wants explaining once there is any.
  if (state.hideout) {
    sheet.line([x + 14, y + h + 16], [x + 42, y + h + 16], 'gf-c-trail');
    sheet.text(x + 50, y + h + 20, 'No surveyed way', 'gf-c-legend');
  }
}

/**
 * The reward notice, pinned over the margin of the outlaw's own sheet in the
 * words the Government Gazette uses for them (§23.2).
 */
function notice(sheet: Sheet, amount: number): void {
  const x = 40;
  const y = 388;
  const w = 168;
  const h = 176;
  sheet.add(`<g class="gf-c-notice" transform="rotate(-3.5 ${x + w / 2} ${y + h / 2})">`);
  sheet.add(`<rect class="gf-c-notice-shadow" x="${x + 4}" y="${y + 5}" width="${w}" height="${h}"/>`);
  sheet.add(`<rect class="gf-c-notice-paper" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  sheet.add(`<rect class="gf-c-notice-rule" x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}"/>`);
  const mid = x + w / 2;
  sheet.text(mid, y + 36, `${formatMoney(amount)}`, 'gf-c-notice-sum', { anchor: 'middle' });
  sheet.text(mid, y + 56, 'REWARD', 'gf-c-notice-head', { anchor: 'middle' });
  sheet.line([x + 28, y + 66], [x + w - 28, y + 66], 'gf-c-thin');
  const lines = [
    'Will be paid by the',
    'Crown for such',
    'information as shall',
    'lead to the taking of',
    'the man known upon',
    'this field.',
  ];
  lines.forEach((line, i) => sheet.text(mid, y + 88 + i * 13, line, 'gf-c-notice-body', { anchor: 'middle' }));
  sheet.text(mid, y + 164, 'GOD SAVE THE QUEEN', 'gf-c-notice-foot', { anchor: 'middle' });
  // The pin.
  sheet.add(`<circle class="gf-c-pin" cx="${mid}" cy="${y + 11}" r="3.5"/>`);
  sheet.add('</g>');
}

// ---------------------------------------------------------------------------
// The whole sheet
// ---------------------------------------------------------------------------

export interface MapDrawing {
  /** The chart itself, as markup ready to be put into the document. */
  svg: string;
  /** Every word printed on the sheet, in the order the pen laid them down. */
  words: string[];
}

export function buildMap(state: GameState): MapDrawing {
  const sheet = new Sheet();
  const wanted = rewardFor(state);
  const showSecret = knowsSecretMine(state);

  // --- the sea, water-lined as the engravers did it -----------------------
  const coast = d(COAST);
  sheet.add(`<path class="gf-c-water" d="${coast} L 16,644 L 16,16 Z"/>`);
  for (const [dx, dy, cls] of [
    [-15, 4, 'gf-c-waterline'],
    [-29, 8, 'gf-c-waterline gf-c-waterline--2'],
    [-44, 12, 'gf-c-waterline gf-c-waterline--3'],
    [-60, 16, 'gf-c-waterline gf-c-waterline--4'],
  ] as Array<[number, number, string]>) {
    sheet.add(`<path class="${cls}" d="${coast}" transform="translate(${dx} ${dy})"/>`);
  }
  sheet.path(coast, 'gf-c-coast');

  // --- water, country, and the lie of the land ----------------------------
  sheet.path(d(RIVER), 'gf-c-river');
  sheet.path(d(CREEK), 'gf-c-creek');
  for (const ridge of RIDGES) hachure(sheet, ridge, 1);
  reeds(sheet, [
    [424, 496],
    [438, 534],
    [478, 546],
    [492, 490],
    [416, 524],
  ]);
  scrub(sheet, [
    [348, 232],
    [318, 178],
    [452, 186],
    [366, 116],
    [512, 168],
    [614, 200],
    [648, 508],
    [676, 578],
    [560, 596],
    [352, 452],
    [300, 546],
    [890, 158],
    [828, 616],
    [252, 618],
  ]);

  // --- the roads inland ---------------------------------------------------
  // A made road is drawn as an engraver draws one: twin lines, ruled together.
  sheet.path(d(MERCERS), 'gf-c-road gf-c-road--outer');
  sheet.path(d(MERCERS), 'gf-c-road gf-c-road--inner');
  sheet.path(
    d({ from: RAZORBACK.segs[0].to, segs: RAZORBACK.segs.slice(1) }),
    'gf-c-track gf-c-track--road',
  );
  sheet.text(468, 200, "MERCER'S TRACK", 'gf-c-road-name', { anchor: 'middle', rot: -18 });
  sheet.text(498, 324, 'RAZORBACK ROAD', 'gf-c-road-name', { anchor: 'middle', rot: -12 });
  sheet.text(396, 284, '8 days afoot', 'gf-c-note-print', { anchor: 'middle', rot: -52 });
  sheet.text(452, 374, '5 days, and hard ones', 'gf-c-note-print', { anchor: 'middle', rot: -4 });

  // The tracks to the diggings, and how far each one is.
  const camps: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];
  if (showSecret) camps.push('secret-mine');
  for (const camp of camps) {
    sheet.path(d(TRACKS[camp]), camp === 'secret-mine' ? 'gf-c-trail' : 'gf-c-track');
    const dist = TRACK_DISTANCE[camp];
    sheet.text(dist.x, dist.y, dist.text, 'gf-c-note-print', { anchor: 'middle', rot: dist.rot });
  }
  ford(sheet, 616, 244, 62);
  ford(sheet, 592, 296, 34);

  // --- the places ---------------------------------------------------------
  township(sheet, PLACES['suze-port'].x, PLACES['suze-port'].y, false);
  // The jetty, which is the whole reason for the town.
  sheet.line([310, 348], [278, 358], 'gf-c-ink');
  sheet.line([282, 352], [280, 364], 'gf-c-thin');
  township(sheet, PLACES['fields-town'].x, PLACES['fields-town'].y, true);
  tents(sheet, PLACES['damp-camp'].x, PLACES['damp-camp'].y);
  tents(sheet, PLACES['snakey-gully'].x, PLACES['snakey-gully'].y);
  poppet(sheet, PLACES['deep-mountains'].x, PLACES['deep-mountains'].y);
  if (showSecret) poppet(sheet, PLACES['secret-mine'].x, PLACES['secret-mine'].y);

  const named: Array<Exclude<LocationId, 'on-road'>> = [
    'suze-port',
    'fields-town',
    'damp-camp',
    'snakey-gully',
    'deep-mountains',
  ];
  if (showSecret) named.push('secret-mine');
  for (const id of named) {
    const p = PLACES[id];
    const cls = id === 'fields-town' || id === 'suze-port' ? 'gf-c-name gf-c-name--town' : 'gf-c-name';
    sheet.text(p.lx, p.ly, p.label, cls, { anchor: p.anchor, rot: p.rot });
  }
  sheet.text(786, 278, 'the diggings', 'gf-c-note-print', { anchor: 'middle' });
  sheet.text(330, 162, 'open forest country', 'gf-c-water-name gf-c-water-name--land', {
    anchor: 'middle',
  });
  sheet.text(690, 600, 'poor country, and no water', 'gf-c-water-name gf-c-water-name--land', {
    anchor: 'middle',
  });
  sheet.text(662, 140, 'SLATE RIVER', 'gf-c-water-name', { anchor: 'middle', rot: 46 });
  if (!wanted) {
    sheet.text(84, 480, 'SOUTHERN OCEAN', 'gf-c-water-name', { anchor: 'middle', rot: -90 });
  }
  // The river is named twice, as a long one is on any sheet: once where it
  // comes down out of the north, and once where it runs away south.
  sheet.text(452, 574, 'SLATE RIVER', 'gf-c-water-name', { anchor: 'middle', rot: 74 });

  // --- the country nobody surveyed ---------------------------------------
  if (state.hideout) {
    const h = PLACES.hideout;
    sheet.path(d(HIDEOUT_TRAIL), 'gf-c-trail');
    // A camp in a private hand: a fire and a canvas, drawn rough.
    sheet.path(`M ${h.x - 10},${h.y + 6} L ${h.x - 1},${h.y - 10} L ${h.x + 8},${h.y + 6} Z`, 'gf-c-hand-line');
    sheet.line([h.x + 12, h.y + 6], [h.x + 20, h.y - 4], 'gf-c-hand-line');
    sheet.line([h.x + 12, h.y - 4], [h.x + 20, h.y + 6], 'gf-c-hand-line');
    sheet.text(h.lx, h.ly, h.label, 'gf-c-hand gf-c-hand--place', { anchor: h.anchor });
  }

  // --- the margin ---------------------------------------------------------
  cartouche(sheet);
  compass(sheet);
  scaleBar(sheet);
  reference(sheet, state);
  sheet.text(966, 636, 'Drawn & sold at Port Gannet, price one shilling.', 'gf-c-credit', {
    anchor: 'end',
  });
  if (wanted > 0) notice(sheet, wanted);

  // --- and what the player himself has written on it ----------------------
  for (const camp of camps) {
    const note = campNote(state, camp);
    if (!note) continue;
    const p = PLACES[camp];
    sheet.text(p.nx, p.ny, note, 'gf-c-hand', { anchor: p.nAnchor, rot: -2 });
  }
  const mercersNote = roadNote(state, 'trickeys');
  if (mercersNote) sheet.text(500, 174, mercersNote, 'gf-c-hand', { anchor: 'middle', rot: -2 });
  const razorbackNote = roadNote(state, 'pass');
  if (razorbackNote) sheet.text(452, 420, razorbackNote, 'gf-c-hand', { anchor: 'middle', rot: -2 });

  const here = markerPosition(state);
  sheet.path(starPath(here[0], here[1], 15), 'gf-c-here gf-blink');

  const label = `A map of the goldfields. ${state.location === 'on-road' ? 'You are on the road.' : 'You are marked with a star.'}`;
  const svg =
    `<svg class="gf-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect class="gf-c-paper" x="0" y="0" width="${W}" height="${H}"/>` +
    `<g clip-path="url(#gf-sheet-clip)">${sheet.parts.join('')}</g>` +
    `<defs><clipPath id="gf-sheet-clip"><rect x="16" y="16" width="${W - 32}" height="${H - 32}"/></clipPath></defs>` +
    neatline() +
    `</svg>`;

  return { svg, words: sheet.words };
}

/** The neat line: the ruled border of the sheet, ticked off in degrees. */
function neatline(): string {
  const parts: string[] = [
    `<rect class="gf-c-neat-outer" x="6" y="6" width="${W - 12}" height="${H - 12}"/>`,
    `<rect class="gf-c-neat-inner" x="16" y="16" width="${W - 32}" height="${H - 32}"/>`,
  ];
  for (let x = 16 + 39; x < W - 16; x += 39) {
    parts.push(`<path class="gf-c-thin" d="M ${r1(x)},6 L ${r1(x)},16"/>`);
    parts.push(`<path class="gf-c-thin" d="M ${r1(x)},${H - 6} L ${r1(x)},${H - 16}"/>`);
  }
  for (let y = 16 + 38; y < H - 16; y += 38) {
    parts.push(`<path class="gf-c-thin" d="M 6,${r1(y)} L 16,${r1(y)}"/>`);
    parts.push(`<path class="gf-c-thin" d="M ${W - 6},${r1(y)} L ${W - 16},${r1(y)}"/>`);
  }
  return parts.join('');
}

/** The line between two places, if the sheet has one ruled, and which way along it. */
function legBetween(
  from: LocationId,
  to: LocationId,
  route: Route,
): { curve: Curve; reversed: boolean } | null {
  const joins = (a: LocationId, b: LocationId) => (from === a && to === b) || (from === b && to === a);
  if (joins('suze-port', 'fields-town')) {
    // Both roads are drawn from the port inland; a man bound for the port is
    // walking the other way along the same line.
    return { curve: route === 'pass' ? RAZORBACK : MERCERS, reversed: to === 'suze-port' };
  }
  for (const camp of ['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]) {
    if (joins('fields-town', camp)) return { curve: TRACKS[camp], reversed: to === 'fields-town' };
  }
  if (joins('deep-mountains', 'secret-mine')) {
    return { curve: TRACKS['secret-mine'], reversed: to === 'deep-mountains' };
  }
  if (from === 'hideout' || to === 'hideout') {
    return { curve: HIDEOUT_TRAIL, reversed: to !== 'hideout' };
  }
  return null;
}

function anchorOf(id: LocationId): Pt {
  const place = PLACES[id as Exclude<LocationId, 'on-road'>] ?? PLACES['fields-town'];
  return [place.sx, place.sy];
}

/** Where the star goes: on a place, or somewhere along the road between two. */
function markerPosition(state: GameState): Pt {
  const journey = state.journey;
  if (state.location === 'on-road' && journey) {
    const total = journey.daysTravelled + journey.daysLeft;
    const progress = total > 0 ? journey.daysTravelled / total : 0;
    const leg = legBetween(journey.from, journey.to, journey.route);
    if (leg) return pointAt(leg.curve, leg.reversed ? 1 - progress : progress);
    // No ruled line between these two: rule one across the country, as a man
    // walking it would have to.
    const [ax, ay] = anchorOf(journey.from);
    const [bx, by] = anchorOf(journey.to);
    return [ax + (bx - ax) * progress, ay + (by - ay) * progress];
  }
  return anchorOf(state.location);
}
