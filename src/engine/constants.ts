/**
 * Every tuning knob in the simulation lives here.
 *
 * Prices marked (faithful) are lifted straight from The New Chum's Companion or the
 * Teacher's Guide. The rest are period-plausible inventions tuned against the
 * balance targets in GAME_SPEC.md §14 by the strategy-bot harness.
 */

import { lsd, pounds, shillings, pence } from './money';
import type { BushRank, CampId, ItemId, JobId, MiningMethod, SkillRank, WorkId } from './types';

// ---------------------------------------------------------------------------
// Money & time
// ---------------------------------------------------------------------------

export const STARTING_MONEY = shillings(10); // (faithful: effectively penniless)
export const LICENCE_COST = shillings(30); // (faithful: 30s a month)
export const LICENCE_DAYS = 30; // (faithful)
export const JOURNAL_PRICE_SUZE = pence(6); // (faithful: "Price — Six pence")
export const JOURNAL_PRICE_FIELDS = shillings(1);
export const GAZETTE_PRICE = pence(1);

// ---------------------------------------------------------------------------
// Store prices
// ---------------------------------------------------------------------------

export interface PriceRow {
  suze: number;
  fields: number;
  camp: number;
}

const P = (s: number, f: number, c: number): PriceRow => ({ suze: s, fields: f, camp: c });

export const PRICES: Record<ItemId, PriceRow> = {
  pan: P(shillings(8), lsd(1, 4), lsd(1, 12)), // (faithful spec table)
  cradle: P(pounds(2), pounds(5), pounds(6)),
  pick: P(shillings(8), shillings(18), shillings(24)),
  shovel: P(shillings(7), shillings(15), shillings(20)),
  ropeBucket: P(shillings(11), lsd(1, 4), lsd(1, 12)),
  tent: P(lsd(1, 10), pounds(4), lsd(4, 10)),
  swag: P(shillings(6), shillings(15), shillings(18)),
  gun: P(lsd(1, 10), pounds(3), lsd(3, 10)),
  waterBags: P(shillings(4), shillings(12), shillings(15)),
  barrow: P(shillings(12), lsd(1, 10), lsd(1, 16)),
  timber: P(pounds(3), pounds(2), lsd(2, 10)), // only useful at the diggings
  pump: P(pounds(6), pounds(4), lsd(4, 10)),
  journal: P(JOURNAL_PRICE_SUZE, JOURNAL_PRICE_FIELDS, JOURNAL_PRICE_FIELDS),
};

/** A week's provisions. (faithful: 5s at the port, 12s-15s at the diggings) */
export const PROVISIONS_WEEK = { suze: shillings(5), fields: shillings(12), camp: shillings(15) };
export const WATER_FILL = { suze: pence(6), fields: shillings(1), camp: shillings(5) }; // 5s a bucket in drought (faithful)

export const HORSE_PRICE = { brumby: pounds(15), hack: pounds(25) }; // (faithful spec table)

/**
 * Bell's occasionally gouges shamefully — The Times recorded a miner's pan
 * selling for £16 (faithful). Rare, and only at the diggings.
 */
export const GOUGE_CHANCE = 0.04;
export const GOUGE_MULTIPLIER = { lo: 3, hi: 13 };

// ---------------------------------------------------------------------------
// Lodgings (faithful prices)
// ---------------------------------------------------------------------------

export const LODGING = {
  inn: { nightly: shillings(10), safety: 0.97, comfort: 1.0 },
  stable: { nightly: shillings(5), safety: 0.9, comfort: 0.5 },
  tentground: { weekly: shillings(5), safety: 0.93, comfort: 0.7 },
  rough: { nightly: 0, safety: 0.85, comfort: 0.0 },
} as const;

// ---------------------------------------------------------------------------
// Wages
// ---------------------------------------------------------------------------

export interface JobDef {
  id: JobId;
  name: string;
  where: 'suze-port' | 'fields-town' | 'deep-mountains';
  lo: number;
  hi: number;
  blurb: string;
}

export const JOBS: Record<JobId, JobDef> = {
  wharf: {
    id: 'wharf',
    name: 'Labouring on the wharves',
    where: 'suze-port',
    lo: shillings(2),
    hi: shillings(3),
    blurb: 'Humping cargo off the ships. Hard on the back; a hot meal comes with a full shift.',
  },
  town: {
    id: 'town',
    name: 'Odd jobs about the town',
    where: 'suze-port',
    lo: shillings(4),
    hi: shillings(6),
    blurb: 'Lighter, steadier errands that introduce you to merchants, ostlers and agents.',
  },
  orderly: {
    id: 'orderly',
    name: 'Hospital orderly at Canvas House',
    where: 'fields-town',
    lo: shillings(3),
    hi: shillings(5),
    blurb: 'Carrying stretchers and boiling linen. A plain staff meal comes with a full shift.',
  },
  clerk: {
    id: 'clerk',
    name: "Store clerk at Bell's",
    where: 'fields-town',
    lo: shillings(3),
    hi: shillings(5),
    blurb: 'Weighing flour and arguing over prices. Bell allows his man a discount.',
  },
  barman: {
    id: 'barman',
    name: 'Barman at the Crown & Cradle',
    where: 'fields-town',
    lo: shillings(4),
    hi: shillings(6),
    blurb: 'Pulling ale for diggers. Every rumour on the field crosses that counter.',
  },
  gardener: {
    id: 'gardener',
    name: "Market gardener for Lin Wu",
    where: 'fields-town',
    lo: shillings(2),
    hi: shillings(4),
    blurb: 'Hoeing cabbages out past the flat. Lin Wu sends you home with greens.',
  },
  council: {
    id: 'council',
    name: 'Council office clerk',
    where: 'fields-town',
    lo: shillings(5),
    hi: shillings(7),
    blurb: 'A paper swell at last — but the Council will not have a man with a record.',
  },
  companyMine: {
    id: 'companyMine',
    name: 'Wages man for the company',
    where: 'deep-mountains',
    lo: shillings(4),
    hi: shillings(6),
    blurb: 'Steady pay underground, and none of the gold is yours.',
  },
};

