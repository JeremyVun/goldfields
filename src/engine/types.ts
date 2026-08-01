import type { Season } from './time';

export type LegalStatus =
  | 'honest'
  | 'petty criminal'
  | 'minor criminal'
  | 'major criminal'
  | 'wanted criminal';

export const LEGAL_LADDER: LegalStatus[] = [
  'honest',
  'petty criminal',
  'minor criminal',
  'major criminal',
  'wanted criminal',
];

export type LocationId =
  | 'suze-port'
  | 'on-road'
  | 'fields-town'
  | 'damp-camp'
  | 'snakey-gully'
  | 'deep-mountains'
  | 'secret-mine'
  /** A camp in the ranges beyond the Blackcap Ranges that no map shows (§23.4). */
  | 'hideout';

export type CampId = 'damp-camp' | 'snakey-gully' | 'deep-mountains' | 'secret-mine';

export const CAMPS: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains', 'secret-mine'];

export type ItemId =
  | 'pan'
  | 'cradle'
  | 'pick'
  | 'shovel'
  | 'ropeBucket'
  | 'tent'
  | 'swag'
  | 'gun'
  | 'waterBags'
  | 'barrow'
  | 'timber'
  | 'pump'
  | 'journal';

export type MiningMethod = 'fossick' | 'pan' | 'cradle' | 'puddle' | 'shaft' | 'dryblow' | 'company';

export type JobId =
  | 'wharf'
  | 'town'
  | 'orderly'
  | 'clerk'
  | 'barman'
  | 'gardener'
  | 'council'
  | 'companyMine';

export type IllnessId =
  | 'dysentery'
  | 'typhoid'
  | 'scurvy'
  | 'sandyBlight'
  | 'sunstroke'
  | 'snakebite'
  | 'spiderbite'
  | 'injury'
  | 'fever'
  | 'exhaustion';

export interface Illness {
  id: IllnessId;
  /** 1 = a nuisance, 2 = serious, 3 = grave. */
  severity: number;
  /** Day the affliction began. */
  since: number;
  /** Days of work lost each day while it lasts (Sandy Blight blinds you). */
  blinding?: boolean;
}

export type Lodging = 'inn' | 'stable' | 'tentground' | 'rough';

export type HorseKind = 'none' | 'brumby' | 'hack';

export type Route = 'trickeys' | 'pass';
export type TravelMode = 'walk' | 'wagon' | 'horse';

export interface Claim {
  /** Hidden richness multiplier ×100 (so 100 = 1.0×). Rolled when pegged. */
  quality: number;
  /** Days of digging done on this ground. */
  workedDays: number;
  peggedOn: number;
  /** Set when a shaft on this claim bottoms on payable wash. */
  proven: boolean;
  /** Registered at the Slateford Council; useful when a jumper disputes it. */
  registered?: boolean;
  /** Last day the owner or his mate was on the ground. */
  lastAttendedDay?: number;
  /** A paid watchman remains on the claim through this day. */
  guardedUntilDay?: number;
  /** Set quietly while away; the player learns of it on returning. */
  jumpedOn?: number | null;
}

/** Days of experience at the trades a man can learn out here, honest or not. */
export interface Skill {
  wash: number;
  shaft: number;
  /** Days of lurking, bailing up, hideout life and getting away (§23.6). */
  bush: number;
}

export type SkillRank = 'new chum' | 'digger' | 'old hand';

/** What the colony calls a man who has taken to the bush (§23.6). */
export type BushRank = 'new chum' | 'flash cove' | 'captain';

// ---------------------------------------------------------------------------
// The civic ladder (§26-§31)
// ---------------------------------------------------------------------------

/** A public work funded at the Council Chambers (§27). */
export type WorkId = 'bridge' | 'waterRace' | 'ward' | 'school';

export interface PublicWork {
  id: WorkId;
  day: number;
  /** The water race is cut to one camp in particular. */
  camp?: CampId;
}

/** How the player's own store treats the field (§26). */
export type StorePolicy = 'fair' | 'gouge';

