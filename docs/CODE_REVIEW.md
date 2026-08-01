# Full code review

Reviewed 1 August 2026 against the working tree as it existed during the review. The tree was already heavily modified and uncommitted; this review does not assume those edits are complete. No implementation changes are included here.

## Resolution audit — 2 August 2026

Every finding below was retested against the completed working tree. “Refuted” means the
reported condition was stale or the recommendation did not establish a defect; “fixed” means
the condition survived reproduction and was changed.

| Finding | Disposition |
|---|---|
| Map migration/build failure | **Refuted as stale.** SVG rendering and semantic map tests already passed when the audit began; the map is now also a lazy chunk. |
| Hearth scaffolding | **Fixed.** Courtship, dated calls, consent, wedding, cottage, letters, events, recovery effects, menus, copy, reducer actions and tests are implemented. |
| Five deterministic failures | **Partly refuted, partly fixed.** Map failures were stale. The company £800 assertion was superseded by §19.4's £400–£700 year-one target. The genuine rush shortfall was repaired in the rush economy; all balance contracts pass. |
| Company sell-out treasury loss | **Fixed.** Sell-out pays the holding's proportional treasury value as well as quoted scrip. |
| Camp gold market unreachable | **Fixed.** Camp/store sale, watched scales, poorer rates and short-weighting are reachable and tested. |
| Storage failure/crash paths | **Fixed.** Page-lifetime fallback storage and typed unavailable/quota/corrupt/not-found results cover acquisition, reads and writes; failed saves never claim success. |
| Unsafe deserialisation | **Fixed.** Size/version, top-level keys, identifiers, enums, money/days, company indices/books, property, Hearth, journal and bounded arrays are validated before render. |
| Overlay return input mismatch | **Fixed.** Pointer, `0` and Escape close the UI overlay without dispatching a location-changing action; DOM tests cover all three. |
| Lease-index corruption | **Fixed.** Equal assignments clear and all later indices decrement; first-lease removal is tested. |
| End total/net-worth divergence | **Fixed.** The reckoning uses canonical `netWorth` and itemises Hearth value. |
| Save ID churn/collision | **Fixed at the cause.** A game keeps its ID and new IDs scan all 8,999 slots without overwrite, eliminating repeat-save orphans; resume-by-number remains the intentional management UI. |
| Trusted action quantities | **Fixed.** The exported reducer rejects non-finite, fractional, negative and out-of-range quantities/indices before mutation. |
| Incomplete interactive semantics | **Fixed.** Native buttons, disabled state, roving tab stop/current item, modal semantics, inert background, focus entry/restoration and teardown are implemented. |
| No DOM integration coverage | **Fixed.** Happy DOM tests construct `App` and `MenuController` and cover storage denial, native menu semantics, modal focus/state and click/keyboard return parity. |
| Horse replacement loss | **Fixed.** Both menu and command refuse a second horse without charging. |
| Non-exhaustive giant dispatchers | **Concrete defect fixed; file-size prescription refuted.** Action and screen unions are compile-time exhaustive. Splitting files merely by line count would not change safety or initial size. |
| Duplicated presentation gates | **Refuted as a general defect.** Commands remain authoritative and reducer payload validation now protects exported calls; the cited gold contradiction itself was fixed. Domain-query extraction remains optional refactoring. |
| Duplicated Journal path/import | **Fixed.** The UI owns the reader, the engine fallback has no content dependency, and Journal prose is a true lazy chunk. |
| Duplicated wallet mutation | **Fixed.** Company and estate share validated `availableFunds`/`debitFunds` helpers. |
| Excluded/stale scratch suite | **Fixed.** Route/company assertions were updated and the scratch suite is part of `npm run check` and CI. |
| Unreproducible deployment/dead env | **Fixed.** Wrangler is exact-version lockfile-pinned, invoked locally, dead Vite variables are gone, and deploy output records commit and dirty state. |
| Missing lint/coverage/CI/budgets | **Fixed.** ESLint, coverage, CI, `git diff --check`, and enforced initial-JS/CSS gzip budgets are present. |
| Stale documentation/comments | **Fixed.** Gold advice, company/share model, amended balance target, Council terminology, Hearth status and test-count wording match the implementation. |
| Over-broad `.gitignore` | **Fixed.** Repository dotfiles are visible; only explicit secrets, editor files and caches are ignored. |
| Smaller hardening suggestions | **Fixed where concrete.** Money parsing is full-string/unique-unit, listener teardown and typed dev hooks exist, the escape bonus reads directly, and the status width is correctly documented as responsive. Flattened menu body text remains deliberately available to pure/non-DOM consumers. |