/** Some days there is simply no work to be had. */
export const NO_WORK_CHANCE = 0.10;
/** A week's engagement pays a small bonus. */
export const WEEK_BONUS = shillings(1);

// ---------------------------------------------------------------------------
// Living costs
// ---------------------------------------------------------------------------

/** Health lost per day with no food in the swag. */
export const STARVATION_HEALTH = 6;
export const THIRST_HEALTH_SUMMER = 16;
export const THIRST_HEALTH_OTHER = 7;

// ---------------------------------------------------------------------------
// Gold & exchange
// ---------------------------------------------------------------------------

/** The period standard: £3 17s 10d an ounce is the ceiling the bank will pay. */
export const BANK_RATE_CEILING = lsd(3, 17, 10);
export const BANK_RATE_FLOOR = lsd(3, 4, 0);
export const BANK_RATE_START = lsd(3, 11, 0);
export const RATE_WALK_STEP = pence(9);

/** How many days of the bank's rate are kept, for the week's trend (§21). */
export const RATE_TRAIL_DAYS = 14;
/** The week the trend word is read over. */
export const RATE_TREND_WINDOW = 7;
/** Less movement than this in a week is no movement at all. */
export const RATE_TREND_THRESHOLD = pence(6);

/** Weekly samples of what a man is worth, for the chart at the reckoning (§21). */
export const WORTH_HISTORY_MAX = 160;
/** Glyphs enough for a year of Sundays. */
export const WORTH_SPARK_WIDTH = 52;

/** Camp storekeepers pay poorly (faithful) — a fraction of the bank's rate. */
export const CAMP_RATE_FACTOR = { lo: 0.7, hi: 0.83 };
export const STORE_RATE_FACTOR = { lo: 0.79, hi: 0.9 }; // Bell's in Slateford
export const SHORT_WEIGHT_CHANCE = 0.22;
export const SHORT_WEIGHT_CHANCE_WATCHED = 0.05;
export const SHORT_WEIGHT_LOSS = { lo: 0.06, hi: 0.22 };

// ---------------------------------------------------------------------------
// Mining
// ---------------------------------------------------------------------------

/** Mean centi-ounces a day before location, luck and season are applied. */
export const METHOD_YIELD: Record<MiningMethod, number> = {
  fossick: 4,
  pan: 21,
  cradle: 36,
  puddle: 44,
  shaft: 168, // only once bottomed on a payable reef
  dryblow: 52,
  company: 0,
};

/** Proportion of days that turn up nothing whatever. */
export const DUFFER_CHANCE: Record<MiningMethod, number> = {
  fossick: 0.42,
  pan: 0.3,
  cradle: 0.24,
  puddle: 0.22,
  shaft: 0.12,
  dryblow: 0.28,
  company: 0,
};

export interface CampDef {
  id: CampId;
  name: string;
  /** Days from Slateford on foot. */
  daysFromTown: number;
  alluvial: number;
  reef: number;
  /** Multiplier on nightly crime rolls. */
  crime: number;
  /** Multiplier on sickness rolls. */
  squalor: number;
  blurb: string;
}

export const CAMP_DEFS: Record<CampId, CampDef> = {
  'damp-camp': {
    id: 'damp-camp',
    name: 'Reedbank Camp',
    daysFromTown: 1,
    alluvial: 1.0,
    reef: 0.5,
    crime: 0.7,
    squalor: 1.15,
    blurb: 'The nearest camp to Slateford; a wet creek flat, modest but steady.',
  },
  'snakey-gully': {
    id: 'snakey-gully',
    name: 'Copperhead Gully',
    daysFromTown: 1,
    alluvial: 1.2,
    reef: 0.65,
    crime: 1.6,
    squalor: 1.3,
    blurb: 'A rowdy, crowded gully. Good dirt, bad neighbours, and snakes.',
  },
  'deep-mountains': {
    id: 'deep-mountains',
    name: 'Blackcap Ranges',
    daysFromTown: 2,
    alluvial: 0.55,
    reef: 1.0,
    crime: 0.85,
    squalor: 0.95,
    blurb: 'Shaft and reef country, and the big company mines. The great lottery.',
  },
  'secret-mine': {
    id: 'secret-mine',
    name: "Widow's Reef",
    daysFromTown: 5,
    alluvial: 1.5,
    reef: 1.35,
    crime: 0.4,
    squalor: 1.0,
    blurb: 'An abandoned desert reef known to a handful of men, and a trail towards a legendary nugget.',
  },
};

export const MATE_WAGE = shillings(2); // (faithful: hire a mate for 2s a day)
export const PUDDLER_RENT = shillings(5); // (faithful: rent the horse-powered machine)
export const PUDDLER_SKIM_CHANCE = 0.3;
export const PUDDLER_SKIM = { lo: 0.05, hi: 0.18 };
/** Working a cradle single-handed is wretched work. */
export const CRADLE_SOLO_FACTOR = 0.5;

export const SHAFT_DEPTH = { lo: 20, hi: 100 }; // feet (faithful)
export const SHAFT_FEET_PER_DAY = { lo: 5, hi: 10 };
export const SHAFT_PAYABLE_CHANCE = 0.34;
/** Reef country: the great lottery, and the ground a company is floated on. */
export const SHAFT_PAYABLE_CHANCE_DEEP = 0.57;
export const SHAFT_RICH_DAYS = { lo: 6, hi: 42 };
export const SHAFT_BONANZA_CHANCE = 0.06;
export const SHAFT_BONANZA_MULT = { lo: 3, hi: 14 };