export interface OwnStore {
  camp: CampId;
  policy: StorePolicy;
  openedOn: number;
}

/** What a half-share in the Times lets a man print (§26). */
export type StoryKind = 'talkUp' | 'pressLicence' | 'soothe' | 'killNotice';

/** Everything a man of property holds, and what the town lets him do with it. */
/** What a house sells over its counter (§31.4). */
export type DrinkId = 'nobbler' | 'ale' | 'bottle' | 'champagne';

export interface Estate {
  shamrock: boolean;
  store: OwnStore | null;
  gazetteShare: boolean;
  works: PublicWork[];
  /** Day gazetted Justice of the Peace; null until the commission (§28.1). */
  jpSince: number | null;
  /** Next monthly court day, once commissioned. */
  nextCourtDay: number;
  /** Day of the last placed story; the press runs one in fourteen days. */
  storyPlacedOn: number;
  /** A called rush that collapsed: no called rush believed for sixty days. */
  calledRushBurnedOn: number;
  /** A hard bench keeps the field quiet until this day (§28.1); 0 is never. */
  severityUntilDay: number;
  /** The one-per-year silence bought of the Times (§26). */
  noticeKillUsed: boolean;
  noticeKillUntilDay: number;
  /** Last day the bar bought him standing (the fourteen-day cap, §30.2). */
  shoutedOn: number;
  /** The town knows he is flush until this day (§30.2). */
  flushUntilDay: number;
  /**
   * Day of the last spree held at his own house (§30.2); 0 is never. The
   * Crown & Cradle's takings only rise for a night drunk under its own roof — a
   * spree in a grog tent forty miles off puts nothing in Mrs. Doyle's till.
   */
  houseSpreeOn: number;
  /** Day the landlord's table last gave up a word; one in seven (§30.1). */
  landlordOn: number;
  /** A friend — an admirer, or your own harbourers — will warn you until this day (§30.1). */
  warnedUntilDay: number;
  /** An informer slipped out of the bar; the traps come by this day (§30.1). */
  informerUntilDay: number;
  /** The sly-grog shanty, the dark mirror of respectability (§28.3). */
  shanty: CampId | null;
  /** A lawyer retained by the quarter against the assizes (§28.3). */
  lawyerUntilDay: number;
}

// ---------------------------------------------------------------------------
// The dark ladder (§23-§24)
// ---------------------------------------------------------------------------

/** The four districts the troopers reckon separately. */
export type HeatZone = 'trickeys' | 'pass' | 'town' | 'camps';

export const HEAT_ZONES: HeatZone[] = ['trickeys', 'pass', 'town', 'camps'];

/** A camp in the ranges, and the outlaw's bank under a flat stone. */
export interface Hideout {
  stashPence: number;
  stashGold: number;
  discovered: boolean;
  madeOn: number;
}

export interface GangMember {
  name: string;
  joined: number;
  /** 0 to 1. A man who shares fairly in a job grows loyal; a poor one informs. */
  loyalty: number;
}

/** What a harbourer or a shanty keeper sold you, and how long it is good for. */
export interface Intelligence {
  kind: 'escort' | 'bank' | 'traveller';
  learnedOn: number;
  untilDay: number;
  /** For a traveller: the road he is coming down. */
  route?: Route;
  /** For the escort: the strength of the guard. */
  strength?: number;
}

/** How the outlaw's road ended, for the epilogue (§24). */
export type OutlawEnd = 'hanged' | 'hulks' | 'california' | 'pardoned' | 'at large';

// ---------------------------------------------------------------------------
// Hearth & kin — the courtship anchor (§32)
// ---------------------------------------------------------------------------

export type HearthRung =
  | 'none'
  | 'acquainted'
  | 'courting'
  | 'betrothed'
  | 'wed'
  | 'settled'
  | 'estranged';

/** The trade she keeps, before the wedding and after it (§32.1). */
export type IntendedTrade = 'storekeeper' | 'nurse' | 'boarding-house';

/** Where the pair of you first met, for the copy to remember. */
export type MeetingPlace = 'ball' | 'shamrock' | 'calico' | 'garden';

