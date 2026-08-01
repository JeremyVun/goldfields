# Goldrush

An educational simulation of life on the diggings in an 1854 Australian gold rush, adapted
from **Goldfields** (Jacaranda Software, 1986) by **Trevor K. Jacob**.

You are a **new chum**: a penniless recent arrival at Port Gannet with ten shillings in your
pocket and one year — 365 days — to make your fortune. The program makes no judgment of
success. At the year's end it simply reckons up what you have and what became of you.

> *"Will you dig fresh holes week after week, month after month, finding just enough gold to
> buy food? Can you protect your gold from cut-throats? You will endure all this and more
> while you wait to make your strike — and your strike may never come."*
> — *A Goldfields Journal*, Nicholas Jacob Rowe, 1854

---

## Running it

Requires Node 22 or later. No runtime dependencies; nothing is fetched from the network while
you play.

```bash
npm install
npm run dev        # development server, usually http://localhost:5173
npm run build      # static build into dist/
npm run preview    # serve the built game
npm test           # the whole Vitest suite, balance simulation included
```

`npm run build` type-checks with `tsc --noEmit` before bundling, so a build failure is a real
failure.

---

## How to play

### Keys

| key | what it does |
|---|---|
| `1`–`9`, `A`–`Z` | choose the menu item with that letter or number |
| `↑` `↓` | move the highlight (long menus scroll to keep it in view) |
| `HOME` `END` | jump the highlight to the first or last item |
| `RETURN` | choose the highlighted item |
| `SPACE` | advance a page of narration ("press the SPACE BAR"), and start the game from the title screen |
| `ESC` | open **the menu** — your money, gold, the exchange rate of the day, your kit, health, legal standing and licence. From here you may exchange gold, save the game, or finish it. Press `ESC` or `0` to close. |
| `M` | open the **map** of the goldfields, marked with where you stand, where your pegs are, where a rush is on and where your company's workings lie. Any key closes it. |
| `0` | back / leave the current counter |

**The colour of the glass.** The game ships as ink on paper; the title screen (`T`)
and the menu (`ESC`, then `D`) cycle the schemes: ink on paper, black & white, or the deep blue
glass. Your choice is remembered between sittings.

### By hand, on a phone or a tablet

The game is playable with no keyboard at all, and rearranges itself when it finds none:

- **Every choice is a row you press**, given at least 44px of height to press it by.
- **The flavour of a choice moves into the row.** On a desk it sits on the highlight line above
  the menu, put there by the marker; a finger cannot put the marker anywhere without also taking
  the choice, so on a touch screen each row carries its own line of flavour instead.
- **The menu and the map become buttons** — `[ MENU ]` `[ MAP ]` at the foot of the glass,
  where the legend of keys sits on a desk. An overlay gains a `✕` pinned to its top.
- **The map** is one drawn sheet — an engraved 1854 survey chart in SVG (`src/ui/map.ts`) —
  and it scales whole to whatever room the glass can spare, so the sheet and the notes beneath
  it are always a single page with nothing to scroll. On a phone laid on its side the notes
  stand in a column beside the sheet rather than under it.
- **The handful of lines that name a key** — "press the SPACE BAR", "press RETURN" — are said
  differently where there is no such key (`src/ui/phrasing.ts`, `tests/responsive.test.ts`).
  Entering a saved game's number raises the numeric keypad and is sent with **Take it up**.

Menu items can also be clicked or tapped. A one-line summary of the menu sits at the foot of
every screen:

```
Day 37 · £2 4s · 1.20 oz · Health: Good · Honest
```

At a camp it also says how your papers stand — `· Licence 12d`, or `· NO LICENCE` — because
that is the only place anybody asks.

### Saving

Open the menu with `ESC` and choose **Save the game**. You are given a **game number**. Write it
down — it is the only way back. To resume, choose **Take up a saved game** on the title screen
and type the number. (There is also a "continue last game" convenience on the title screen.)
Saves live in your browser's `localStorage`.

### Money and weights

Pre-decimal currency: **£1 = 20 shillings (s)**, **1s = 12 pence (d)**. Prices are written
`£3 12s 6d`, `15s`, `8d`. Gold is weighed in ounces. The Bank of Australasia at Slateford
pays the best rate in the colony — up to the period standard of **£3 17s 10d the ounce** —
while camp storekeepers pay a good deal less and their scales are their own.

