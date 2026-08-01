import { COMPANY_SHARE_PRICE, GANG_MAX } from './constants';
import { SAVE_VERSION, createInitialState, emptyEstate, emptyHearth, emptyHeat } from './state';
import {
  CAMPS,
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

/** An in-memory store so the engine and its tests never touch the DOM. */
export function memoryStore(): SaveStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function defaultStore(): SaveStore {
  const g = globalThis as unknown as { localStorage?: SaveStore };
  return g.localStorage ?? memoryStore();
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
      quality: 100, workedDays: 0, peggedOn: day, proven: false,
      registered: false, lastAttendedDay: day, guardedUntilDay: 0, jumpedOn: null,
    };
    else if (v && typeof v === 'object') {
      const c = v as Partial<Claim>;
      out[camp] = {
        quality: c.quality ?? 100,
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
  if (typeof l.reef === 'number' || typeof l.name === 'string') {
    return {
      name: l.name ?? MIGRATED_MINE_NAMES[index % MIGRATED_MINE_NAMES.length],
      reef: l.reef ?? 100,
      level: l.level ?? 1,
      face: Math.max(0, l.face ?? 0),
      yieldNow: l.yieldNow ?? l.reef ?? 100,
      wet: l.wet ?? false,
      pump: l.pump ?? false,
      timbered: l.timbered ?? false,
      flooded: l.flooded ?? false,
      progress: Math.max(0, l.progress ?? 0),
      plan: l.plan === 'sink' || l.plan === 'drive' ? l.plan : null,
    };
  }
  const quality = l.quality ?? 100;
  const worked = l.workedDays ?? 0;
  return {
    name: MIGRATED_MINE_NAMES[index % MIGRATED_MINE_NAMES.length],
    reef: quality,
    level: 1,
    face: Math.max(0, 5 - Math.floor(worked / 12)),
    yieldNow: quality,
    wet: false,
    pump: false,
    timbered: false,
    flooded: false,
    progress: 0,
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
    treasury: Math.max(0, c.treasury ?? 0),
    sharesOwned: c.sharesOwned ?? 0,
    sharesPublic: c.sharesPublic ?? 0,
    sharesUnsold: c.sharesUnsold ?? 0,
    sharePrice: c.sharePrice ?? COMPANY_SHARE_PRICE,
    crews: (c.crews ?? []).map((k) => ({
      task: k.task === 'prospect' || k.task === 'develop' ? k.task : 'mine',
      lease: typeof k.lease === 'number' ? k.lease : undefined,
    })),
    leases: (c.leases ?? []).map((l, i) => migrateLease(l, i)),
    weekProfit: c.weekProfit ?? [],
    lastWeekGold: c.lastWeekGold ?? 0,
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
    stashGold: Math.max(0, h.stashGold ?? 0),
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
      loyalty: Math.max(0, Math.min(1, m.loyalty ?? 0.5)),
    }));
}

/**
 * A save written before the civic ladder was kept comes back a man of no
 * property: nothing owned, nothing subscribed, no commission (§26-§31).
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
    homeStashGold: Math.max(0, h.homeStashGold ?? 0),
    cottagePaid: Math.max(0, h.cottagePaid ?? 0),
  };
}

/** Tolerant of older saves: anything missing falls back to a fresh game's value. */
export function deserialise(text: string): GameState | null {
  try {
    const raw = JSON.parse(text) as Partial<GameState>;
    if (typeof raw.day !== 'number' || typeof raw.moneyPence !== 'number') return null;
    const base = createInitialState(raw.seed ?? 1);
    const rush: RushNews | null = raw.rush
      ? { ...raw.rush, since: raw.rush.since ?? raw.day, base: raw.rush.base ?? 1 }
      : null;
    return {
      ...base,
      ...raw,
      v: SAVE_VERSION,
      items: { ...base.items, ...(raw.items ?? {}) },
      claims: migrateClaims(raw.claims, raw.day),
      freshness: { ...base.freshness, ...(raw.freshness ?? {}) },
      skill: { ...base.skill, ...(raw.skill ?? {}) },
      standing: raw.standing ?? 0,
      partner: raw.partner ?? false,
      slatefordLodging: raw.slatefordLodging ?? 'rough',
      slatefordTentGroundPaidUntil: raw.slatefordTentGroundPaidUntil ?? 0,
      horseInspection: { ...base.horseInspection, ...(raw.horseInspection ?? {}) },
      // A save written before either ledger was kept starts both afresh, at
      // whatever the rate and the man are worth today.
      rateTrail: numberList(raw.rateTrail, raw.bankRate ?? base.bankRate),
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
      rewardPrinted: raw.rewardPrinted ?? 0,
      warnedOn: raw.warnedOn ?? 0,
      gaolBreakOffered: raw.gaolBreakOffered ?? false,
      pardonOffered: raw.pardonOffered ?? false,
      outlawEnd: raw.outlawEnd ?? null,
      stats: { ...base.stats, ...(raw.stats ?? {}) },
      journal: raw.journal ?? [],
    } as GameState;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, store: SaveStore = defaultStore()): string {
  const id = state.gameId ?? String(1000 + Math.floor(Math.random() * 8999));
  store.setItem(SAVE_PREFIX + id, serialise({ ...state, gameId: id }));
  store.setItem(LAST_KEY, id);
  return id;
}

export function loadGame(id: string, store: SaveStore = defaultStore()): GameState | null {
  const cleanId = id.trim();
  const text = store.getItem(SAVE_PREFIX + cleanId) ?? store.getItem(LEGACY_SAVE_PREFIX + cleanId);
  return text ? deserialise(text) : null;
}

export function lastGameId(store: SaveStore = defaultStore()): string | null {
  return store.getItem(LAST_KEY) ?? store.getItem(LEGACY_LAST_KEY);
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