export interface Intended {
  name: string;
  trade: IntendedTrade;
  /** A flavour axis for the copy, never a stat: 'dry wit', 'devout', 'bookish'… */
  manner: string;
  metOn: number;
  metAt: MeetingPlace;
  /** Evening calls kept at Port Gannet; 2-3 and she decides (§32.1). */
  callsKept: number;
  /** Lavish gifts pressed on her; it is the pattern that cools, never the price. */
  lavishGifts: number;
  /** Lavishness offered too early or pressed twice; consent sees conduct, never spend. */
  lavishMissteps?: number;
  /** Day of the last gift of any size, for the pattern's arithmetic (§32.1). */
  lastGiftOn: number;
}

export type HearthEventKind = 'call' | 'banns' | 'wedding' | 'christmas' | 'birth' | 'sickbed';

/** One dated pull at a time: a window at Port Gannet, printed well ahead. */
export interface HearthEvent {
  kind: HearthEventKind;
  openDay: number;
  closeDay: number;
  /** Has a letter told the player of it yet? */
  announced: boolean;
}

export interface Letter {
  day: number;
  text: string;
  tone: Tone;
  read: boolean;
}

export interface Hearth {
  intended: Intended | null;
  rung: HearthRung;
  /** The Port Gannet household exists. */
  cottage: boolean;
  /** What was paid for it; the deed's value in the net-worth ledger. */
  cottagePaid: number;
  nextEvent: HearthEvent | null;
  eventsKept: number;
  eventsMissed: number;
  /** Consecutive missed events; two running is an estrangement (§32.3). */
  missedRun: number;
  homeStashPence: number;
  homeStashGold: number;
  /** Unread mail waiting at a post office (§32.2). */
  letters: Letter[];
  /** Day of the next subscription ball at Slateford; 0 until announced. */
  nextBallDay: number;
  /** A broken courtship: no new introduction for sixty days (§32.1). */
  courtshipBurnedOn: number;
  /** She ended it herself; that door does not reopen (§32.1, §32.3). */
  herDecision: boolean;
  reconciliationUsed: boolean;
  weddingDay: number;
  /** Total sent home, for the epilogue's arithmetic (§32.3). */
  remittedPence: number;
  childBorn: boolean;
  sickbedDone: boolean;
  /** The engineered calendar collision has fired this year (§32.3). */
  collisionDone: boolean;
}

export interface ShaftState {
  camp: CampId;
  /** Feet sunk so far. */
  depth: number;
  /** Feet at which this shaft bottoms (20-100, faithful). */
  bottomAt: number;
  bottomed: boolean;
  /** True once bottomed and the reef proved payable. */
  payable: boolean;
  /** Remaining days of good washdirt in a payable shaft. */
  richDaysLeft: number;
  timbered: boolean;
  pumped: boolean;
}

/** How hard the company drives its ground (§19.4). */
export type DrivingRate = 'cautious' | 'ordinary' | 'hard';

/** What a developing crew is at on a lease (§19.4). */
export type LeasePlan = 'sink' | 'drive';

/** Four wages-men, a task, and perhaps a particular mine to do it at. */
export interface Crew {
  task: 'mine' | 'develop' | 'prospect';
  /** Index into the company's leases, for mining and developing crews. */
  lease?: number;
}

/**
 * A named company mine, worked level by level for as long as the treasury
 * dares pay for it (§19.4). Never a churned resource: developed, extended,
 * flooded, dewatered — and abandoned only as a last resort.
 */