export const CAVEIN_CHANCE = { untimbered: 0.028, timbered: 0.005 };
export const CAVEIN_DEATH = 0.05;
export const CAVEIN_INJURY_HEALTH = { lo: 12, hi: 45 };
export const FLOOD_CHANCE_WINTER = { unpumped: 0.13, pumped: 0.03 };

export const SHARE_PRICE = pounds(5);
export const MAX_SHARES = 3; // three share certificates shipped with the game (faithful)
export const DIVIDEND_MULT = { lo: 0, hi: 4.5 };

export const CLAIM_JUMP_CHANCE = 0.05;

// ---------------------------------------------------------------------------
// Ground that runs out — claims, depletion, freshness
// ---------------------------------------------------------------------------

/** Quality at pegging: 100 × freshness × (base + spread × an exponential draw). */
export const CLAIM_QUALITY_BASE = 0.35;
export const CLAIM_QUALITY_SPREAD = 0.65;
/** Most ground is ordinary; a little of it is a marvel. */
export const CLAIM_QUALITY_CLAMP = { lo: 25, hi: 300 };

/** A dozen days of full wash, then the ground thins away to two-fifths of it. */
export const DEPLETION_FREE_DAYS = 12;
export const DEPLETION_FLOOR_DAYS = 50;
export const DEPLETION_FLOOR = 0.4;

/** Common ground, worked by any man without pegging. It never runs out, and never pays. */
export const COMMON_GROUND_FACTOR = 0.55;
/** What the common ground is worth while a rush is on it. */
export const COMMON_GROUND_RUSH = 1.15;

export const FRESHNESS_START = 1.0;
export const FRESHNESS_SECRET = 1.4; // no man has scratched it yet
/** The fields are picked over as the year goes on — about two-thirds left by December. */
export const FRESHNESS_DECAY_PER_DAY = 0.0009;
/** Even the oldest field has some gold in it, for a man prepared to work. */
export const FRESHNESS_FLOOR = 0.45;

/** Dishing while you prospect turns up a colour now and then. */
export const PROSPECT_FIND_CHANCE = 0.3;
export const PROSPECT_FIND = { lo: 1, hi: 6 };

// ---------------------------------------------------------------------------
// New chum → old hand: skill and standing
// ---------------------------------------------------------------------------

/** Days of the trade wanted for each rung. */
export const SKILL_DIGGER_DAYS = 30;
export const SKILL_OLD_HAND_DAYS = 90;

export const SKILL_DUFFER: Record<SkillRank, number> = {
  'new chum': 1.0,
  digger: 0.85,
  'old hand': 0.7,
};
export const SKILL_YIELD: Record<SkillRank, number> = {
  'new chum': 1.0,
  digger: 1.08,
  'old hand': 1.16,
};
export const SKILL_FEET: Record<SkillRank, number> = {
  'new chum': 1.0,
  digger: 1.15,
  'old hand': 1.3,
};
/** How wide of the mark a man's guess at his own ground is. */
export const SKILL_PROSPECT_ERROR: Record<SkillRank, number> = {
  'new chum': 0.6,
  digger: 0.35,
  'old hand': 0.18,
};
/** An old hand knows the gullies to be down in when the troopers ride through. */
export const SKILL_EVASION: Record<SkillRank, number> = {
  'new chum': 0,
  digger: 0.05,
  'old hand': 0.1,
};

export const STANDING_MAX = 100;
export const STANDING_WAGE_DAY = 0.25;
export const STANDING_GOLD_SALE = 1;
export const STANDING_LICENCE = 2;
/** A man loses more name by one bad turn than he gains by a month of honest days. */
export const STANDING_PER_RUNG = 10;

export const STANDING_COUNCIL_JOB = 25;
export const STANDING_PARTNER = 30;
export const STANDING_DISCOUNT = 60;

/** A partner draws no wage: the pair divide the gold share and share alike. */
export const PARTNER_SHARE = 0.5;
/** Bell knows your name: a tenth off the goods, and not a penny off the flour. */
export const STORE_DISCOUNT = 0.1;

// ---------------------------------------------------------------------------
// The player's own company (§19)
// ---------------------------------------------------------------------------

/** A man trusted with a partner is known well enough to promote a company. */
export const COMPANY_FLOAT_STANDING = 30;
export const COMPANY_FLOAT_CAPITAL = pounds(100);
export const COMPANY_FLOAT_MAX_RUNG = 1; // no worse than a petty criminal
export const COMPANY_REGISTRATION_FEE = pounds(10);

export const COMPANY_SHARES = 20;
export const COMPANY_SHARE_PRICE = pounds(10);
/** How many of the twenty a man may keep for himself at the float. */
export const COMPANY_SUBSCRIPTIONS = [8, 12, 16];

export const COMPANY_MAX_CREWS = 3;
/** Two named mines, worked deep, are the game; churning ground is not (§19.4). */
export const COMPANY_MAX_LEASES = 2;
/** Four wages-men to the crew, six pounds the week. */
export const COMPANY_CREW_WAGES = pounds(6);
/** What a crew wins in a week on ordinary ground, before luck. */
export const COMPANY_CREW_WEEK = pounds(22);

