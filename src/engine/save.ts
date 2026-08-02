import { COMPANY_SHARE_PRICE, GANG_MAX } from './constants';
import { SAVE_VERSION, createInitialState, emptyEstate, emptyHearth, emptyHeat } from './state';
import {
  CAMPS,
  LEGAL_LADDER,
  type CampId,
  type Claim,
  type Company,
  type Estate,
  type GameState,
  type GangMember,
  type Hearth,
  type HearthEvent,
  type Hideout,
  type Intended,
  type Lease,
  type RushNews,
} from './types';

export const SAVE_PREFIX = 'goldrush.game.';
export const LAST_KEY = 'goldrush.last';
const LEGACY_SAVE_PREFIX = 'goldfields.game.';
const LEGACY_LAST_KEY = 'goldfields.last';

export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageFailure {
  kind: 'unavailable' | 'quota' | 'corrupt' | 'not-found';
  message: string;
}

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: StorageFailure };

/** An in-memory store so the engine and its tests never touch the DOM. */
export function memoryStore(): SaveStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const pageMemoryStore = memoryStore();

export function defaultStore(): SaveStore {
  try {
    const g = globalThis as unknown as { localStorage?: SaveStore };
    return g.localStorage ?? pageMemoryStore;
  } catch {
    return pageMemoryStore;
  }
}

export function serialise(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * A version 1 save held claims as plain flags. Ground pegged before the ledger
 * of quality was kept is entered as ordinary, unworked, unproven dirt.
 */
function migrateClaims(raw: unknown, day: number): Record<CampId, Claim | null> {
  const from = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<CampId, Claim | null>;
  for (const camp of CAMPS) {
    const v = from[camp];
    if (v === true) out[camp] = {
      richnessPct: 100, workedDays: 0, peggedOn: day, proven: false,
      registered: false, lastAttendedDay: day, guardedUntilDay: 0, jumpedOn: null,
    };
    else if (v && typeof v === 'object') {
      const c = v as Partial<Claim>;
      out[camp] = {
        richnessPct: c.richnessPct ?? 100,
        workedDays: c.workedDays ?? 0,
        peggedOn: c.peggedOn ?? day,
        proven: c.proven ?? false,
        registered: c.registered ?? false,
        lastAttendedDay: c.lastAttendedDay ?? c.peggedOn ?? day,
        guardedUntilDay: c.guardedUntilDay ?? 0,
        jumpedOn: c.jumpedOn ?? null,
      };
    } else out[camp] = null;
  }
  return out;
}

/** A trail of figures off disk, with anything that is not a number thrown out. */
function numberList(raw: unknown, fallback: number | undefined): number[] {
  if (Array.isArray(raw)) {
    const out = raw.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (out.length > 0) return out;
  }
  return fallback === undefined ? [] : [fallback];
}

/** The names given to ground brought forward from a save written before §19.4. */
const MIGRATED_MINE_NAMES = ['the North Star', 'the Perseverance', 'the Welcome', 'the Caledonia'];

/**
 * A lease off disk. A §19.2 save held `{ quality, workedDays, proven }`: that
 * ground comes back as a named mine bottomed at the first level, its reef the
 * old quality and its face whatever the old wear had left in it.
 */
function migrateLease(raw: unknown, index: number): Lease {
  const l = (raw ?? {}) as Partial<Lease> & { quality?: number; workedDays?: number };
  if (typeof l.reefPct === 'number' || typeof l.name === 'string') {
    return {
      name: l.name ?? MIGRATED_MINE_NAMES[index % MIGRATED_MINE_NAMES.length],
      reefPct: l.reefPct ?? 100,
      level: l.level ?? 1,
      faceCrewWeeks: Math.max(0, l.faceCrewWeeks ?? 0),
      yieldNowPct: l.yieldNowPct ?? l.reefPct ?? 100,
      wet: l.wet ?? false,
      pump: l.pump ?? false,
      timbered: l.timbered ?? false,
      flooded: l.flooded ?? false,
      progressCrewWeeks: Math.max(0, l.progressCrewWeeks ?? 0),
      plan: l.plan === 'sink' || l.plan === 'drive' ? l.plan : null,
    };
  }
  const quality = l.quality ?? 100;
  const worked = l.workedDays ?? 0;
  return {
    name: MIGRATED_MINE_NAMES[index % MIGRATED_MINE_NAMES.length],
    reefPct: quality,
    level: 1,
    faceCrewWeeks: Math.max(0, 5 - Math.floor(worked / 12)),
    yieldNowPct: quality,
    wet: false,
    pump: false,
    timbered: false,
    flooded: false,
    progressCrewWeeks: 0,
    plan: null,
  };
}

/** A company read back off disk, with every book it needs to keep. */
function migrateCompany(raw: unknown): Company | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Company>;
  if (typeof c.name !== 'string') return null;
  return {
    name: c.name,
    treasuryPence: Math.max(0, c.treasuryPence ?? 0),
    sharesOwned: c.sharesOwned ?? 0,
    sharesPublic: c.sharesPublic ?? 0,
    sharesUnsold: c.sharesUnsold ?? 0,
    sharePricePence: c.sharePricePence ?? COMPANY_SHARE_PRICE,
    crews: (c.crews ?? []).map((k) => ({
      task: k.task === 'prospect' || k.task === 'develop' ? k.task : 'mine',
      lease: typeof k.lease === 'number' ? k.lease : undefined,
    })),
    leases: (c.leases ?? []).map((l, i) => migrateLease(l, i)),
    weekProfitPence: c.weekProfitPence ?? [],
    lastWeekGoldCentiOz: c.lastWeekGoldCentiOz ?? 0,
    foundedOn: c.foundedOn ?? 1,
    lastDividendDay: c.lastDividendDay ?? 0,
    relations: c.relations ?? 0,
    supplyContractUntilDay: c.supplyContractUntilDay ?? 0,
    battery: c.battery ?? false,
    driving: c.driving === 'cautious' || c.driving === 'hard' ? c.driving : 'ordinary',
    lastWeek: c.lastWeek ?? null,
  };
}