export interface Lease {
  /** "the North Star" — fixed at discovery, and printed everywhere. */
  name: string;
  /** ×100 quality of the lode, rolled at discovery. Never shown as a number. */
  reef: number;
  /** 0 = an unbottomed show; each level after is a sunk development project. */
  level: number;
  /** Crew-weeks of payable stone left at the current level. */
  face: number;
  /** ×100 worth of the stone now being broken; rolled when a level or drive opens. */
  yieldNow: number;
  /** Rolled at discovery; all ground below level 2 counts wet regardless. */
  wet: boolean;
  /** Pumping plant installed (treasury capital, §19.4). */
  pump: boolean;
  /** Standing timber-work installed; halves cave-ins here. */
  timbered: boolean;
  /** A flooded mine yields nothing until a crew and a pump dewater it. */
  flooded: boolean;
  /** Crew-weeks put into the current development job (sinking, driving, dewatering). */
  progress: number;
  /** What a developing crew is at on this lease. */
  plan: LeasePlan | null;
}

/** One week of the company's books, ruled off for the ledger pane (§19.4). */
export interface WeekBooks {
  revenue: number;
  crushing: number;
  wages: number;
  development: number;
  upkeep: number;
  compensation: number;
  net: number;
}

export interface Company {
  name: string;
  /** Pence in the company's own account. */
  treasury: number;
  sharesOwned: number;
  sharesPublic: number;
  sharesUnsold: number;
  /** Pence a share; walks weekly. */
  sharePrice: number;
  crews: Crew[];
  leases: Lease[];
  /** Trailing weekly profit in pence, most recent last. */
  weekProfit: number[];
  /** Centi-ounces the crews washed last week, for the report. */
  lastWeekGold: number;
  foundedOn: number;
  lastDividendDay: number;
  /** Confidence built by meeting investors and agents at Port Gannet, 0-100. */
  relations?: number;
  /** A port supply contract trims weekly working costs through this day. */
  supplyContractUntilDay?: number;
  /** The company's own stamping battery, once bought: no more crushing fees (§19.4). */
  battery: boolean;
  /** Company-wide driving policy (§19.4). */
  driving: DrivingRate;
  /** Last week's statement for the ledger pane; null before the first Sunday. */
  lastWeek: WeekBooks | null;
}

/** What a man did in December, and what the field remembers of it. */
export type StockadeRole = 'none' | 'joined' | 'kept clear' | 'sold supplies' | 'away';

/** A company sold out of leaves this much behind it. */
export interface SoldOut {
  name: string;
  amount: number;
  day: number;
}

export interface Employment {
  job: JobId;
  /** Day the engagement ends; the player may work on beyond it. */
  since: number;
  daysWorked: number;
}

export interface RushNews {
  camp: CampId;
  untilDay: number;
  factor: number;
  /** Day the word got out — the ground is richest to the first men on it. */
  since: number;
  /** Freshness the camp had before the rush, and will have again after it. */
  base: number;
}

export interface HuntWarning {
  camp: CampId;
  untilDay: number;
}

export interface SecretRumour {
  /** Has the player heard the rumour at all? */
  heard: boolean;
  /** Is it the real thing, or a cruel hoax? */
  genuine: boolean;
  /** Has the player already chased it? */
  chased: boolean;
  /** Camp the rumour points beyond. */
  fromCamp: CampId;
  heardOn: number;
}

export interface SecretExpedition {
  /** Steps followed towards the legendary nugget, 0-4. */
  trail: number;
  daysSearched: number;
  /** Weight of The Southern Cross once exposed; it remains in the earth until recovered. */
  nuggetCentiOz?: number;
  nuggetFound: boolean;
  nuggetRecovered?: boolean;
  exhausted: boolean;
}

export interface GamblingSession {
  game: 'twoup' | 'cards';
  stake: number;
  /** Two-up winnings currently left with the spinner. */
  pot: number;
  round: number;
  /** Cards: rough strength of the player's hand, 1-10. */
  hand: number;
  /** A readable or misleading clue about the other player. */
  tell: 'steady' | 'eager' | 'uneasy';
}

export interface JournalEntry {
  day: number;
  text: string;
  tone: Tone;
}

export type Tone = 'good' | 'bad' | 'neutral' | 'grave' | 'title';

export interface NarrationEvent {
  id: string;
  text: string;
  tone: Tone;
}