## Executive summary

The project has a strong foundation: a deterministic, mostly pure TypeScript engine; strict type checking; no runtime dependencies; broad simulation tests; and a compact hand-built DOM UI. Keeping that architecture is the right choice for this game.

It is not currently releasable in the reviewed state:

- `npm run build` fails because the map was changed from an ASCII return type to `{ svg, words }`, while the application and tests still consume `{ lines, markerRow, markerCol }`.
- `npm test` has five deterministic failures: three from that map contract mismatch and two from balance targets.
- Hearth & Kin (§32) is represented throughout the public state, action, screen, save, content, and specification surfaces, but its engine, menus, copy, and reducer dispatch are still stubs.
- Company sell-out discards the player's proportional share of company treasury even though the canonical net-worth calculation counts it.
- The documented camp/store gold market is disabled by an early return, leaving its rates, short-weighting rules, content, and action variants unreachable.
- Save persistence is fragile in restricted-storage browsers, accepts structurally unsafe data, and can silently collide with or orphan earlier saves.

Bundle size is respectable for a prose-heavy game, but the initial bundle is larger than it needs to be. A direct production-style bundle of the current source is approximately 487.1 kB JavaScript raw, 168.8 kB gzip, or 138.5 kB Brotli, plus 16.1 kB CSS raw / 4.0 kB gzip. Nearly 45% of minified JavaScript is eager prose. The best savings come from lazy-loading optional content and feature domains, not from changing framework or micro-optimising engine code.

## Review scope and evidence

Reviewed:

- all production TypeScript in `src/engine`, `src/ui`, and `src/content`;
- build, TypeScript, package, deployment, and ignore configuration;
- the full `tests` suite and excluded `scratch` harnesses;
- `README.md` and `docs/GAME_SPEC.md` against implemented behaviour;
- production-style raw, gzip, and Brotli bundle size and per-module attribution;
- dirty-worktree diffs where they explained an observed regression.

Commands run:

| Check | Result |
|---|---|
| `npm run build` | **Fail**: map return type no longer matches `App` or `tests/ux.test.ts` |
| `npm test -- --reporter=basic` | **Fail**: 443 passed, 5 failed, 448 total |
| `git diff --check` | Pass |
| excluded `scratch` Vitest suite | 31 passed, 4 stale journey-name assertions failed at the start of review |
| production-style esbuild analysis | JS 487,056 B raw / 168,828 B gzip / 138,485 B Brotli; CSS 16,135 B / 3,963 B / 3,462 B |

The existing `dist` directory is from an earlier successful build and is now stale relative to the source. Its JS is 475,929 B raw / 164,660 B gzip, so it should not be used to validate the current map work.

Severity used below:

- **P0**: blocks build/release or represents a committed feature that cannot function.
- **P1**: confirmed correctness or data-loss problem in a reachable/core path.
- **P2**: meaningful quality, UX, maintainability, or latent correctness risk.
- **P3**: cleanup or hardening with lower immediate impact.

## Findings

### P0 — Map migration is incomplete and breaks the build

`src/ui/map.ts:590-597` now declares `MapDrawing` as `{ svg, words }`. `buildMap` returns that shape at `src/ui/map.ts:737`. The rest of the migration was not made atomically:

- `src/ui/app.ts:494-513` still destructures `lines`, `markerRow`, and `markerCol`, then builds an ASCII `<pre>`.
- `tests/ux.test.ts:285-339` asserts those removed properties.
- Current Vitest execution reaches the old tests because Vitest transpiles without a type-check, then fails three tests with `undefined` property errors.
- `tsc --noEmit` catches the mismatch and prevents all production builds.

The code comments in the new map correctly say that `words` is the testable and screen-reader surface, but neither the tests nor `App` use it yet.

Recommendation:

1. Complete this migration before any other release work: render `svg`, expose `words` as accessible fallback text, and remove the old scrolling/marker logic.
2. Rewrite map tests around stable semantics: SVG is present, the current-location marker has the expected class/position, and `words` contains claim/rush/company annotations. Avoid tests tied to an obsolete raster grid.
3. Keep all dynamic text escaped before insertion. If the SVG continues to be constructed as a string, centralise and test escaping rather than introducing multiple raw-markup paths.
4. Lazy-load the map renderer when the map overlay first opens. It contributes about 14.5 kB, or 3% of minified JS, and is not needed to start or play the first turn.

### P0 — Hearth & Kin (§32) is a public feature made entirely of scaffolding

This is much more than a future private module:

- `docs/GAME_SPEC.md:1129-1315` specifies the complete system and balance assertions.
- `src/engine/types.ts:499-501` exposes the `hearth`, `ball`, and `letters` screens.
- `src/engine/types.ts:906-919` exposes thirteen Hearth actions.
- the game state contains the full `Hearth` structure and save version is already 6;
- `src/engine/daily.ts:208` calls `hearthDay` every day;
- `src/engine/index.ts` exports the feature.

But:

- `src/engine/hearth.ts:30-148` is a set of no-ops and hard-coded `false`, `null`, `0`, and `hearth.final.none` returns;
- `src/content/hearthText.ts:9-13` is an empty text table;
- the three screens have no `getView` cases, so they fall through to the generic default;
- none of the thirteen Hearth actions has reducer dispatch;
- there are no Hearth tests.

Because the reducer is not exhaustive, these valid `Action` values silently do nothing rather than producing a compile-time error. This is a concrete example of the current dispatcher architecture allowing an entire feature to be omitted.

Recommendation: either finish §32 as one atomic feature before release, or explicitly mark it as future and remove/hide it from current screens, actions, public exports, save-version claims, and current-spec commitments. Do not ship the present half-public state. Add an exhaustive action check so a recurrence cannot compile.

### P1 — Five deterministic tests fail

Three are the map regression above. The other two are current balance-contract failures in `tests/balance.test.ts`:

| Strategy | Actual deterministic median | Required |
|---|---:|---:|
| Rush chaser | 29,764d = £124 4d | at least 1.25× still cradler = 32,761.25d |
| Company magnate | 134,103d = £558 15s 3d | at least 192,000d = £800 |

The company magnate's p90 still exceeds £2,000, so this is primarily a median/reliability problem rather than removal of the high upside. The rush chaser misses its target by about 9.1%.

Recent economy/travel edits—particularly changed fishing yield/failure, food price, and travel costs—can affect bot survival and opportunity cost. Diagnose through the seeded bot ledger rather than merely lowering assertions. If the intended design target changed, update §22 and the test together with a written reason; otherwise restore the economics.

These simulations are deterministic under their fixed seeds, so rerunning without code changes will not resolve the failures.

### P1 — Company sell-out destroys treasury value already counted as the player's

The canonical rule in `src/engine/state.ts:584-595` values a company holding as:

```text
owned shares × share price + owned proportion of treasury
```

`netWorth` includes that value, and `tests/company.test.ts:461-469` explicitly verifies it. However, `sellOut` at `src/engine/company.ts:724-734` pays only `sharesOwned * sharePrice`, then deletes the company and all treasury. The direct sell-out test at `tests/company.test.ts:430-437` codifies this contradictory payout.

The loss can also happen indirectly: `sellOwnShares` automatically invokes `sellOut` when holdings fall below `COMPANY_SELLOUT_FLOOR` (`src/engine/company.ts:737-758`). A player selling only some scrip can therefore lose their remaining share of the treasury without a separate decision.

Choose one economic model and use it everywhere. The specification and `companyWorth` currently imply that sell-out should pay the proportional treasury share. If share price is instead intended to capitalise treasury, remove the extra treasury component from `companyWorth`, end-of-year totals, and tests. The current mixed model is wrong under either interpretation.

### P1 — The documented local gold market is unreachable dead code

The specification says camp storekeepers buy at worse rates and may cheat on their scales (`docs/GAME_SPEC.md:231-240`). The README tells players to watch the weighing and prefer the bank (`README.md:105-116`). The implementation still contains:

- location/store rate calculations (`src/engine/market.ts:107-127`);
- short-weighting probability and loss constants;
- watched/unwatched branches and narration (`src/engine/market.ts:425-454`);
- `store` and `camp` variants in the `sellGold` action/API.

But `src/engine/market.ts:415-417` immediately rejects every non-bank sale. Menus say camp storekeepers do not buy gold, and `tests/market.test.ts:192-205` now codifies the bank-only behaviour.

This is specification drift plus bundle-bearing unreachable code. Restore the intended sale choices and test watched versus unwatched scales, or remove the rates, constants, narration, action variants, README advice, and §10 promise. The current middle state has the maintenance and size cost of the richer mechanic without the mechanic.

### P1 — Save persistence can fail silently or crash startup

`defaultStore` at `src/engine/save.ts:40-43` has two problems:

1. If `localStorage` is absent, every call creates a new in-memory `Map`. A save and a later load use different stores, so the fallback never persists even for the page lifetime.
2. Merely accessing `globalThis.localStorage` can throw in restricted/security contexts. Reads and writes can also throw because of privacy restrictions or quota exhaustion.