// --- the mine goes down (§19.4) --------------------------------------------
/** Timber and powder: what a crew-week of sinking costs the treasury. */
export const COMPANY_SINK_COST = pounds(8);
/** Crew-weeks to bottom the next level: base + floor(level/2). */
export const COMPANY_SINK_BASE_WEEKS = 2;
/** Richer with every level sunk: yield factor 1 + bonus × (level − 1). */
export const COMPANY_DEPTH_BONUS = 0.22;
/** Crew-weeks of stone a freshly bottomed level carries. */
export const COMPANY_FACE_WEEKS = { lo: 4, hi: 7 };
/** A drive along the level: one crew-week of work, and its price in timber. */
export const COMPANY_DRIVE_COST = pounds(4);
export const COMPANY_DRIVE_YIELD = 0.85;
export const COMPANY_DRIVE_FACE = { lo: 2, hi: 4 };
export const COMPANY_DRIVE_DUFFER = 0.2;
/** Chance freshly found ground is wet; below this level all ground counts wet. */
export const COMPANY_LEASE_WET = 0.4;
export const COMPANY_WET_LEVEL = 2;
/** Winter, weekly, per unpumped wet-or-deep lease. */
export const COMPANY_FLOOD_CHANCE = 0.1;
export const COMPANY_PUMP_BREAK = 0.03;
export const COMPANY_PUMP_REPAIR = { lo: pounds(8), hi: pounds(15) };
export const COMPANY_DEWATER_WEEKS = 2;
/** Per-lease plant, from the treasury (§19.4). */
export const COMPANY_PUMP_PLANT = pounds(35);
export const COMPANY_TIMBER_PLANT = pounds(20);
/** The big capital decision the share float exists to finance. */
export const COMPANY_BATTERY_COST = pounds(150);
export const COMPANY_BATTERY_UPKEEP = pounds(3);
/** Until the battery is owned, the public battery takes this off every gross. */
export const COMPANY_CRUSH_FEE = 0.15;
/** Registering a prospecting crew's find with the Council. */
export const COMPANY_TAKEUP_FEE = pounds(5);
/** Output ×, cave-in ×, face wear × — cautious / ordinary / hard (§19.4). */
export const COMPANY_DRIVING: Record<
  'cautious' | 'ordinary' | 'hard',
  { out: number; cavein: number; wear: number }
> = {
  cautious: { out: 0.8, cavein: 0.5, wear: 0.8 },
  ordinary: { out: 1, cavein: 1, wear: 1 },
  hard: { out: 1.3, cavein: 2, wear: 1.45 },
};
/** The pump-man engaged on a digger's own shaft, Bell selling pumps no more. */
export const PUMPMAN_FEE = lsd(2, 10);

export const COMPANY_CAVEIN_CHANCE = 0.04;
export const COMPANY_CAVEIN_COST = { lo: pounds(10), hi: pounds(30) };
export const COMPANY_CAVEIN_QUIT = 0.15;

export const COMPANY_PROSPECT_CHANCE = 0.22;
export const COMPANY_PROSPECT_OLD_HAND = 0.06;
/** A company's new ground is reef ground, and worth more than a creek claim. */
export const COMPANY_LEASE_REEF = 1.35;

export const COMPANY_UPTAKE_BASE = 0.25;
export const COMPANY_UPTAKE_STANDING = 400;
export const COMPANY_UPTAKE_PROFIT = 0.15;
export const COMPANY_UPTAKE_AGITATION = 400;

export const COMPANY_PRICE_WALK = 0.1;
export const COMPANY_PRICE_CLAMP = { lo: pounds(1), hi: pounds(120) };
export const COMPANY_PRICE_PROFIT = 0.09;
export const COMPANY_PRICE_LOSS = 0.05;
export const COMPANY_PRICE_DIVIDEND = 0.08;
export const COMPANY_PRICE_CAVEIN = 0.07;

/** Fewer than five shares retained and a man is out of his own company. */
export const COMPANY_SELLOUT_FLOOR = 5;
export const COMPANY_WALKOFF_STANDING = 10;
/** Nervous shareholders, when the chairman is seen behind the stockade. */
export const COMPANY_JOIN_PRICE_DROP = 0.2;

// ---------------------------------------------------------------------------
// 1854 boils: the licence agitation (§20)
// ---------------------------------------------------------------------------

export const AGITATION_FROM_DAY = 120;
export const AGITATION_PER_DAY = 0.15;
export const AGITATION_PER_HUNT = 2;
export const AGITATION_PER_STORY = 1;
export const AGITATION_MAX = 100;
/** Troopers ride harder as the field grows angrier. */
export const AGITATION_HUNT_SCALE = 250;

export const MEETING_WINDOW = { from: 240, to: 260 };
export const MEETING_STANDING = 5;
export const MEETING_AGITATION = 5;
/** A man with a record who stands up at a monster meeting is remembered for it. */
export const MEETING_ARREST_CHANCE = 0.08;

export const STOCKADE_WINDOW = { from: 330, to: 345 };
export const STOCKADE_CAMP: CampId = 'snakey-gully';
export const STOCKADE_JOIN = { killed: 0.08, wounded: 0.3, arrested: 0.25 };
export const STOCKADE_JOIN_STANDING = 30;
export const STOCKADE_SELL_PROFIT = { lo: pounds(20), hi: pounds(60) };
export const STOCKADE_SELL_STANDING = 15;
/** The field remembers a man who sold to both sides. */
export const STOCKADE_SELL_RISK = 1.5;

/** From here the licence is dead, and the miner's right takes its place. */
export const AFTERMATH_DAY = 350;
export const MINERS_RIGHT_COST = pounds(1); // £1 the year (faithful to what followed Eureka)
export const MINERS_RIGHT_DAYS = 365;

// ---------------------------------------------------------------------------
// Law
// ---------------------------------------------------------------------------

export const HUNT_CHANCE = 0.125; // roughly 1 digging day in 8
export const HUNT_CHANCE_WARNED = 0.4;
export const BRIBE_AMOUNT = pounds(5); // (faithful: "a fiver is a good-sized bribe")
export const BRIBE_SUCCESS = 0.8;
export const BRIBE_SUCCESS_WANTED = 0.5;
export const MAGISTRATE_INTERVAL = 30; // travelling magistrate, once a month (faithful)
export const FINE = { lo: pounds(5), hi: pounds(10) };
export const HARD_LABOUR_DAYS = 30; // (faithful)
export const CLEAN_DAYS_TO_REFORM = 90;

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

export const ROUTES = {
  trickeys: {
    name: "Mercer's Track",
    walkDays: 8, // (faithful spec: the longer, better, crowded road)
    wagonDays: 5,
    horseDays: 3,
    danger: 1.0,
    blurb: 'The better and more popular road; crowded, cluttered with broken drays.',
  },
  pass: {
    name: 'the Razorback Road',
    walkDays: 5,
    wagonDays: 4,
    horseDays: 3,
    danger: 2.0,
    blurb: 'Shorter, but the surface is cruel and the track is lonely.',
  },
} as const;