export type Screen =
  | 'title'
  | 'resume'
  | 'intro'
  | 'suze'
  | 'suze-work'
  | 'suze-store'
  | 'suze-lodgings'
  | 'suze-horses'
  | 'secret-expedition'
  | 'suze-crime'
  | 'hearth'
  | 'ball'
  | 'letters'
  | 'gazette'
  | 'journal'
  | 'travel-route'
  | 'travel-mode'
  | 'ftown'
  | 'ftown-bank'
  | 'ftown-lodgings'
  | 'ftown-store'
  | 'ftown-council'
  | 'ftown-work'
  | 'ftown-hospital'
  | 'ftown-hotel'
  | 'ftown-gamble'
  | 'ftown-twoup'
  | 'ftown-cards'
  | 'ftown-depart'
  | 'camp'
  | 'camp-store'
  | 'store-sell'
  | 'camp-mine'
  | 'camp-grog'
  | 'company'
  | 'company-crews'
  | 'company-ground'
  | 'company-policy'
  | 'company-dividend'
  | 'estate'
  | 'court'
  | 'press'
  | 'bandit'
  | 'bandit-roads'
  | 'hideout'
  | 'gang'
  | 'stash'
  | 'encounter'
  | 'end'
  | 'obituary';

export type PendingKind =
  | 'trooper'
  | 'bushrangers'
  | 'claimJumper'
  | 'magistrate'
  | 'shortWeight'
  | 'secretRumour'
  | 'meeting'
  | 'stockade'
  /** A traveller stopped on the road, waiting on the player's word (§23.4). */
  | 'bailup'
  /** Troopers come upon the lurking bandit, or the wanted man where he sleeps. */
  | 'patrol'
  /** The camp in the ranges found while the player is in it. */
  | 'hideoutRaid'
  /** Taken, and waiting on the assizes at Slateford (§24). */
  | 'assizes'
  /** The pardon offered to an outlaw who stood behind the slabs (§24). */
  | 'pardon'
  /** The troopers come to burn out the shanty (§28.3). */
  | 'shantyRaid';

export interface Pending {
  kind: PendingKind;
  /** Free-form payload for the encounter. */
  data?: Record<string, number | string | boolean>;
}

export type Task =
  | { kind: 'travel' }
  | { kind: 'mine'; method: MiningMethod; days: number }
  | { kind: 'work'; job: JobId; days: number }
  | { kind: 'rest'; days: number }
  | { kind: 'hospital'; days: number };

export interface Journey {
  route: Route;
  mode: TravelMode;
  /** Days still to travel. */
  daysLeft: number;
  daysTravelled: number;
  /** Where the road ends. */
  to: LocationId;
  from: LocationId;
  /** Chests of abandoned finery picked up along the way (saleable at Port Gannet). */
  salvage: number;
}

export interface Stats {
  daysWorked: number;
  daysDug: number;
  goldWon: number;
  shaftsSunk: number;
  caveIns: number;
  timesRobbed: number;
  timesArrested: number;
  bribesPaid: number;
  illnesses: number;
  huntsEvaded: number;
  gamblingNet: number;
  /** Travellers stopped on the road (§23.4). */
  bailUps: number;
  /** Banks and escorts taken (§23.4). */
  bigJobs: number;
  /** Everything robbery brought in, valued in pence at the day's rate. */
  takings: number;
}

export interface GameState {
  /** Version tag for save compatibility. */
  v: number;
  seed: number;
  rngState: number;
  gameId: string | null;

  day: number;
  screen: Screen;
  location: LocationId;

  moneyPence: number;
  bankPence: number;
  goldCentiOz: number;

  health: number;
  illness: Illness | null;
  /** Days since the player last ate fresh vegetables — scurvy clock. */
  daysWithoutGreens: number;
  /** Consecutive days of unbroken toil — exhaustion clock. */
  fatigue: number;

  legal: LegalStatus;
  cleanDays: number;
  licenceUntilDay: number;
  jailUntilDay: number;
  onLogs: boolean;
  logsSince: number;
  fineOwed: number;

