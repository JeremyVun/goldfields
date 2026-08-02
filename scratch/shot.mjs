/**
 * One-stop scenario screenshot tool: build a game state, land on any screen,
 * and shoot it at any set of responsive viewports. Replaces the one-off
 * harnesses agents keep writing.
 *
 *   node scratch/shot.mjs [scenario.mjs] [--out DIR] [--port N] [--vp LIST]
 *                         [--screen NAME] [--keys LIST] [--seed N] [--full]
 *
 * Needs the dev server running (npm run dev) and playwright installed
 * (`npm i -D playwright --no-save`, then `npx playwright install chromium`).
 *
 * --vp is a comma list of preset names (below), `all`, or custom specs like
 * `900x600`, `390x844@3+touch`. --keys are keyboard presses made after landing
 * (`Escape,m` opens the map; `x9:Space` repeats a key). --screen forces the
 * saved state's screen so you land there directly on resume — note it does NOT
 * move the player, so screens whose prose depends on location need
 * d.state.location set (or real navigation) in a scenario.
 *
 * A scenario module may export:
 *   setup(d, engine)  — REQUIRED to be self-contained (it is stringified and
 *                       run inside the browser; no imports, no closures).
 *                       `d` is a driver: d.state (mutable GameState),
 *                       d.begin() → new game at Suze Port, d.press('2'),
 *                       d.pressLabel('store'), d.dispatch(action), d.view().
 *                       Return a GameState or just mutate d.state.
 *   seed, screen, keys, viewports — optional defaults, CLI flags win.
 *   stops = [{ name, keys }]     — a tour: after landing, each stop presses
 *                       its keys then shoots <viewport>-<name>.png, so one run
 *                       photographs a whole journey at every viewport.
 *
 * --theme paper|blue|noir shoots under a different theme (default paper).
 *
 * With no scenario at all it starts a fresh game at Suze Port, so
 * `node scratch/shot.mjs --screen ftown-bank --vp all` is often enough.
 * The tool prints the `.gf-title` heading per shot so you can confirm where
 * you landed, and fails loudly if the built state does not survive the save
 * validator (src/engine/save.ts deserialise).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PRESETS = {
  'phone-se': { width: 375, height: 667, dsf: 2, touch: true },
  'phone-tall': { width: 393, height: 852, dsf: 3, touch: true },
  'phone-land': { width: 852, height: 393, dsf: 3, touch: true },
  tablet: { width: 768, height: 1024, dsf: 2, touch: true },
  'tablet-land': { width: 1024, height: 768, dsf: 2, touch: true },
  desktop: { width: 1280, height: 800, dsf: 1, touch: false },
  'desktop-wide': { width: 1440, height: 900, dsf: 1, touch: false },
};

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
const flags = {};
let scenarioPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : args[++i];
  else scenarioPath = args[i];
}

const scenario = scenarioPath ? await import(pathToFileURL(scenarioPath).href) : {};
const seed = Number(flags.seed ?? scenario.seed ?? 1);
const screen = flags.screen ?? scenario.screen ?? null;
const port = flags.port ?? '5173';
const out = flags.out ?? 'scratch/shots-out';
const keys = flags.keys ? flags.keys.split(',') : scenario.keys ?? [];
const setupSrc = scenario.setup ? scenario.setup.toString() : null;

function parseViewport(name) {
  if (PRESETS[name]) return { name, ...PRESETS[name] };
  const m = /^(\d+)x(\d+)(?:@(\d+))?(\+touch)?$/.exec(name);
  if (!m) throw new Error(`unknown viewport "${name}" — presets: ${Object.keys(PRESETS).join(', ')}, or WxH[@dsf][+touch]`);
  return { name, width: Number(m[1]), height: Number(m[2]), dsf: Number(m[3] ?? 1), touch: !!m[4] };
}
const vpArg = flags.vp ?? (Array.isArray(scenario.viewports) ? scenario.viewports.join(',') : 'desktop');
const viewports = (vpArg === 'all' ? Object.keys(PRESETS) : vpArg.split(',')).map(parseViewport);

/**
 * Run in the page after each shot: the faults a screenshot is easy to skim
 * past. Chiefly overprinting — two menu rows sharing the same paper, or a row
 * whose words are drawn outside the box that is supposed to hold them, which
 * is what a squeezed grid track or a capped multicol does and what no amount
 * of looking at a thumbnail reliably catches.
 */