export const WAGON_FARE = shillings(12);
export const COACH_FARE = pounds(2); // Cobb & Co. to Port Gannet (faithful)
export const COACH_DAYS = 2;

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const HEALTH_MAX = 100;
export const REST_RECOVERY = { lo: 5, hi: 10 };
export const HOSPITAL_FEE_PER_DAY = shillings(10); // (faithful ~10s a day)
export const HOSPITAL_RECOVERY = { lo: 9, hi: 16 };
export const QUACK_FEE = pounds(10); // (faithful: butchers and bakers charging £10 for surgery)
export const SCURVY_DAYS = 95;
export const AUTO_HOSPITAL_HEALTH = 18;
/** Below this the player is "Gravely ill" and is warned of it every night. */
export const GRAVE_HEALTH = 20;

// ---------------------------------------------------------------------------
// News & rumour
// ---------------------------------------------------------------------------

export const RUSH_CHANCE_PER_DAY = 0.014;
export const RUSH_DAYS = { lo: 10, hi: 28 };
export const RUSH_FACTOR = { lo: 1.5, hi: 2.6 };
export const HUNT_WARNING_CHANCE = 0.02;
export const SECRET_RUMOUR_CHANCE = 0.012;
export const SECRET_GENUINE_CHANCE = 0.4;
export const SECRET_TRAVEL_DAYS = 5;

// ---------------------------------------------------------------------------
// Crime by the player
// ---------------------------------------------------------------------------

export const STEAL_STORE = { take: { lo: shillings(8), hi: pounds(3) }, caught: 0.33 };
export const STEAL_DRUNK = { take: { lo: shillings(3), hi: pounds(2) }, caught: 0.22 };
/** A thief who gets clean away is still a thief, and word gets about in time. */
export const STEAL_KNOWN_CHANCE = 0.3;

// ---------------------------------------------------------------------------
// THE DARK LADDER — notoriety, heat, and the outlaw's economy (§23)
// ---------------------------------------------------------------------------

export const NOTORIETY_MAX = 100;
/** What audacity is worth. */
export const NOTORIETY_THEFT = 2;
export const NOTORIETY_PER_RUNG = 5;
export const NOTORIETY_BAILUP = 2;
export const NOTORIETY_KNOWN_NAME = 1;
export const NOTORIETY_ESCAPE = 2;
export const NOTORIETY_GAOL_BREAK = 6;
export const NOTORIETY_BANK = 15;
export const NOTORIETY_ESCORT = 25;
export const NOTORIETY_STOCKADE = 10;

/** What each rung of the dark ladder wants of a man. */
export const NOTORIETY_BAILUP_GATE = 15;
export const NOTORIETY_HIDEOUT_GATE = 30;
export const NOTORIETY_GANG_GATE = 45;
export const NOTORIETY_BIGJOB_GATE = 60;
/** Past this the name goes before him, and some hand over without a word. */
export const NOTORIETY_KNOWN_GATE = 40;
export const NOTORIETY_KNOWN_CHANCE = 0.45;

/** The reward notice: period-plausible round sums, and £500 the cap. */
export const REWARD_STEPS: [number, number][] = [
  [20, pounds(20)],
  [40, pounds(50)],
  [60, pounds(100)],
  [80, pounds(200)],
  [95, pounds(500)],
];

export const HEAT_MAX = 100;
export const HEAT_PER_CRIME = 6;
export const HEAT_PER_BIG_JOB = 25;
/** Half of what a district earns splashes into the districts beside it. */
export const HEAT_SPLASH = 0.5;
export const HEAT_DECAY_PER_DAY = 1.5;
/** While the licence question boils, the troopers have other work (§23.3). */
export const HEAT_AGITATION_RELIEF = 200;

/** Trooper patrols met on the road by an ordinary traveller, at full heat. */
export const PATROL_TRAVELLER_AT_FULL = 0.05;
/** A man lying in the scrub waiting for travellers is met a deal more often. */
export const PATROL_LURK_BASE = 0.018;
export const PATROL_LURK_AT_FULL = 0.09;

/** Takings fall away as a district is warned: travellers band up and carry less. */
export const BAILUP_FIND_BASE = 0.86;
export const BAILUP_FIND_HEAT = 0.0022;
export const BAILUP_TAKE_HEAT = 0.0042;

export interface VictimDef {
  id: string;
  weight: number;
  money: { lo: number; hi: number };
  /** Centi-ounces about him. */
  gold: { lo: number; hi: number };
  /** Chests and swag worth selling at Port Gannet. */
  salvage?: number;
  resist: number;
  /** A digger's pile. The field never forgives the man who takes one (§23.5). */
  digger?: boolean;
}

/** Who comes down a goldfields road, and what he has on him. */
export const BAILUP_VICTIMS: VictimDef[] = [
  {
    id: 'newchum',
    weight: 22,
    money: { lo: shillings(18), hi: pounds(8) },
    gold: { lo: 0, hi: 0 },
    salvage: 1,
    resist: 0.12,
  },
  {
    id: 'digger',
    weight: 26,
    money: { lo: shillings(5), hi: pounds(4) },
    gold: { lo: 70, hi: 470 },
    resist: 0.24,
    digger: true,
  },
  {
    id: 'squatter',
    weight: 19,
    money: { lo: pounds(10), hi: pounds(44) },
    gold: { lo: 0, hi: 0 },
    salvage: 1,
    resist: 0.3,
  },
  {
    id: 'chinese',
    weight: 12,
    money: { lo: pounds(3), hi: pounds(14) },
    gold: { lo: 0, hi: 90 },
    resist: 0.06,
  },
  {
    id: 'parson',
    weight: 6,
    money: { lo: 0, hi: shillings(6) },
    gold: { lo: 0, hi: 0 },
    resist: 0.02,
  },
  {
    id: 'buyer',
    weight: 12,
    money: { lo: pounds(18), hi: pounds(70) },
    gold: { lo: 0, hi: 280 },
    resist: 0.42,
  },
  {
    id: 'trooper',
    weight: 5,
    money: { lo: shillings(8), hi: pounds(2) },
    gold: { lo: 0, hi: 0 },
    resist: 0.85,
  },
];

