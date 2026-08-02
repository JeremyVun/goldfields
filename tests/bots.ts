/**
 * Strategy bots for the balance harness (GAME_SPEC.md §16).
 *
 * Each bot is a pure function from state to the next action it would take.
 * They exercise the whole engine — travel, law, health, mining, market — and
 * their year-end results are asserted against the §14 balance targets.
 */

import { makeRng } from '../src/engine/rng';
import { createInitialState, hasWork, inAftermath, isCamp, isLicensed, lodgingAt, netWorth } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { bankRefuses, priceOf, provisionsPrice } from '../src/engine/market';
import { depletionFactor, freshnessOf, isWorkedOut } from '../src/engine/mining';
import { canFloat, purse } from '../src/engine/company';
import { canBigJob, canBreakGaol, canMakeHideout, canRecruit, crimeVisible } from '../src/engine/bandit';
import { canTakeCommission, commissionRequirements, courtDue, isJP } from '../src/engine/estate';
import {
  CAMP_DEFS,
  COMPANY_CREW_WAGES,
  COMPANY_MAX_CREWS,
  COMPANY_REGISTRATION_FEE,
  COMPANY_SHARE_PRICE,
  HORSE_PRICE,
  JP_FEE,
  NOTORIETY_BAILUP_GATE,
  NOTORIETY_GANG_GATE,
  GANG_MAX,
  NOTORIETY_HIDEOUT_GATE,
  PASSAGE_FARE,
  SHOUT_CAP_DAYS,
  STORE_PRICE,
  STORE_STANDING,
  STORE_STOCK_PRICE,
  WORK_DEFS,
} from '../src/engine/constants';
import { pounds, shillings } from '../src/engine/money';
import { DAYS_IN_YEAR } from '../src/engine/time';
import type { Action, CampId, GameState, ItemId, OutlawEnd, Route, WorkId } from '../src/engine/types';

export interface Bot {
  name: string;
  decide(state: GameState): Action | null;
}

export interface RunResult {
  bot: string;
  seed: number;
  worth: number;
  died: boolean;
  causeOfDeath: string | null;
  day: number;
  health: number;
  legal: string;
  arrests: number;
  goldWon: number;
  daysDug: number;
  steps: number;
  standing: number;
  /** Did he ever get his name on a company's door? */
  floated: boolean;
  /** And the other ledger (§25). */
  notoriety: number;
  outlawed: boolean;
  outlawEnd: OutlawEnd | null;
  bailUps: number;
  bigJobsDone: number;
  takingsPence: number;
  diggersRobbed: number;
  hadHideout: boolean;
  stash: number;
  /** The civic ladder (§29): what he ended the year holding, and when. */
  properties: number;
  works: number;
  storeDay: number | null;
  jp: boolean;
  /** How often each narration key fired all year — the harness's event counts. */
  events: Record<string, number>;
}

const KEEP_FOR_BRIBE = pounds(5);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function framing(state: GameState, meeting = false): Action | null | undefined {
  if (state.pending) {
    // Everyone tries the fiver first; it is what the Journal advises.
    if (state.pending.kind === 'trooper') {
      return state.moneyPence >= KEEP_FOR_BRIBE ? { type: 'bribe' } : { type: 'submit' };
    }
    // The dark ladder's questions (§23-§24). An honest bot never sees these.
    if (state.pending.kind === 'bailup') {
      const victim = String(state.pending.data?.victim ?? '');
      // The wild colonial boy robs the Crown and the squatters and never a
      // digger's pile: it keeps the harbourers friendly and the gaol door ajar.
      if (victim === 'digger' || victim === 'parson' || victim === 'trooper') {
        return { type: 'letPass' };
      }
      return { type: 'bailUpTake', shoot: false };
    }
    if (state.pending.kind === 'patrol' || state.pending.kind === 'hideoutRaid') {
      return { type: 'flee' };
    }
    if (state.pending.kind === 'assizes') {
      return canBreakGaol(state) ? { type: 'breakGaol' } : { type: 'awaitAssizes' };
    }
    // A man who has come this far does not buy a clean name with the whole of it.
    if (state.pending.kind === 'pardon') return { type: 'takePardon', take: false };
    // Bots dig; they do not agitate. They keep to the tent for the monster
    // meeting and well clear of the stockade (§22). A man who means to float a
    // company is the exception: he goes down to be seen at the meeting.
    if (state.pending.kind === 'meeting') return { type: 'attendMeeting', attend: meeting };
    if (state.pending.kind === 'stockade') return { type: 'keepClear' };
    return state.items.gun > 0 ? { type: 'resist' } : { type: 'submit' };
  }
  if (state.screen === 'title') return { type: 'newGame' };
  if (state.screen === 'intro') return { type: 'continue' };
  if (state.screen === 'gazette' || state.screen === 'journal') return { type: 'continue' };
  if (state.screen === 'end' || state.screen === 'obituary') return null;
  if (state.endOfYear || state.gameOver) return null;
  return undefined; // nothing framing to do; carry on with strategy
}

function needsItem(state: GameState, item: ItemId): boolean {
  return state.items[item] < 1;
}

function canAfford(state: GameState, item: ItemId, reserve = 0): boolean {
  return state.moneyPence - reserve >= priceOf(state, item);
}

/** Kit up at Port Gannet, where goods are much cheaper (the Journal's first lesson). */
function outfitAtSuze(state: GameState, wanted: ItemId[]): Action | null {
  for (const it of wanted) {
    // Keep a fortnight's food money back while buying tools.
    if (needsItem(state, it) && canAfford(state, it, shillings(10))) return { type: 'buy', item: it };
  }
  return null;
}