/** The camp in the ranges, read back with nothing owing and nothing negative. */
function migrateHideout(raw: unknown): Hideout | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Partial<Hideout>;
  return {
    stashPence: Math.max(0, h.stashPence ?? 0),
    stashCentiOz: Math.max(0, h.stashCentiOz ?? 0),
    discovered: h.discovered ?? false,
    madeOn: h.madeOn ?? 1,
  };
}

function migrateGang(raw: unknown, day: number): GangMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Partial<GangMember> => !!m && typeof m === 'object')
    .slice(0, GANG_MAX)
    .map((m) => ({
      name: typeof m.name === 'string' ? m.name : 'a man with no name to give',
      joined: m.joined ?? day,
      loyaltyFrac: Math.max(0, Math.min(1, m.loyaltyFrac ?? 0.5)),
    }));
}

/**
 * A save written before the civic ladder was kept comes back a man of no
 * property: nothing owned, no works funded, no commission (§26-§31).
 */
function migrateEstate(raw: unknown): Estate {
  const base = emptyEstate();
  if (!raw || typeof raw !== 'object') return base;
  const e = raw as Partial<Estate>;
  return {
    ...base,
    ...e,
    store: e.store && typeof e.store === 'object' ? { ...e.store } : null,
    works: Array.isArray(e.works) ? e.works.filter((w) => w && typeof w === 'object') : [],
  };
}

function migrateIntended(raw: unknown): Intended | null {
  if (!raw || typeof raw !== 'object') return null;
  const i = raw as Partial<Intended>;
  if (typeof i.name !== 'string') return null;
  return {
    name: i.name,
    trade: i.trade ?? 'storekeeper',
    manner: typeof i.manner === 'string' ? i.manner : 'dry wit',
    metOn: i.metOn ?? 1,
    metAt: i.metAt ?? 'ball',
    callsKept: i.callsKept ?? 0,
    lavishGifts: i.lavishGifts ?? 0,
    lastGiftOn: i.lastGiftOn ?? 0,
  };
}

