/**
 * The icon in the tab strip. It is the one part of the game a player sees
 * before the game has loaded and long after they have wandered off to another
 * tab, and it breaks in ways nothing else notices: a link edited to a name
 * that was never written, an icon regenerated at a size the platform will
 * quietly resample, a stray alpha channel that iOS renders as black.
 *
 * The art itself is a matter for the eye (`node scratch/favicon.mjs --proof`).
 * What is checked here is only what a machine can be sure of.
 *
 * Plain JavaScript, and deliberately: the project's TypeScript is compiled
 * with `types: ["vite/client"]` and nothing else, and reading bytes off the
 * disk is not worth pulling the whole of node's type surface in after it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

/** Every href on a <link rel="...icon..."> in the document head. */
function iconHrefs() {
  const links = html.match(/<link[^>]*rel="[^"]*icon[^"]*"[^>]*>/g) ?? [];
  return links.map((tag) => {
    const href = tag.match(/href="([^"]+)"/);
    expect(href, `icon link without an href: ${tag}`).toBeTruthy();
    return href[1];
  });
}

/** Width and height out of a PNG's IHDR. */
function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect([...bytes.subarray(0, 8)]).toEqual(signature);
  expect(bytes.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

/** The alpha byte of every pixel of an 8-bit RGBA PNG written filter-none. */
function alphas(bytes) {
  const { w, h } = pngSize(bytes);
  const parts = [];
  let at = 8;
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('latin1');
    if (type === 'IDAT') parts.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const out = [];
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    expect(raw[row], 'unfiltered scanlines expected').toBe(0);
    for (let x = 0; x < w; x++) out.push(raw[row + 1 + x * 4 + 3]);
  }
  return out;
}

describe('the icon in the tab strip', () => {
  it('links three icons and no more', () => {
    // One .ico for the browsers that read nothing else, one .svg for the rest,
    // one apple-touch-icon for a home screen. A fourth would be a wrong turn.
    expect(iconHrefs().sort()).toEqual([
      './apple-touch-icon.png',
      './favicon.ico',
      './favicon.svg',
    ]);
  });

  it('points every link at a file that is actually shipped', () => {
    // Relative hrefs, because the build is based at './' and the game is meant
    // to run from a subdirectory as happily as from a domain root.
    for (const href of iconHrefs()) {
      expect(href.startsWith('./'), `${href} is not relative`).toBe(true);
      // `public/` is copied wholesale into the build output by Vite.
      const bytes = readFileSync(join(ROOT, 'public', href.slice(2)));
      expect(bytes.length).toBeGreaterThan(0);
    }
  });

  it('carries 16, 32 and 48 inside the .ico', () => {
    const ico = readFileSync(join(ROOT, 'public', 'favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // an icon, not a cursor
    const count = ico.readUInt16LE(4);
    const sizes = [];
    for (let i = 0; i < count; i++) {
      const at = 6 + i * 16;
      const width = ico[at] === 0 ? 256 : ico[at];
      sizes.push(width);
      // Each entry is a whole PNG at its stated size — no BMP masks.
      const offset = ico.readUInt32LE(at + 12);
      const length = ico.readUInt32LE(at + 8);
      const image = ico.subarray(offset, offset + length);
      expect(pngSize(image)).toEqual({ w: width, h: width });
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('gives iOS a 180 square with nothing to see through', () => {
    const png = readFileSync(join(ROOT, 'public', 'apple-touch-icon.png'));
    // Not 192 scaled down: iOS would resample it and the pixels would blur.
    expect(pngSize(png)).toEqual({ w: 180, h: 180 });
    // iOS composites a home-screen icon on nothing at all, so a transparent
    // pixel comes out black. The tile must be opaque corner to corner.
    expect(new Set(alphas(png))).toEqual(new Set([255]));
  });

  it('lets the tab strip show through behind the nugget', () => {
    // The other half of the bargain above: the icons that sit in a tab are
    // cut out, so they take the colour of whatever browser is showing them.
    // If this ever comes back opaque, the icon has quietly grown a white box.
    const ico = readFileSync(join(ROOT, 'public', 'favicon.ico'));
    const offset = ico.readUInt32LE(6 + 12);
    const smallest = ico.subarray(offset, offset + ico.readUInt32LE(6 + 8));
    const seen = new Set(alphas(smallest));
    expect(seen.has(0), 'no transparent pixels in the 16px icon').toBe(true);
    // Cut out, not faded: alpha is all or nothing, which is what keeps the
    // edges hard when a browser scales the drawing.
    expect(seen).toEqual(new Set([0, 255]));

    const svg = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
    expect(svg).not.toContain('#efe7d3'); // no paper field painted in behind
  });

  it('draws the .svg on the same 16x16 grid as the rest', () => {
    const svg = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 16 16"');
    // Without this a browser scaling the icon up would smooth the edges of
    // every pixel and hand back a watercolour of the drawing.
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});