The title render calls `lastGameId(defaultStore())` and `loadGame` without protection (`src/ui/app.ts:688-699`), so a storage-access error can stop initial rendering. Manual resume does the same at `src/ui/app.ts:330-350`.

Save occurs inside the broad dispatch `try` (`src/ui/app.ts:151-197`). The reducer has already generated narration claiming the game is saved, but a storage failure is caught as a generic storytelling mishap and the resulting state is not committed. The user receives neither a correct save confirmation nor an actionable storage error.

Recommendation:

- use one module-scoped memory fallback;
- wrap acquisition and every storage operation in a small adapter returning explicit success/failure results;
- only narrate “saved” after persistence succeeds;
- distinguish “storage unavailable”, “quota full”, “corrupt save”, and “unknown number” in the UI;
- test a throwing storage getter, throwing `setItem`, and a quota-like failure.

### P1 — Deserialisation trusts unsafe saved state

`deserialise` only requires `day` and `moneyPence` to have JavaScript type `number` (`src/engine/save.ts:235-295`). It then spreads the raw object over a fresh state and casts it to `GameState`.

Consequences:

- `NaN`, `Infinity`, negative values, fractional money/days, and extreme values pass;
- unknown `location`, `screen`, legal state, action-related enums, and nested object shapes pass;
- future save versions are silently interpreted as current and overwritten with `SAVE_VERSION`;
- unbounded `journal`, history, letters, gang, and other arrays can be revived;
- partially validated nested objects can still contain invalid numeric and enum fields.

For example, an unknown location reaches `locationName` at `src/engine/state.ts:525-537`, whose default indexes `CAMP_DEFS[loc].name` and can throw during render. That render is outside the dispatch error boundary.

Treat local storage as untrusted input. Validate finite integers and ranges, enum membership, bounded array lengths, and every nested structure. Reject unsupported future versions; migrate only known older versions. A schema library is not required—small typed parsers are enough and avoid runtime bundle cost. Add corrupt, maliciously large, and future-version fixtures.

### P1 — Menu overlay “return” changes location sub-screen on click but not keyboard

The menu overlay's last row dispatches `{ type: 'continue' }` (`src/engine/menus.ts:658-664`). Keyboard `0` or Escape closes the overlay directly (`src/ui/app.ts:245-249`), preserving the underlying screen. Clicking/tapping that visible row goes through `dispatch` (`src/ui/app.ts:471-479`), and reducer `continue` routes to `screenForLocation` (`src/engine/reduce.ts:804-808`).

If the overlay was opened over the bank, store, company books, or another sub-screen, keyboard users return there while pointer users are sent to the location's home screen.

Make “close overlay” a UI command rather than a game `Action`, or store and restore the exact previous screen. Add an App-level test for click, `0`, Escape, and touch paths.

### P1 — Abandoning a company lease corrupts later crew assignments

`abandonLease` splices `c.leases` and only clears crews assigned exactly to the removed index (`src/engine/company.ts:387-395`). Every crew assigned to a later lease retains its old numeric index even though that lease shifted down.

With two leases, removing lease 0 leaves a crew assigned to lease 1 pointing out of range. With more, it may point to the wrong ground. Mining fallback logic can hide this for some tasks, while development can simply stop progressing.

After a splice, clear equal assignments and decrement every `crew.lease > removedIndex`. Better still, give leases stable IDs and store those on crews; positional foreign keys are brittle. Add tests covering removal of the first, middle, and last lease with crews on each.

### P1 — End-of-year total diverges from canonical net worth

`netWorth` at `src/engine/state.ts:623-633` includes cash, bank, gold, company, outlaw stash, estate, and Hearth value. `endView` manually recomputes the same concept at `src/engine/menus.ts:2838-2860` but omits `hearthWorth`.

This is currently masked by the unimplemented Hearth system, but once a cottage or home stash exists the final certificate under-reports the player. Use `netWorth(state)` for `IN ALL` and render `hearthWorth` as its own constituent line. This also removes a duplicated business rule.

### P2 — Save IDs are regenerated, collision-prone, and never managed

Reducer `save` always generates a new four-digit ID and overwrites `gameId` (`src/engine/reduce.ts:832-839`). `saveGame` writes the new slot, but nothing deletes or updates the old one. Repeated saves therefore orphan records.

There are only 8,999 possible IDs and no collision check, so a new save can silently overwrite another game. `listSaves` exists but is unused; there is no list/delete/overwrite UI. With up to 400 journal entries per save, repeated orphaning also makes quota failure more likely.