/** A traveller who fights, and what it costs the man who stops him. */
export const BAILUP_RESIST_HARM = { lo: 5, hi: 22 };
export const BAILUP_SHOT_KILLS = 0.35;

export const SKILL_BUSH_FLASH_DAYS = 30;
export const SKILL_BUSH_CAPTAIN_DAYS = 90;
export const BUSH_ESCAPE: Record<BushRank, number> = {
  'new chum': 0,
  'flash cove': 0.08,
  captain: 0.15,
};
export const BUSH_SEARCH: Record<BushRank, number> = {
  'new chum': 1,
  'flash cove': 0.7,
  captain: 0.45,
};
export const BUSH_TAKINGS: Record<BushRank, number> = {
  'new chum': 1,
  'flash cove': 1.1,
  captain: 1.2,
};
/** The shanty keepers end by shouting the captain himself. */
export const BUSH_INTEL_COST: Record<BushRank, number> = {
  'new chum': shillings(5),
  'flash cove': shillings(4),
  captain: 0,
};

/** Getting away: a horse, a good pair of legs and a knowledge of the gullies. */
export const ESCAPE_BASE = 0.46;
export const ESCAPE_HORSE = 0.15;
export const ESCAPE_NOTORIETY = 400;

export const HIDEOUT_DAYS = 2;
export const HIDEOUT_TRAVEL_DAYS = 2;
export const HIDEOUT_SEARCH_BASE = 0.012;
export const HIDEOUT_SEARCH_AT_FULL = 0.15;
/** They quarter the ranges for a big enough name whatever the district is doing. */
export const HIDEOUT_SEARCH_NOTORIETY = 0.02;
/** The field turns informer against a man who robs diggers (§23.5). */
export const HIDEOUT_SEARCH_HOSTILE = 1.5;

export const GANG_MAX = 3;
export const GANG_LOYALTY = { lo: 0.2, hi: 0.95 };
export const GANG_LOYALTY_PER_JOB = 0.1;
export const GANG_INFORM_SCALE = pounds(500);
export const GANG_INFORM_RATE = 0.06;

export const INTEL_DAYS = 8;
export const INTEL_TRAVELLER_DAYS = 3;
/** A full gold room is worth half as much again to the man who knows of it. */
export const BANK_FULL_MULTIPLIER = 1.5;

export const ROB_BANK_TAKE = { lo: pounds(150), hi: pounds(400) };
export const ROB_BANK_FAIL = 0.35;
export const ROB_BANK_CAPTURE = 0.4;

export const ROB_ESCORT_TAKE = { lo: pounds(1000), hi: pounds(4000) };
export const ROB_ESCORT_BLIND_MEET = 0.15;
export const ROB_ESCORT_SUCCESS = 0.55;
export const ROB_ESCORT_MOUNTED = 0.1;
export const ROB_ESCORT_AMBUSH = 0.3;
export const ROB_ESCORT_DAYS = 2;
export const ROB_ESCORT_KILLED = 0.15;
export const ROB_ESCORT_WOUNDED = 0.3;
export const ROB_ESCORT_CAPTURE = 0.3;

/** The fence at the sly-grog shanties: six or seven parts in ten of the bank. */
export const FENCE_RATE = { lo: 0.6, hi: 0.7 };
export const FENCE_SHORT_WEIGHT = 0.3;
export const FENCE_SHORT_LOSS = { lo: 0.05, hi: 0.2 };

/** Being hunted: the daily roll for a man the Crown wants (§24). */
export const PURSUIT_OUTLAW_BASE = 0.016;
export const PURSUIT_OUTLAW_NOTORIETY = 0.042;
export const PURSUIT_OUTLAW_HEAT = 0.035;

export const GAOL_BREAK_CHANCE = 0.4;

export const PASSAGE_FARE = pounds(20);
export const PASSAGE_RECOGNITION = 200;

// ---------------------------------------------------------------------------
// Gambling
// ---------------------------------------------------------------------------

export const TWOUP_WIN = 0.47;
/**
 * The playable hand returns CARDS_PAYOUT times everything risked. Across the
 * ten hands, three tells and optimal fold/call/raise/bluff decisions, 1.4 leaves
 * the table a 2.13% edge. CARDS_WIN remains the aggregate-action compatibility
 * chance, where the same figure is net winnings rather than a returned stake.
 */
export const CARDS_WIN = 0.38;
export const CARDS_PAYOUT = 1.4;
// A nobbler was a shilling everywhere until §31.4 gave every house its own
// prices; DRINKS is the table now, and nothing is bought at a flat rate.

// ---------------------------------------------------------------------------
// The civic ladder — property & the press (§26)
// ---------------------------------------------------------------------------

export const SHAMROCK_PRICE = pounds(250);
export const SHAMROCK_STANDING = 40;
export const SHAMROCK_TAKINGS = { lo: pounds(2), hi: pounds(6) }; // weekly
export const SHAMROCK_RUSH_FACTOR = 1.5;
/** Rush news reaches the landlord this many days before the Times prints it. */
export const SHAMROCK_RUSH_LEAD_DAYS = 2;
export const SHAMROCK_BRAWL_CHANCE = 0.2; // per week
export const SHAMROCK_BRAWL_COST = { lo: pounds(1), hi: pounds(5) };
export const SHAMROCK_SHAKEDOWN_AGITATION = 70;

