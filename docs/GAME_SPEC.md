# Goldrush — Game Specification

An educational simulation of "life on the diggings" in an 1854 Australian gold rush,
adapted from **Goldfields** (Jacaranda Software, 1986, by Trevor K. Jacob).

Primary sources (in `research/`):
- `teachers_guide.txt` — original Teacher's Guide (OCR)
- `journal.txt` — *A Goldfields Journal* by "Nicholas Jacob Rowe" (OCR), the in-fiction
  player guide whose content drives nearly all mechanics and flavour text
- `extras.txt` — poster / getting-started sheet (OCR)

Fidelity principle: where the sources give a fact (name, price, mechanic), use it exactly.
Where the original's internal numbers are unknown, invent period-plausible values that hit
the balance targets in §14, and mark nothing as "modern" — every word of copy must read
like 1854 Australian goldfields idiom (the Journal is the style reference).

---

## 1. Premise & victory

- Year is **1854**. The player is a **"new chum"** — a penniless recent arrival at
  **Port Gannet**.
- The player has **one year (365 days)** to make their fortune on the goldfields.
- The game itself makes **no judgment of success** (faithful to original). At year's end
  it presents a summary of experiences and possessions (a "Bank Draft" style tally), and
  offers to continue for a **second year** or start anew.
- Death (health reaching zero) ends the game with an obituary in *The Slateford Times*.

## 2. Currency, weights, time

- Pre-decimal currency: **£1 = 20 shillings (s), 1s = 12 pence (d)**. All UI money is
  rendered as e.g. `£3 12s 6d` (omit zero parts: `£5`, `15s`, `8d`). Internally store
  **pence** as an integer.
- Gold is measured in **ounces (oz)**, stored internally in 1/100 oz.
- Time advances in **days**; every action costs days (see per-screen tables). Day counter
  and season shown to player. Seasons matter: **summer** (Dec–Feb: heat, thirst, dust,
  Sandy Blight) and **winter** (Jun–Aug: rain, mud, flooding, cold). Game starts day 1 =
  1 January 1854 (summer).

## 3. Player state — "the kitty"

Faithful to original: an information screen inspected by pressing **`@` at any time**.
It lists:

- money held (£sd) and gold held (oz)
- **exchange rate of the day** (what an ounce fetches, varies by location — §10)
- equipment and property owned
- a resume of experiences: health status, **legal status**, licence state, employment
- menu options (faithful): **exchange gold**, **save the game** (issues an ID number),
  **finish the game**
- A one-line **summary of kitty information appears at the bottom of every screen**:
  `Day 37 · £2 4s · 1.20 oz · Health: Good · Honest`

State fields:

| field | values |
|---|---|
| `day` | 1–365 (or 366–730 in year two) |
| `moneyPence` | int ≥ 0 |
| `goldCentiOz` | int ≥ 0 |
| `health` | 0–100, displayed as words: Hearty (80+), Good (60+), Poorly (40+), Ill (20+), Gravely ill (1+), Dead (0) |
| `legalStatus` | honest → petty criminal → minor criminal → major criminal → wanted criminal (faithful ladder) |
| `licenceUntilDay` | day licence expires (licences last 30 days) |
| `location` | suze-port, on-road, fields-town, damp-camp, snakey-gully, deep-mountains, secret-mine |
| `equipment` | set + counts: pan, cradle, pick, shovel, tent, blanket/swag, gun, water bags, provisions (days of food), timber supports, pump, rope & bucket, horse (brumby / hack), claim pegged |
| `illness` | none or named condition with severity |
| `jailUntilDay` | if imprisoned |
| `employment` | none or current job |
| `journal` | log of notable events for the end-of-year summary |

## 4. Locations & map

Fictional geography (faithful names):

- **Port Gannet** — the port of arrival. Cheap goods, work, lodgings.
- Two roads to the diggings (faithful): **Mercer's Track** — longer, better surface,
  crowded, safer; **the Razorback Road** — shorter, rough, isolated, higher bushranger and
  accident risk.
- **Slateford** — the largest settlement, on Slate River. Contains **Bell's Outfitters**
  (and Bell's Freight), the **Bank of Australasia**, the hospital (**"Canvas House"**),
  the **Crown & Cradle**, the **Council Chambers** (licences, claims, complaints), police
  camp with "the logs", and **Lin Wu's market garden** just out of town.
- Mining camps, each with its own character (faithful):
  - **Reedbank Camp** — closest to Slateford; alluvial creek workings; wet; flood-prone in
    winter; modest but steady gold.
  - **Copperhead Gully** — rowdy large camp; good alluvial and puddling (rentable
    horse-powered puddling machine, faithful); night-time crime; snakes; flash floods in
    its steep gully.
  - **Blackcap Ranges** — shaft/reef country and **big company mines**; highest potential
    yields; cave-in and flooding risk; player may buy **shares** in a mining company or
    work for company wages.
  - **Widow's Reef** — sometimes there are **rumours of a lost reef**.
    Rumours may be genuine (a rich, remote working reachable by a hard journey) or a
    **hoax** (days wasted). At most one genuine chance per year.
- A **map screen** (M key) drawn in period style showing Port Gannet, the two tracks, Slate
  River, Slateford and the camps (the original shipped a poster map).

## 5. Program/screen structure

Mirror the original's module structure (BBC files INTRO, SUZE, TRAVEL, FTOWN, MINING,
END):

1. **INTRO** — title screen ("Press the SPACE BAR to start"), then new game / resume
   saved game (enter ID number), then arrival narrative at Port Gannet.
2. **SUZE** — Port Gannet hub.
3. **TRAVEL** — journey sequences between Port Gannet and the Slate River diggings.
4. **FTOWN** — Slateford hub.
5. **MINING** — camps and diggings.
6. **END** — end-of-year summary; continue a second year or finish.

All hubs are **numbered/lettered menu screens** (keyboard driven: number keys, letters,
RETURN, SPACE BAR, `@` for kitty, `M` for map), with short narrative paragraphs and
occasional simple illustrations. See §15 for presentation.

## 6. Port Gannet (SUZE)

