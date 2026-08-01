import {
  AFTERMATH_DAY,
  AGITATION_HUNT_SCALE,
  AGITATION_MAX,
  BANK_RATE_START,
  CAMP_DEFS,
  COMPANY_SHARES,
  FRESHNESS_SECRET,
  FRESHNESS_START,
  GAZETTE_SHARE_PRICE,
  NOTORIETY_MAX,
  REWARD_STEPS,
  SHAMROCK_PRICE,
  SHANTY_PRICE,
  STORE_PRICE,
  SKILL_BUSH_CAPTAIN_DAYS,
  SKILL_BUSH_FLASH_DAYS,
  SKILL_DIGGER_DAYS,
  SKILL_OLD_HAND_DAYS,
  STANDING_MAX,
  STARTING_MONEY,
  STOCKADE_SELL_RISK,
  WORTH_HISTORY_MAX,
} from './constants';
import { formatGold, formatMoney, goldValue } from './money';
import { DAYS_IN_YEAR, season, seasonShort } from './time';
import {
  CAMPS,
  HEAT_ZONES,
  LEGAL_LADDER,
  type BushRank,
  type CampId,
  type Claim,
  type Company,
  type Estate,
  type GameState,
  type Hearth,
  type HeatZone,
  type ItemId,
  type LegalStatus,
  type LocationId,
  type Lodging,
  type Route,
  type SkillRank,
  type Tone,
  type WorkId,
} from './types';

/** The save format the engine writes. */
export const SAVE_VERSION = 6;

/** A man fresh off the boat, with nobody in the colony to write to (§32). */
export function emptyHearth(): Hearth {
  return {
    intended: null,
    rung: 'none',
    cottage: false,
    cottagePaid: 0,
    nextEvent: null,
    eventsKept: 0,
    eventsMissed: 0,
    missedRun: 0,
    homeStashPence: 0,
    homeStashGold: 0,
    letters: [],
    nextBallDay: 0,
    courtshipBurnedOn: 0,
    herDecision: false,
    reconciliationUsed: false,
    weddingDay: 0,
    remittedPence: 0,
    childBorn: false,
    sickbedDone: false,
    collisionDone: false,
  };
}

/** A man fresh off the boat holds nothing and no town knows his name. */
export function emptyEstate(): Estate {
  return {
    shamrock: false,
    store: null,
    gazetteShare: false,
    works: [],
    jpSince: null,
    nextCourtDay: 0,
    storyPlacedOn: 0,
    calledRushBurnedOn: 0,
    severityUntilDay: 0,
    noticeKillUsed: false,
    noticeKillUntilDay: 0,
    shoutedOn: 0,
    flushUntilDay: 0,
    houseSpreeOn: 0,
    landlordOn: 0,
    warnedUntilDay: 0,
    informerUntilDay: 0,
    shanty: null,
    lawyerUntilDay: 0,
  };
}

export function emptyHeat(): Record<HeatZone, number> {
  return { trickeys: 0, pass: 0, town: 0, camps: 0 };
}

export function emptyItems(): Record<ItemId, number> {
  return {
    pan: 0,
    cradle: 0,
    pick: 0,
    shovel: 0,
    ropeBucket: 0,
    tent: 0,
    swag: 0,
    gun: 0,
    waterBags: 0,
    barrow: 0,
    timber: 0,
    pump: 0,
    journal: 0,
  };
}

export function emptyClaims(): Record<CampId, Claim | null> {
  return {
    'damp-camp': null,
    'snakey-gully': null,
    'deep-mountains': null,
    'secret-mine': null,
  };
}

export function startingFreshness(): Record<CampId, number> {
  return {
    'damp-camp': FRESHNESS_START,
    'snakey-gully': FRESHNESS_START,
    'deep-mountains': FRESHNESS_START,
    'secret-mine': FRESHNESS_SECRET,
  };
}