  items: Record<ItemId, number>;
  provisionDays: number;
  waterDays: number;
  horse: HorseKind;
  horseKnowledge: number;
  horseInspection: { brumby: number; hack: number };
  lodging: Lodging;
  tentGroundPaidUntil: number;
  /** Lodging chosen at Slateford; Port Gannet keeps the legacy fields above. */
  slatefordLodging: Lodging;
  slatefordTentGroundPaidUntil: number;
  salvage: number;
  /** A bought or earned meal waiting to be eaten at the next day-end. */
  fedToday: boolean;

  claims: Record<CampId, Claim | null>;
  /** How much gold each camp has left in it — rushes lift it, working wears it down. */
  freshness: Record<CampId, number>;
  shaft: ShaftState | null;
  mateUntilDay: number;
  /** A partner takes no wage and half the gold. */
  partner: boolean;
  puddlerUntilDay: number;

  skill: Skill;
  /** A digger's name on the field, 0-100. */
  standing: number;
  /** Port contacts: employers, ostlers, shipping agents and investors. */
  suzeStanding: number;
  /** Successful days behind Bell's counter, determining the visible discount tier. */
  briggsDays: number;
  briggsBlacklisted: boolean;

  // --- the dark ladder (§23) ------------------------------------------
  /** The other kind of name, 0-100. It never decays. */
  notoriety: number;
  /** How hard the troopers are riding in each district, 0-100. */
  heat: Record<HeatZone, number>;
  /** Once set, the ninety clean days are shut and only §24 remains. */
  outlawed: boolean;
  hideout: Hideout | null;
  gang: GangMember[];
  /** A word bought of a harbourer, good for a few days only. */
  intel: Intelligence | null;
  /** An informer has told them where you will be next. */
  ambush: boolean;
  /** Diggers' piles taken: the wild colonial boy takes none (§23.5). */
  diggersRobbed: number;
  bigJobsDone: number;
  /** A trooper or a victim killed. The assizes hang for it (§24). */
  bloodShed: boolean;
  /** The reward last printed in the Times, in pence. */
  rewardPrinted: number;
  /** Day the harbourers' free warning was last spent (§23.5). */
  warnedOn: number;
  /** The gaol break is offered once and once only. */
  gaolBreakOffered: boolean;
  pardonOffered: boolean;
  /** How the outlaw's road ended, for the reckoning. */
  outlawEnd: OutlawEnd | null;

  employment: Employment | null;

  /** The player's own company, once floated (§19). */
  company: Company | null;
  /** What was paid out when he sold the last of his holding. */
  soldOut: SoldOut | null;

  /** Property, works, the press and the bench (§26-§31). Always present. */
  estate: Estate;

  /** The courtship, the cottage and the letters (§32). Always present. */
  hearth: Hearth;

  /** How hot the licence question has grown, 0-100 (§20). */
  agitation: number;
  meetingDone: boolean;
  meetingAttended: boolean;
  stockadeDone: boolean;
  stockadeDay: number;
  stockadeRole: StockadeRole;
  /** Day the miner's right expires; £1 the year, after the licence dies. */
  minersRightUntilDay: number;
  aftermathNoted: boolean;

  /** Bank of Australasia buying rate, pence per ounce. */
  bankRate: number;
  /** The last fortnight of the bank's rate, oldest first (§21). */
  rateTrail: number[];
  /** What the player was worth, sampled every seventh day (§21). */
  worthHistory: number[];
  rush: RushNews | null;
  hunt: HuntWarning | null;
  secret: SecretRumour | null;
  /** At most one genuine secret-mine chance per year (faithful). */
  secretGenuineUsed: boolean;
  secretExpedition: SecretExpedition | null;
  gazetteReadOn: number;

  gambling: GamblingSession | null;

  /** How many days a single chosen spell of work lasts (1,2,3,7,14,30). */
  spellDays: number;

  journey: Journey | null;
  pending: Pending | null;
  resumeTask: Task | null;

  journal: JournalEntry[];
  stats: Stats;

  yearsPlayed: number;
  gameOver: null | 'dead' | 'finished';
  causeOfDeath: string | null;
  /** Set when the year rolls over and the END screen is due. */
  endOfYear: boolean;
}