/**
 * A save written before the hearth was kept comes back a single man with
 * nobody in the colony to write to (§32).
 */
function migrateHearth(raw: unknown): Hearth {
  const base = emptyHearth();
  if (!raw || typeof raw !== 'object') return base;
  const h = raw as Partial<Hearth>;
  return {
    ...base,
    ...h,
    intended: migrateIntended(h.intended),
    nextEvent: h.nextEvent && typeof h.nextEvent === 'object' ? { ...h.nextEvent } as HearthEvent : null,
    letters: Array.isArray(h.letters) ? h.letters.filter((l) => l && typeof l === 'object') : [],
    homeStashPence: Math.max(0, h.homeStashPence ?? 0),
    homeStashCentiOz: Math.max(0, h.homeStashCentiOz ?? 0),
    cottagePaidPence: Math.max(0, h.cottagePaidPence ?? 0),
  };
}

function finiteInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

const LOCATIONS = new Set(['suze-port', 'fields-town', 'on-road', 'hideout', ...CAMPS]);
const LODGINGS = new Set(['inn', 'stable', 'tentground', 'rough']);
const HORSES = new Set(['none', 'brumby', 'hack']);
const STOCKADE_ROLES = new Set(['none', 'joined', 'kept clear', 'sold supplies', 'away']);
const ILLNESSES = new Set([
  'dysentery', 'typhoid', 'scurvy', 'sandyBlight', 'sunstroke',
  'snakebite', 'spiderbite', 'injury', 'fever', 'exhaustion',
]);
const WORKS = new Set(['bridge', 'waterRace', 'ward', 'school']);
const TONES = new Set(['good', 'bad', 'neutral', 'grave', 'title']);
const HEARTH_RUNGS = new Set(['none', 'acquainted', 'courting', 'betrothed', 'wed', 'settled', 'estranged']);
const HEARTH_EVENTS = new Set(['call', 'banns', 'wedding', 'christmas', 'birth', 'sickbed']);
const INTENDED_TRADES = new Set(['storekeeper', 'nurse', 'boarding-house']);
const MEETING_PLACES = new Set(['ball', 'shamrock', 'calico', 'garden']);
const SCREENS = new Set([
  'title', 'resume', 'intro', 'suze', 'suze-work', 'suze-store', 'suze-lodgings', 'suze-horses',
  'secret-expedition', 'suze-crime', 'hearth', 'ball', 'letters', 'gazette', 'journal',
  'travel-route', 'travel-mode', 'ftown', 'ftown-bank', 'ftown-lodgings', 'ftown-store',
  'ftown-council', 'ftown-work', 'ftown-hospital', 'ftown-hotel', 'ftown-gamble', 'ftown-twoup',
  'ftown-cards', 'ftown-depart', 'camp', 'camp-store', 'store-sell', 'camp-mine', 'camp-grog',
  'company', 'company-crews', 'company-ground', 'company-policy', 'company-dividend',
  'estate', 'court', 'press', 'bandit', 'bandit-roads', 'hideout', 'gang', 'stash', 'encounter',
  'end', 'obituary',
]);

function validTree(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000_000;
  if (typeof value === 'string') return value.length <= 20_000;
  if (value === null || typeof value === 'boolean' || value === undefined) return true;
  if (Array.isArray(value)) return value.length <= 1_000 && value.every((v) => validTree(v, depth + 1));
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every((v) => validTree(v, depth + 1));
  return false;
}