Use a stable ID after the first save, probe before allocating a new one, and expose intentional “save as new” separately if desired. Add save listing/deletion or a bounded retention policy.

### P2 — Reducer actions are trusted even when they carry quantities and indices

The UI currently emits valid fixed values, but the exported engine accepts arbitrary `Action` objects. Several paths do not validate positive finite integers. A clear example is `rentPuddler` at `src/engine/reduce.ts:1521-1529`: a negative day count makes `cost` negative, adds money, and moves the rental deadline backwards. Similar risks exist for work/mine/rest durations, stakes, share counts, lease/crew indices, and stash amounts.

Save corruption and future UI changes make this more than a theoretical type concern—TypeScript types do not exist at runtime. Validate at the reducer/domain boundary, not only by disabling menu rows. Consider branded helpers such as `positiveDays`, `validLeaseIndex`, and `boundedAmount`, returning a narrated refusal without changing state.

### P2 — Interactive UI semantics are not keyboard- or screen-reader complete

Menu rows are `div role="button" tabindex="-1"` (`src/ui/menu.ts:49-65`). Overlay close controls and legend actions use the same pattern (`src/ui/app.ts:410-418`, `454-461`, `849-858`). They cannot receive individual keyboard focus. Disabled rows expose only a CSS class, not `aria-disabled`; the highlighted item is not represented through `aria-current`, `aria-selected`, or active-descendant semantics.

The overlay layer has no dialog semantics, focus trap, inert background, or focus restoration. `App.render` always focuses the root (`src/ui/app.ts:625-635`), which can also make screen-reader browsing awkward.

Use native `<button>` elements where possible. For the game-style single-focus menu, use a documented roving-tabindex or `aria-activedescendant` pattern, expose disabled/highlight state, give overlays `role="dialog"`/`aria-modal="true"`, and restore focus on close. Preserve the fast number-key interaction as an additional input method.

### P2 — The real DOM application has no automated integration coverage

Tests exercise the pure engine, menu data, phrasing, and map builder, but no test constructs `App` or `MenuController` in a DOM. That is why the overlay return mismatch and incomplete map migration crossed the suite boundary.

Add a small jsdom or happy-dom layer for:

- title/resume and storage failures;
- narration flush before overlay actions;
- menu selection by key, click, and touch;
- overlay focus/close/return behaviour;
- journal open/read/close;
- map insertion and accessible description;
- input buffer and mobile keypad flow.

Add one Playwright smoke path at desktop and narrow-mobile sizes. These are development dependencies and do not affect the production bundle.

### P2 — Replacing an owned horse silently destroys the old one

The horse-dealer menu remains enabled when a horse is already owned (`src/engine/menus.ts:939-957`). `buyHorse` deducts the full price and assigns `state.horse = kind` (`src/engine/market.ts:377-397`), with no sale, trade-in, refusal, or warning. Buying the same horse twice also charges twice.

If deliberate, the UI should explicitly say that the old horse is surrendered with no value. More likely, disable the owned kind and offer a confirm/trade-in path for replacement. Add a test for already-owned horses.

### P2 — The main dispatcher and view builder are too large to be safely exhaustive

`src/engine/reduce.ts` is about 1,857 lines and handles roughly 126 action variants. `src/engine/menus.ts` is about 2,922 lines and handles the full screen graph. Hearth demonstrates the failure mode: adding types without handlers compiles because both switches have permissive fall-through/default behaviour.

Split by domain—port, travel, mining, company, civic, bandit, Hearth—while keeping the pure state-machine architecture. Use one typed dispatcher or exhaustive domain switches ending in `assertNever`. Screen sets such as `CAMP_SCREENS`, `TOWN_SCREENS`, and `PORT_SCREENS` should also be typed against `Screen`, rather than inferred as general strings.

This refactor improves safety but does not reduce bundle size by itself. It saves initial bytes only if domain modules are dynamically imported at entry boundaries.

### P2 — Rules and presentation gates are duplicated

Menus repeatedly calculate whether an action is affordable/allowed, then engine functions recalculate a related rule. This creates drift in labels, disabled states, and actual mutation. The gold-selling conflict is the clearest example.

Prefer domain queries that return structured results:

```ts
type Gate = { ok: true } | { ok: false; reason: string };
```

The menu can use the same gate's reason, while the command remains authoritative. For complex choices, expose typed option descriptors from the domain instead of duplicating price/availability formulas in `menus.ts`.

### P2 — Journal presentation and imports are duplicated

