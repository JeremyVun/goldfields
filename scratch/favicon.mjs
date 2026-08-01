/*
 * Favicon generator — no dependencies, no network.
 *
 * The icon is authored once as a 16x16 character grid (the size at which it
 * actually has to read) and everything else is that same grid scaled by whole
 * numbers, so the pixels stay square at every size. Run:
 *
 *   node scratch/favicon.mjs             # write public/ icons (art: free)
 *   node scratch/favicon.mjs nugget      # the same nugget in a printed block
 *   node scratch/favicon.mjs --proof     # also write proofs to scratch/shots
 *
 * The proofs are the point of the thing: an icon is judged at 16px over the
 * colour a tab strip happens to be, not at the size it was drawn.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---- palette ------------------------------------------------------------ */
/* Paper and ink are the game's own default theme; the golds are the only
   colours the printer would have paid extra for. */
const PALETTE = {
  '.': null, // transparent
  P: '#efe7d3', // paper
  K: '#201c12', // ink
  k: '#6b6350', // ink, dimmed (a printer's grey)
  G: '#e0a92b', // gold, body
  H: '#ffe45c', // gold, lit face
  S: '#8f5f14', // gold, shadowed face
};

/* ---- the art ------------------------------------------------------------ */

/**
 * Lay ink into every empty cell that touches a drawn one, diagonals included.
 * A shape with no field behind it needs this: on a pale tab strip the lit face
 * of the gold is nearly the colour of the strip, and without a keyline the
 * nugget loses its top-left edge entirely.
 */
function outline(grid) {
  const n = grid.length;
  const drawn = (x, y) =>
    x >= 0 && y >= 0 && x < n && y < n && PALETTE[grid[y][x]] !== null;
  return grid.map((row, y) =>
    [...row]
      .map((cell, x) => {
        if (PALETTE[cell] !== null) return cell;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) if (drawn(x + dx, y + dy)) return 'K';
        }
        return cell;
      })
      .join(''),
  );
}

/*
 * A nugget in a printed block. Read at 16px it is: dark frame, pale field, one
 * gold lump lit from the upper left. No thin strokes anywhere — every feature
 * is at least two pixels thick, because one-pixel detail turns to grey mush
 * the moment a browser draws this into a tab strip at 16px on a 1x display.
 */
const NUGGET = [
  'KKKKKKKKKKKKKKKK',
  'KPPPPPPPPPPPHPPK',
  'KPPPPPPPPPPHHHPK',
  'KPPPPHHHHPPPHPPK',
  'KPPPHHHHGGGPPPPK',
  'KPPHHHHGGGGPPPPK',
  'KPPHHHHGGGGGGSSK',
  'KPHHHHGGGGGGGSSK',
  'KPHHHGGGGGGGGSSK',
  'KPPHGGGGGGGGSSSK',
  'KPPGGGGGGGGSSSPK',
  'KPPPPGGGGGSSSPPK',
  'KPPPPPPSSSSSPPPK',
  'KPPPPPPPPPPPPPPK',
  'KPPPPPPPPPPPPPPK',
  'KKKKKKKKKKKKKKKK',
];

/*
 * The same nugget with the block taken away from behind it, drawn larger
 * because it no longer has to share the tile with a frame. Gold only: the ink
 * outline is put on by `outline()` below, which is what lets the thing keep
 * its edge against a white tab strip and a black one both.
 */
const NUGGET_FREE = outline([
  '................',
  '................',
  '...HHHHH........',
  '..HHHHHHGG......',
  '..HHHHHGGGG.....',
  '.HHHHHGGGGGGSS..',
  '.HHHHGGGGGGGSSS.',
  '.HHHHGGGGGGGSSS.',
  '.HHHGGGGGGGGSSS.',
  '.HHGGGGGGGGSSSS.',
  '..GGGGGGGGSSSS..',
  '..GGGGGGGSSSS...',
  '....GGGGSSSS....',
  '......SSSSS.....',
  '................',
  '................',
]);

/* A pan tilted to the light, the colour settled in the bottom of it. */
const PAN = [
  'KKKKKKKKKKKKKKKK',
  'KPPPPPPPPPPPPPPK',
  'KPPPkkkkkkkkPPPK',
  'KPkkKKKKKKKKkkPK',
  'KPkKKKKKKKKKKkPK',
  'KPkKKKKKKKKKKkPK',
  'KPkKKKKKKKKKKkPK',
  'KPkKKKHHKKKKKkPK',
  'KPPkKKHHHHKKkPPK',
  'KPPkKHHGGGGKkPPK',
  'KPPPkkGGGGkkPPPK',
  'KPPPPPkkkkPPPPPK',
  'KPPPPPPPPPPPPPPK',
  'KPPPPPPPPPPPPPPK',
  'KPPPPPPPPPPPPPPK',
  'KKKKKKKKKKKKKKKK',
];