function validRevivedState(state: GameState): boolean {
  if (!LOCATIONS.has(state.location) || !SCREENS.has(state.screen)) return false;
  if (!LEGAL_LADDER.includes(state.legal) || !LODGINGS.has(state.lodging) || !LODGINGS.has(state.slatefordLodging)) return false;
  if (!HORSES.has(state.horse) || !STOCKADE_ROLES.has(state.stockadeRole)) return false;
  if (state.gameId !== null && !/^\d{4}$/.test(state.gameId)) return false;
  if (![state.day, state.moneyPence, state.bankPence, state.goldCentiOz, state.health, state.bankRatePencePerOz].every(finiteInt)) return false;
  if (state.day < 1 || state.moneyPence < 0 || state.bankPence < 0 || state.goldCentiOz < 0) return false;
  if (state.health < 0 || state.health > 100 || state.bankRatePencePerOz <= 0) return false;
  if (state.illness && (!ILLNESSES.has(state.illness.id) || !finiteInt(state.illness.severity) || !finiteInt(state.illness.since))) return false;
  if (!Object.values(state.items).every((n) => finiteInt(n) && n >= 0 && n <= 10_000)) return false;
  for (const camp of CAMPS) {
    const claim = state.claims[camp];
    if (claim && (
      ![claim.richnessPct, claim.workedDays, claim.peggedOn].every(finiteInt) ||
      claim.richnessPct < 0 || claim.workedDays < 0 || claim.peggedOn < 0
    )) return false;
    if (typeof state.freshness[camp] !== 'number' || !Number.isFinite(state.freshness[camp]) || state.freshness[camp] < 0) return false;
  }
  if (state.company) {
    const c = state.company;
    if (c.name.length > 200 || c.crews.length > 4 || c.leases.length > 2) return false;
    if (![c.treasuryPence, c.sharesOwned, c.sharesPublic, c.sharesUnsold, c.sharePricePence].every((n) => finiteInt(n) && n >= 0)) return false;
    if (c.sharesOwned + c.sharesPublic + c.sharesUnsold !== 20) return false;
    if (!['cautious', 'ordinary', 'hard'].includes(c.driving)) return false;
    if (c.crews.some((crew) => crew.lease !== undefined && (!finiteInt(crew.lease) || crew.lease < 0 || crew.lease >= c.leases.length))) return false;
    if (c.leases.some((lease) =>
      lease.name.length > 200 ||
      ![lease.reefPct, lease.level, lease.yieldNowPct, lease.progressCrewWeeks].every(finiteInt) ||
      !Number.isFinite(lease.faceCrewWeeks) || lease.level < 0 || lease.faceCrewWeeks < 0 ||
      (lease.plan !== null && lease.plan !== 'sink' && lease.plan !== 'drive')
    )) return false;
  }
  const store = state.estate.store;
  if (store && (!CAMPS.includes(store.camp) || !['fair', 'gouge'].includes(store.policy) || !finiteInt(store.openedOn))) return false;
  if (state.estate.works.length > 4 || state.estate.works.some((work) =>
    !WORKS.has(work.id) || !finiteInt(work.day) || (work.camp !== undefined && !CAMPS.includes(work.camp))
  )) return false;
  if (!HEARTH_RUNGS.has(state.hearth.rung)) return false;
  if (state.hearth.intended && (
    !INTENDED_TRADES.has(state.hearth.intended.trade) ||
    !MEETING_PLACES.has(state.hearth.intended.metAt) ||
    state.hearth.intended.name.length > 200
  )) return false;
  if (state.hearth.nextEvent && (
    !HEARTH_EVENTS.has(state.hearth.nextEvent.kind) ||
    !finiteInt(state.hearth.nextEvent.openDay) || !finiteInt(state.hearth.nextEvent.closeDay)
  )) return false;
  if (state.hearth.letters.some((letter) =>
    !finiteInt(letter.day) || typeof letter.text !== 'string' || letter.text.length > 20_000 || !TONES.has(letter.tone)
  )) return false;
  if (state.journal.some((entry) =>
    !finiteInt(entry.day) || typeof entry.text !== 'string' || entry.text.length > 20_000 || !TONES.has(entry.tone)
  )) return false;
  return validTree(state);
}

