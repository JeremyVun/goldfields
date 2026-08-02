# Code comment audit: initial pass

The comments are not uniformly noise. Most of the risk sits in comments that
duplicate tuning values, describe transient implementation history, or carry
design rules that the types and module boundaries do not express. Comments
that record state-machine traps, units, inclusive dates, browser constraints,
or source provenance are valuable and should not be deleted mechanically.

## Scope

This pass scanned TypeScript, JavaScript, CSS, HTML, and shell code under
`src/`, `tests/`, `scripts/`, and `scratch/`. It excluded generated images,
dependency metadata, build output, and environment files. It sampled every
comment-heavy file but did not validate every comment against the game spec.

At the time of the handoff, the three main scopes had about 2,063 standalone
`//` comments or `/*` openings:

| Scope | Code lines | Comment starts |
| --- | ---: | ---: |
| `src/` | 21,991 | 1,461 |
| `tests/` | 9,144 | 475 |
| `scratch/` | 2,556 | 127 |

Existing uncommitted changes in `src/ui/menu.ts` and `src/ui/styles.css`
overlap a comment-heavy area. This pass counted and sampled those files but did
not edit them.

## Changes made in this pass

- Removed a stale description of claim depletion in `src/engine/mining.ts`.
  It said the floor was one-third while `DEPLETION_FLOOR` is two-fifths. The
  function and named constants already state the calculation without a second
  source of truth.
- Replaced the tracked `scratch/integration.ts` header that said “Not
  committed” and referred to “Agent A” and “Agent B” with its durable purpose
  and run command. Corrected the old Suze Port name in `scratch/driver.ts`.
- Removed small comments that only narrated the following expression or
  assertion in `src/main.ts`, `src/ui/dom.ts`, `src/engine/money.ts`,
  `src/engine/reduce.ts`, `src/engine/travel.ts`, `src/engine/mining.ts`, and two
  tests.

## Hotspots

### 1. Tuning values and historical provenance

`src/engine/constants.ts` has 207 comment starts in 1,037 lines. Its comments
mix units and invariants with source claims, balance history, and long design
arguments. Across `src/` and `tests/`, 42 comment lines use “faithful” and about
420 refer to a numbered game-spec section.

The section references provide useful traceability. So does “faithful”, which a
first draft of this audit wrongly proposed removing: the header of
`constants.ts` defines it — values lifted from The New Chum's Companion or the
Teacher's Guide, as opposed to invented values tuned by the bot harness. The
tag's working meaning is *this is a historical fact, not a free tuning knob*,
and it is a guardrail for every future balance pass. Keep it. Numeric prose is
still prone to drift, as the depletion comment demonstrated, and the long store
income rationale that sat on `STORE_WEEK_BASE` was reconciled into §26 of the
spec (the spec had said £1 while the code used £8).

Next pass:

1. Treat the constant as the sole numeric truth. Comments should state units,
   scope, or a non-obvious relationship, not repeat its value in prose.
2. Keep the “faithful” tags and the legend at the head of `constants.ts` that
   defines them. Do not delete a “faithful” tag when trimming an adjacent
   comment.
3. Move tuning narratives and benchmark results out of `constants.ts` into the
   spec, reconciling any spec/code contradiction rather than relocating it.
   Keep a short pointer beside the constant.
4. Check prose claims against their constants and balance assertions before
   deleting anything in bulk.

### 2. State shape and sentinel values

`src/engine/types.ts` has 170 comment starts in 955 lines. Many are load-bearing:
they explain centi-ounce storage, inclusive “until day” fields, `0` meaning
“never”, and values that affect save compatibility. Deleting them would make
the state less safe.

The density is still a design smell. Where a field needs a sentence to explain
its unit or sentinel, prefer a more explicit name or type. Review this file
together with `src/engine/state.ts` and `src/engine/save.ts`, because changing a
sentinel or serialized field in isolation can break old saves.

Next pass: rename ambiguous fields such as `*On`, `*UntilDay`, counts, and money
or gold values to expose units and inclusivity. Replace `0` sentinels with
`null` only when the save migration is explicit. Keep comments for domain
meaning that TypeScript cannot express.

### 3. Balance bots and volatile benchmark prose