### A short strategy, drawn from the Journal

- **Buy your outfit at Port Gannet.** Everything costs two or three times as much at the
  diggings, and Bell's will gouge you shamefully when a rush is on.
- **Work the wharves first.** Wages are good because workers are scarce, but wages alone will
  never make a fortune. Save up an outfit and go.
- **Carry water in summer and food always.** Travellers — usually footsloggers — have died of
  thirst on these roads.
- **Buy a brumby, not a showy hack.** Brumbies are best in drought and scanty forage, will
  travel hard country, and will find water by scratching for it in a sandy creek bed. The
  dealers will cheat you if you have no knowledge of horses.
- **Carry a loaded gun.** It turns most bushrangers, and most candle-lighters, away.
- **Take out a licence: thirty shillings the month.** Digging without one is possible, and
  the troopers hunt diggers about one day in eight. A fiver is a good-sized bribe for most
  troopers; the alternative is the logs, the monthly magistrate, and thirty days breaking
  rock if you cannot pay the fine.
- **Cradling is the easiest and surest way of finding gold**, but never in such large
  quantities as are possible with shaft mining. A cradle wants a mate; worked single-handed
  its yields halve.
- **Timber your shaft and pump it.** Cave-ins and winter water have killed a great many men
  who thought they had no time for either.
- **Watch the weighing**, and take your gold to the bank rather than the camp storekeeper.
- **Eat greens.** Lin Wu's garden just out of Slateford is the cure for scurvy.
- **Bank your money.** A tent is not a safe.

### The long game

A year is not one long week repeated. The ground under you runs out, and there is a ladder to
climb off it.

- **Claims wear out.** A twelve-foot claim is free and yours alone, but its wash is hidden and
  it thins with every day you work it, until at last there is nothing in it. Pull the pegs and
  put them in again — the new ground is rolled fresh — or walk to another camp.
- **Try the ground with a dish** before you sink a month into it. A day spent prospecting tells
  you in plain words whether you are standing on duffer's ground or on rich dirt, and the
  better a digger you are the less your guess is out.
- **The camps are picked over as the year goes on**, and a rush is the cure. When the Times
  reports heavy washdirt somewhere, the men who get there first and peg get the good of it;
  those who arrive last get the leavings. Moving pays.
- **You get better at it.** Days at the wash and days underground are counted separately, and
  a new chum becomes a digger and then an old hand: steadier yields, fewer duffers, faster
  sinking, a surer eye, and a knack for being somewhere else when the troopers ride through.
- **The field learns your name.** Honest wages, gold banked, licences taken out and meetings
  stood at all build your standing. A man of some standing is offered a partner who takes no
  wage but a share of the gold; a man of more finds Bell shaving his prices; and a man of
  real standing may do the last thing the diggings allow.
- **Float a company.** Build 30 points of standing, prove a shaft in the Blackcap Ranges, keep
  your name clean and put a hundred pounds together, and the registrar will write you up:
  twenty shares, some kept, the
  rest offered to the public. Then you stop swinging a pick and start paying men who do — hire
  crews, put one to prospecting for fresh reef, watch the scrip, declare a dividend, or sell
  out altogether. It is the richest road in the colony, and the one that ends the year
  somewhere you could not have stood on day one.
- **1854 boils.** A shilling a day for a licence, and troopers through the holes to collect
  it, and the field grows angrier all year. There is a monster meeting by torchlight at the end
  of winter, and in December the diggers put up a stockade. You may go in behind the slabs,
  keep well clear, or sell to both sides — the field remembers all three. The stockade falls,
  as it did; and the licence dies with it, replaced by a miner's right at a pound the year,
  and the hunts stop for good.

### Where things are

- **Port Gannet** — the port of arrival. Cheap goods, plentiful work, lodgings from ten
  shillings a night at the inn down to nothing at all in the open, a bank, the horse dealer,
  *The Slateford Times* and *The New Chum's Companion* (sixpence).