/** Tolerant of older saves: anything missing falls back to a fresh game's value. */
export function deserialise(text: string): GameState | null {
  try {
    if (text.length > 2_000_000) return null;
    const raw = JSON.parse(text) as Partial<GameState>;
    if (typeof raw.v === 'number' && raw.v > SAVE_VERSION) return null;
    if (!finiteInt(raw.day) || raw.day < 1 || raw.day > 36_500) return null;
    if (!finiteInt(raw.moneyPence) || raw.moneyPence < 0) return null;
    if (raw.seed !== undefined && !finiteInt(raw.seed)) return null;
    const base = createInitialState(raw.seed ?? 1);
    const known = Object.fromEntries(
      Object.keys(base).map((key) => [key, (raw as Record<string, unknown>)[key] ?? (base as unknown as Record<string, unknown>)[key]]),
    ) as unknown as GameState;
    const rush: RushNews | null = raw.rush
      ? { ...raw.rush, since: raw.rush.since ?? raw.day, base: raw.rush.base ?? 1 }
      : null;
    const revived = {
      ...base,
      ...known,
      v: SAVE_VERSION,
      screen: (raw as { screen?: string }).screen === 'camp-shares'
        ? (raw.company ? 'company' : 'camp')
        : known.screen,
      items: { ...base.items, ...(raw.items ?? {}) },
      claims: migrateClaims(raw.claims, raw.day),
      freshness: { ...base.freshness, ...(raw.freshness ?? {}) },
      skill: { ...base.skill, ...(raw.skill ?? {}) },
      standing: raw.standing ?? 0,
      partner: raw.partner ?? false,
      slatefordLodging: raw.slatefordLodging ?? 'rough',
      slatefordTentGroundPaidUntilDay: raw.slatefordTentGroundPaidUntilDay ?? 0,
      horseInspection: { ...base.horseInspection, ...(raw.horseInspection ?? {}) },
      // A save written before either ledger was kept starts both afresh, at
      // whatever the rate and the man are worth today.
      rateTrail: numberList(raw.rateTrail, raw.bankRatePencePerOz ?? base.bankRatePencePerOz),
      worthHistory: numberList(raw.worthHistory, undefined),
      rush,
      // A save written before the company or the agitation was kept in the
      // ledger comes back a plain digger in a quiet year.
      company: migrateCompany(raw.company),
      soldOut: raw.soldOut ?? null,
      estate: migrateEstate(raw.estate),
      hearth: migrateHearth(raw.hearth),
      agitation: raw.agitation ?? 0,
      meetingDone: raw.meetingDone ?? false,
      meetingAttended: raw.meetingAttended ?? false,
      stockadeDone: raw.stockadeDone ?? false,
      stockadeDay: raw.stockadeDay ?? 0,
      stockadeRole: raw.stockadeRole ?? 'none',
      minersRightUntilDay: raw.minersRightUntilDay ?? 0,
      aftermathNoted: raw.aftermathNoted ?? false,
      // A save written before the dark ladder was kept in the ledger comes back
      // an honest man with a clean sheet and nothing buried anywhere (§25).
      notoriety: raw.notoriety ?? 0,
      heat: { ...emptyHeat(), ...(raw.heat ?? {}) },
      outlawed: raw.outlawed ?? false,
      hideout: migrateHideout(raw.hideout),
      gang: migrateGang(raw.gang, raw.day),
      intel: raw.intel ?? null,
      ambush: raw.ambush ?? false,
      diggersRobbed: raw.diggersRobbed ?? 0,
      bigJobsDone: raw.bigJobsDone ?? 0,
      bloodShed: raw.bloodShed ?? false,
      rewardPrintedPence: raw.rewardPrintedPence ?? 0,
      warnedOn: raw.warnedOn ?? 0,
      gaolBreakOffered: raw.gaolBreakOffered ?? false,
      pardonOffered: raw.pardonOffered ?? false,
      outlawEnd: raw.outlawEnd ?? null,
      stats: { ...base.stats, ...(raw.stats ?? {}) },
      journal: Array.isArray(raw.journal) ? raw.journal.slice(-400) : [],
    } as GameState;
    if (!validRevivedState(revived)) return null;
    revived.rateTrail = revived.rateTrail.slice(-30);
    revived.worthHistory = revived.worthHistory.slice(-800);
    revived.hearth.letters = revived.hearth.letters.slice(-40);
    return revived;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, store: SaveStore = defaultStore()): string {
  let id = state.gameId;
  if (!id) {
    const allocated = allocateSaveId(store);
    if (!allocated.ok) throw new Error(allocated.error.message);
    id = allocated.value;
  }
  store.setItem(SAVE_PREFIX + id, serialise({ ...state, gameId: id }));
  store.setItem(LAST_KEY, id);
  return id;
}

function failure(error: unknown, fallback: StorageFailure['kind'] = 'unavailable'): StorageFailure {
  const name = typeof error === 'object' && error && 'name' in error ? String((error as { name: unknown }).name) : '';
  const quota = /quota/i.test(name) || (typeof error === 'object' && error && 'code' in error && (error as { code: unknown }).code === 22);
  return quota
    ? { kind: 'quota', message: 'Browser storage is full. Delete an older site save or free storage, then try again.' }
    : { kind: fallback, message: 'Browser storage is unavailable in this window.' };
}

export function allocateSaveId(store: SaveStore = defaultStore()): StorageResult<string> {
  try {
    const start = Math.floor(Math.random() * 8999);
    for (let n = 0; n < 8999; n++) {
      const id = String(1000 + ((start + n) % 8999));
      if (store.getItem(SAVE_PREFIX + id) === null && store.getItem(LEGACY_SAVE_PREFIX + id) === null) {
        return { ok: true, value: id };
      }
    }
    return { ok: false, error: { kind: 'quota', message: 'Every game number is already in use.' } };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export function trySaveGame(state: GameState, store: SaveStore = defaultStore()): StorageResult<string> {
  try {
    return { ok: true, value: saveGame(state, store) };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export function loadGame(id: string, store: SaveStore = defaultStore()): GameState | null {
  const cleanId = id.trim();
  const text = store.getItem(SAVE_PREFIX + cleanId) ?? store.getItem(LEGACY_SAVE_PREFIX + cleanId);
  return text ? deserialise(text) : null;
}

export function tryLoadGame(id: string, store: SaveStore = defaultStore()): StorageResult<GameState> {
  try {
    const cleanId = id.trim();
    const text = store.getItem(SAVE_PREFIX + cleanId) ?? store.getItem(LEGACY_SAVE_PREFIX + cleanId);
    if (!text) return { ok: false, error: { kind: 'not-found', message: 'No such game.' } };
    const state = deserialise(text);
    if (!state) return { ok: false, error: { kind: 'corrupt', message: 'That saved game is damaged or from a newer version.' } };
    return { ok: true, value: state };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export function lastGameId(store: SaveStore = defaultStore()): string | null {
  return store.getItem(LAST_KEY) ?? store.getItem(LEGACY_LAST_KEY);
}

export function tryLastGameId(store: SaveStore = defaultStore()): StorageResult<string | null> {
  try {
    return { ok: true, value: lastGameId(store) };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export function listSaves(store: SaveStore = defaultStore()): string[] {
  const g = globalThis as unknown as { localStorage?: Storage };
  const ls = g.localStorage;
  if (!ls || store !== (ls as unknown as SaveStore)) return [];
  const ids = new Set<string>();
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k?.startsWith(SAVE_PREFIX)) ids.add(k.slice(SAVE_PREFIX.length));
    else if (k?.startsWith(LEGACY_SAVE_PREFIX)) ids.add(k.slice(LEGACY_SAVE_PREFIX.length));
  }
  return [...ids].sort();
}