export interface MenuItem {
  key: string;
  label: string;
  action: Action;
  /**
   * Flavour: the reason a man might want this. Shown for the highlighted item
   * only, so that a long list stays a list and does not become an essay.
   */
  note?: string;
  /**
   * A warning that must be read before the choice is made — a gouging price,
   * what you already carry, why the item is barred. Always shown in the row.
   */
  alert?: string;
  disabled?: boolean;
}

/** A standing tally shown beside a screen, so the menu need not be opened. */
export interface AsidePanel {
  title: string;
  rows: AsideRow[];
}

export interface AsideRow {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
  /** A rule and a caption dividing one part of the tally from the next. */
  heading?: boolean;
}

/**
 * A headed block of label/value rows. A view that has panels is offering the
 * frame a way to set the same matter side by side instead of down the page;
 * `body` always carries the flattened reading for anything that wants prose.
 */
export interface ViewPanel {
  heading: string;
  rows: { label?: string; text: string }[];
}

export interface ScreenView {
  screen: Screen;
  title: string;
  subtitle?: string;
  body: string[];
  /** Set beside one another where the frame has the width for it. */
  panels?: ViewPanel[];
  menu: MenuItem[];
  /** Ask for free text (game ID, wager). */
  input?: { prompt: string; kind: 'gameId' | 'wager' | 'amount' };
  art?: string;
  /** Rendered as a pane beside the menu where the screen is worth a ledger. */
  aside?: AsidePanel;
}