- **The roads** — Mercer's Track (longer, better, crowded, safer) and the Razorback Road (shorter,
  rougher, lonelier, and far more bushrangers). Walk, ride a wagon for 10s, or take a horse.
- **Slateford** — the Bank of Australasia, Bell's Outfitters, the Council Chambers (licences and
  claims), Canvas House (the hospital), the Crown & Cradle and its two-up school, Cobb & Co.
  back to the port, and work as an orderly, a store clerk, a barman, a market gardener for
  Lin Wu, or a Council clerk — that last barred to any man with a record.
- **Reedbank Camp** — nearest to town; alluvial creek workings; wet, modest and steady.
- **Copperhead Gully** — rowdy and crowded, good dirt, bad neighbours, snakes, and the
  horse-powered puddling machine at five shillings a day.
- **Blackcap Ranges** — shaft and reef country and the big company mines. Shares at £5, or
  wages underground, or the registrar's ledger and a company of your own.
- **Widow's Reef** — sometimes there are rumours. Some are true. Most are not.

---

## How it is built

```
src/
  engine/            the pure simulation — no DOM, no globals, fully deterministic
    rng.ts           seeded, serialisable mulberry32 generator
    money.ts         £sd arithmetic and formatting; gold in centi-ounces
    time.ts          the 1854 calendar and southern-hemisphere seasons
    types.ts         GameState, Action, ScreenView and the rest of the contract
    constants.ts     every tuning knob in the game, in one file
    state.ts         initial state, derived descriptions, the menu status line
    daily.ts         the per-day upkeep loop every multi-day action runs through
    health.ts        afflictions, risk, Canvas House
    law.ts           licences, digger hunts, bribes, the logs, the magistrate
    market.ts        prices, the exchange-rate random walk, short weight
    mining.ts        claims, quality and depletion, methods, yields, shafts, prospecting
    company.ts       floating, crews, leases, the treasury and the scrip
    agitation.ts     the licence question, the monster meeting, the stockade, the epilogue
    travel.ts        routes, modes, the road and its events
    events.ts        camp nights, rushes, rumours, claim-jumpers, dividends
    news.ts          The Slateford Times
    menus.ts         every screen as data: getView(state) -> ScreenView
    reduce.ts        the reducer: (state, action, rng) -> (state, narration)
    save.ts          serialisation and the game-number ritual
  content/
    text.ts          128 narration keys, 500-plus period-prose variants
    library.ts       The New Chum's Companion, newspaper stories, advertisements and camp talk
    say.ts           variant selection and placeholder substitution
  ui/                plain-DOM rendering, keyboard handling, the retro presentation
public/              the icon set, copied into the build untouched
tests/               Vitest: unit tests plus the strategy-bot balance harness
```

The engine is a pure state machine. `step(state, action, rng)` returns a **new** state and the
narration events the action produced; it never mutates its argument and never touches the DOM.
All randomness goes through an injectable seeded RNG whose state is stored in the game state,
which is why a resumed save plays out exactly as the original would have.

The icon is drawn as pixel art on a 16×16 grid — a gold nugget in the paper theme's own ink,
cut out of its background and keylined so that it holds its edge on a pale tab strip and a dark
one alike — and `node scratch/favicon.mjs` renders `public/` from it: an SVG, a 16/32/48 `.ico`,
and a 180px icon for a home screen, every one of them scaled by whole numbers so the pixels stay
square. The home-screen icon is the one exception to the transparency, and gets the nugget in a
printed block instead: iOS composites a home screen icon on nothing, and renders a see-through
pixel black. Like the game, it has no dependencies; the PNG and ICO containers are written out
by hand over `node:zlib`. `node scratch/favicon.mjs --proof` writes proofs to `scratch/shots`
for judging the drawing by eye — zoomed, at true size, and laid over four tab-strip colours.

### Tests

```bash
npm test
```

The suite covers £sd arithmetic (including a round-trip over every value up to five
pounds and a check that no rendering ever produces "20s" or "12d"), the calendar and seasons,
the licence and law ladder, health and afflictions, prices and exchange rates, travel, mining
yields, claim quality and depletion, skill and standing, the company's books, the December
troubles, and the presentation of it all.