export function createInitialState(seed: number): GameState {
  return {
    v: SAVE_VERSION,
    seed,
    rngState: seed >>> 0,
    gameId: null,

    day: 1,
    screen: 'title',
    location: 'suze-port',

    moneyPence: STARTING_MONEY,
    bankPence: 0,
    goldCentiOz: 0,

    health: 100,
    illness: null,
    daysWithoutGreens: 0,
    fatigue: 0,

    legal: 'honest',
    cleanDays: 0,
    licenceUntilDay: 0,
    jailUntilDay: 0,
    onLogs: false,
    logsSince: 0,
    fineOwed: 0,

    items: emptyItems(),
    provisionDays: 0,
    waterDays: 0,
    horse: 'none',
    horseKnowledge: 0,
    horseInspection: { brumby: 0, hack: 0 },
    lodging: 'rough',
    tentGroundPaidUntil: 0,
    slatefordLodging: 'rough',
    slatefordTentGroundPaidUntil: 0,
    salvage: 0,
    fedToday: false,

    claims: emptyClaims(),
    freshness: startingFreshness(),
    shaft: null,
    mateUntilDay: 0,
    partner: false,
    puddlerUntilDay: 0,

    skill: { wash: 0, shaft: 0, bush: 0 },
    standing: 0,
    suzeStanding: 0,
    briggsDays: 0,
    briggsBlacklisted: false,

    notoriety: 0,
    heat: emptyHeat(),
    outlawed: false,
    hideout: null,
    gang: [],
    intel: null,
    ambush: false,
    diggersRobbed: 0,
    bigJobsDone: 0,
    bloodShed: false,
    rewardPrinted: 0,
    warnedOn: 0,
    gaolBreakOffered: false,
    pardonOffered: false,
    outlawEnd: null,

    employment: null,

    company: null,
    soldOut: null,

    estate: emptyEstate(),

    hearth: emptyHearth(),

    agitation: 0,
    meetingDone: false,
    meetingAttended: false,
    stockadeDone: false,
    stockadeDay: 0,
    stockadeRole: 'none',
    minersRightUntilDay: 0,
    aftermathNoted: false,

    bankRate: BANK_RATE_START,
    rateTrail: [BANK_RATE_START],
    worthHistory: [STARTING_MONEY],
    rush: null,
    hunt: null,
    secret: null,
    secretGenuineUsed: false,
    secretExpedition: null,
    gazetteReadOn: 0,

    gambling: null,

    spellDays: 7,

    journey: null,
    pending: null,
    resumeTask: null,

    journal: [],
    stats: {
      daysWorked: 0,
      daysDug: 0,
      goldWon: 0,
      shaftsSunk: 0,
      caveIns: 0,
      timesRobbed: 0,
      timesArrested: 0,
      bribesPaid: 0,
      illnesses: 0,
      huntsEvaded: 0,
      gamblingNet: 0,
      bailUps: 0,
      bigJobs: 0,
      takings: 0,
    },

    yearsPlayed: 1,
    gameOver: null,
    causeOfDeath: null,
    endOfYear: false,
  };
}

/** The lodging selected in a major town; Port keeps the original save fields. */
export function lodgingAt(state: GameState, location: LocationId = state.location): Lodging {
  return location === 'fields-town' ? state.slatefordLodging : state.lodging;
}

export function cloneClaims(claims: Record<CampId, Claim | null>): Record<CampId, Claim | null> {
  const out = {} as Record<CampId, Claim | null>;
  for (const c of CAMPS) out[c] = claims[c] ? { ...(claims[c] as Claim) } : null;
  return out;
}

export function cloneCompany(c: Company | null): Company | null {
  if (!c) return null;
  return {
    ...c,
    crews: c.crews.map((crew) => ({ ...crew })),
    leases: c.leases.map((lease) => ({ ...lease })),
    weekProfit: c.weekProfit.slice(),
  };
}