`tests/bots.ts` and `tests/balance.test.ts` contain 199 comment starts. Much of
the strategy explanation is useful, but exact claims such as measured death
rates, purchase dates, and outcomes over thousands of seeded years can become
false whenever tuning changes. Several test comments also restate the test name
or the assertions immediately below them.

Next pass: run `npm run tune`, compare every measured claim with current output,
and keep the target in executable assertions. Strategy comments should explain
why action ordering or a fallback exists; result commentary should live in a
dated tuning note or be deleted.

### 4. Reducer and menu state machines

`src/engine/reduce.ts` and `src/engine/menus.ts` have 179 comment starts between
them. Their best comments describe real traps: interrupted tasks, pending
encounters, save trust boundaries, and UI choices whose state must be committed
before dispatch. Those comments are regression knowledge and should remain
until named helpers and focused tests make the invariant clear.

Their density also reflects module size: the reducer is 1,982 lines and the
menu builder is 3,152. A future refactor should split dispatch and view building
by system or screen, then convert commented invariants into helper names and
tests. Section dividers remain useful while these files are monoliths.

### 5. UI layout comments

`src/ui/styles.css`, `src/ui/app.ts`, and `src/ui/map.ts` contain 262 comment
starts. CSS comments about overflow, coarse pointers, grid behaviour, and map
geometry often explain constraints the declarations do not show. Other
comments use the game's voice to narrate straightforward layout code, making
the actual constraint harder to find.

Review this area only after the current uncommitted menu/layout work settles.
Reduce each retained comment to the constraint, the failure mode, and—where one
exists—the responsive or screenshot test that protects it. Avoid viewport
measurements and browser claims that are not covered by a test.

### 6. Large domain modules

`src/engine/bandit.ts` has 96 comment starts, followed by
`src/engine/estate.ts`, `src/engine/shamrock.ts`, and `src/engine/company.ts`.
Their module introductions and section headings help navigation, but some
comments explain the game design rather than the code contract. Move long
design essays to `docs/GAME_SPEC.md`; retain short explanations of side effects,
probability composition, and cross-system coupling.

### 7. Scratch tooling

The tracked scratch tools contain useful operating instructions, especially
where setup must run inside the browser or Playwright is optional. They also
accumulate stale ownership, “temporary” status, and obsolete place names more
quickly than production code. Audit headers against actual tracked status and
commands; remove implementation-session history.

## Decision rule for later passes

| Comment kind | Action |
| --- | --- |
| Unit, range, inclusivity, external constraint, or public contract | Keep; shorten only if meaning survives |
| Regression or browser failure mode | Keep until a named abstraction and focused test replace it |
| Historical claim with a precise source | Keep the nearby rule brief; put the citation in the spec |
| Explanation needed to follow ordinary control flow | Refactor the code, then reassess the comment |
| Duplicated number, benchmark result, or business rule | Make code/test/spec authoritative; remove the duplicate |
| Restatement of the next line, test name, or assertion | Delete |
| Agent ownership, implementation diary, or obsolete temporary status | Delete or rewrite as durable intent |

The next session should start with `constants.ts` and the “faithful” claims,
then review `types.ts` with save migration, then run the balance harness before
editing bot comments. The reducer/menu and UI passes are larger refactors and
should not be mixed with a broad deletion sweep.

## Corrections from the adversarial review (2026-08-02)

- The first pass ranked hotspots by raw comment starts, which surfaces
  declaration files (`constants.ts`, `types.ts`) where doc comments are the
  most legitimate form. The better proxy for *structure that needs uplift* is
  comments inside function bodies of logic files. On that metric:
  `src/ui/app.ts` (64), `src/engine/reduce.ts` (55), `src/engine/menus.ts`
  (53), `src/engine/bandit.ts` (28), and — missed entirely by the first pass —
  `src/engine/daily.ts` (26 in 228 lines, the highest density in the engine,
  including a real double-execution trap around the detention callback).
- A third comment category exists alongside “delete” and “refactor, then
  delete”: design-decision records (why a menu row carries the season note,
  why the company books are ruled off in columns). No refactor obsoletes
  these; total comment count is not a KPI.
- The first pass's own edits deleted one “faithful” provenance tag in
  `mining.ts` (the summer creek factor) while trimming narration; it has been
  restored. Bot/benchmark volatility (hotspot 3) was overstated: sampling
  found the balance-test comments state design targets beside the assertions
  that encode them, which is the good kind.