On top of those, a **simulation harness** auto-plays seven strategy bots over 300 seeded years
each and asserts the balance targets, along with the invariants that money is never negative,
that no impossible state is reachable, and that every year terminates. Typical results:

| strategy | median | p25 | p75 | p90 | max | deaths | broke | arrests/yr |
|---|---|---|---|---|---|---|---|---|
| idler (Port Gannet wages only) | £19 17s | £18 0s | £21 0s | £22 10s | £24 13s | 2.3% | 1.0% | 0.00 |
| cautious licensed panner, Reedbank Camp | £63 9s | £46 6s | £85 4s | £103 8s | £197 14s | 1.0% | 2.0% | 0.24 |
| cautious cradler with a mate | £89 11s | £61 8s | £124 4s | £156 15s | £283 6s | 2.0% | 2.0% | 0.22 |
| rush chaser (the same cradle, on the move) | £153 14s | £108 2s | £199 7s | £251 3s | £358 18s | 2.7% | 2.7% | 0.30 |
| aggressive shafter, Blackcap Ranges | £357 7s | £164 5s | £535 6s | £729 0s | £1354 6s | 11.3% | 8.3% | 0.29 |
| company magnate (floats, hires, pays dividends) | £1002 2s | £114 6s | £1972 7s | £2469 9s | £3202 11s | 15.3% | 10.3% | 0.12 |
| licence dodger, Copperhead Gully | £1 19s | 16s 2d | £4 18s | £8 1s | £38 6s | 9.7% | 75.7% | 5.25 |

Wages alone keep a man alive and no more. A careful digger does well. The same digger who
follows the rushes and re-pegs does half again as well for no more work — moving pays. The
shaft is the great lottery: it pays better than anything a lone man can do, and it kills
roughly one in nine. Best of the lot is the man who stops digging and floats a company, which
is exactly how the money was really made; seven in ten of them get the company away, and about
one in seven does not live to see the year out. The licence dodger digs forty days a year and
spends the rest of it in irons — three-quarters of them finish with less than five pounds to
their name.

To re-run the balance simulation with a different sample size:

```bash
GOLDRUSH_RUNS=1000 npm test -- tests/balance.test.ts
```

---

## Provenance and credits

**Goldfields** was written by **Trevor K. Jacob** and published by **Jacaranda Software** (a
division of Jacaranda Wiley Ltd, Brisbane) in 1986, for the Apple II, BBC Micro, Commodore 64,
IBM PC and Microbee. © Trevor K. Jacob 1986.

The original package contained a floppy disk, a Teacher's Guide, a copy of *A Goldfields
Journal* by "Nicholas Jacob Rowe", black-line masters of a key-words sheet, a diary sheet and a
sheet with a bank draft and three share certificates, and a poster with a map and getting-
started information.

This clone was reconstructed from scans of that documentation preserved at the **Internet
Archive** (archive.org). The OCR'd sources used are in `research/`:

- `journal.txt` — *A Goldfields Journal* (the in-fiction player guide, and the source of nearly
  every mechanic, price and turn of phrase here)
- `teachers_guide.txt` — the Teacher's Guide, including the description of the kitty, the
  save-by-number ritual and the BBC disk's module names (INTRO, SUZE, TRAVEL, FTOWN, MINING,
  END), which this clone's screen flow mirrors
- `extras.txt` — the poster, getting-started sheet, bank draft, share certificates and
  key-words list
- `cover.txt` — the Journal's cover

Where the sources give a fact — a name, a price, a mechanic — it is used exactly: ten shillings
for a bed in the flea-ridden dormitory, five shillings for clean straw in a stable, five
shillings a week for a patch of tent ground, thirty shillings a month for a miner's licence, a
five pound note for a trooper, £10 for a camp "doctor" who is a butcher by trade, sixpence for
the Journal, a twelve-foot-square claim, a shaft bottoming between twenty and a hundred feet,
£16 for a pan at the worst of a rush, and £3 17s 10d the ounce as the ceiling on gold. Where
the original program's internal numbers are unknown, period-plausible values were invented and
then tuned by the simulation harness until they met the balance targets above.

This is a homage and a preservation exercise, made for study and enjoyment. All rights in the
original *Goldfields* remain with Trevor K. Jacob and Jacaranda Wiley Ltd.