Starting money: **10s** (effectively penniless; one bad night's lodging wipes it out).

Menu:

1. **Seek work at the wharves/town** — jobs are plentiful, "wages are good" (faithful).
   Wharf labour pays **2s–3s per day** and includes a hot meal; odd jobs pay
   **4s–6s per day**, build port connections faster, and only sometimes include food.
   A week's engagement pays a small bonus. Each day worked = 1 day.
2. **Bell's Outfitters (Port Gannet prices)** — buy equipment **much cheaper than at
   the goldfields** (faithful). Price list §11.
3. **Lodgings each night** (faithful prices): inn dormitory **10s**, stable on straw
   **5s**, rent tent-ground **5s per week** (requires tent), or **sleep rough (free)** —
   sleeping rough or in the stable risks illness and theft; the dormitory has fleas but
   is safe-ish.
4. **Read The Slateford Times (1d)** — news: exchange-rate movements, rushes/strikes at
   particular camps (which temporarily raise that camp's yields), licence-hunt warnings,
   rumours of Widow's Reef, colour stories drawn from the Journal.
5. **Buy The New Chum's Companion (6d)** — in-game access to excerpted
   survival hints from `journal.txt`.
6. **Set out for the diggings** → TRAVEL.

Crime option: **steal from the store or drunks** — quick money, chance of being seen;
raises legal status ladder; if caught → court (§13).

## 7. Travel (TRAVEL)

Choices, then a day-by-day journey with events:

- **Route**: Mercer's Track (**8 days'** walk equivalent) or the Razorback Road (**5 days'**
  walk equivalent, rougher — higher event rates).
- **Mode**:
  - **Walk ("footslogger")** — free. Must carry limited kit (tent + hand tools; no
    cradle unless a barrow is bought). Requires **water bags and provisions** or risk
    thirst/starvation — in summer, travellers **have died of thirst** (faithful):
    running out of water in summer costs severe health loss, possible death.
  - **Wagon ride** — **£3** per person, gear carried; 20% slower than walking pace is
    NOT true — wagons move at walking pace but carry everything and halve fatigue;
    bogging risk in winter mud (lose 1–3 days).
  - **Horseback** — fastest (**3 days** either route). Horses at the Port Gannet dealer:
    **brumby £15** (hardy, finds water, won't eat poisonous plants — faithful) or
    **showy hack £25** (prestige, but suffers in drought/rough country; dealers cheat
    new chums — faithful). A horse also speeds later trips between town and camps.
- **Events en route** (per-day rolls; Razorback Road roughly doubles the bad ones):
  - **Bushrangers bail you up** — lose money/gold; owning a loaded **gun** usually
    scares them off (faithful advice); resisting without one risks injury.
  - **Trooper licence patrol** (only within the Slate River diggings) — see §13.
  - Bogged / flash flood at crossings (winter), thirst (summer), snakebite, meeting
    fellow travellers (rumours, small trades), finding abandoned goods along the track
    (faithful: chests of clothes, books, china — saleable back at Port Gannet for a
    "wonderful profit", but a burden to carry).

Arrival from Port Gannet lands the player at **Slateford**. Between Slateford and each
camp: 1 day on foot (Blackcap Ranges 2), half on horseback.

## 8. Slateford (FTOWN)

Menu:

1. **Bank of Australasia** — best gold **exchange rate** in the colony (§10); deposit
   money (safe from theft; the year-end Bank Draft shows the balance).
2. **Bell's Outfitters** — full equipment and provisions at **inflated diggings prices**
   (typically 2–3× Port Gannet; the Journal records a pan selling for **£16** at the worst
   of a rush — allow rare gouging spikes). Sells everything in §11.
3. **Council Chambers** — buy/renew **miner's licence: 30 shillings for 30 days**
   (faithful); register a claim; lodge complaints (flavour).
4. **Seek work** (faithful job list) — jobs pay daily wages, no licence needed:
   - **Hospital orderly at Canvas House** — ~4s/day, small hygiene/health benefit, plain staff meal on a successful shift.
   - **Store clerk at Bell's** — ~4s/day, occasional store discounts.
   - **Barman at the Crown & Cradle** — ~5s/day, hears rumours early, small risk of
     brawls (grog-shop adjacent).
   - **Market gardener for Lin Wu** — ~3s/day plus fresh vegetables (health bonus;
     scurvy protection).
   - **Council office clerk** — ~6s/day, **refused to anyone with a criminal record**
     (faithful).
5. **Canvas House (hospital)** — treatment costs money (~10s/day of stay) and days, but
   cures illness/injury. Severe illness anywhere triggers automatic carting to Canvas
   House (faithful). Beware quack "doctors" at the camps charging **£10 for surgery**
   (faithful) with uncertain results.
6. **Crown & Cradle / grog shops** — drink and gamble (two-up / cards): fast money
   either direction; drunkenness risks theft, injury, arrest; grog shops are illegal but
   police-protected (flavour, faithful).
7. **Cobb & Co.** — paid coach seat back to Port Gannet (**£2**, 2 days, bushranger-proof
   mostly); the gold escort (flavour, faithful).
8. **Go to the diggings** — Reedbank Camp / Copperhead Gully / Blackcap Ranges (or follow a
   secret-mine rumour).

## 9. Mining (MINING)

At a camp, the player must **peg a claim** (free, one per camp, 12-foot square —
faithful) and hold a **valid licence** to dig legally. Digging without a licence is
possible ("licence dodging", faithful) but troopers hunt diggers (§13).

Methods (day of work each; yields are random draws whose ranges depend on method,
location, equipment, and active "rush" news):

| method | needs | character |
|---|---|---|
| **Fossick** | nothing | free, tiny yields; the fallback of the destitute; allowed without claim (mullock heaps) |
| **Pan** | pan | simple, cheap, slow (faithful); best at Reedbank Camp / Copperhead Gully creeks |
| **Cradle** | cradle, ideally a mate | "easiest and surest way of finding gold, but never in such large quantities as shaft mining" (faithful) — steadier, higher mean; hire a mate for 2s/day or yields halve |
| **Puddling machine** | rent at Copperhead Gully, 5s/day | good in winter when creeks run; watch the owner or lose a little dirt (faithful) |
| **Shaft mining** | pick, shovel, rope & bucket; timber supports & pump strongly advised | Blackcap Ranges (and lucky claims elsewhere). Multi-day sinking (bottoming at 20–100 ft, faithful) with nothing until "bottomed", then chance of striking the reef: the big lottery. **Cave-in risk each day** (much reduced by timber supports), **flooding risk in winter** (reduced by pump). Cave-in: injury, possible death, shaft lost. |
| **Buy shares / company work** | Blackcap Ranges | shares (£5 each, up to 3 — matches the three share certificates shipped with the game) pay dividends at year end scaled to a hidden company-fortune roll; company wages 5s/day, safe but slow |

- **Dryblowing** appears as Journal lore and as the technique at **Widow's Reef**
  (a desert working) if the genuine rumour is followed: no water needed, good yields,
  brutal health toll in summer.
- **Claim-jumpers** may seize an unattended claim (faithful); a gun or a mate deters.
- Nightly camp events: tent robbery ("candle-lighters", faithful — a tent + gun helps),
  grog tent, rumours, snakebite at Copperhead Gully, spider bites, fires.
- Living at camp costs provisions (~1s/day equivalent; bought food at camp stores costs
  2–3× Port Gannet — faithful price notes: bread up to 5s a loaf, water 5s a bucket in
  drought).

## 10. Gold & exchange

- **Exchange rates vary by location** (faithful): camp storekeepers pay poorly
  (~£2 10s–£3 0s per oz, and may **cheat on the scales** — watch the weights, faithful:
  small chance of being short-weighted, reduced if the player chooses to "watch the
  weighing"); **Bank of Australasia in Slateford pays best** (~£3 5s–£3 17s per oz).
- The rate performs a small daily random walk, published in *The Slateford Times* and the
  kitty. Faithful anchor: the period standard price ~£3 17s 10d per oz is the bank-rate
  ceiling.
- Carrying much gold or cash raises robbery stakes; the bank deposit is the safe store.

## 11. Price list (Port Gannet / Slateford typical)

| item | Port Gannet | goldfields |
|---|---|---|
| pan | 8s | £1 4s (rush spikes to £16, rare, faithful anecdote) |
| cradle | £2 | £5 |
| pick | 8s | 18s |
| shovel | 7s | 15s |
| rope & bucket | 11s | £1 4s |
| tent | £1 10s | £4 |
| swag/blanket | 6s | 15s |
| gun (loaded) | £1 10s | £3 |
| water bags | 4s | 12s |
| provisions (per week) | 5s | 12s–15s |
| timber supports (per shaft) | — | £2 |
| pump | — | £4 |
| barrow | 12s | £1 10s |
| *The New Chum's Companion* | 6d | 1s |
| brumby / hack | £15 / £25 | — |

## 12. Health

- Ailments (all named in sources): **dysentery** (dirty water/camp squalor — the big
  killer, faithful), **typhoid**, **scurvy** (no vegetables for long stretches; Lin Wu's
  produce protects), **Sandy Blight** (summer dust — temporarily blinds: lost days),
  **sunstroke** (summer work), **snakebite/spider bite**, injuries (cave-in, brawl,
  bushranger, flood).
- Risk drivers: sleeping rough, camp squalor, bad water, summer heat, winter cold and
  wet, overwork while Poorly.
- Health recovers slowly with rest + provisions; quickly (but expensively) at Canvas
  House. Reaching **Gravely ill** away from town → automatic cart to Canvas House, fees
  deducted, many days lost. Health 0 → death → END with obituary.

## 13. Law

- **Licence**: 30s / 30 days (faithful). Troopers run **digger hunts** at the camps
  (base ~1 in 8 digging days; the Times sometimes warns of a sweep). Caught without a
  licence:
  - option to **bribe ~£5** ("a fiver is a good-sized bribe for most troopers",
    faithful) — usually works, small chance the trooper is honest → worse;
  - otherwise **chained to the logs** to await the **monthly magistrate** (up to 30 days
    lost, faithful), then fined (£5–£10) or, if unable to pay, **30 days'** hard labour.
- Offences (theft, claim-jumping, grog selling, licence dodging, unpaid fines) advance
  the ladder **honest → petty criminal → minor criminal → major criminal → wanted
  criminal** (faithful). A record blocks council work (faithful) and raises trooper
  attention. Status can improve one rung per 90 clean days.
- Being **wanted** triggers active police pursuit events.

## 14. Balance targets (tuning contract)

Simulated over many seeded runs (see §16):

- A player who never leaves Port Gannet and just works ends the year with roughly
  **£15–£30** — survival, not fortune (mirrors the design intent: wages alone won't do).
- A cautious licensed panner/cradler at Reedbank Camp typically ends with **£50–£250**.
- A skilled strategy (cradle + good exchange timing + shaft or shares when capitalised)
  can reach **£500–£2000**; the shaft/secret-mine lottery allows rare windfalls beyond.
- An unlicensed, careless, or unlucky player frequently ends the year broke, jailed, or
  dead. Death rate for a reasonable strategy should be **under ~10%**, but visible.
- Nothing is a guaranteed win; variance is the point (the Journal: "your strike may
  never come").

## 15. Presentation (faithful 8-bit feel)

- **Full-screen retro terminal aesthetic**: chunky pixel font, low-fi 8/16-colour
  palette in the spirit of the C64/BBC originals (deep blue background, light cyan/
  yellow text is a good anchor), scanline-free but blocky; simple blocky illustrations /
  dithered scene headers for each location are welcome but optional.
- **Keyboard-first**: menu numbers/letters, RETURN, SPACE BAR ("Press the SPACE BAR" on
  the title screen, faithful), `@` opens the kitty (faithful), `M` map. Mouse/touch on
  menu items also works.
- Persistent **status bar** at the bottom of every screen (kitty summary, faithful).
- Text is presented in short paragraphs with a "more…" SPACE advance for longer
  passages. All copy in period idiom; lift phrases from `journal.txt` freely.
- **Save/load**: saving issues a **game ID number** the player is told to write down
  (faithful ritual); state stored in `localStorage` keyed by ID (plus a convenience
  "continue last game").

## 16. Technical requirements

- **Stack**: Vite + TypeScript, no UI framework — plain DOM. Must run with
  `npm install && npm run dev` and build statically with `npm run build`.
- **Architecture**: pure simulation engine (`src/engine/`) completely separated from
  rendering (`src/ui/`). The engine is a state machine: `(state, action, rng) → (state,
  narration events)`. All randomness through an injectable **seeded RNG**.
- **Tests (Vitest)**: unit tests for currency arithmetic, state transitions, licence/
  law flows, health, exchange; **simulation harness** that auto-plays strategy bots
  (idler, cautious panner, aggressive shafter, licence dodger) over hundreds of seeded
  years and asserts the §14 balance targets and invariants (money ≥ 0, no impossible
  states, game always terminates).
- `README.md`: how to run, how to play (keys), provenance note crediting the original
  and sources.

---

# PROGRESSION UPLIFT (§17–§22)

The clone above is faithful and fun, but every camp plays the same and the year has no
shape. Sections §17–§22 amend it with an **upward capability ladder**: pan → cradle and
mates → shafts and capital → **your own mining company**. Depletion and rushes are the
*push* between rungs, never the loop itself. Design principle: every new location or
tier must hand the player a genuinely new verb, and the year must end somewhere the
player could not have stood on day 1 — as a labourer become capitalist, or a rebel, or
a dead man in the Times.

Nothing here breaks period fidelity: companies floating shares, licence agitation
boiling over in December 1854, worked-out ground and rushes are all *more* faithful to
the sources, not less.

## 17. Ground that runs out — claims, prospecting, rushes (amends §9)

### 17.1 Claim quality & depletion

`claims: Record<CampId, boolean>` becomes `Record<CampId, Claim | null>`:

```ts
interface Claim {
  /** Hidden richness multiplier ×100 (so 100 = 1.0×). Rolled when pegged. */
  quality: number;      // clamp 25–300
  /** Days of digging done on this ground. */
  workedDays: number;
  peggedOn: number;
  /** Set when a shaft on this claim bottoms on payable wash. Gates company flotation. */
  proven: boolean;
}
```

- **Quality roll at peg**: `quality = round(100 * freshness(camp) * (0.35 + 0.65 * rng.exponential()))`,
  clamped 25–300. (`rng.exponential()` has mean 1 — most ground is ordinary, some is a
  little marvel.)
- **Depletion**: `depletionFactor(workedDays)` = 1.0 for the first 12 worked days, then
  linear decline to a floor of **0.3 at 50 days**. A claim is "worked out" (floor
  reached) permanently.
- **Yield hook** (in `rollYield`): for pan/cradle/puddle/shaft/dryblow on a pegged
  claim, multiply by `quality/100 * depletionFactor`. The old flat `*0.8` no-claim
  penalty becomes: digging without a claim works the common ground at
  `0.55 * freshness(camp)` and never depletes (the destitute fallback). Fossicking is
  unchanged (mullock heaps).
- `workedDays` increments once per day dug on the claim (any method except fossick).
- When a mining spell hits the depletion floor mid-spell, interrupt with a clear line
  ("the wash has gone off; this ground is worked out") and stop the spell — the game
  telling the player it is time to move.
- **Abandon & re-peg**: new action `abandonClaim` (current camp). Pegging again rolls a
  fresh quality against *current* freshness. One claim per camp at a time, as before.

### 17.2 Camp freshness — rushes are the engine of movement

New per-camp state `freshness: Record<CampId, number>` (start 1.0; Widow's Reef 1.4).

- Baseline decay: −0.0009/day for each of the three ordinary camps (fields get picked
  over across the year; ~0.67 by December).
- **Rush**: when a rush starts at a camp (existing `RushNews`), set that camp's
  freshness to `rush.factor` (1.5–2.6). While the rush runs, freshness decays linearly
  from `factor` back to the pre-rush baseline at `rush.untilDay` — **the earlier you
  arrive and peg, the richer the roll**. The old blanket `rushFactor()` yield
  multiplier is **removed**; a rush now pays through pegging fresh ground (and a modest
  ×1.15 on common ground while it runs).
- The Times already announces rushes; camp talk at the Crown & Cradle should too.

### 17.3 Prospecting — a new verb

Action `prospect` (1 day, needs a pan; any camp):

- On your pegged claim: report the claim's quality in period bands with noise
  ("duffer's ground" <60, "poor wash" 60–90, "fair wash" 90–130, "promising" 130–180,
  "rich dirt, keep it quiet" 180+). Noise: estimate = quality × uniform(1±err), where
  err = 0.6 / 0.35 / 0.18 by wash-skill level (§18).
- With no claim pegged: sample the open ground — an estimate of `freshness` ("this
  gully is picked over" / "there is still gold in this ground" / "the ground here is
  all but untouched").
- Small consolation: `rng.chance(0.3)` finds 1–6 centi-oz while dishing.
- Counts as a digging day for hunts and wash skill.

## 18. New chum → old hand — skill & standing (new)

### 18.1 Skill

`skill: { wash: number; shaft: number }` — days of experience (wash: pan, cradle,
puddle, dryblow, prospect; shaft: sinking and driving).

Levels: **new chum** (0–29) · **digger** (30–89) · **old hand** (90+). Effects:

| effect | new chum | digger | old hand |
|---|---|---|---|
| duffer chance | ×1.0 | ×0.85 | ×0.7 |
| yield | ×1.0 | ×1.08 | ×1.16 |
| shaft feet/day | ×1.0 | ×1.15 | ×1.3 |
| prospect error | ±60% | ±35% | ±18% |
| hunt evasion bonus | +0 | +0.05 | +0.10 |

The kitty names the rank ("You came out a new chum; you are an old hand at the wash
now."). Level-ups get a journal entry and a narration line.

### 18.2 Standing

`standing: number` 0–100. A digger's name on the field. Earned: +0.25 per honest
wage-day, +1 per gold sale at the bank, +2 per licence bought, +5 for attending the
monster meeting (§20); −10 per rung of legal worsening. Never decays. Gates:

- **≥ 25**: council clerk job (in addition to a clean record).
- **≥ 30**: a **partner** offers himself when you hire a mate — new action
  `takePartner` (and `dissolvePartnership`). A partner costs no wage but takes **50%
  of gross gold** won while partnered. Full cradle factor, mate bonuses to shaft work,
  claim-jump and night-theft rolls halved. `partner: boolean` replaces day-counted
  mateship when active.
- **≥ 30**: may float a company (§19). The proven Blackcap Ranges claim and capital,
  rather than a second reputation grind beyond partnership, are the main gates.
- **≥ 60**: Bell knows your name — 10% off store goods (not provisions).

## 19. The company — labourer become capitalist (amends §9 shares row)

The existing three-certificate £5 share purchase in the Blackcap Ranges company stays
as-is (the small-time flutter). This section is the player's *own* company.

### 19.1 Floating

At the **company office (Blackcap Ranges)** or **Council Chambers**, action
`floatCompany`, available when **all** hold:

- standing ≥ 30, legal status no worse than petty criminal;
- a **proven** claim at Blackcap Ranges (a shaft bottomed payable there, ever — §17.1);
- £100 or more in hand + bank (the clerk will not register paupers).

Flotation: registration fee **£10**. The company issues **20 shares at £10**. The
player subscribes **8–16 shares** (choice of 8/12/16; pays £80/£120/£160 into the
treasury); the rest are offered to the public. Public shares sell over the following
weeks — per week each unsold share sells with probability
`0.25 + standing/400 + (lastQuarterProfitable ? 0.15 : 0) − agitation/400`. Proceeds
to treasury. Company name is generated period-style ("The Golden Hope Quartz Mining
Co.", "Band of Hope & Albion Consols", …) and printed everywhere.

The player's proven claim converts to the company's **first lease** (its quality
carries over; company leases deplete at half the §17 rate — deeper ground).

### 19.2 Running it

New screen `company` (from Blackcap Ranges camp menu and Slateford council menu).
State:

```ts
interface Company {
  name: string;
  treasury: number;          // pence
  sharesOwned: number;       // player's
  sharesPublic: number;      // sold to the public
  sharesUnsold: number;
  sharePrice: number;        // pence, walks weekly
  crews: Crew[];             // max 3
  leases: Lease[];           // max 4; { quality, workedDays, proven }
  weekProfit: number[];      // trailing record for reports & price
  foundedOn: number;
}
interface Crew { task: 'mine' | 'prospect' }
```

- **Hire/fire crews** (`hireCrew`/`fireCrew`): a crew is four wages-men, **£6/week**
  from the treasury. Hiring only at Blackcap Ranges.
- **Assign** (`setCrewTask`): mining crews work the best un-worked-out lease; a
  prospecting crew has a 0.22/week chance (+0.06 if the player is an old hand at
  shaft work) of proving a new lease (quality rolled off camp freshness × reef).
- **Weekly tick** (every 7th day in `endDay`, wherever the player is): each mining
  crew wins gold worth `£10 × quality/100 × depletionFactor × rng.exponential()`
  (sold at bank rate into the treasury); 4% chance/crew-week of a cave-in: £10–£30
  compensation from treasury, the lease loses a week, small chance the crew quits.
  Wages come out of the treasury; if it cannot pay, the player's pocket is tried; if
  neither can, crews walk off, share price halves, standing −10.
- **Dividends** (`declareDividend`): pay `X` per share out of the treasury to *all*
  shareholders (player pockets their fraction; the public's share simply leaves).
  Dividends push the share price up and sell unsold shares faster.
- **Share dealing**: `sellOwnShares(n)` / `buyBackShares(n)` at the current price
  (public must have appetite: buys limited by the same uptake probability). Selling
  below 5 retained shares = **selling out**: the company leaves the state entirely,
  final payment at price × shares, journal entry, epilogue flag.
- **Share price**: starts £10; walks weekly ±10% biased by trailing profit, dividends
  paid, agitation (§20), and cave-ins.

Company value (`sharesOwned × sharePrice + treasury × sharesOwned/20`) counts in
`netWorth`. Weekly report line in the log when the player is at Blackcap Ranges or
reads the Times ("The Golden Hope washed 31 oz for the week").

### 19.4 The mine goes down (amends §19.1–19.2; the second-year arc)

The company exists to give the game a **second year**: the player floats it late in
year one, gets it standing on its feet, and continues past the year's end to take it
deep. So a lease stops being ground that wears out and gets dropped, and becomes a
**named mine** that is developed downward for as long as the player dares pay for it.
Everything in §19.2 about crews, wages, shares, dividends, uptake and price stands
except where amended here.

**The lease.** Replaces the §19.2 `Lease` entirely:

```ts
interface Lease {
  name: string;        // "the North Star", "the Perseverance" — fixed at discovery
  reef: number;        // ×100 quality of the lode, rolled at discovery; never shown as a number
  level: number;       // 0 = an unbottomed show; 1+ = bottomed levels, each a sunk project
  face: number;        // crew-weeks of payable stone left at the current level
  yieldNow: number;    // ×100 worth of the stone now being broken; rolled when a level or drive is opened
  wet: boolean;        // rolled at discovery (40%); ALL ground below level 2 counts wet
  pump: boolean;       // pumping plant installed on this lease (treasury capital)
  timbered: boolean;   // standing timber-work installed (treasury capital)
  flooded: boolean;    // a flooded mine yields nothing until dewatered
  progress: number;    // crew-weeks put into the current development job
  plan: 'sink' | 'drive' | null; // what a developing crew is at on this lease
}
```

- `COMPANY_MAX_LEASES` falls **4 → 2**. Two named mines, worked deep, are the game;
  churning ground is not. Worked-out leases are never auto-lapsed; an idle lease
  simply stands. Abandoning one (new action `abandonLease`) forfeits all plant and
  development sunk in it, so it is the last resort, not the loop.
- The founding claim converts to a lease at **level 1** with a rolled face (4–6
  crew-weeks), `yieldNow` from the claim's quality, `reef` = claim quality, wet rolled.
- A prospecting strike (same chance as §19.2) now yields a **level-0 show**: named,
  `reef` rolled by the existing formula, wet rolled; £5 take-up fee from treasury. If
  both slots are full the find is driven into the poorest lease instead: fresh face
  (3–5 crew-weeks) at a freshly rolled `yieldNow` on its current level.

**Crews.** `Crew` becomes `{ task: 'mine' | 'develop' | 'prospect'; lease?: number }`
(index into `leases` for mine/develop; a mining crew with no assignment takes the best
open face). `setCrewTask` gains the optional lease index.

**Development.** A crew put to `develop` on a lease executes its `plan`
(action `setLeasePlan`):

- **Sink** to the next level: needs `sinkWeeks(level) = 2 + floor(level / 2)`
  crew-weeks; each crew-week costs `COMPANY_SINK_COST` (£8, timber and powder) from
  treasury. Ground below level 2 (or wet at any level) cannot be sunk or mined
  without a pump installed. On completion: `level += 1`, roll
  `yieldNow = reef × (1 + 0.22 × (level − 1)) × clamp(rng.exponential())` and
  `face = 4–7` crew-weeks. **Deeper is richer on average and dearer to reach** —
  each level is a capital gamble on the same mine, and a deep level can still bottom
  on poor stone (that is the lottery).
- **Drive** along the current level: 1 crew-week, `COMPANY_DRIVE_COST` (£4); rolls a
  fresh `yieldNow` at ×0.85 the level's depth factor and a smaller face (2–4 weeks);
  20% chance of a duffer (nothing; the week and the money are gone). The cheap,
  modest continuation when the face cuts out.
- **Dewater** happens automatically when a develop crew is put on a flooded lease
  with a working pump: 2 crew-weeks, no materials cost.

**Water.** In winter, each lease that is wet-or-deep and unpumped floods with 10%
chance per week (`flooded = true`, narrated). A pumped lease never floods, but the
pump breaks with 3% chance per week: repair £8–£15 paid from treasury automatically
if it can; if it cannot, the pump stands broken (flag off) until the treasury can,
and the flood risk returns. Personal shafts (§17) lose the Bell portable pump:
Bell **no longer sells pumps**; instead the Blackcap Ranges camp offers **"engage
the pump-man"** (new action `hirePumpman`, £2 10s) which sets `shaft.pumped` on the
player's current shaft. A pump still carried from an old save keeps working.

**Plant.** Per-lease capital from treasury, action `installPlant`:
- **Pumping plant** — £35. Required for deep/wet sinking and mining as above.
- **Timber-work** — £20. Halves the cave-in chance on that lease.

Company-wide, action `buyBattery`: **a stamping battery, £150** capital plus £3/week
upkeep. Until it is owned, all crushing is paid for: **15% of every mining crew's
gross revenue** goes in battery fees (`COMPANY_CRUSH_FEE`). The battery is the big
mid-game capital decision the share float exists to finance.

**Driving rate.** One company-wide policy, action `setDriving`,
`'cautious' | 'ordinary' | 'hard'`: output ×0.8 / ×1.0 / ×1.3; cave-in chance
×0.5 / ×1 / ×2; face consumed ×0.8 / ×1 / ×1.45. Hard driving on untimbered deep
ground is how the disaster happens; cautious driving is how a thin treasury survives
winter.

**Mining week.** Each mining crew on an open, unflooded face wins
`COMPANY_CREW_WEEK × (yieldNow/100) × drivingOut × rng.exponential()` gross; crushing
fees off the top unless the battery is owned; `face` falls by the driving wear (when
it reaches 0 the level is cut out and the mine waits on a decision — sink, drive, or
stand idle, narrated once). Cave-ins as §19.2, halved by timber, scaled by driving;
a cave-in also knocks 1 off `face`.

**The books.** The company keeps `lastWeek` for the ledger pane:

```ts
interface WeekBooks {
  revenue: number; crushing: number; wages: number;
  development: number; upkeep: number; compensation: number; net: number;
}
```

The company screen shows it as a ruled weekly statement (stone won, crushing and
cartage, wages, development, upkeep, compensation, net) in place of the bare profit
trail. Shares are the financing layer, exactly as §19.2: the battery and the deep
levels are what the public's money is *for*.

**Balance (amends §22 targets).** The magnate's year-one median falls to
**£400–£700** (still above the aggressive shafter): development weeks earn nothing,
crushing takes its slice, and plant eats the treasury. The payoff moves to year two:
a held company worked deep through a second year should show median company value
(player's holding + dividends taken) at least **×2** its end-of-year-one figure, and
clearly beat selling out at year one and digging on. Bots: the magnate bot learns to
sink, install plant and buy the battery; a two-year magnate variant is added to the
harness. The tuning agent may report a target as unreachable with evidence and a
trade-off curve rather than forcing it.

## 20. A year with a shape — the licence agitation (new)

1854 boils. `agitation: number` 0–100:

- +0.15/day from day 120; +2 whenever the player is stopped in a hunt; +1 per
  Times licence story; capped at 100. Never falls before the confrontation.
- Effects while rising: hunt chance ×(1 + agitation/250); Times runs escalating
  agitation stories (meetings, burned licences, the Commissioner's men jeered).
- **Monster meeting**, first camp night in the window day 240–260: attend
  (+5 standing, agitation +5, tiny arrest risk if the player has a record) or keep
  to your tent.
- **The stockade**, window day 330–345 (December): the diggers rise at **Copperhead
  Gully**. If the player is at any camp (or Slateford) they must choose:
  - **Join them**: 8% killed, 30% wounded (injury, severity 2), 25% arrested if the
    stockade falls (it always falls, faithfully to history — but the cause wins);
    survivors gain +30 standing, a journal entry to be proud of, and the epilogue
    remembers it.
  - **Keep clear**: no effect.
  - **Sell to both sides** (requires a store of provisions or a company): £20–£60
    profit, −15 standing, claim-jump and night-theft chances +50% for the rest of
    the game (the field remembers too).
  - Company owners who join see their share price drop 20% (nervous shareholders);
    company owners who sell supplies gain treasury but the −15 standing stings.
- **Aftermath**, from day 350 (and all of year two): licence hunts **cease**. The
  Council sells a **miner's right — £1 for the year** replacing the 30s/30-day
  licence. The Times reports the change. (Historically the licence died with the
  Eureka Stockade; the game's fiction follows.)
- If the player is at Port Gannet for the whole window it happens off-stage in the
  Times; the aftermath still applies.

## 21. UX pass (amends §15)

- **Net-worth history**: sample `netWorth` weekly into `worthHistory: number[]`. The
  END screen renders a 52-week sparkline in block glyphs (▁▂▃▄▅▆▇█) with start/peak/
  final figures — the shape of your year at a glance.
- **Rate trend**: keep the last 14 days of `bankRate` (`rateTrail`). Kitty, bank and
  Times show a period-idiom trend word ("gold is rising / easing / steady") plus
  the direction over the week.
- **Licence at a glance**: at any camp, the status line adds `Licence 12d` (or `NO
  LICENCE`). Starting a mining spell that will outlive the licence warns first:
  "your licence dies on Thursday, mid-spell."
- **Map**: mark the player, pegged claims, an active rush ("a RUSH at Copperhead
  Gully"), and the company's workings.
- **Camp screens differ**: each camp screen leads with what is *distinct* there
  (freshness word, rush, puddling machine, company office) so moving feels like
  arriving somewhere new.
- **Spell interrupts**: worked-out claim stops the spell (§17.1); licence expiry
  mid-spell emits a warning line the day it lapses.

## 22. Balance additions (amends §14; the §14 targets all still hold)

New bots in the harness:

- **rush chaser**: a cradler who re-pegs at whichever camp freshness/rush favours.
  Target: median ≥ 1.25× the static cautious cradler's median (moving must pay).
- **company magnate**: an aggressive shafter who floats a company once proven and
  capitalised, hires crews, declares dividends. Target: median **£800–£3500**,
  p90 ≥ £2000, deaths < 20%. The richest strategy in the game, as it should be —
  the ones who really made money sold shovels and floated companies.
- **stockade note**: bots ignore the stockade (keep clear) except one assertion run
  verifying joining is survivable-but-costly and the aftermath removes hunts.

Retuning latitude: §14's five original targets are the contract; adjust freshness
decay, depletion floor, and quality spread until both old and new targets pass.
Static diggers keep §14 ranges *because* depletion pushes their yield down while
re-pegging and rush-chasing push the skilled player's up.

Save compatibility: bump `v` to 2; `deserialise` migrates boolean claims to
`Claim | null` (true → a quality-100 unproven claim) and defaults all new fields.

---

# THE DARK LADDER — BANDIT MODE (§23–§25)

Bandit mode is the dark mirror of §18–§19: a second capability ladder, digger →
bushranger, ending in "captain of a gang" the way the honest path ends in owner of a
company. There is no mode toggle — the existing legal ladder *is* the entry ramp. The
wanted status stops being a pure punishment and becomes a fork in identity. Period
fidelity holds throughout: bushrangers, harbourers, informers, the McIvor gold escort
robbery (1853) and the "wild colonial boy" tradition are all sources-adjacent; every
line of copy stays in Journal idiom.

Design law (same as §17): **pressure is the push, never the loop.** Heat exists to
drive the outlaw *up* the ladder — go quiet, move districts, or escalate — exactly as
depletion pushes the digger to fresh ground.

## 23. Notoriety, heat, and the outlaw's economy

### 23.1 Entry and the point of no return

- From **minor criminal**, crime verbs appear contextually (greyed-with-note before
  that, faithful to how the game teaches elsewhere). From **wanted criminal**, the
  honest game closes: bank refuses him (no deposit/withdraw/sellGold at bank), council
  and town jobs refuse, no company flotation; camp stores and grog shops still serve.
- The 90-clean-days reform path (§13) stays open **until** `outlawed: boolean` is set
  — by the first big job (§23.4) or by wounding a trooper while resisting. Once
  outlawed, `cleanDayTick` is a no-op; the only exits are §24's endings.

### 23.2 Notoriety — the dark mirror of standing

`notoriety: number` 0–100, never decays. Earned by audacity: successful bail-up +2
(+1 more if the victim "knew the name" — see below), escape from troopers +2, gaol
break +6, bank job +15, escort job +25, surviving the stockade while wanted +10.
Gates:

| notoriety | unlocks |
|---|---|
| ≥ 15 | **`bailUp`** — lurk on a chosen road (Mercer's Track or the Pass) and stick up travellers |
| ≥ 30 | **`makeHideout`** — **Split Rock Camp** beyond Blackcap Ranges: new pseudo-location `hideout`, safe sleep, a **stash** (the outlaw's bank) |
| ≥ 45 | **`recruitGangMember`** (up to 3, at grog tents/sly-grog shanties) — no wage, each takes an equal share of gross takings; enable the big jobs; each is a possible informer |
| ≥ 60 | **the big jobs**: `robBank` (Slateford) and the capstone `robEscort` (Mercer's Track) |

At notoriety ≥ 40, victims sometimes hand over without a fight ("they knew the
name": no resistance roll, +1 notoriety). The Times prints the player's **reward
notice** once wanted: reward = £5 × notoriety/10, rounded to period-plausible sums
(£20, £50, £100, £200, £500 cap), re-printed when it rises. The reward drives
informer probability (§23.5).

### 23.3 Heat — the push

`heat: Record<HeatZone, number>` 0–100, zones `'trickeys' | 'pass' | 'town' |
'camps'`. +12 per crime committed in a zone (+25 for a big job, and half splashes
into adjacent zones); decays −0.8/day. Effects, scaling linearly with the zone's
heat: trooper patrol encounter chance on the roads (0 → 0.05/day at heat 100 for
travellers, ×3 for the lurking bandit), bail-up victim quality falls (travellers warned,
they band together and carry less), hideout search chance (§23.4). While agitation
(§20) is high the troopers are busy with licence hunts: heat *gain* is multiplied by
`1 − agitation/200` — crime gets easier through 1854 and peaks at the stockade.

### 23.4 The verbs

- **`bailUp { route }`** (1 day; needs a gun; a horse strongly advised — without one,
  escape rolls suffer). Rolls a victim off a traveller table (new chums with kit,
  diggers carrying gold home, a squatter's wagon, a Chinese party, a parson with
  nothing). Outcomes: takings (money/gold/salvage), resistance (injury risk; a
  wounded victim = `worsen` 2 rungs and +blood if he dies — cap: victims never die
  unless the player chose to shoot), trooper patrol interruption (heat-scaled).
  Robbing **diggers** marks the field hostile (§23.5); a bandit may choose to let
  poor diggers pass ("a digger's pile is safe with me" — the sympathy play).
- **`makeHideout`** (2 days, in Blackcap Ranges; needs tent + provisions). Adds
  `hideout: { stashPence, stashGold, discovered: boolean } | null`. At the hideout:
  sleep costs nothing and is safe, `stash`/`unstash` money and gold. Each week,
  search chance = camps-zone heat/100 × 0.15, halved per bushcraft rank; if found
  while away, the stash is lost and the Times crows; if found while present, a
  fight-or-flee encounter.
- **`recruitGangMember`** / **`dismissGangMember`**: `gang: GangMember[]` (max 3),
  `{ name, joined, loyalty: number }`. Gross takings split equally with gang present
  (they only matter on jobs; solo bail-ups stay solo). Each member each week may
  inform: chance = reward/£500 × 0.06 × (2 − loyalty), loyalty 0–1 rolled at recruit,
  +0.1 per job they share fairly in. An informer sets the ambush flag on the
  player's next big job (troopers waiting) and quits.
- **`gatherIntelligence`** (1 day, at the Crown & Cradle via a harbourer or a sly-grog
  shanty, costs 5s in shouted drinks): learns one of — the escort's next run day and
  strength (needed before `robEscort` at better than blind odds), whether the bank's
  gold room is full (bank job payout ×1.5 window), or a rich traveller due on a road
  (guaranteed quality bail-up within 3 days). Mirrors prospecting (§17.3): turns
  robbery from a coin flip into a plan.
- **Fencing**: a wanted man exchanges gold only via the **fence** at sly-grog
  shanties (any camp) at **60–70% of bank rate**, or the camp store at its usual bad
  rate while merely criminal. The scales-cheating game inverts: now *he* is the one
  short-weighted.
- **Big jobs** (notoriety ≥ 60, full gang, guns for all — buy them, horses advised):
  - **`robBank`** (Slateford, 1 day): base take £150–£400 (×1.5 in a full-gold-room
    window); 35% base failure (troopers/armed clerk) → fight: wounds, possible
    capture. Success: +15 notoriety, town heat +25, `outlawed` set.
  - **`robEscort`** (the capstone; Mercer's Track; must hold intelligence of the
    run): 2 days' ride and ambush. Take **£1000–£4000** equivalent in gold, split
    with the gang. Without intelligence it is a blind 15% chance of even meeting the
    escort; with it, success 55% (+10% if all mounted, −ambush flag −30%). Failure:
    running fight — each participant 15% killed, 30% wounded; player capture 30% on
    failure. Success: +25 notoriety, all-zones heat +25, `outlawed` set, a newspaper
    front page for the ages.

### 23.5 Sympathy vs. the reward — the moral texture

A rule, not a meter: track `diggersRobbed` and `bigJobsDone`. While
`diggersRobbed === 0` and the player has robbed only banks, escorts and squatters,
the field half-admires him: harbourers **warn of patrols** (one free "the traps are
out" cancel per lurk-week) and gaol-break help is available (§24). Each digger
robbed: camps-zone informer events (+search chance ×1.5, permanent until year end),
and the §19 company path is soured retroactively — standing −10. The wild-colonial-boy
play is to rob the Crown and the banks and never a digger's pile.

### 23.6 Bushcraft — the third skill

`skill.bush: number` (days of bail-ups, lurking, hideout life, escapes). Ranks:
**new chum / flash cove / captain** at 0–29 / 30–89 / 90+. Effects: escape rolls
+0 / +0.08 / +0.15, hideout search chance ×1 / ×0.7 / ×0.45, bail-up takings
×1 / ×1.1 / ×1.2, intelligence cost 5s / 4s / free (the shanty keepers shout *him*).
The kitty names it ("You came out a new chum; the colony calls you Captain now.").

## 24. Endings for an outlaw (amends §1, END)

While `outlawed`, pursuit events escalate with total heat and notoriety (replaces the
flat `pursuitRisk`): troopers at the lodging house, a party of police on the road,
the hideout raid. Capture while outlawed → the **assizes** (not the monthly
magistrate):

- **Hanged** if blood was shed (a trooper or victim killed) — the Times obituary
  runs a ballad verse; game over `dead`, cause "hanged at the Slateford assizes".
- Otherwise **years' hard labour**: game over `finished`, epilogue "the road ends in
  the hulks"; the year tally shows what the Crown confiscated (everything not
  stashed).
- **Gaol break** (offered once, before the assizes sit, if `diggersRobbed === 0` and
  gang or harbourers remain): 40% out (+6 notoriety, back to the hideout), 60% and
  the sentence doubles.

Chosen endings:

- **Got away clean**: at Port Gannet, `buyPassage` (£20, under a false name) — sail for
  California. Recognition chance at the gangway = notoriety/200 (halved if bushcraft
  captain). Success: game over `finished`, victory epilogue; **net worth counts only
  what he got out** (hand + stash — the bank kept anything left there, claims and
  company forfeit).
- **The Eureka pardon**: an outlaw who **joins the stockade and survives** (§20) is
  offered a pardon in the aftermath window — costs the whole stash (restitution),
  clears `outlawed`, legal → petty criminal, keeps notoriety (the name lingers).
  Period-perfect redemption; one offer only.
- Year end while still at large: the year-two continue offer stands (the hunt goes
  on), or finish with the "still out in the ranges" epilogue.

## 25. Balance & harness additions (amends §14/§22 — all prior targets still hold)

New bot **bushranger**: turns criminal early at Port Gannet, buys gun and horse, farms
the roads (rotating on heat), makes a hideout, recruits, gathers intelligence,
attempts the escort when able, tries the California exit at year end. Targets over
seeded runs:

- median outcome **£300–£1500** — between the cautious cradler and the company
  magnate: crime pays better per day than digging, dramatically worse per life;
- **bad-end rate 35–50%** (dead + hanged + hulks) — the worst tail in the game;
- the escort job pays £1000–£4000 gross when it succeeds (the McIvor haul scaled to
  this economy) — the dark ladder's shaft-bottoming lottery;
- an honest-bot control confirms nothing here perturbs §14/§22 targets (a player who
  never turns criminal must never see a bandit-mode event beyond the existing
  bushranger travel events, which now draw from the same victim tables).

Invariants: money/stash ≥ 0; `outlawed` ⇒ legal = wanted criminal; game always
terminates; save `v` → 3 with migration defaulting all new fields (`notoriety` 0,
`heat` zeros, `hideout`/`gang` empty, `skill.bush` 0, `outlawed` false).

---

# THE NOTABLE — CIVIC LADDER (§26–§29)

The third ladder. The company (§19) makes the player a capitalist and the dark ladder
(§23) makes him a captain, but both leave the *world* untouched: towns, prices, roads,
rushes and the Times act on him and never the reverse. §26–§29 add the missing tier —
**status sinks**: large spends of money (gated by standing, §18.2) whose payoff is not a
yield multiplier but a rewrite of the world's own rules. Identity arc: **digger → man of
property → notable of the fields**.

Design law (same as §17/§23): every purchase must hand the player a **new verb or
strike a rule from the world's dice** — visibly, for everyone, with the player's name on
it. Anything that merely pays income at a rate is the company's job, not this ladder's.
Sizing law: the sinks together cost ~£900+; a £300–£500 player must *choose* what kind
of notable to become. Period fidelity holds: publicans, storekeepers who out-earned the
diggers, subscription-built bridges, hospital benefactors and post-Eureka Local Courts
are all sources-adjacent.

## 26. Property — buying a seat at the table (new)

New state:

```ts
interface Estate {
  shamrock: boolean;
  store: { camp: CampId; policy: 'fair' | 'gouge' } | null;
  gazetteShare: boolean;
  works: WorkId[];            // §27, completed public works
  jpSince: number | null;     // §28
}
```

All purchases at the named premises; all require legal status **honest or petty
criminal** (respectability is bought with clean money — a wanted man is refused
everywhere; his sinks live in §28.3). Estate counts in `netWorth` at purchase price.
Each purchase: journal entry, newspaper story, and the deed named in the kitty.

- **The Crown & Cradle** — **£250**, standing ≥ 40, at Slateford. Mrs. Doyle stays on
  to run it. Weekly takings £2–£6 (×1.5 while any rush runs — thirsty diggers), paid
  wherever the player is. The world-rewrite: **all rumour traffic now flows to the
  owner** — secret-mine rumours arrive pre-graded (the barman hears which teller was
  drunk: genuine/hoax revealed), rush news arrives **2 days before** the Times prints
  it (peg ahead of the crowd, §17.2), and `gatherIntelligence` (§23.4) is free and
  discreet. Liability: brawl damages £1–£5 some weeks; if agitation > 70 the troopers
  lean on licensed houses (one shakedown event, £5 or +5 agitation).
- **A store of your own** — **£120 + £30 opening stock**, standing ≥ 30, at any camp
  (one store). The rush economy inverts: weekly profit `£1 × campFreshness × (rush at
  camp ? 3 : 1)` — when the rush hits *your* camp, you are the one selling £16 pans.
  New verb `setStorePolicy`: **fair dealing** (profit ×1, +0.5 standing/week, the camp's
  night-theft rolls against *you* halved — the field protects its honest man) or
  **gouge** (profit ×2, −0.5 standing/week, claim-jump and theft rolls against you
  +25% — the field remembers). The player buys own-kit at cost (Port Gannet prices) at
  their store. A worked-over camp (freshness < 0.5) makes the store a dying concern —
  depletion pushes the storekeeper too.
- **A half-share in The Slateford Times** — **£200**, standing ≥ 50, at Slateford.
  Trivial income (£1/week); the point is the **press**. New verb `placeStory`
  (1 day, at Slateford, max one story per 14 days):
  - **Talk up a camp**: the Times cries a strike at a chosen camp → a **called rush**
    (§17.2 rush, factor 1.3–1.7) begins there in 2 days. The player knows it's paper;
    the field doesn't. If the camp's true freshness < 0.6 the rush collapses in a week
    of duffer ground and the field learns whose paper called it: **−15 standing**, no
    called rush believed for 60 days. Print truth about fresh ground and no one is the
    wiser. (Prospect first, §17.3 — the press is a rifle, not a shotgun.)
  - **Press the licence question**: agitation +8 and one guaranteed hunt-warning
    (the next sweep is printed before it runs). The player can *steer the year toward
    the stockade*.
  - **Soothe the field**: agitation −5 (floor: never below 40 after day 240 — the
    boil-over cannot be printed away; history still happens).
  - **Kill a reward notice** (merely criminal, not `outlawed`): the player's own
    misdeeds go unprinted — all heat zones decay ×2 for 14 days. Once per year; if
    later outlawed, a rival paper prints *that* he bought silence: notoriety +5,
    standing −20.

## 27. Public works — striking rules from the dice (new)

Subscribed at the **Council Chambers** (the Council puts up a plaque; the Times
prints the subscription list with the player's name at its head). Pure sinks — no
income, ever. Each grants **+10 standing**, a journal entry, and a permanent,
field-wide rule change:

| work | cost | the rule it strikes |
|---|---|---|
| **Bridge over Slate River** | £120 | winter bogging/flood-crossing events on the Slateford–Reedbank Camp leg **removed for all travel** (player, escort, everyone); that leg costs half a day |
| **Water race to a chosen camp** | £80 | at that camp: carried water is no longer consumed, summer thirst and dust events halved, **Sandy Blight struck from its event table**, puddling works year-round (§9), camp freshness decay −25% (water washes more ground) |
| **A ward at Canvas House** | £100 | treatment **free for the subscriber, half-price for the field**; dysentery/typhoid base rates at all camps ×0.8 (the sick are carted out before it spreads) |
| **A school at Slateford** | £60 | pure standing (+15 total) and the epilogue's warmest line; year two: one educated youngster turns up as the best mate/crew hire in the game (wage-free mate, loyalty 1.0) |

Works persist into year two. The map (§21) marks them. When a struck event *would*
have fired, occasionally narrate the absence ("the coach rolls over Vun's Bridge;
the old crossing would have swallowed a wheel this day") — the player must *see* the
world obeying them.

## 28. The notable of the fields (new)

### 28.1 Justice of the Peace — the apex verb

In the **aftermath** (§20, day ≥ 350) or year two, at the Council Chambers:
`acceptCommission` — offered when standing ≥ 60, legal status honest, and at least
one §26 property or two §27 works held. Costs a **£50 subscription** to the Court
fund. The player is gazetted J.P.:

- Once per month, a **court day** at Slateford (1 day): 2–3 cases drawn from the
  game's own event tables (a licence dodger — year two vagrants, a claim-jumper, a
  drunk who wrecked the Crown & Cradle, a captured bushranger). Verb per case: **leniency**
  (camps heat −5, agitation −3, +1 standing with the field) or **severity** (town
  heat −8, theft/claim-jump event rates −10% for 30 days, −1 standing — the field
  respects but does not love a hard bench).
- The player's own petty scrapes are quietly no-billed (fines waived while J.P.);
  being *convicted* of anything real forfeits the commission, −30 standing, Times
  front page.
- The kitty's resume line becomes the ladder's summit: "arrived a new chum; sits on
  the Slateford bench now."

### 28.2 Epilogue (amends END)

The END tally gains an **Estate** section: properties, works (with plaque lines),
the commission. Epilogue precedence when multiple ladders were climbed: hanged/dead >
California > company sold out > **J.P./notable** > company held > captain at large >
old hand > survivor. A notable's epilogue is about the *town*, not the pile: what
Slateford looks like because he was there.

### 28.3 The dark mirror (amends §23)

Respectability refuses the wanted man, but the dark ladder gets its own two sinks,
same design law (world-rewrite, not multiplier):

- **Buy the sly-grog shanty** at a chosen camp — **£80**, notoriety ≥ 30: the fence
  rate there rises to **80% of bank rate** (his own scales now), `gatherIntelligence`
  free, and the shanty's harbourers extend the §23.5 patrol warning to *every* week
  regardless of the diggers-robbed rule. If troopers raid it (camps heat > 60,
  4%/week) the £80 is ash.
- **Retain a lawyer in Slateford** — **£60/quarter**, via the shanty: at the
  assizes (§24) "years' hard labour" becomes a defended trial — 35% acquitted
  (walk free, notoriety +8), else sentence stands. Hanging is never lawyered away
  (blood is blood).

## 29. Balance & harness additions (amends §14/§22/§25 — all prior targets hold)

New bot **the notable**: a cautious cradler-then-storekeeper who buys the store by
day ~150, works and subscribes, takes the commission when offered. Targets:

- median **£250–£900** — below the company magnate (property income alone must not
  beat mining capital; the *point* of this ladder is the world, not the pile);
- deaths < 8% (the safest late game, as respectability should be);
- assertion: a called rush on genuinely fresh ground (freshness ≥ 0.9) yields the
  caller re-pegging profit ≥ 1.3× staying put; a called rush on stale ground costs
  net standing (lying to the field must not be free);
- assertion: bridge + water race + ward measurably reduce the harness's event counts
  (struck rules stay struck); honest-bot control confirms §14/§22/§25 targets
  unmoved when no estate is bought.

Invariants: at most one store, one shanty; J.P. ⇒ honest at gazettal; estate values
≥ 0. Save `v` → 4; migration defaults `estate` to empty, no works, `jpSince` null.

## 30. Life at the Crown & Cradle (amends §8.6, §26)

The Crown & Cradle currently sells two verbs (drink, gamble) and treats every man the same.
It becomes the room where the game **reflects the player's name back at him** — the
social readout for all three ladders, and home of the period's most authentic status
sink: *shouting the bar*.

### 30.1 The room reads you

On entering, one reception line keyed to standing (or notoriety, whichever tale is
taller), before the menu:

| tier | reception |
|---|---|
| standing < 15 | **new chum**: nobblers watered (drink costs full price, half effect), card sharps seek him out (gambling odds worsened ~5%), nobody talks (rumours vague or absent) |
| 15–39 | **known face**: fair measures, straight games, ordinary rumour access |
| 40–59 | **a respected man**: the settlers' corner; rumours arrive unasked (one free newspaper-grade item per visit); parlour gambling unlocked — higher stakes (£1–£5 a hand) against squatters and warders, fair odds |
| ≥ 60 | **the field's own**: some nights the room shouts *him* (free drink, +1 health, flavour); the landlord's table — one `gatherIntelligence`-grade item per week, free, honest-flavoured |
| notoriety ≥ 40 | the dark mirror: benches clear, talk stops; if `diggersRobbed === 0` an admirer stands him a drink and a warning ("the traps were asking after a man of your description" — next pursuit event telegraphed); any drinking visit while wanted: 4% an informer slips out (one pursuit event within 3 days) |

Barman job (§8.4) gains a line: while employed there, the player *is* the room's ear —
reception-tier rumour benefits at one tier above his standing.

### 30.2 Shouting the bar — the authentic sink

New verb `shoutTheBar` (evening, at the Crown & Cradle or any camp grog tent):

- **Shout the room** — cost `2s × heads present` (roughly £1–£3 town, 10s–£1 camp
  tents): +2 standing (capped: shouts count at most once per 14 days — generosity
  remembered, extravagance mocked), the room talks (one rumour, quality by venue), and
  the night passes merrily (+2 health, unless already drunk).
- **The spree** — the full gold-mad performance, £15–£25: champagne at 30s the bottle
  for the whole house, the fiddler paid to play till dawn. +5 standing (same 14-day
  cap shared with shouts), a **paragraph in the Times** ("a lucky digger entertained the
  town royally on Tuesday night"), a journal entry, next day lost with a sore head
  (−5 health) — and the town *knows he's flush*: theft/bail-up rolls against him +25%
  for 7 days. Faithful to the sources' men who "have eaten £10 notes in mutton"
  sandwiches; the copy should reach for exactly that register.
- If the player **owns the Crown & Cradle** (§26): shouting his own house costs half (the
  wholesale price of generosity) and spree reports in the Times mention the house — takings
  ×1.25 the following week.
- Bandit colour: a wanted man shouting a sly-grog shanty (same costs via the fence's
  prices) buys **loyalty, not standing** — every gang member present +0.1 loyalty
  (§23.4), and the shanty's harbourers warn him free for a week.

### 30.3 Balance note (amends §29)

Standing from drink is capped (max +5 per 14 days from §30.2) so the ladder cannot be
bought by rounds alone; the £15–£25 spree is deliberately the *worst* £-per-standing
in the game — it exists because it is what the sources say men actually did, and it
makes the room love you *tonight*, which is its own reward.

## 31. Price relativities — authenticity pass (amends §6, §9, §11, §14)

The Journal states exact relativities; the tuning must preserve them and the copy
should *voice* them. Contract (all from `journal.txt`):

1. **The licence scandal is arithmetic**: 30s/month = 1s/day = £18/year, "when a
   labourer's wage is five shillings a week, and shepherds receive a miserable ten
   pounds a year". The colonial baseline wage is **5s/week**; the licence story in the Times
   stories and the agitation copy (§20) must quote this sum. Boom wages (port 2s–4s
   a day, town 3s–6s) stand — the Journal's own reason: "workers are scarce, the
   wages are good" — but at least one Port Gannet narration should marvel at earning
   "a shepherd's month in a week".
2. **A night's bed costs days of wages** (why the new chum sleeps rough): dormitory
   10s, stable 5s, tent-ground 5s/week — already faithful; never soften them.
3. **Freight is the villain at the diggings**: camp provisions currently flat
   12s–15s/week; make them **12s–25s/week**, scaling with season and rush (drought/
   rush pushes bread to its faithful 5s-a-loaf, water to 5s a bucket, and the
   narration says so). Flour at £20 the hundredweight is the quotable spike.
4. **Drink is priced nowhere in §11** — add:

   | drink | Port Gannet | Crown & Cradle | camp grog tent / sly-grog |
   |---|---|---|---|
   | nobbler (brandy) | 6d | 1s | 1s 6d |
   | pot of ale | 4d | 6d | 1s |
   | bottled ale / porter | 1s 6d | 2s 6d | 4s |
   | champagne, the bottle | 12s | 30s | 30s+ (when they have it) |

   Drunkenness risk per session unchanged (§8.6); the grog tent's liquor is worse
   (add a small illness roll — "colonial rum" cut with tobacco water, faithful to
   the register if not the letter).
5. **The suppliers out-earn the diggers** ("more likely to make a fortune than the
   diggers"): §26 store profit and §29's notable-bot median must keep the *storekeeper
   beats the average digger, loses to the lucky one* shape — that line is the thesis
   of the whole civic ladder.
6. **£16 pan, £10 quack surgery, £5 bribe, £20/cwt flour** — already placed; treat
   as immovable.

Harness addition: a **relativity assertion** — over seeded years, median honest
*daily* digging take at a fair claim must sit between the town daily wage and 3× it
(digging must tempt, not guarantee — the Journal's whole argument for why the wharves
empty), and one week of camp provisions must never fall below 2× Port Gannet's price.

---

# HEARTH & KIN — THE COURTSHIP ANCHOR (§32)

Port Gannet is early game only: cheap kit, wages, then the road, returning only to sell
salvage or flee. §32 makes it the game's **hearth** — the mid/late-game anchor and a
motivation the tally cannot measure. The player is a new chum who came out alone; the
year can end with a household he built. Sources: the Journal's *Goldfields Women*
chapter ("astute businesswomen… free women doing similar work to the men"), the
Scally obituaries, mail day on the diggings, and the subscription balls of the fields.

Design law (same as §17/§23/§26): **no meter, no upkeep, no visit-or-else decay.**
The arc advances by discrete dated events; the household pays in verbs and
rule-strikes, never income-at-a-rate. Missing an event never costs money or health —
it marks the *story* (a cold letter, a broken engagement, an epilogue line).

Taste law (binding on all copy and mechanics): **she is a person, not a purchase.**
Courtship advances by kept calls and the player's name on the field — never by money
spent. There is no affection meter and no ranking of suitors. She acts: she consents,
declines, and can end it herself, always with her reasons in the copy. The register
is the Journal's — respectful, dry, period — and never leering.

## 32.1 Courtship

State:

```ts
interface Hearth {
  intended: Intended | null;     // the person courted / married
  rung: 'none' | 'acquainted' | 'courting' | 'betrothed' | 'wed' | 'settled'
      | 'estranged';
  cottage: boolean;              // the Port Gannet household exists
  nextEvent: HearthEvent | null; // one dated pull at a time
  eventsKept: number; eventsMissed: number;
  homeStashPence: number; homeStashGold: number;
  letters: Letter[];             // unread mail waiting at any post office
}
interface Intended {
  name: string;                  // period names, generated
  trade: 'storekeeper' | 'nurse' | 'boarding-house';
  /** flavour axis for copy, not a stat: 'dry wit' | 'devout' | 'bookish' | … */
  manner: string;
}
```

- **Meeting** (rung → `acquainted`): the game introduces exactly one prospective
  partner at a time, through surfaces the player already inhabits — a **subscription
  ball** at Slateford (announced in the Times, 2–3 per year, ticket 5s, standing ≥ 25
  to be received; the ball is also a §30-grade social night for anyone), the
  Crown & Cradle's respected corner (§30.1 tier, standing ≥ 40), being nursed at Canvas
  House, or Lin Wu's garden. She is the Journal's astute businesswoman — a
  storekeeper's daughter keeping her father's books, a nurse from Canvas House, a
  widow who runs a boarding house — rolled with a name, trade and manner. Her
  people are at **Port Gannet**; if nothing comes of the meeting, nothing comes of it.
- **Paying addresses** (`payAddresses`, then `callAtThePort`): courting means
  calling at Port Gannet — each call a dated window the player requests (2–7 days,
  ~3–4 weeks apart, printed in a letter). A call is an evening of period scenes
  (walking the esplanade, tea with her people, her opinion of the diggings — copy
  keyed to her trade and manner). After **2–3 kept calls**, *she decides*:
  betrothal is her consent, weighed openly on standing, record, and calls kept —
  and she may decline with reasons ("she'd not follow a man she has met thrice to
  a tent at Copperhead Gully"). Small gifts (≤ 5s, from her trade's wants) colour a
  call. A **lavish** gift is read in context, not by its price: rare, and from a
  man whose name she already knows (standing ≥ 30), it lands as plain generosity —
  a warm scene, nothing more. Press a second one on her inside the month, or offer
  one before your name has earned it, and it cools the courtship — **"she is
  nobody's purchase."** Either way her consent is never bought: money moves the
  roll not at all, in any direction.
- **Banns & wedding**: `betrothed` → banns read at Port Gannet (Times line) → the
  wedding (dated window, **£10–£20**, a §30-style shout, +3 standing, journal
  entry) → `wed`. A record worse than petty criminal and her family refuses the
  banns (she may not — §32.5).
- **Her side of the ledger**: miss two call windows running, or let the legal
  ladder worsen mid-courtship, and *she* ends it by letter — rung `estranged`, her
  reasons plain, no meter shown or kept. One courtship per year at most; a broken
  one does not re-roll a new suitor for 60 days, and never re-rolls the same one.

**The cottage** (`buyCottage`, Port Gannet, **£60–£120** by size) houses them; rung
`settled` = wed + cottage. She keeps her trade after the wedding (faithful — "free
women doing similar work to the men"): the household supports itself, **no weekly
drain**; what the player leaves or sends is his choice (§32.3).

## 32.2 What the hearth grants — verbs and struck rules

All require `cottage` and rung ≥ `wed`/`settled`:

- **Home strikes the port's dice**: sleeping at the cottage is free and safe (the
  10s dormitory, stable, and sleep-rough illness/theft rolls all struck at Port
  Gannet); `homeStash` is theft-proof storage — a second bank at the port end (and
  the outlaw's only honest-side vault, §32.5).
- **Hearth convalescence**: resting at home heals **+6 health/day** (best in the
  game, better than Canvas House) and costs nothing. Gravely-ill carting (§12) goes
  to the *cottage* instead of Canvas House if the player is at Port Gannet or on the
  port side of the map — illness now pulls him home.
- **The port agent** (`consignGoods`, at Slateford via Bell's Freight, 2s
  freight): track-salvage and goods sell at **Port Gannet prices without the trip**;
  gold may be consigned to the homeStash (escort-safe). This is *her* acumen, and
  her trade colours which arm is strongest (flavour-sized, not a ranking): the
  storekeeper's daughter clears consignments at the best figure; the nurse's
  hearth convalescence runs +1 health/day over the base; the boarding-house widow
  hears the wharves — newly-landed labour calls at your door first, and hiring a
  mate or crew within 7 days of any ship's docking rolls the **best-quality hire
  in the game** (year two: the §27 schoolhouse youngster arrives this way).
- **Letters** — a channel mirroring the Times, collected at any post office
  (Port Gannet, Slateford) for 1d: family news in period voice, every dated event
  printed ahead, and the emotional ledger — letters warm or cool with
  `eventsKept/Missed` and remittances. Mail day at the camps (weekly) announces
  waiting letters by name.

## 32.3 The pull calendar — 3–5 events a year, one collision

`nextEvent` schedules at most one dated pull at a time, ~3–5 per year total, each a
2–7 day window at Port Gannet: the calls while courting, the banns and the wedding,
**Christmas at the hearth** (day ~359 — deliberately inside the stockade
aftermath), a birth (year two, or late year one if wed early), a sickbed (the
Scally shadow: wife or child down with typhoid — being there + paying a real
doctor **£5** rolls well; absence rolls the period's dice honestly, and the game
does not flinch). Kept events warm letters and advance rungs; missed events mark.
**Two consecutive missed events** (or the sickbed missed with a death) → rung
`estranged`: verbs revoked, letters stop, epilogue changed; one reconciliation
offer per game (a month's presence at the port, `eventsKept` reset hard) — and
none at all if the estrangement was her breaking off the courtship (§32.1): that
door closes as she said it would.

**The collision (engineered, once per year)**: one hearth event is scheduled to
land in the same week as a genuine rush or (if the player owns shafts/company) a
strike week. The wharf or the pile — the system's signature choice, printed with
full knowledge in advance. No mechanical punishment either way; the letters and
the epilogue remember which.

`sendRemittance` (any bank/post office, any sum): a pure sink — buys nothing but
the tone of the next letter, `journal` entries, and the epilogue's arithmetic of
what the year was *for*.

## 32.4 The tally that isn't money (amends §1, END, §28.2)

END gains a **Hearth** section: the household, events kept and missed, remittances,
the final letter — the year read back through their eyes. The game still makes no
judgment; the family does, gently. Epilogue precedence (§28.2) amended: hanged/dead
> California **(with or without them — different lines)** > `estranged` (its own
cold line, outranking every success) > company sold out > J.P./notable > **settled
hearth** > company held > captain at large > old hand > survivor. A settled hearth
plus any other summit compounds the warmest endings in the game.

## 32.5 The dark mirror (amends §23–§24)

- A wanted man's household will **harbour** him — the cottage is the one roof
  pursuit events cannot reach. But harbouring is a crime: each visit while wanted
  rolls `townHeat/100 × 0.2` that troopers trail him — if the house is marked,
  next visit is an ambush and the family faces harbouring charges (arrest event,
  £20 bail from his pocket or stash, rung → `estranged`). The anchor becomes an
  ache he cannot safely touch; his letters route through the sly-grog shanty (1s
  the fence's fee).
- **The sweetheart of the ranges** (ballad-faithful): courtship while merely
  criminal may continue at a lower gate (her family refuses banns; she doesn't) —
  she warns of one pursuit event per month (the §23.5 harbourer rule, personal).
  If he is taken, the §24 informer at the wedding table is the period's saddest
  song: one gang member's loyalty roll decides whether the marked house was sold.
- **Got away clean, together**: `buyPassage` extends to the household — £20 a head.
  Recognition roll unchanged; success with family aboard is the dark ladder's
  warmest epilogue. The **Eureka pardon** (§24) reopens the banns.

## 32.6 Balance & harness (amends §14/§22/§25/§29 — all prior targets hold)

Sizing: honest path all-in ~**£80–£150** (ball tickets and calls + wedding £10–£20
+ cottage £60–£120), beside the §26–§27 sinks — the £300–£500 player chooses what
kind of man to become. New bot **the family man**: cautious cradler, courts from
the first ball, keeps every call and event, consigns salvage, remits monthly.
Targets:

- median **£40–£150 below the cautious cradler's** median (the hearth costs real
  days and pounds and must not be a profit strategy) but the **lowest death rate
  in the game** (< 5% — hearth convalescence and port nights are the safest year);
- pull events cost **≤ 22 days/year** total including travel (the anchor must not
  eat the year);
- assertion: missing every event costs **£0 and 0 health** versus keeping none
  scheduled (no punishment loops — only rung/epilogue divergence);
- assertion: total money spent during courtship has **zero effect** on her consent
  roll (gifts are flavour; a *pattern* of lavishness — repeated inside the month,
  or lavish while standing < 30 — strictly cools, while a rare well-earned one
  never helps nor harms consent — the taste law is load-bearing and tested);
- assertion: `consignGoods` + port-agent hiring make a rush-chaser-with-hearth
  within 10% of the plain rush chaser's median (the anchor must not tax the
  ambitious into ignoring it);
- honest-bot control: a player who never engages sees no hearth event, ever.

Invariants: at most one hearth, one intended at a time; `estranged` is reachable
only through missed events or her stated reasons, never through poverty; homeStash
≥ 0; save `v` → 6, migration defaults `hearth` to `{ intended: null, rung: 'none' }`
with empty fields.