function auditLayout() {
  const faults = [];
  // With an overlay up, the frame beneath it still holds its rows; only the
  // overlay's own are being looked at.
  const scope = document.querySelector('.gf-overlay-panel') ?? document;
  const rows = [...scope.querySelectorAll('.gf-menu-item, .gf-aside-row')];
  const boxes = rows.map((r) => ({ t: r.textContent.trim().slice(0, 22), r: r.getBoundingClientRect() }));
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r;
      const b = boxes[j].r;
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
        hits.push(`“${boxes[i].t}” × “${boxes[j].t}”`);
      }
    }
  }
  if (hits.length) faults.push(`${hits.length} overlapping rows: ${hits.slice(0, 3).join(', ')}`);
  const spilling = rows
    .filter((r) => r.scrollHeight > r.clientHeight + 1 || r.scrollWidth > r.clientWidth + 1)
    .map((r) => `“${r.textContent.trim().slice(0, 22)}”`);
  if (spilling.length) faults.push(`${spilling.length} rows spill their box: ${spilling.slice(0, 3).join(', ')}`);
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) faults.push('the page scrolls sideways');
  const tap = rows
    .filter((r) => r.classList.contains('gf-menu-item'))
    .map((r) => r.getBoundingClientRect().height);
  if (matchMedia('(pointer: coarse)').matches && tap.length && Math.min(...tap) < 43) {
    faults.push(`a row is only ${Math.round(Math.min(...tap))}px under a finger`);
  }
  return faults;
}

const URL = `http://localhost:${port}/`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

// ------------------------------------------- build the state in the browser
// The dev server transpiles the engine, so the scenario runs against the real
// modules with no node-side TS loader. The finished state is written through
// saveGame, then the localStorage entries are carried into each viewport's
// fresh context.
const buildPage = await (await browser.newContext()).newPage();
buildPage.on('console', (m) => m.type() === 'error' && console.log(`[build] ${m.text()}`));
await buildPage.goto(URL, { waitUntil: 'networkidle' });
const saved = await buildPage.evaluate(async ({ src, seed, screen }) => {
  const engine = await import('/src/engine/index.ts');
  const rng = engine.makeRng(seed);
  let state = engine.createInitialState(seed);
  const d = {
    engine,
    get state() { return state; },
    set state(s) { state = s; },
    view: () => engine.getView(state),
    dispatch(a) {
      const r = engine.step(state, a, rng);
      state = r.state;
      return r.events.map((e) => e.text);
    },
    press(key) {
      const v = d.view();
      const m = v.menu.find((x) => x.key.toUpperCase() === String(key).toUpperCase());
      if (!m) throw new Error(`key "${key}" not on ${v.screen}; have ${v.menu.map((x) => x.key).join(',')}`);
      if (m.disabled) throw new Error(`key "${key}" (${m.label}) disabled on ${v.screen}`);
      return d.dispatch(m.action);
    },
    pressLabel(needle) {
      const v = d.view();
      const m = v.menu.find((x) => x.label.toLowerCase().includes(String(needle).toLowerCase()));
      if (!m) throw new Error(`nothing matching "${needle}" on ${v.screen}: ${v.menu.map((x) => x.label).join(' | ')}`);
      if (m.disabled) throw new Error(`"${m.label}" disabled on ${v.screen}`);
      return d.dispatch(m.action);
    },
    begin() {
      d.dispatch({ type: 'newGame', seed });
      d.dispatch({ type: 'continue' });
    },
  };
  let built;
  if (src) {
    const setup = (0, eval)(`(${src})`);
    built = (await setup(d, engine)) ?? state;
  } else {
    d.begin();
    built = state;
  }
  if (screen) built.screen = screen;
  if (!engine.deserialise(engine.serialise(built))) {
    throw new Error('built state fails the save validator (deserialise returned null) — check screen name and field values against src/engine/save.ts');
  }
  engine.saveGame(built, engine.defaultStore());
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('goldrush.')) entries[k] = localStorage.getItem(k);
  }
  return { entries, screen: built.screen, day: built.day };
}, { src: setupSrc, seed, screen });
await buildPage.context().close();
if (flags.theme) saved.entries['goldrush.theme'] = flags.theme;
console.log(`state built: screen=${saved.screen} day=${saved.day} seed=${seed}`);

// ---------------------------------------------------------------- the shots
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  await ctx.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, saved.entries);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log(`[${vp.name}] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[${vp.name}] pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('#screen');
  await page.keyboard.press('C'); // "Continue last game" — resumes onto the saved screen
  await page.waitForTimeout(150);
  await page.keyboard.press('Space'); // past the "game is resumed" narration
  await page.waitForTimeout(150);
  const pressAll = async (list) => {
    for (const k of list) {
      const m = /^x(\d+):(.*)$/.exec(k);
      const [times, key] = m ? [Number(m[1]), m[2]] : [1, k];
      for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        await page.waitForTimeout(40);
      }
    }
    await page.waitForTimeout(150);
  };
  const shoot = async (name) => {
    const title = await page.evaluate(() => document.querySelector('.gf-title')?.textContent ?? '?');
    const audit = await page.evaluate(auditLayout);
    const path = `${out}/${name}.png`;
    await page.screenshot({ path, fullPage: !!flags.full });
    console.log(
      `${path}  ${vp.width}x${vp.height}${vp.touch ? ' touch' : ''}  — "${title}"` +
        (audit.length ? `\n    !! ${audit.join('\n    !! ')}` : ''),
    );
  };
  await pressAll(keys);
  const stops = Array.isArray(scenario.stops) ? scenario.stops : null;
  if (stops) {
    for (const stop of stops) {
      await pressAll(stop.keys ?? []);
      await shoot(`${vp.name}-${stop.name}`);
    }
  } else {
    await shoot(vp.name);
  }
  await ctx.close();
}

await browser.close();