`getView` has a journal case at `src/engine/menus.ts:988-1000`, but `App.render` bypasses `getView` for journal screens and uses a separate reader (`src/ui/app.ts:625-631`, `923-1008`). Both paths statically import `JOURNAL_SECTIONS`.

Consolidate on one journal presentation path. Removing the engine-menu fallback also removes the import that currently prevents the journal prose from becoming a clean lazy chunk.

### P2 — Wallet drawing logic is duplicated

`company.ts` and `estate.ts` each define essentially identical `purse` and “cash first, bank second” functions. Law and health contain additional hand-written variations. This is financial state mutation and should have one implementation.

Extract side-effect-light helpers such as `availableFunds`, `canAfford`, and `debitFunds(order)`. Make the source order explicit because some purchases intentionally require cash while deeds/company registration allow bank funds. Centralisation reduces the chance of overdrafts and inconsistent payment rules; the bundle effect is small.

### P2 — Scratch tests are large, excluded, and partly stale

`vite.config.ts:10-12` includes only `tests/**/*.test.ts`; TypeScript also excludes `scratch`. The scratch directory contains useful fuzz, journey, mobile, screenshot, and edge harnesses, but it is not a reliable second suite. At review start its Vitest config produced 31 passes and four failures caused by old route names (“Trickey’s” and “Pass Road” versus “Mercer’s Track” and “Razorback Road”).

Promote durable fuzz/invariant and regression cases into `tests`; keep visual/manual scripts under a clearly documented tooling directory; delete or archive obsolete assertions. A large excluded pseudo-suite creates false confidence and review noise.

### P2 — Deployment is not reproducible and contains dead configuration

`scripts/deploy.sh` uses `npx --yes wrangler` without a pinned version. A deployment can therefore download and execute a different CLI than the prior deployment, outside `package-lock.json`. Add Wrangler as a pinned dev dependency or invoke an explicit version.

The script exports `VITE_ANALYTICS_URL` and `VITE_DATA_RELEASE`, but no source file references either `VITE_` variable or `import.meta.env` for those values. Remove them if analytics was intentionally removed, or wire and type them if still required. At present they add ceremony and imply telemetry/release metadata that the bundle does not contain.

`--commit-dirty=true` may be intentional for local previews, but production deploys should record the source identity and whether the tree was dirty so an artifact can be reproduced.

### P3 — Tooling lacks lint, coverage, CI, and bundle budgets

`package.json` provides build and test scripts only. Strict TypeScript catches much, but not unreachable logic, accessibility conventions, unsafe casts, inconsistent formatting, or bundle regressions. `vite.config.ts:15` currently uses `as any` to suppress the config-type mismatch.

Add:

- ESLint or Biome with TypeScript-aware unused/unreachable checks;
- Vitest coverage for engine branch gaps, especially save and reducer dispatch;
- a CI job for `npm ci`, build, unit tests, browser smoke, `git diff --check`, and bundle budget;
- correctly typed Vitest config, for example via `vitest/config`, instead of `as any`.

Start the bundle budget just above a known good baseline to stop growth, then ratchet it down. A reasonable first target after optional-content splitting is initial JS below 150 kB gzip, with a hard regression ceiling near the present 169 kB until that work lands. Keep CSS below 5 kB gzip.

### P3 — Documentation and comments are out of sync

- `README.md:217` says 281 tests; the current suite contains 448.
- README/spec gold advice conflicts with the bank-only tests and menus.
- §32 reads as committed design while its code is explicitly assigned to nonexistent “engine agent” and “presentation agent” TODOs.
- `company.ts:323-324` still calls live behaviour a “skeleton API”.
- scratch journey names are stale.

Generated counts should not be hand-maintained. Mark specification sections as planned/implemented, and require behaviour changes to update code, tests, and spec in the same change.

### P3 — `.gitignore` is over-broad

The `.*` rule ignores every dotfile/directory, not just local noise. It can silently hide new `.github`, `.editorconfig`, tool configuration, or other important project metadata from `git status`. Replace it with explicit entries such as `.DS_Store`, `.env*`, editor directories, and known caches. Keep the rule protecting secrets, but do not make all repository configuration invisible.

### P3 — Smaller hardening and simplification opportunities

