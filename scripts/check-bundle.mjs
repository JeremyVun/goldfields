import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const assets = readdirSync(new URL('../dist/assets/', import.meta.url));
const initialJs = assets.find((name) => /^index-.*\.js$/.test(name));
const css = assets.find((name) => /^index-.*\.css$/.test(name));
if (!initialJs || !css) throw new Error('production bundle is missing its initial JS or CSS asset');

const sizes = {
  initialJsGzip: gzipSync(readFileSync(new URL(`../dist/assets/${initialJs}`, import.meta.url))).length,
  cssGzip: gzipSync(readFileSync(new URL(`../dist/assets/${css}`, import.meta.url))).length,
};
const limits = { initialJsGzip: 180_000, cssGzip: 6_000 };

for (const key of Object.keys(limits)) {
  if (sizes[key] > limits[key]) {
    throw new Error(`${key} is ${sizes[key]} bytes; budget is ${limits[key]}`);
  }
}
console.log(`bundle: initial JS ${sizes.initialJsGzip} B gzip; CSS ${sizes.cssGzip} B gzip`);