/* ---- PNG ---------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array of w*h*4. */
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(
      raw,
      y * (w * 4 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
}

/**
 * Grid -> rgba at `scale` device pixels per art pixel, optionally with a `pad`
 * of border pixels in the frame's own ink. Padding is how an integer scale is
 * made to land on a size that is not a multiple of 16 without resampling: the
 * frame simply gets thicker, which no eye can tell from a thicker frame.
 */
function raster(grid, scale, pad = 0, bg = null) {
  const n = grid.length;
  const w = n * scale + pad * 2;
  const rgba = new Uint8Array(w * w * 4);
  const flood = (colour, from, to) => {
    const [r, g, b] = hex(colour);
    for (let y = from; y < to; y++) {
      for (let x = from; x < to; x++) {
        const i = (y * w + x) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  };
  if (pad) flood(PALETTE.K, 0, w);
  // A field behind art that was drawn with none — how the free-standing nugget
  // is given something to sit on where transparency is not allowed.
  if (bg) flood(bg, pad, w - pad);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const colour = PALETTE[grid[y][x]];
      if (!colour) continue;
      const [r, g, b] = hex(colour);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy + pad) * w + x * scale + dx + pad) * 4;
          rgba[i] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = 255;
        }
      }
    }
  }
  return { rgba, w };
}

function png(grid, scale, pad = 0, bg = null) {
  const { rgba, w } = raster(grid, scale, pad, bg);
  return encodePng(rgba, w, w);
}

/*
 * The icon over the colours a tab strip is actually likely to be: a pale one,
 * a dark one, and the muddy middle a themed browser lands on. Each band shows
 * the drawing at 12x and again at true size, because the two answer different
 * questions — whether the drawing is any good, and whether it survives.
 */
const CHROME = ['#ffffff', '#dee1e6', '#35363a', '#202124'];

function chromeSheet(grid) {
  const n = grid.length;
  const zoom = 10;
  const pad = 8;
  const cell = n * zoom + pad * 2;
  const w = cell * CHROME.length;
  const h = cell + n + pad * 2;
  const rgba = new Uint8Array(w * h * 4);
  const put = (x, y, [r, g, b]) => {
    const i = (y * w + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  };
  CHROME.forEach((bg, c) => {
    const back = hex(bg);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < cell; x++) put(c * cell + x, y, back);
    }
    for (const [scale, top] of [
      [zoom, pad],
      [1, cell + pad],
    ]) {
      const { rgba: art, w: aw } = raster(grid, scale);
      for (let y = 0; y < aw; y++) {
        for (let x = 0; x < aw; x++) {
          const i = (y * aw + x) * 4;
          if (art[i + 3] === 0) continue; // let the chrome show through
          put(c * cell + pad + x, top + y, [art[i], art[i + 1], art[i + 2]]);
        }
      }
    }
  });
  return encodePng(rgba, w, h);
}

/* ---- ICO ---------------------------------------------------------------- */

/* An .ico is a directory of images; since Vista each entry may simply be a
   whole PNG, which is what we do — no BMP masks to get wrong. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, data }, i) => {
    const at = i * 16;
    dir[at] = size >= 256 ? 0 : size;
    dir[at + 1] = size >= 256 ? 0 : size;
    dir[at + 2] = 0; // palette
    dir[at + 3] = 0;
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

/* ---- SVG ---------------------------------------------------------------- */

/* Run-length merged along each row so the file stays small and the shapes stay
   whole; shape-rendering keeps the edges hard when a browser scales it up. */
function svg(grid) {
  const n = grid.length;
  const rects = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const ch = grid[y][x];
      let run = 1;
      while (x + run < n && grid[y][x + run] === ch) run++;
      if (PALETTE[ch]) {
        rects.push(
          `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PALETTE[ch]}"/>`,
        );
      }
      x += run;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">`,
    '<title>Goldrush</title>',
    ...rects,
    '</svg>',
    '',
  ].join('\n');
}

/* ---- output ------------------------------------------------------------- */

const GRIDS = { nugget: NUGGET, free: NUGGET_FREE, pan: PAN };
const args = process.argv.slice(2);
const pick = args.find((a) => !a.startsWith('--')) ?? 'free';
const grid = GRIDS[pick];
if (!grid) throw new Error(`unknown art: ${pick}`);

if (args.includes('--proof') || args.includes('--proof-only')) {
  mkdirSync(join(ROOT, 'scratch/shots'), { recursive: true });
  for (const [name, g] of Object.entries(GRIDS)) {
    // True size, a 12x proof to judge the drawing itself, and the drawing laid
    // over the tab strips it has to hold its own against.
    writeFileSync(join(ROOT, `scratch/shots/icon-${name}-16.png`), png(g, 1));
    writeFileSync(join(ROOT, `scratch/shots/icon-${name}-proof.png`), png(g, 12));
    writeFileSync(join(ROOT, `scratch/shots/icon-${name}-chrome.png`), chromeSheet(g));
  }
  console.log('proofs -> scratch/shots/');
}

if (!args.includes('--proof-only')) {
  const pub = join(ROOT, 'public');
  mkdirSync(pub, { recursive: true });
  writeFileSync(join(pub, 'favicon.svg'), svg(grid));
  writeFileSync(
    join(pub, 'favicon.ico'),
    ico([16, 32, 48].map((size) => ({ size, data: png(grid, size / 16) }))),
  );
  // iOS wants 180 square, rounds the corners itself, and never honours
  // transparency — a see-through pixel on a home screen comes out black. So a
  // see-through drawing hands the home screen over to the printed block
  // instead, which is the same nugget with a field and a margin of its own;
  // simply flooding paper in behind the free-standing one butts its outline
  // straight up against the border. 180 being no multiple of 16, the art is
  // drawn at 11x and the last two pixels a side go to the border rather than
  // to a resampler.
  const seeThrough = grid.some((row) => [...row].some((c) => PALETTE[c] === null));
  writeFileSync(
    join(pub, 'apple-touch-icon.png'),
    png(seeThrough ? NUGGET : grid, 11, 2), // 180px
  );
  console.log(`icons (${pick}) -> public/`);
}