- `statusLine` promises an 80-column line (`src/engine/state.ts:551-577`) but does not enforce a width; high cash/reward combinations exceed it. Either make the constraint responsive/CSS-owned or add deterministic abbreviation rules.
- `parseMoney` (`src/engine/money.ts:72-89`) accepts partial matches/trailing garbage and does not reject duplicate units. If it remains a public utility, require a full-string parse and add negative/garbage/duplicate-unit tests.
- `App` installs global resize/orientation/viewport/input-mode listeners but has no teardown. A single lifetime is fine today; provide `destroy()` before tests, hot remounting, or embedding create multiple instances.
- The dev screenshot hook uses `(import.meta as any)` and `(window as any)` (`src/ui/app.ts:140-143`). It is correctly DEV-gated, but proper `ImportMetaEnv` and `Window` declarations remove unsafe casts.
- `law.ts:179` expresses the horse escape bonus as subtracting a negative value. Rewrite it as a direct addition; the result is currently correct but needlessly hard to audit.
- `body` text is reconstructed from `panels` in `menuView` (`src/engine/menus.ts:648-656`) while the App renders panels directly. Derive flattened text only for consumers that need it to avoid two representations drifting.

## Bundle review

### Current attribution

The current source cannot pass Vite's type-check because of the map mismatch, so attribution was measured with a direct minified esbuild bundle. It is suitable for finding weight, not for claiming a deployable artifact.

| Module | Approx. minified JS contribution | Share |
|---|---:|---:|
| `src/content/text.ts` | 192.1 kB | 39.5% |
| `src/engine/menus.ts` | 77.7 kB | 15.9% |
| `src/engine/reduce.ts` | 30.0 kB | 6.2% |
| `src/content/library.ts` | 26.4 kB | 5.4% |
| `src/ui/app.ts` | 17.4 kB | 3.6% |
| `src/engine/bandit.ts` | 16.6 kB | 3.4% |
| `src/ui/map.ts` | 14.5 kB | 3.0% |
| `src/engine/estate.ts` | 14.4 kB | 3.0% |
| `src/engine/company.ts` | 12.1 kB | 2.5% |
| `src/engine/mining.ts` | 10.7 kB | 2.2% |

Types and comments are already stripped, so shortening type names, deleting comments, or compressing `types.ts` will not improve production size. Repeated prose also compresses well under gzip/Brotli; hand-deduplicating sentences would harm writing quality for little transfer benefit.

### Highest-value size work

1. **Split and lazy-load the journal.** The journal portion of `library.ts` is roughly 13 kB source before minification. It is optional, opened explicitly, and currently pinned into the initial graph by both `App` and `menus.ts`. Consolidate the reader, move `JOURNAL_SECTIONS` into its own module, and import it on first open. Optionally prefetch during idle time.
2. **Lazy-load the map.** The new map is about 14.5 kB of minified code and opens only on command. This is a clean feature boundary once the migration is complete.
3. **Split narration by domain together with domain engines.** `content/text.ts` is the dominant 192 kB. `say()` is synchronous, so merely splitting the file does nothing. Load a feature's engine, menus, and narration when the player first enters company, bandit, civic, or Hearth play; ensure the chunk is ready before dispatch. Keep universal travel/health/mining text in the initial chunk.
4. **Split the giant menu and reducer along those same async boundaries.** Static file splitting alone changes maintainability, not initial download. Vite will preload statically imported chunks.
5. **Keep the plain DOM architecture and zero runtime dependencies.** Introducing a framework would add baseline code without solving prose weight.
6. **Enable Brotli at the CDN and verify cache headers.** Current JS is about 30 kB smaller under Brotli than gzip. This helps transfer size, though not parse/compile cost.
7. **Add a measured budget report to CI.** Record raw, gzip, and Brotli for initial and lazy chunks. Fail on unexpected initial growth and review total lazy payload separately.

Potential trade-off: more chunks reduce initial parse/download but may slightly increase total compressed bytes because chunks cannot share one compression dictionary. The game also claims no network dependency while playing; if offline continuity matters, prefetch/cache optional chunks after first render or use a service worker. Measure on a cold mobile profile before choosing chunk granularity.

### Work that is unlikely to pay off

- replacing small helpers with terse inline code;
- removing useful types or comments;
- converting tables to JSON while still loading them eagerly;
- custom run-length/string compression in JavaScript;
- adding a UI framework for code splitting;
- creating many tiny chunks that add request and module-evaluation overhead.

## Architecture and code-quality assessment

### What is working well

- The engine is independent of the DOM and is easy to simulate.
- Seeded RNG and state cloning make failures reproducible.
- Money uses integer pence and gold uses centi-ounces, avoiding floating-point currency drift.
- `netWorth`, estate/company/stash helpers, and most domain rules are pure and testable.
- Narration is separated from mechanics and missing keys are made visible.
- The test suite covers unit rules, long random play, invariants, and strategy-level economics.
- There are no production packages or external assets; CSS is only about 4 kB gzip.
- The code generally uses explicit domain names and strong discriminated unions.