export const STORE_PRICE = pounds(120);
export const STORE_STOCK_PRICE = pounds(30);
export const STORE_STANDING = 30;
/**
 * A week behind your own counter, on ground still worth digging. §26 wrote
 * this at £1, which is a tenth of what the store costs to open every year and
 * flatly contradicts the Journal's own thesis that the suppliers were "more
 * likely to make a fortune than the diggers" (§31.5). At £8 a week — against
 * the £2-£3 a careful digger clears after his mate, his licence and the price
 * of flour — the storekeeper beats the average digger, loses to the lucky one,
 * and still waits half a year to see his £150 back. Tuned against §29's
 * notable-bot median (§31.5 is the target this knob exists to hit).
 */
export const STORE_WEEK_BASE = pounds(8);
export const STORE_RUSH_FACTOR = 3;
export const STORE_GOUGE_FACTOR = 2;
export const STORE_POLICY_STANDING = 0.5; // weekly, +fair / −gouge
export const STORE_DYING_FRESHNESS = 0.5;
/** The field protects its honest storekeeper's tent, and remembers the other sort (§26). */
export const STORE_FAIR_THEFT = 0.5;
export const STORE_GOUGE_THEFT = 1.25;

export const GAZETTE_SHARE_PRICE = pounds(200);
export const GAZETTE_STANDING = 50;
export const GAZETTE_WEEK_INCOME = pounds(1);
export const STORY_COOLDOWN_DAYS = 14;
export const CALLED_RUSH_FACTOR = { lo: 1.3, hi: 1.7 };
export const CALLED_RUSH_DELAY_DAYS = 2;
/** Below this true freshness a called rush collapses in duffer ground. */
export const CALLED_RUSH_STALE = 0.6;
export const CALLED_RUSH_STANDING_LOSS = 15;
export const CALLED_RUSH_BURN_DAYS = 60;
export const PRESS_AGITATION_UP = 8;
export const PRESS_AGITATION_DOWN = 5;
/** After day 240 the boil-over cannot be printed away (§26). */
export const PRESS_SOOTHE_FLOOR = 40;
export const PRESS_SOOTHE_FLOOR_DAY = 240;
export const KILL_NOTICE_DAYS = 14;
export const KILL_NOTICE_HEAT_FACTOR = 2;
export const KILL_NOTICE_EXPOSED_NOTORIETY = 5;
export const KILL_NOTICE_EXPOSED_STANDING = 20;

// ---------------------------------------------------------------------------
// Public works (§27)
// ---------------------------------------------------------------------------

export const WORK_DEFS: Record<WorkId, { cost: number; standing: number }> = {
  bridge: { cost: pounds(120), standing: 10 },
  waterRace: { cost: pounds(80), standing: 10 },
  ward: { cost: pounds(100), standing: 10 },
  school: { cost: pounds(60), standing: 15 },
};
/** Dysentery/typhoid base rates at the camps, once the ward is endowed. */
export const WARD_DISEASE_FACTOR = 0.8;
export const WARD_FEE_FACTOR = 0.5; // hospital half-price for the field
export const RACE_SUMMER_FACTOR = 0.5; // thirst & dust events at the raced camp
export const RACE_FRESHNESS_FACTOR = 0.75; // freshness decay slowed

// ---------------------------------------------------------------------------
// The bench, and the dark mirror (§28)
// ---------------------------------------------------------------------------

export const JP_FEE = pounds(50);
export const JP_STANDING = 60;
export const JP_OFFER_DAY = 350; // or year two — see inAftermath()
export const COURT_INTERVAL_DAYS = 28;
export const COURT_LENIENCY = { heat: -5, agitation: -3, standing: 1 };
export const COURT_SEVERITY = { heat: -8, standing: -1, calmDays: 30, crimeFactor: 0.9 };
export const JP_FORFEIT_STANDING = 30;

export const SHANTY_PRICE = pounds(80);
export const SHANTY_NOTORIETY = 30;
export const SHANTY_FENCE_RATE = 0.8;
export const SHANTY_RAID_HEAT = 60;
export const SHANTY_RAID_CHANCE = 0.04; // per week above that heat
export const LAWYER_FEE = pounds(60);
export const LAWYER_DAYS = 90; // the quarter
export const LAWYER_ACQUIT_CHANCE = 0.35;
export const LAWYER_ACQUIT_NOTORIETY = 8;

// ---------------------------------------------------------------------------
// Life at the Crown & Cradle (§30)
// ---------------------------------------------------------------------------

/** What the room costs, by house (§31 drink table). */
export const DRINKS = {
  nobbler: { suze: pence(6), shamrock: shillings(1), camp: pence(18) },
  ale: { suze: pence(4), shamrock: pence(6), camp: shillings(1) },
  bottle: { suze: pence(18), shamrock: lsd(0, 2, 6), camp: shillings(4) },
  champagne: { suze: shillings(12), shamrock: shillings(30), camp: shillings(30) },
};
export const SHOUT_HEAD_COST = shillings(2); // a nobbler a head, roughly
export const SHOUT_HEADS = { town: { lo: 10, hi: 30 }, camp: { lo: 5, hi: 10 } };
export const SHOUT_STANDING = 2;
export const SPREE_COST = { lo: pounds(15), hi: pounds(25) };
export const SPREE_STANDING = 5;
export const SPREE_HEALTH = 5; // the sore head
/** Standing bought at the bar counts once in fourteen days (§30.3). */
export const SHOUT_CAP_DAYS = 14;
export const FLUSH_DAYS = 7;
export const FLUSH_ROBBERY_FACTOR = 1.25;
export const OWN_HOUSE_SHOUT_FACTOR = 0.5;
export const OWN_HOUSE_TAKINGS_FACTOR = 1.25;
export const SHOUT_GANG_LOYALTY = 0.1;
/** Reception tiers (§30.1) read straight off standing / notoriety. */
export const RECEPTION_KNOWN = 15;
export const RECEPTION_RESPECTED = 40;
export const RECEPTION_FIELDS_OWN = 60;
export const RECEPTION_FEARED_NOTORIETY = 40;
export const INFORMER_DRINK_CHANCE = 0.04;