export function clone(state: GameState): GameState {
  return {
    ...state,
    items: { ...state.items },
    company: cloneCompany(state.company),
    soldOut: state.soldOut ? { ...state.soldOut } : null,
    estate: {
      ...state.estate,
      store: state.estate.store ? { ...state.estate.store } : null,
      works: state.estate.works.map((w) => ({ ...w })),
    },
    hearth: {
      ...state.hearth,
      intended: state.hearth.intended ? { ...state.hearth.intended } : null,
      nextEvent: state.hearth.nextEvent ? { ...state.hearth.nextEvent } : null,
      letters: state.hearth.letters.map((l) => ({ ...l })),
    },
    claims: cloneClaims(state.claims),
    freshness: { ...state.freshness },
    heat: { ...state.heat },
    hideout: state.hideout ? { ...state.hideout } : null,
    gang: state.gang.map((g) => ({ ...g })),
    intel: state.intel ? { ...state.intel } : null,
    rateTrail: state.rateTrail.slice(),
    worthHistory: state.worthHistory.slice(),
    skill: { ...state.skill },
    horseInspection: { ...state.horseInspection },
    illness: state.illness ? { ...state.illness } : null,
    shaft: state.shaft ? { ...state.shaft } : null,
    employment: state.employment ? { ...state.employment } : null,
    rush: state.rush ? { ...state.rush } : null,
    hunt: state.hunt ? { ...state.hunt } : null,
    secret: state.secret ? { ...state.secret } : null,
    secretExpedition: state.secretExpedition ? { ...state.secretExpedition } : null,
    gambling: state.gambling ? { ...state.gambling } : null,
    journey: state.journey ? { ...state.journey } : null,
    pending: state.pending ? { ...state.pending } : null,
    resumeTask: state.resumeTask ? { ...state.resumeTask } : null,
    journal: state.journal.slice(),
    stats: { ...state.stats },
  };
}

// ---------------------------------------------------------------------------
// Derived descriptions
// ---------------------------------------------------------------------------

export function healthWord(health: number): string {
  if (health <= 0) return 'Dead';
  if (health >= 80) return 'Hearty';
  if (health >= 60) return 'Good';
  if (health >= 40) return 'Poorly';
  if (health >= 20) return 'Ill';
  return 'Gravely ill';
}

export function fatigueWord(fatigue: number): string {
  if (fatigue >= 21) return 'Spent';
  if (fatigue >= 13) return 'Exhausted';
  if (fatigue >= 6) return 'Tired';
  if (fatigue >= 3) return 'Weary';
  return 'Fresh';
}

/**
 * After the stockade the thirty-shilling licence is dead and a miner's right
 * stands in its place (§20). Year two is all aftermath.
 */
export function inAftermath(state: GameState): boolean {
  return state.yearsPlayed > 1 || state.day >= AFTERMATH_DAY;
}

export function hasMinersRight(state: GameState): boolean {
  return state.minersRightUntilDay >= state.day;
}

export function isLicensed(state: GameState): boolean {
  return state.licenceUntilDay >= state.day || hasMinersRight(state);
}

export function licenceWord(state: GameState): string {
  if (hasMinersRight(state)) {
    const left = state.minersRightUntilDay - state.day + 1;
    return `a miner's right, ${left} day${left === 1 ? '' : 's'} to run`;
  }
  if (!isLicensed(state)) return 'no licence';
  const left = state.licenceUntilDay - state.day + 1;
  return `licence, ${left} day${left === 1 ? '' : 's'} to run`;
}

export function legalRung(status: LegalStatus): number {
  return LEGAL_LADDER.indexOf(status);
}

export function skillRank(days: number): SkillRank {
  if (days >= SKILL_OLD_HAND_DAYS) return 'old hand';
  if (days >= SKILL_DIGGER_DAYS) return 'digger';
  return 'new chum';
}

export function washRank(state: GameState): SkillRank {
  return skillRank(state.skill.wash);
}

export function shaftRank(state: GameState): SkillRank {
  return skillRank(state.skill.shaft);
}

/** What the field would say of you, if asked. */
export function standingPhrase(standing: number): string {
  if (standing >= 80) return 'an old identity of the diggings';
  if (standing >= 60) return 'a name Bell himself knows';
  if (standing >= 45) return 'well spoken of about the camps';
  if (standing >= 30) return 'a man others will go mates with';
  if (standing >= 15) return 'a face they have begun to know';
  return 'a stranger on the field';
}

// ---------------------------------------------------------------------------
// The dark ladder (§23)
// ---------------------------------------------------------------------------

export function bushRank(days: number): BushRank {
  if (days >= SKILL_BUSH_CAPTAIN_DAYS) return 'captain';
  if (days >= SKILL_BUSH_FLASH_DAYS) return 'flash cove';
  return 'new chum';
}