### Desired end state

Keep one deterministic core, but make feature ownership and boundaries explicit:

```text
App shell
├── core engine: time, health, travel, mining, save
├── core presentation: common menus, narration, status
└── lazy feature domains
    ├── journal + journal content
    ├── map renderer
    ├── company + company menus/text
    ├── civic/estate + menus/text
    ├── bandit + menus/text
    └── Hearth + menus/text
```

Each domain should own:

- action handlers;
- rule/gate queries;
- screens or view builders;
- narration keys/content;
- unit tests and at least one integration path.

The root dispatcher should be exhaustively typed. Save parsing should be a separate trust boundary before any `GameState` reaches those domains.

## Test strategy recommendations

Preserve the existing seeded simulations; they are unusually valuable. Add the missing layers:

1. **Compile contract:** build must pass before unit tests are considered green.
2. **Reducer exhaustiveness:** compile-time proof that every `Action['type']` is handled, including actions handled in pending-encounter preprocessing.
3. **State invariant helper:** one reusable assertion for finite integers, ranges, enum values, index validity, journal/history caps, and cross-field rules; run it in fuzz tests and after deserialisation fixtures.
4. **DOM integration:** interaction parity across keyboard, click, touch, and storage failure.
5. **Browser smoke:** start, work, travel, mine, open/close menu and map, save, reload, resume.
6. **Accessibility:** automated axe pass plus manual keyboard/screen-reader review of the single-focus game menu.
7. **Bundle regression:** initial and lazy chunk raw/gzip/Brotli sizes in CI.
8. **Balance diagnostics:** on failure, emit strategy seed and component ledger so regressions can be reduced rather than inferred from the final median.

High-value regression cases from this review:

- map API renders and exposes annotations accessibly;
- company sell-out reconciles exactly with the chosen `companyWorth` model;
- abandoning lease 0 remaps crews on lease 1;
- overlay return preserves the exact screen for all input methods;
- storage getter/write failures never blank the title and never claim a save succeeded;
- corrupt/future saves are rejected without rendering;
- repeated save updates one slot and never collides;
- every Hearth action has a handler before §32 is exposed;
- replacing/repurchasing a horse follows an explicit policy;
- negative/NaN action quantities cannot mutate state.

## Recommended remediation order

### Phase 1 — Restore a trustworthy baseline

1. Complete or revert the map migration so build and all map tests pass.
2. Diagnose the two seeded balance failures; restore targets or deliberately revise spec and assertions.
3. Decide whether §32 is release scope. Complete it atomically or hide/remove the scaffolding from the current product surface.
4. Add build + test as required CI checks.

Exit criterion: `npm ci`, `npm run build`, and all 448+ tests pass from a clean checkout.

### Phase 2 — Fix correctness and persistence

1. Resolve company treasury valuation/sell-out semantics.
2. Resolve bank-only versus camp/store gold-sale semantics.
3. Fix lease-index remapping.
4. Fix overlay return parity.
5. Use canonical `netWorth` in the end view.
6. Replace save storage access with explicit safe results; stabilise IDs and validate all deserialised state.
7. Validate quantity/index-bearing actions.

### Phase 3 — Raise structural quality

1. Add exhaustive action dispatch.
2. Split reducer/menu code by domain.
3. Share rule gates and wallet helpers.
4. Consolidate journal and panel/body representations.
5. Add DOM/browser/accessibility coverage.
6. Promote useful scratch harnesses and retire stale ones.
7. Add lint, coverage, and typed test config.

### Phase 4 — Reduce initial bundle

1. Establish and enforce the current baseline.
2. Lazy-load journal and map first; measure cold-load improvement.
3. Split optional feature domains with their narration.
4. Target initial JS below 150 kB gzip, then ratchet based on real mobile load measurements.
5. Verify Brotli, immutable hashed-asset caching, and offline/prefetch behaviour.

## Final assessment

The codebase does not need a rewrite. Its best qualities—the dependency-free UI, deterministic pure engine, integer economy, and seeded balance suite—are exactly the qualities to preserve. The immediate problem is consistency across layers: types, reducer, menus, content, tests, spec, and save format can currently move independently. The map break, Hearth scaffolding, gold-market drift, and contradictory company valuation are all forms of that same issue.

Restore an all-green baseline, make actions and saved state exhaustive trust boundaries, then split optional prose-heavy domains behind real lazy entry points. That sequence addresses correctness first and should also bring the initial compressed JavaScript below the current ~169 kB without sacrificing the game's voice or adding runtime dependencies.