/** What a man gets out of a glass, before the house waters it (§30.1). */
export const DRINK_RELIEF = { nobbler: 2, ale: 1, bottle: 3, champagne: 4 };
/** The new chum's nobbler has been a long way past the water butt. */
export const NEW_CHUM_DRINK_FACTOR = 0.5;
/** And the card sharps find him out (§30.1). */
export const NEW_CHUM_ODDS_FACTOR = 0.95;
/** The settlers' corner: pounds a hand, and no thumb on the scale. */
export const PARLOUR_STAKES = [pounds(1), pounds(2), pounds(5)];
export const PARLOUR_ODDS_FACTOR = 1.05;
/** Some nights the room shouts the field's own man (§30.1). */
export const HOUSE_SHOUTS_CHANCE = 0.35;
/** An admirer stands the wild colonial boy a drink, and a warning. */
export const ADMIRER_CHANCE = 0.15;
/** Colonial rum, cut with tobacco water: the grog tent's own hazard (§31.4). */
export const GROG_TENT_ILLNESS = 0.05;
/** The landlord's table gives up one word in seven days (§30.1). */
export const LANDLORD_INTERVAL_DAYS = 7;
/** How long a friend's warning, or an informer's word, stays good (§30.1). */
export const WARNING_DAYS = 3;
export const INFORMER_DAYS = 3;
/** A week's harbourers bought with one night's grog at your own shanty (§30.2). */
export const SHANTY_WARNING_DAYS = 7;
/** The night passes merrily. */
export const SHOUT_HEAL = 2;

// ---------------------------------------------------------------------------
// Freight is the villain at the diggings (§31.3)
// ---------------------------------------------------------------------------

/** A week's provisions at the diggings runs 12s to 25s, and never outside it. */
export const PROVISIONS_FLOOR = shillings(12);
export const PROVISIONS_CEILING = shillings(25);
/** Summer dries the creeks and winter bogs the drays; either puts flour up. */
export const PROVISIONS_SEASON = { summer: 1.3, autumn: 1.0, winter: 1.25, spring: 1.0 };
/** A rush eats a camp's flour before the bullockies can come up with more. */
export const PROVISIONS_RUSH_CAMP = 1.35;
/** And the town feels it too, every dray on the road being bound the other way. */
export const PROVISIONS_RUSH_TOWN = 1.15;
/** Dearer than this and bread is at its faithful 5s the loaf; the copy says so. */
export const PROVISIONS_DEAR = shillings(21);
/** Cheaper than this and the drays are through. */
export const PROVISIONS_CHEAP = shillings(13);
/** The colonial baseline the Journal measures every price against (§31.1). */
export const LABOURER_WEEK = shillings(5);

// ---------------------------------------------------------------------------
// Hearth & kin — the courtship anchor (§32)
// ---------------------------------------------------------------------------

/** A subscription ball at Slateford: the ticket, and the standing to be received. */
export const BALL_TICKET = shillings(5);
export const BALL_STANDING = 25;
/** The Crown & Cradle's respected corner will make an introduction at this name (§30.1). */
export const SHAMROCK_MEETING_STANDING = 40;
/** Balls a year, announced in the Times. */
export const BALLS_PER_YEAR = 3;
/** Evening calls at Port Gannet: the window, and how far apart they come. */
export const CALL_WINDOW_DAYS = 5;
export const CALL_GAP_DAYS = 24;
/** Kept calls before she will hear a proposal; her consent is hers (§32.1). */
export const CALLS_BEFORE_BANNS = 3;
/** A small gift from her trade's wants; anything past this cools it (§32.1). */
export const GIFT_SMALL_MAX = shillings(5);
/** The wedding at Port Gannet (§32.1). */
export const WEDDING_COST = pounds(15);
export const WEDDING_STANDING = 3;
/** The cottage, by size (§32.1). */
export const COTTAGE_PRICE_SMALL = pounds(60);
export const COTTAGE_PRICE_LARGE = pounds(120);
/** A broken courtship: no new introduction for sixty days (§32.1). */
export const COURTSHIP_BURN_DAYS = 60;
/** Hearth convalescence: the best bed in the colony (§32.2). */
export const HEARTH_HEAL_PER_DAY = 6;
/** The nurse's hearth heals one better (§32.2). */
export const HEARTH_HEAL_NURSE_BONUS = 1;
/** Bell's Freight freight on a consignment to the port (§32.2). */
export const CONSIGN_FREIGHT = shillings(2);
/** Hiring within this many days of a ship docking finds the pick of the wharf. */
export const SHIP_HIRE_DAYS = 7;
/** Christmas at the hearth (§32.3). */
export const CHRISTMAS_DAY = 359;
/** The sickbed's honest doctor (§32.3). */
export const SICKBED_DOCTOR_FEE = pounds(5);
/** Two missed events running is an estrangement (§32.3). */
export const MISSED_RUN_ESTRANGED = 2;
/** Visiting the cottage while wanted: the chance per visit the traps trail him,
 *  scaled by town heat (§32.5). */
export const HARBOUR_TRAIL_SCALE = 0.2;
/** Bail when the household is taken up for harbouring (§32.5). */
export const HARBOUR_BAIL = pounds(20);
/** Passage out for the household, a head (§32.5). */
export const FAMILY_PASSAGE_HEAD = pounds(20);
/** A lavish gift lands as generosity only from a name she knows (§32.1)… */
export const GIFT_LAVISH_STANDING = 30;
/** …and only rarely: a second inside the month reads as purchase (§32.1). */
export const GIFT_LAVISH_GAP_DAYS = 30;
/** What a lavish gift runs to. */
export const GIFT_LAVISH_COST = pounds(2);