export function bushRankOf(state: GameState): BushRank {
  return bushRank(state.skill.bush);
}

/** What the colony would call him, if it were asked at a bar. */
export function notorietyPhrase(notoriety: number): string {
  if (notoriety >= 80) return 'a name to frighten children with';
  if (notoriety >= 60) return 'the man the Times prints of';
  if (notoriety >= 45) return 'talked of at every grog tent on the field';
  if (notoriety >= 30) return 'known to the traps by name';
  if (notoriety >= 15) return 'a face the police camp has begun to know';
  return 'nobody the troopers have heard of';
}

export function addNotoriety(state: GameState, amount: number): void {
  state.notoriety = Math.max(0, Math.min(NOTORIETY_MAX, state.notoriety + amount));
}

/** Which district the troopers would reckon this to, for the heat books. */
export function heatZoneFor(state: GameState, route?: Route): HeatZone {
  if (route) return route === 'pass' ? 'pass' : 'trickeys';
  if (state.location === 'on-road') {
    return state.journey?.route === 'pass' ? 'pass' : 'trickeys';
  }
  if (state.location === 'suze-port' || state.location === 'fields-town') return 'town';
  return 'camps';
}

/** The districts either side of a given one; heat splashes into them. */
export function adjacentZones(zone: HeatZone): HeatZone[] {
  switch (zone) {
    case 'trickeys':
      return ['pass', 'town'];
    case 'pass':
      return ['trickeys', 'town'];
    case 'town':
      return ['trickeys', 'pass', 'camps'];
    default:
      return ['town'];
  }
}

export function heatOf(state: GameState, zone: HeatZone): number {
  return state.heat[zone] ?? 0;
}

export function totalHeat(state: GameState): number {
  return HEAT_ZONES.reduce((a, z) => a + heatOf(state, z), 0);
}

/** The word the field uses for how hard the traps are riding hereabouts. */
export function heatWord(level: number): string {
  if (level >= 80) return 'thick with traps';
  if (level >= 55) return 'watched close';
  if (level >= 30) return 'uneasy';
  if (level >= 10) return 'quiet enough';
  return 'as quiet as a Sunday';
}

/** What the Crown is offering for him, in pence; nothing until he is wanted. */
export function rewardFor(state: GameState): number {
  if (state.legal !== 'wanted criminal') return 0;
  let reward = 0;
  for (const [at, sum] of REWARD_STEPS) if (state.notoriety >= at) reward = sum;
  return reward;
}

/** The diggers half-admire a man who has never taken a digger's pile (§23.5). */
export function fieldSympathy(state: GameState): boolean {
  return state.diggersRobbed === 0;
}

export function stashWorth(state: GameState): number {
  const h = state.hideout;
  if (!h) return 0;
  return h.stashPence + goldValue(h.stashGold, state.bankRate);
}

export function addStanding(state: GameState, amount: number): void {
  state.standing = Math.max(0, Math.min(STANDING_MAX, state.standing + amount));
}

export function bumpAgitation(state: GameState, amount: number): void {
  state.agitation = Math.max(0, Math.min(AGITATION_MAX, state.agitation + amount));
}

/** Troopers ride harder as the field grows angrier (§20). */
export function agitationHuntFactor(state: GameState): number {
  return 1 + state.agitation / AGITATION_HUNT_SCALE;
}

/** The field remembers a man who sold to both sides at the stockade (§20). */
export function betrayalFactor(state: GameState): number {
  return state.stockadeRole === 'sold supplies' ? STOCKADE_SELL_RISK : 1;
}

export function isCamp(loc: LocationId): loc is CampId {
  return (CAMPS as string[]).includes(loc);
}

export function locationName(loc: LocationId): string {
  switch (loc) {
    case 'suze-port':
      return 'Port Gannet';
    case 'on-road':
      return 'the road';
    case 'fields-town':
      return 'Slateford';
    case 'hideout':
      return 'Split Rock Camp';
    default:
      return CAMP_DEFS[loc as CampId].name;
  }
}

/**
 * What the status line says of a man's papers when he is standing on a camp's
 * dirt, which is the only place the troopers ever ask (§21).
 */