function suzeLodging(state: GameState): Action | null {
  const want = state.items.tent > 0 ? 'tentground' : 'rough';
  if (state.lodging !== want) return { type: 'setLodging', kind: want };
  return null;
}

/** Nobody works well on an empty stomach; food comes before everything. */
function feed(state: GameState, floor = 10): Action | null {
  if (state.provisionDays >= floor) return null;
  const week = provisionsPrice(state);
  if (state.moneyPence >= week * 4) return { type: 'buyProvisions', weeks: 4 };
  if (state.moneyPence >= week) return { type: 'buyProvisions', weeks: 1 };
  // A wanted man may not draw on the bank at all (§23.1); asking twice is how a
  // bot spends a year standing at a counter.
  if (state.bankPence >= week * 4 && !bankRefuses(state)) {
    return { type: 'withdraw', amount: week * 4 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The idler: never leaves Port Gannet, just works.
// ---------------------------------------------------------------------------

export const idler: Bot = {
  name: 'idler',
  decide(state) {
    const f = framing(state);
    if (f !== undefined) return f;

    const food = feed(state, 12);
    if (food) return food;
    if (state.health < 32 && state.moneyPence > shillings(30)) return { type: 'hospital', days: 3 };
    if (state.health < 32 && state.bankPence > shillings(40)) return { type: 'withdraw', amount: shillings(40) };
    if (state.health < 50 && state.provisionDays > 4) return { type: 'rest', days: 3 };
    if (state.daysWithoutGreens > 60 && state.moneyPence > shillings(3)) return { type: 'buyGreens' };
    if (needsItem(state, 'tent') && state.moneyPence > priceOf(state, 'tent') + shillings(12)) {
      return { type: 'buy', item: 'tent' };
    }
    const lodge = suzeLodging(state);
    if (lodge) return lodge;
    // A wise man puts his wages in the bank rather than under his blanket.
    if (state.moneyPence > pounds(3)) {
      return { type: 'deposit', amount: state.moneyPence - shillings(20) };
    }
    return { type: 'work', job: 'wharf', days: 7 };
  },
};

// ---------------------------------------------------------------------------
// A generic digger bot, parameterised by camp, method and whether it pays for
// a licence. Covers the cautious panner, the aggressive shafter and the dodger.
// ---------------------------------------------------------------------------

/** Which of the ordinary three camps a rush-chaser would be at today (§22). */
export function bestCamp(state: GameState, method: 'pan' | 'cradle' | 'shaft'): CampId {
  const camps: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];
  // Word of a rush trumps everything: fresh ground pegged early rolls rich.
  if (state.rush && state.rush.untilDay >= state.day && camps.includes(state.rush.camp)) {
    return state.rush.camp;
  }
  let best: CampId = camps[0];
  let score = -1;
  for (const c of camps) {
    const ground = method === 'shaft' ? CAMP_DEFS[c].reef : CAMP_DEFS[c].alluvial;
    const s = freshnessOf(state, c) * ground;
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return best;
}

/**
 * A week's work tells a man what his ground is worth. When it is worth less
 * than the average of what is left in the camp, the pegs come out (§17.1) —
 * pegging again costs nothing but the walk across the flat.
 */
function poorerThanTheField(state: GameState, camp: CampId): boolean {
  const claim = state.claims[camp];
  if (!claim || claim.workedDays < 7) return false;
  const worth = claim.richnessPct * depletionFactor(claim.workedDays);
  return worth < 90 * freshnessOf(state, camp);
}

/** Ground pegged before the word got out is ground pegged at the old price. */
function staleOfRush(state: GameState, camp: CampId): boolean {
  const claim = state.claims[camp];
  if (!claim) return false;
  const rush = state.rush;
  return !!rush && rush.camp === camp && rush.untilDay >= state.day && claim.peggedOn < rush.since;
}

type DigMethod = 'pan' | 'cradle' | 'shaft';

interface DiggerPlan {
  name: string;
  camp: CampId | ((state: GameState) => CampId);
  /** Follows the rushes and the freshest ground rather than sitting still. */
  roving?: boolean;
  method: DigMethod | ((state: GameState) => DigMethod);
  licence: boolean;
  kit: ItemId[];
  /** Bought at Port Gannet only if the money is there after the essentials. */
  optional?: ItemId[];
  /** Kept in stock at the diggings prices of Slateford, up to the given count. */
  stock?: Partial<Record<ItemId, number>>;
  capitalToLeave: number;
  /** Centi-ounces of gold the bot will carry before making for the bank. */
  carryLimit?: number;
  route: 'trickeys' | 'pass';
  hireMate?: boolean;
  /** Days of licence cover bought in advance; each licence is a point of name. */
  licenceStock?: number;
  /** Money kept out of the bank, for troopers and for a company's wages. */
  pocket?: (state: GameState) => number;
  /** Floats a company of his own the moment the registrar will have him. */
  company?: boolean;
  /** Health at which he knocks off for a few days, and at which he walks to town. */
  restBelow?: number;
  townBelow?: number;
  /** Health at which he pays Canvas House, and the greens interval he keeps. */
  hospitalBelow?: number;
  greensAfter?: number;
  /** Climbs the civic ladder: a counter of his own, a name, and the bench (§29). */
  civic?: boolean;
  /** Slabs and props before he sends down another bucket (§9). */
  timberFirst?: boolean;
}

function campOf(plan: DiggerPlan, state: GameState): CampId {
  return typeof plan.camp === 'function' ? plan.camp(state) : plan.camp;
}

function methodOf(plan: DiggerPlan, state: GameState): DigMethod {
  return typeof plan.method === 'function' ? plan.method(state) : plan.method;
}

/**
 * The business of a man who owns a mine rather than digs one (§19, §22): float,
 * put on crews, keep one of them looking for fresh reef, and pay a dividend
 * when the treasury will stand it.
 */
function companyBusiness(state: GameState): Action | null {
  const c = state.company;
  if (!c) {
    const outlay = COMPANY_REGISTRATION_FEE + COMPANY_SHARE_PRICE * 12;
    if (canFloat(state) && purse(state) >= outlay) return { type: 'floatCompany', shares: 12 };
    return null;
  }
  if (c.crews.length < COMPANY_MAX_CREWS && c.treasuryPence >= COMPANY_CREW_WAGES * 3) {
    return { type: 'hireCrew' };
  }
  // Two at the reef and one out over the ranges looking for the next lease.
  const last = c.crews.length - 1;
  if (c.crews.length >= COMPANY_MAX_CREWS && c.crews[last].task !== 'prospect') {
    return { type: 'setCrewTask', index: last, task: 'prospect' };
  }
  // A treasury is no use to a shareholder until it is declared out of the door.
  const issued = c.sharesOwned + c.sharesPublic;
  const float = COMPANY_CREW_WAGES * c.crews.length * 4;
  if (issued > 0 && c.treasuryPence >= float + pounds(1) * issued) {
    return { type: 'declareDividend', perShare: pounds(1) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The civic ladder: a counter of his own, a round for the room, a plaque and
// the bench (§26-§29). A cautious man buys none of it with money he needs.
// ---------------------------------------------------------------------------

/** Food, a licence and a fiver for the troopers come before any deed. */
const CIVIC_RESERVE = pounds(8);
/** Past this the field's good opinion is had, and rounds are only rounds. */
const SHOUT_UNTIL_STANDING = 65;
/** Public works, cheapest first: a man gives what he can spare (§27). */
const WORK_ORDER: WorkId[] = ['ward', 'school', 'waterRace', 'bridge'];

/** Generosity counts once in a fortnight; the fortnight is the whole rule (§30.3). */
function shoutDue(state: GameState): boolean {
  return state.estate.shoutedOn === 0 || state.day - state.estate.shoutedOn >= SHOUT_CAP_DAYS;
}

function civicAtTown(state: GameState): Action | null {
  // The bench first: it is offered in the aftermath and to a clean sheet only.
  if (canTakeCommission(state) && purse(state) >= JP_FEE + CIVIC_RESERVE) {
    return { type: 'acceptCommission' };
  }
  if (isJP(state) && courtDue(state)) return { type: 'holdCourt' };
  // A round for the room, once a fortnight, while the name is still worth the
  // buying. He shouts; he does not spree — £20 for five points is the worst
  // money in the game and he knows it (§30.3).
  if (state.standing < SHOUT_UNTIL_STANDING && shoutDue(state)) {
    if (state.moneyPence >= pounds(6)) return { type: 'shoutBar', spree: false };
    if (purse(state) >= pounds(14) && state.bankPence >= pounds(6)) {
      return { type: 'withdraw', amount: pounds(6) };
    }
  }
  // Public works out of what is genuinely spare: no plaque is worth a hungry
  // winter, and the money never comes back (§27).
  for (const id of WORK_ORDER) {
    if (hasWork(state, id)) continue;
    const camp = state.estate.store?.camp;
    if (id === 'waterRace' && !camp) continue;
    if (purse(state) < WORK_DEFS[id].cost + pounds(200)) continue;
    return { type: 'fundWork', work: id, camp: id === 'waterRace' ? camp : undefined };
  }
  return null;
}

/**
 * Everything the Bench asks except the walk to the Chambers itself, which is
 * the first of the requirements listed (§28.1) and the one the notable is
 * expected to do something about.
 */
function benchAwaits(state: GameState): boolean {
  if (state.estate.jpSinceDay !== null) return false;
  return commissionRequirements(state).every((r, i) => r.met || i === 0);
}

/** A tent, a licence and thirty pounds of flour: the storekeeper's start (§26). */
function civicAtCamp(state: GameState, camp: CampId): Action | null {
  // The commission is gazetted at the Chambers or nowhere: a man does not
  // stand on his own claim waiting to be made a magistrate.
  if (benchAwaits(state)) return { type: 'travelTo', place: 'fields-town' };
  if (state.estate.store) return null;
  if (state.standing < STORE_STANDING) return null;
  // No man opens a counter on ground the field is walking off (§26).
  if (freshnessOf(state, camp) < 0.6) return null;
  if (purse(state) < STORE_PRICE + STORE_STOCK_PRICE + CIVIC_RESERVE) return null;
  return { type: 'openStore', camp };
}

function makeDigger(plan: DiggerPlan): Bot {
  const reserve = (state: GameState): number => plan.pocket?.(state) ?? pounds(3);
  return {
    name: plan.name,
    decide(state) {
      const f = framing(state, !!plan.company);
      if (f !== undefined) return f;

      // The list is called and the bench must say something to it. Leniency:
      // the field respects a hard man and does not love him (§28.1).
      if (state.screen === 'court') return { type: 'rule', ruling: 'leniency' };

      // ---- Port Gannet: earn, outfit, and go -----------------------------
      if (state.location === 'suze-port') {
        const food = feed(state, 12);
        if (food) return food;
        if (state.health < 32 && state.moneyPence > shillings(30)) return { type: 'hospital', days: 3 };
        if (state.health < 50 && state.provisionDays > 4) return { type: 'rest', days: 3 };
        if (state.goldCentiOz > 0) return { type: 'sellGold', where: 'bank', watch: true };
        if (state.salvage > 0) return { type: 'sellSalvage' };
        if (state.daysWithoutGreens > 60 && state.moneyPence > shillings(3)) return { type: 'buyGreens' };
        // While saving for an outfit, a man sleeps rough and likes it.
        if (state.lodging !== 'rough') return { type: 'setLodging', kind: 'rough' };
        const kitted = plan.kit.every((i) => state.items[i] > 0);
        if (!kitted) {
          const buy = outfitAtSuze(state, plan.kit);
          if (buy) return buy;
          return { type: 'work', job: 'town', days: 7 };
        }
        // Kitted out: lay in food and the price of a licence, then go.
        if (state.items.waterBags > 0 && state.waterDays < 8 && state.moneyPence > shillings(2)) {
          return { type: 'fillWater' };
        }
        if (state.provisionDays < 56 && state.moneyPence > plan.capitalToLeave + shillings(20)) {
          return { type: 'buyProvisions', weeks: 4 };
        }
        if (state.provisionDays >= 42 && state.moneyPence >= plan.capitalToLeave) {
          for (const it of plan.optional ?? []) {
            if (state.items[it] < 1 && canAfford(state, it, plan.capitalToLeave)) {
              return { type: 'buy', item: it };
            }
          }
          return { type: 'travel', route: plan.route, mode: 'walk' };
        }
        return { type: 'work', job: 'town', days: 7 };
      }

      // ---- Slateford: bank, licence, victuals, then out again --------
      if (state.location === 'fields-town') {
        if (state.goldCentiOz > 0) return { type: 'sellGold', where: 'bank', watch: true };
        // The registrar keeps his ledger at the Chambers as well as at the
        // workings; a man with the money does not walk two days to use it.
        if (plan.company && !state.company) {
          const float = companyBusiness(state);
          if (float) return float;
        }
        const food = feed(state, 10);
        if (food) return food;
        if (state.health < (plan.hospitalBelow ?? 30) && state.moneyPence > shillings(30)) {
          return { type: 'hospital', days: 3 };
        }
        if (state.health < (plan.restBelow ?? 45)) return { type: 'rest', days: 4 };
        if (plan.licence && !isLicensed(state) && state.moneyPence >= shillings(30)) {
          return { type: 'buyLicence' };
        }
        // A man of means takes out his licences a year at a time: fewer walks
        // back to the Chambers, and the clerk remembers the name (§18.2).
        if (
          plan.licence &&
          plan.licenceStock &&
          !inAftermath(state) &&
          state.licenceUntilDay - state.day < plan.licenceStock &&
          state.moneyPence >= shillings(30) + pounds(6)
        ) {
          return { type: 'buyLicence' };
        }
        if (state.daysWithoutGreens > (plan.greensAfter ?? 70) && state.moneyPence > shillings(4)) {
          return { type: 'buyGreens' };
        }
        if (plan.civic) {
          const civic = civicAtTown(state);
          if (civic) return civic;
        }
        if (state.items.waterBags > 0 && state.waterDays < 6 && state.moneyPence > shillings(2)) {
          return { type: 'fillWater' };
        }
        for (const [it, want] of Object.entries(plan.stock ?? {}) as [ItemId, number][]) {
          if (state.items[it] < want && state.moneyPence > priceOf(state, it) + pounds(2)) {
            return { type: 'buy', item: it };
          }
          if (state.items[it] < want && state.bankPence > pounds(6) && state.moneyPence < pounds(6)) {
            return { type: 'withdraw', amount: pounds(6) };
          }
        }
        if (state.provisionDays < 25 && state.moneyPence > shillings(30)) {
          return { type: 'buyProvisions', weeks: 4 };
        }
        // Keep a fiver about you for troopers; bank the rest.
        if (state.moneyPence > KEEP_FOR_BRIBE + reserve(state) + pounds(1)) {
          return { type: 'deposit', amount: state.moneyPence - KEEP_FOR_BRIBE - reserve(state) };
        }
        if (state.provisionDays < 8) {
          if (state.bankPence > 0) return { type: 'withdraw', amount: pounds(2) };
          return { type: 'work', job: 'gardener', days: 7 };
        }
        if (plan.licence && !isLicensed(state)) {
          if (state.bankPence >= shillings(30)) return { type: 'withdraw', amount: pounds(2) };
          return { type: 'work', job: 'barman', days: 7 };
        }
        return { type: 'travelTo', place: campOf(plan, state) };
      }

      // ---- At the diggings ----------------------------------------------
      const target = campOf(plan, state);
      // A roving man does not sit on picked-over ground while a rush is on
      // elsewhere; he pulls up and walks to it.
      if (
        plan.roving &&
        isCamp(state.location) &&
        state.location !== target &&
        state.location !== 'secret-mine' &&
        !state.shaft &&
        state.health >= 40 &&
        state.provisionDays >= 5
      ) {
        return { type: 'travelTo', place: target };
      }
      if (state.location === target || state.location === 'secret-mine') {
        const camp = state.location as CampId;
        if (state.health < (plan.townBelow ?? 32)) return { type: 'travelTo', place: 'fields-town' };
        if (plan.civic) {
          const civic = civicAtCamp(state, camp);
          if (civic) return civic;
        }
        if (plan.company && camp === 'deep-mountains') {
          const business = companyBusiness(state);
          if (business) return business;
        }
        const claim = state.claims[camp];
        // Proved ground is what the registrar wants to see; a man who means to
        // float does not pull those pegs until the company holds the lease.
        const holdForFloat =
          !!plan.company &&
          !state.company &&
          camp === 'deep-mountains' &&
          !!claim?.proven &&
          !isWorkedOut(claim);
        // Ground past its best is ground to give up: pull the pegs and put them
        // in again on the same camp's dirt, which rolls fresh quality.
        if (
          claim &&
          !state.shaft &&
          !holdForFloat &&
          (isWorkedOut(claim) ||
            claim.workedDays >= 24 ||
            (plan.roving && (staleOfRush(state, camp) || poorerThanTheField(state, camp))))
        ) {
          return { type: 'abandonClaim' };
        }
        if (!claim) return { type: 'pegClaim' };
        // Two days from the nearest sack of flour, a careful man keeps a
        // fortnight of it by him and pays the camp's freight for the privilege.
        if (plan.civic && state.provisionDays < 14 && state.moneyPence >= provisionsPrice(state) * 2) {
          return { type: 'buyProvisions', weeks: 2 };
        }
        if (state.items.waterBags > 0 && state.waterDays < 5 && state.moneyPence > shillings(6)) {
          return { type: 'fillWater' };
        }
        if (state.provisionDays < 6) return { type: 'travelTo', place: 'fields-town' };
        if (plan.licence && state.licenceUntilDay - state.day < 4 && !inAftermath(state)) {
          return { type: 'travelTo', place: 'fields-town' };
        }
        if (state.goldCentiOz > (plan.carryLimit ?? 600)) return { type: 'travelTo', place: 'fields-town' };
        const method = methodOf(plan, state);
        // A man who has finished with the reef fills in nothing and walks: the
        // hole is left to the next hopeful, and its odds with it.
        if (method !== 'shaft' && state.shaft) return { type: 'abandonShaft' };
        if (method === 'shaft' && state.items.timber < 1 && state.moneyPence > pounds(3)) {
          return { type: 'buy', item: 'timber' };
        }
        // Slabbing the sides costs a day of gold and may cost nothing at all,
        // which is the whole of the difference between a careful man and the
        // column of the Times that lists what was dug out of the fall.
        if (plan.timberFirst && state.shaft && !state.shaft.timbered && state.items.timber > 0) {
          return { type: 'timberShaft' };
        }
        if (plan.hireMate && state.mateUntilDay < state.day && state.moneyPence > pounds(2)) {
          return { type: 'hireMate', days: 7 };
        }
        if (state.health < (plan.restBelow ?? 45)) return { type: 'rest', days: 3 };
        // A man who means to slab his hole works it in short spells until he
        // has: every day of an open shaft is a day of the untimbered odds.
        const spell = plan.timberFirst && method === 'shaft' && !state.shaft?.timbered ? 1 : 7;
        return { type: 'mine', method, days: spell };
      }

      // Somewhere unexpected (a hoax chase, or carted off): make for town.
      return { type: 'travelTo', place: 'fields-town' };
    },
  };
}

export const cautiousPanner = makeDigger({
  name: 'cautious panner',
  camp: 'damp-camp',
  method: 'pan',
  licence: true,
  kit: ['pan', 'swag', 'waterBags', 'tent'],
  optional: ['gun'],
  capitalToLeave: shillings(38),
  route: 'trickeys',
});

export const cautiousCradler = makeDigger({
  name: 'cautious cradler',
  camp: 'damp-camp',
  method: 'cradle',
  licence: true,
  kit: ['pan', 'swag', 'waterBags', 'tent', 'barrow', 'cradle'],
  optional: ['gun'],
  capitalToLeave: shillings(40),
  route: 'trickeys',
  hireMate: true,
});

export const aggressiveShafter = makeDigger({
  name: 'aggressive shafter',
  camp: 'deep-mountains',
  method: 'shaft',
  licence: true,
  kit: ['pick', 'shovel', 'ropeBucket', 'swag', 'waterBags', 'tent'],
  optional: ['gun'],
  stock: { timber: 3, pump: 1 },
  capitalToLeave: shillings(45),
  carryLimit: 1800,
  route: 'trickeys',
});

export const licenceDodger = makeDigger({
  name: 'licence dodger',
  camp: 'snakey-gully',
  method: 'pan',
  licence: false,
  kit: ['pan', 'swag', 'waterBags', 'tent'],
  capitalToLeave: shillings(12),
  route: 'pass',
});

/**
 * The rush chaser: the same cradle and the same mate as the cautious man, but
 * he reads the Times and walks. Fresh ground pegged early is the whole of the
 * difference (§22).
 */
export const rushChaser = makeDigger({
  name: 'rush chaser',
  camp: (state) => bestCamp(state, 'cradle'),
  roving: true,
  method: 'cradle',
  licence: true,
  kit: ['pan', 'swag', 'waterBags', 'tent', 'barrow', 'cradle'],
  optional: ['gun'],
  capitalToLeave: shillings(40),
  route: 'trickeys',
  hireMate: true,
});

/**
 * The company magnate: an aggressive shafter who, having proved his ground and
 * made a name, stops swinging the pick and starts paying men who do (§22).
 */
export const companyMagnate = makeDigger({
  name: 'company magnate',
  camp: 'deep-mountains',
  method: 'shaft',
  licence: true,
  licenceStock: 240,
  kit: ['pick', 'shovel', 'ropeBucket', 'swag', 'waterBags', 'tent'],
  optional: ['gun'],
  stock: { timber: 3, pump: 1 },
  capitalToLeave: shillings(45),
  carryLimit: 1200,
  route: 'trickeys',
  company: true,
  // A dead chairman is no chairman: he knocks off sooner than a lone digger.
  restBelow: 55,
  townBelow: 44,
  hospitalBelow: 50,
  greensAfter: 40,
  // Wages come out of the treasury; when they will not, they come out of the
  // chairman's pocket, so the chairman keeps one.
  pocket: (state) => (state.company ? pounds(25) : pounds(3)),
});

/** Falls of earth a cautious man will sit through before he gives up holes. */
const REEF_FALLS = 3;

/**
 * The price of a counter of his own and a fortnight's flour behind it, and the
 * whole reason the notable's middle year is spent at the reef rather than at
 * the wash. Measured on this economy: a rush-chasing cradler tops £158 in a
 * third of his years and never before September, so a man who means to be
 * behind a counter by the spring must sink for it (see the note on §29 in the
 * balance suite).
 */
function wantsCapital(state: GameState): boolean {
  // Three falls of earth and he has done with holes: the men who kept going
  // down after that are the ones public-works lists are got up for.
  if (state.stats.caveIns >= REEF_FALLS) return false;
  return !state.estate.store && purse(state) < STORE_PRICE + STORE_STOCK_PRICE + CIVIC_RESERVE;
}

/**
 * The reef is a means and not a life: the day the counter is paid for he comes
 * up out of the hole for good and goes back to the wash, which is why nothing
 * kills him after midsummer and why he is the safest late game in the book.
 */
function atTheReef(state: GameState): boolean {
  return wantsCapital(state);
}

/** A cradle wants a barrow to move it; failing that, a man works his pan. */
function washMethod(state: GameState): DigMethod {
  return state.items.cradle > 0 && state.items.barrow > 0 ? 'cradle' : 'pan';
}

/**
 * The notable: a careful digger who sinks one properly slabbed shaft for the
 * price of a counter of his own, and then keeps the counter — buying a round
 * when the room is worth buying, subscribing what he can spare to the
 * Council's list, and taking the commission when it is offered (§29). The
 * suppliers out-earned the diggers; he is the harness's proof of it (§31.5).
 */
export const notable = makeDigger({
  name: 'the notable',
  camp: (state) => (atTheReef(state) ? 'deep-mountains' : bestCamp(state, 'cradle')),
  roving: true,
  method: (state) => (atTheReef(state) ? 'shaft' : washMethod(state)),
  licence: true,
  licenceStock: 240,
  kit: ['pick', 'shovel', 'ropeBucket', 'swag', 'waterBags', 'tent'],
  optional: ['gun'],
  stock: { timber: 3, pump: 1, barrow: 1, cradle: 1 },
  capitalToLeave: shillings(45),
  carryLimit: 1200,
  route: 'trickeys',
  hireMate: true,
  timberFirst: true,
  civic: true,
  // A man with a counter to mind and a name to keep does not dig himself into
  // Canvas House: the safest late game in the book (§29).
  restBelow: 60,
  townBelow: 50,
  hospitalBelow: 55,
  greensAfter: 30,
});

// ---------------------------------------------------------------------------
// The bushranger: the dark ladder, walked from the bottom (§25).
// ---------------------------------------------------------------------------

/** Which road is the cooler one today; heat is the whole of the push (§23.3). */
function coolerRoad(state: GameState): Route {
  return state.heat.trickeys <= state.heat.pass ? 'trickeys' : 'pass';
}

function roadHeat(state: GameState): number {
  return Math.min(state.heat.trickeys, state.heat.pass);
}

/** Kit a man on the roads cannot do without, and one gun for every man of them. */
const BANDIT_KIT: ItemId[] = ['gun', 'swag', 'waterBags', 'tent'];

export const bushranger: Bot = {
  name: 'bushranger',
  decide(state) {
    const f = framing(state);
    if (f !== undefined) return f;

    const wanted = state.legal === 'wanted criminal';
    const atPort = state.location === 'suze-port';
    const atRanges = state.location === 'hideout';
    const atTown = state.location === 'fields-town';
    const camp = isCamp(state.location);
    const shop = atPort || atTown || camp;

    // ---- keep body and soul together ----------------------------------
    if (shop) {
      const food = feed(state, 21);
      if (food) return food;
    }
    // No man rides out of a town dry; that is how the Times fills its column.
    if (shop && state.items.waterBags > 0 && state.waterDays < 9 && state.moneyPence > shillings(6)) {
      return { type: 'fillWater' };
    }
    if (shop && state.items.waterBags < 1 && state.moneyPence > pounds(1)) {
      return { type: 'buy', item: 'waterBags' };
    }
    if (state.provisionDays < 8 && !shop) {
      // A man cannot eat what is buried; he lifts the price of flour first.
      if (atRanges && state.moneyPence < pounds(4) && (state.hideout?.stashPence ?? 0) > 0) {
        return { type: 'unstash', what: 'money', amount: pounds(4) };
      }
      return { type: 'travelTo', place: atRanges ? 'deep-mountains' : 'fields-town' };
    }
    if (state.health < 30 && state.moneyPence > shillings(40) && (atPort || atTown)) {
      return { type: 'hospital', days: 3 };
    }
    if (state.health < 48 && state.provisionDays > 4) return { type: 'rest', days: 4 };
    if (state.daysWithoutGreens > 70 && shop && state.moneyPence > shillings(5)) {
      return { type: 'buyGreens' };
    }
    if (shop && lodgingAt(state) !== 'rough' && !atPort) return { type: 'setLodging', kind: 'rough' };

    // ---- turn what has been taken into money --------------------------
    if (atPort && state.salvage > 0) return { type: 'sellSalvage' };
    if (state.goldCentiOz > 150) {
      if (wanted && (atRanges || camp)) return { type: 'fenceGold' };
      if (!wanted && (atPort || atTown)) return { type: 'sellGold', where: 'bank', watch: true };
    }

    // ---- the year is out, or the big work is done: bury it and take ship --
    // What is under the flat stone is his whether the Crown takes him or not,
    // so it goes under the stone before he goes near a wharf (§24).
    const daysLeft = DAYS_IN_YEAR * state.yearsPlayed - state.day;
    // Once the big work is done — or twice attempted and lost — a man who means
    // to keep anything at all buries it and goes down to the wharf.
    const bolting =
      crimeVisible(state) && (daysLeft <= 20 || state.bigJobsDone > 0 || state.stats.bigJobs >= 1);
    if (bolting) {
      if (state.goldCentiOz > 0 && (atRanges || camp)) return { type: 'fenceGold' };
      if (state.hideout) {
        if (atRanges && state.moneyPence > PASSAGE_FARE + pounds(8)) {
          return { type: 'stash', what: 'money', amount: state.moneyPence - PASSAGE_FARE - pounds(5) };
        }
        if (!atRanges && state.moneyPence > pounds(40) && state.provisionDays >= 8 && daysLeft > 12) {
          return { type: 'travelTo', place: 'hideout' };
        }
      }
      if (atPort) {
        if (state.moneyPence >= PASSAGE_FARE) return { type: 'buyPassage' };
      } else if (daysLeft > 4) {
        if (atTown) return { type: 'travel', route: 'trickeys', mode: state.horse !== 'none' ? 'horse' : 'walk' };
        return { type: 'travelTo', place: 'fields-town' };
      }
    }

    // ---- entry: a name of the wrong sort, and a pistol -------------------
    if (!crimeVisible(state) || state.notoriety < NOTORIETY_BAILUP_GATE) {
      if (atPort) {
        if (state.lodging !== 'rough') return { type: 'setLodging', kind: 'rough' };
        if (needsItem(state, 'gun') && canAfford(state, 'gun', shillings(8))) {
          return { type: 'buy', item: 'gun' };
        }
        if (state.moneyPence < shillings(45)) return { type: 'work', job: 'wharf', days: 7 };
        return { type: 'steal', target: 'drunk' };
      }
      return { type: 'travel', route: 'trickeys', mode: state.horse !== 'none' ? 'horse' : 'walk' };
    }

    // ---- outfit ----------------------------------------------------------
    if (shop) {
      for (const it of BANDIT_KIT) {
        if (needsItem(state, it) && canAfford(state, it, shillings(20))) return { type: 'buy', item: it };
      }
      if (state.items.waterBags > 0 && state.waterDays < 6 && state.moneyPence > shillings(6)) {
        return { type: 'fillWater' };
      }
    }
    if (atPort && state.horse === 'none' && state.moneyPence >= HORSE_PRICE.brumby + pounds(2)) {
      return { type: 'buyHorse', kind: 'brumby' };
    }
    // A loaded piece for every man who rides (§23.4).
    if (
      shop &&
      state.notoriety >= NOTORIETY_GANG_GATE &&
      state.items.gun < GANG_MAX + 1 &&
      state.moneyPence > priceOf(state, 'gun') + pounds(3)
    ) {
      return { type: 'buy', item: 'gun' };
    }

    // ---- a camp in the ranges --------------------------------------------
    if (state.notoriety >= NOTORIETY_HIDEOUT_GATE && !state.hideout) {
      if (canMakeHideout(state).ok) return { type: 'makeHideout' };
      if (state.location === 'deep-mountains' && state.provisionDays < 10 && state.moneyPence > pounds(2)) {
        return { type: 'buyProvisions', weeks: 2 };
      }
      if (state.location !== 'deep-mountains' && state.provisionDays >= 16 && state.items.tent > 0) {
        if (atPort) return { type: 'travel', route: 'trickeys', mode: state.horse !== 'none' ? 'horse' : 'walk' };
        return { type: 'travelTo', place: 'deep-mountains' };
      }
    }

    // ---- bury what there is where the Crown cannot reach it ----------------
    // The stash is the outlaw's bank, and the ride up to it is how a district
    // is let cool: going quiet and getting rich are the same errand (§23.3).
    if (state.hideout && !bolting) {
      if (atRanges && state.moneyPence > pounds(9)) {
        return { type: 'stash', what: 'money', amount: state.moneyPence - pounds(6) };
      }
      if (!atRanges && state.moneyPence > pounds(8) && state.provisionDays >= 10) {
        return { type: 'travelTo', place: 'hideout' };
      }
    }

    // ---- men to ride with, and the capstone -------------------------------
    if (canRecruit(state).ok) return { type: 'recruitGangMember' };
    // A man tries the big work twice and no more: the ones who kept at it are
    // all in the Times' obituary column.
    const jobsTried = state.stats.bigJobs;
    if (canBigJob(state).ok && jobsTried < 1) {
      // Sold to the traps: buy the word of where they are lying up, first.
      if (state.ambush && state.moneyPence >= shillings(8)) return { type: 'gatherIntelligence' };
      if (state.ambush) return { type: 'bailUp', route: coolerRoad(state) };
      const escortWord = state.intel?.kind === 'escort' && state.intel.untilDay >= state.day;
      if (escortWord) return { type: 'robEscort' };
      if (atTown && state.intel?.kind === 'bank' && state.intel.untilDay >= state.day) {
        return { type: 'robBank' };
      }
      if (!state.intel && state.moneyPence >= shillings(8)) return { type: 'gatherIntelligence' };
    }

    // ---- the roads --------------------------------------------------------
    if (state.items.gun < 1) {
      if (atPort) return { type: 'work', job: 'wharf', days: 7 };
      return { type: 'travelTo', place: 'fields-town' };
    }
    if (state.location === 'on-road') return { type: 'travelTo', place: 'fields-town' };
    // Both districts warned: go quiet in the ranges and let them cool (§23.3).
    if (roadHeat(state) > 85) {
      if (state.hideout && !atRanges && state.provisionDays >= 10) return { type: 'travelTo', place: 'hideout' };
      return { type: 'rest', days: 5 };
    }
    return { type: 'bailUp', route: coolerRoad(state) };
  },
};

export const ALL_BOTS: Bot[] = [
  idler,
  cautiousPanner,
  cautiousCradler,
  aggressiveShafter,
  licenceDodger,
  rushChaser,
  companyMagnate,
  notable,
  bushranger,
];

// ---------------------------------------------------------------------------
// The harness
// ---------------------------------------------------------------------------

export const MAX_STEPS = 4000;

export function playYear(bot: Bot, seed: number): RunResult {
  const rng = makeRng(seed);
  let state = createInitialState(seed);
  let steps = 0;
  let stallDay = state.day;
  let stall = 0;
  const events: Record<string, number> = {};
  let storeDay: number | null = null;

  while (steps < MAX_STEPS) {
    if (state.gameOver || state.endOfYear) break;
    const action = bot.decide(state);
    if (action === null) break;
    const before = state.day;
    const result = step(state, action, rng);
    state = result.state;
    // What the world actually did to him, key by key: the harness counts the
    // events a struck rule is supposed to have struck (§29).
    for (const e of result.events) events[e.id] = (events[e.id] ?? 0) + 1;
    if (storeDay === null && state.estate.store) storeDay = state.estate.store.openedOn;
    steps += 1;
    if (state.day === before) {
      stall += 1;
      if (stall > 60) {
        // A bot that cannot make the day advance rests, so a year always ends.
        state = step(state, { type: 'rest', days: 3 }, rng).state;
        stall = 0;
      }
    } else {
      stall = 0;
      stallDay = state.day;
    }
  }
  void stallDay;

  return {
    bot: bot.name,
    seed,
    worth: netWorth(state),
    died: state.gameOver === 'dead',
    causeOfDeath: state.causeOfDeath,
    day: state.day,
    health: state.health,
    legal: state.legal,
    arrests: state.stats.timesArrested,
    goldWon: state.stats.goldWon,
    daysDug: state.stats.daysDug,
    steps,
    standing: state.standing,
    floated: !!state.company || !!state.soldOut,
    notoriety: state.notoriety,
    outlawed: state.outlawed,
    outlawEnd: state.outlawEnd,
    bailUps: state.stats.bailUps,
    bigJobsDone: state.bigJobsDone,
    takingsPence: state.stats.takings,
    diggersRobbed: state.diggersRobbed,
    hadHideout: !!state.hideout,
    stash: state.hideout ? state.hideout.stashPence : 0,
    properties:
      (state.estate.shamrock ? 1 : 0) +
      (state.estate.store ? 1 : 0) +
      (state.estate.gazetteShare ? 1 : 0) +
      (state.estate.shanty ? 1 : 0),
    works: state.estate.works.length,
    storeDay,
    jp: state.estate.jpSinceDay !== null,
    events,
  };
}

export interface Summary {
  bot: string;
  runs: number;
  deaths: number;
  deathRate: number;
  median: number;
  mean: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  max: number;
  min: number;
  broke: number;
  arrestRate: number;
  medianDaysDug: number;
  medianStanding: number;
  floatRate: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i];
}

export function summarise(bot: Bot, runs: RunResult[]): Summary {
  const worths = runs.map((r) => r.worth).sort((a, b) => a - b);
  const dug = runs.map((r) => r.daysDug).sort((a, b) => a - b);
  const deaths = runs.filter((r) => r.died).length;
  return {
    bot: bot.name,
    runs: runs.length,
    deaths,
    deathRate: deaths / runs.length,
    median: quantile(worths, 0.5),
    mean: Math.round(worths.reduce((a, b) => a + b, 0) / runs.length),
    p10: quantile(worths, 0.1),
    p25: quantile(worths, 0.25),
    p75: quantile(worths, 0.75),
    p90: quantile(worths, 0.9),
    max: worths[worths.length - 1],
    min: worths[0],
    broke: runs.filter((r) => r.worth < pounds(5)).length,
    arrestRate: runs.reduce((a, r) => a + r.arrests, 0) / runs.length,
    medianDaysDug: quantile(dug, 0.5),
    medianStanding: quantile(
      runs.map((r) => r.standing).sort((a, b) => a - b),
      0.5,
    ),
    floatRate: runs.filter((r) => r.floated).length / runs.length,
  };
}

export function runBot(bot: Bot, count: number, seedBase = 1000): RunResult[] {
  const out: RunResult[] = [];
  for (let i = 0; i < count; i++) out.push(playYear(bot, seedBase + i * 7919));
  return out;
}