export type Action =
  | { type: 'start' }
  | { type: 'newGame'; seed?: number }
  | { type: 'resumePrompt' }
  | { type: 'resume'; state: GameState }
  | { type: 'continue' }
  | { type: 'goto'; screen: Screen }
  | { type: 'work'; job: JobId; days: number }
  | { type: 'buy'; item: ItemId; qty?: number }
  | { type: 'sellSalvage' }
  | { type: 'buyProvisions'; weeks: number }
  | { type: 'buyGreens' }
  | { type: 'quack' }
  | { type: 'fillWater' }
  | { type: 'buyHorse'; kind: 'brumby' | 'hack' }
  | { type: 'inspectHorse'; kind: 'brumby' | 'hack'; method: 'look' | 'trial' | 'ostler' }
  | { type: 'buyMeal' }
  | { type: 'fishForFood' }
  | { type: 'setLodging'; kind: Lodging }
  | { type: 'readGazette' }
  | { type: 'readJournal' }
  | { type: 'steal'; target: 'store' | 'drunk' }
  | { type: 'sellItem'; item: ItemId }
  | { type: 'chooseRoute'; route: Route }
  | { type: 'travel'; route: Route; mode: TravelMode }
  | { type: 'deposit'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'sellGold'; where: 'bank' | 'camp' | 'store'; watch: boolean }
  | { type: 'buyLicence' }
  | { type: 'pegClaim' }
  | { type: 'abandonClaim' }
  | { type: 'prospect' }
  | { type: 'complain' }
  | { type: 'hospital'; days: number }
  | { type: 'drink'; what?: DrinkId }
  | { type: 'gamble'; game: 'twoup' | 'cards'; stake: number }
  | { type: 'startGamble'; game: 'twoup' | 'cards'; stake: number }
  | { type: 'twoUpCall'; side: 'heads' | 'tails' }
  | { type: 'twoUpCollect' }
  | { type: 'cardsDecision'; choice: 'fold' | 'call' | 'raise' | 'bluff' }
  | { type: 'coach' }
  | { type: 'travelTo'; place: LocationId }
  | { type: 'mine'; method: MiningMethod; days: number }
  | { type: 'hireMate'; days: number }
  | { type: 'takePartner' }
  | { type: 'dissolvePartnership' }
  | { type: 'rentPuddler'; days: number }
  | { type: 'floatCompany'; shares: number }
  | { type: 'hireCrew' }
  | { type: 'fireCrew' }
  | { type: 'setCrewTask'; index: number; task: 'mine' | 'develop' | 'prospect'; lease?: number }
  | { type: 'setLeasePlan'; lease: number; plan: LeasePlan }
  | { type: 'installPlant'; lease: number; plant: 'pump' | 'timber' }
  | { type: 'buyBattery' }
  | { type: 'setDriving'; rate: DrivingRate }
  | { type: 'abandonLease'; lease: number }
  | { type: 'hirePumpman' }
  | { type: 'declareDividend'; perShare: number }
  | { type: 'sellOwnShares'; n: number }
  | { type: 'buyBackShares'; n: number }
  | { type: 'sellOut' }
  | { type: 'companyRelations' }
  | { type: 'companySupplyContract' }
  | { type: 'attendMeeting'; attend: boolean }
  | { type: 'joinStockade' }
  | { type: 'keepClear' }
  | { type: 'sellSupplies' }
  | { type: 'rest'; days: number }
  | { type: 'followRumour' }
  | { type: 'searchSecret'; approach: 'search' | 'winnow' | 'dig' }
  | { type: 'recoverNugget' }
  | { type: 'timberShaft' }
  | { type: 'registerClaim'; camp: CampId }
  | { type: 'guardClaim'; camp: CampId; days: number }
  | { type: 'answerClaimJumper'; choice: 'confront' | 'council' | 'abandon' }
  | { type: 'abandonShaft' }
  | { type: 'bribe' }
  | { type: 'submit' }
  | { type: 'resist' }
  | { type: 'watchWeighing'; watch: boolean }
  // --- the civic ladder (§26-§31) --------------------------------------
  | { type: 'buyShamrock' }
  | { type: 'openStore'; camp: CampId }
  | { type: 'setStorePolicy'; policy: StorePolicy }
  | { type: 'buyGazetteShare' }
  | { type: 'placeStory'; kind: StoryKind; camp?: CampId }
  | { type: 'fundWork'; work: WorkId; camp?: CampId }
  | { type: 'acceptCommission' }
  | { type: 'holdCourt' }
  | { type: 'rule'; ruling: 'leniency' | 'severity' }
  | { type: 'buyShanty' }
  | { type: 'retainLawyer' }
  | { type: 'shoutBar'; spree: boolean }
  // --- hearth & kin (§32) ----------------------------------------------
  | { type: 'attendBall' }
  | { type: 'payAddresses' }
  | { type: 'callAtThePort' }
  | { type: 'giveGift'; lavish: boolean }
  | { type: 'proposeBanns' }
  | { type: 'holdWedding' }
  | { type: 'buyCottage'; size: 'small' | 'large' }
  | { type: 'homeStash'; what: 'money' | 'gold'; amount: number }
  | { type: 'homeUnstash'; what: 'money' | 'gold'; amount: number }
  | { type: 'consignGoods' }
  | { type: 'sendRemittance'; amount: number }
  | { type: 'readLetters' }
  | { type: 'seekReconciliation' }
  // --- the dark ladder (§23-§24) ---------------------------------------
  | { type: 'bailUp'; route: Route }
  | { type: 'bailUpTake'; shoot: boolean }
  | { type: 'letPass' }
  | { type: 'makeHideout' }
  | { type: 'stash'; what: 'money' | 'gold'; amount: number }
  | { type: 'unstash'; what: 'money' | 'gold'; amount: number }
  | { type: 'recruitGangMember' }
  | { type: 'dismissGangMember'; index: number }
  | { type: 'gatherIntelligence' }
  | { type: 'fenceGold' }
  | { type: 'robBank' }
  | { type: 'robEscort' }
  | { type: 'buyPassage' }
  | { type: 'breakGaol' }
  | { type: 'awaitAssizes' }
  | { type: 'takePardon'; take: boolean }
  | { type: 'flee' }
  | { type: 'nextYear' }
  | { type: 'finish' }
  | { type: 'save'; id?: string }
  | { type: 'cycleSpell' }
  | { type: 'quitToTitle' };

export interface StepResult {
  state: GameState;
  events: NarrationEvent[];
}

export interface SeasonInfo {
  season: Season;
}