export function licenceStatus(state: GameState): string {
  if (hasMinersRight(state)) return "Miner's right";
  if (inAftermath(state)) return "No miner's right";
  if (state.licenceUntilDay >= state.day) return `Licence ${state.licenceUntilDay - state.day + 1}d`;
  return 'NO LICENCE';
}

/** The one-line menu summary that sits at the foot of every screen (faithful). */
export function statusLine(state: GameState): string {
  // Terse and kept to one visual line by the responsive status bar. A
  // proclaimed man's legal rung and his price go in one field, and no outlaw
  // is troubling the Camp about a licence, so that field goes with him.
  const reward = rewardFor(state);
  const legal = state.outlawed
    ? 'OUTLAWED'
    : state.legal === 'honest'
      ? 'Honest'
      : state.legal === 'wanted criminal'
        ? 'WANTED'
        : titleCase(state.legal);
  const bits = [
    `Day ${state.day}`,
    // The season sits beside the day because it is the day's whole meaning: it
    // decides what the creeks are doing, what the flour costs, and what the
    // field is likely to hand a man in the way of sickness.
    seasonShort(state.day),
    formatMoney(state.moneyPence),
    formatGold(state.goldCentiOz),
    healthWord(state.health),
    reward > 0 ? `${legal} ${formatMoney(reward)}` : legal,
    fatigueWord(state.fatigue),
  ];
  if (isCamp(state.location) && !state.outlawed) bits.push(licenceStatus(state));
  return bits.join(' · ');
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * What a man's holding in his own company would fetch: his scrip at the day's
 * price, and his share of what is in the treasury (§19.2).
 */
export function companyWorth(state: GameState): number {
  const c = state.company;
  if (!c) return 0;
  return Math.max(
    0,
    Math.round(c.sharesOwned * c.sharePrice + (c.treasury * c.sharesOwned) / COMPANY_SHARES),
  );
}

/** Has the field the benefit of a given public work (§27)? */
export function hasWork(state: GameState, id: WorkId, camp?: CampId): boolean {
  return state.estate.works.some((w) => w.id === id && (camp === undefined || w.camp === camp));
}

/**
 * What the deeds in a man's strongbox would fetch: property at its purchase
 * price (§26, §28.3). Public works are subscriptions, not investments — they
 * count for nothing here and everything in the epilogue.
 */
export function estateWorth(state: GameState): number {
  const e = state.estate;
  let worth = 0;
  if (e.shamrock) worth += SHAMROCK_PRICE;
  if (e.store) worth += STORE_PRICE;
  if (e.gazetteShare) worth += GAZETTE_SHARE_PRICE;
  if (e.shanty) worth += SHANTY_PRICE;
  return worth;
}

/** The cottage at its deed price, and what is laid by under its floor (§32.2). */
export function hearthWorth(state: GameState): number {
  const h = state.hearth;
  return h.cottagePaid + h.homeStashPence + goldValue(h.homeStashGold, state.bankRate);
}

/** Everything the player is worth, valued at today's bank rate. */
export function netWorth(state: GameState): number {
  return (
    state.moneyPence +
    state.bankPence +
    goldValue(state.goldCentiOz, state.bankRate) +
    companyWorth(state) +
    stashWorth(state) +
    estateWorth(state) +
    hearthWorth(state)
  );
}

/** A Sunday's entry in the ledger of what a man is worth (§21). */
export function recordWorth(state: GameState): void {
  state.worthHistory.push(netWorth(state));
  while (state.worthHistory.length > WORTH_HISTORY_MAX) state.worthHistory.shift();
}

export function addJournal(state: GameState, text: string, tone: Tone = 'neutral'): void {
  state.journal.push({ day: state.day, text, tone });
  if (state.journal.length > 400) state.journal.shift();
}

export function currentSeason(state: GameState) {
  return season(state.day);
}

/** The year is out when the day rolls past 365 (or 730 in a second year). */
export function checkYearEnd(state: GameState): void {
  if (state.gameOver || state.endOfYear) return;
  if (state.day > DAYS_IN_YEAR * state.yearsPlayed) state.endOfYear = true;
}
