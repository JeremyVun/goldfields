# Goldrush (Goldfields clone)

Browser-based 1854 Australian gold-rush life sim. TypeScript + Vite, no runtime
dependencies, no framework — plain DOM. Node 18+.

## Commands

```bash
npm run dev          # dev server (http://localhost:5173)
npm run build        # tsc --noEmit type-check, then vite build → dist/
npm run preview      # serve dist/
npm test             # full Vitest suite (tests/**/*.test.{ts,mjs}), includes balance sim
npm run test:watch   # vitest watch mode
npm run tune         # balance simulation only (tests/balance.test.ts)
scripts/deploy.sh    # build + deploy to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN)
```

Run a single suite with `npx vitest run tests/<name>.test.ts`.

## Layout

- `src/engine/` — pure game logic: `state.ts`/`types.ts` (state shape),
  `reduce.ts` (action reducer), `constants.ts` (tuning numbers), plus one module
  per system (mining, market, travel, health, law, company, estate, hearth,
  bandit, agitation, …). `index.ts` is the public surface; `rng.ts` seeded RNG;
  `save.ts` persistence.
- `src/content/` — all prose/strings (`text.ts`, `hearthText.ts`, `library.ts`,
  `say.ts`), looked up by key with a visible placeholder fallback for missing keys.
- `src/ui/` — DOM rendering: `app.ts` (root), `map.ts`, `menu.ts`,
  `narration.ts`, `styles.css`, `theme.ts`.
- `src/main.ts` — entry point; `index.html` at repo root.
- `tests/` — one suite per engine system, plus `balance.test.ts` (long-running
  bot simulation, driven by `bots.ts`), `ux.test.ts`, `responsive.test.ts`,
  `icons.test.mjs` (`.mjs` suites inspect shipped files on disk).
- `scratch/` — throwaway drivers, screenshot scripts, and exploratory tests; has
  its own `vitest.config.ts` (`npx vitest run -c scratch/vitest.config.ts`,
  10-min timeout). Not part of `npm test`.
- `docs/GAME_SPEC.md` — the design spec (numbered §-sections);
  `docs/CODE_REVIEW.md` — review notes.

## Config

- `vite.config.ts` holds both build and Vitest config (test timeout 120 s,
  node environment).
- `tsconfig.json` — strict TS, no node types on purpose (browser-only code).
- Deploy env: `VITE_ANALYTICS_URL`, `VITE_DATA_RELEASE`, `CF_PAGES_PROJECT`
  (default `goldrush`), `CLOUDFLARE_API_TOKEN` — see `scripts/deploy.sh`.
