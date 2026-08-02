/**
 * The player's own company — labourer become capitalist (GAME_SPEC.md §19).
 *
 * A man who has proved ground in the Blackcap Ranges, kept his name clean and
 * put a hundred pounds together may take the last step the diggings allow: he
 * stops swinging a pick and starts paying men who do.
 */

import {
  CAMP_DEFS,
  CLAIM_QUALITY_BASE,
  CLAIM_QUALITY_CLAMP,
  CLAIM_QUALITY_SPREAD,
  COMPANY_BATTERY_UPKEEP,
  COMPANY_BATTERY_COST,
  COMPANY_CAVEIN_CHANCE,
  COMPANY_CAVEIN_COST,
  COMPANY_CAVEIN_QUIT,
  COMPANY_CREW_WAGES,
  COMPANY_CREW_WEEK,
  COMPANY_CRUSH_FEE,
  COMPANY_DEPTH_BONUS,
  COMPANY_DRIVE_COST,
  COMPANY_DRIVE_DUFFER,
  COMPANY_DRIVE_FACE,
  COMPANY_DRIVE_YIELD,
  COMPANY_DRIVING,
  COMPANY_DEWATER_WEEKS,
  COMPANY_FACE_WEEKS,
  COMPANY_FLOOD_CHANCE,
  COMPANY_SINK_BASE_WEEKS,
  COMPANY_SINK_COST,
  COMPANY_FLOAT_CAPITAL,
  COMPANY_FLOAT_MAX_RUNG,
  COMPANY_FLOAT_STANDING,
  COMPANY_JOIN_PRICE_DROP,
  COMPANY_LEASE_REEF,
  COMPANY_LEASE_WET,
  COMPANY_MAX_CREWS,
  COMPANY_MAX_LEASES,
  COMPANY_PRICE_CAVEIN,
  COMPANY_PRICE_CLAMP,
  COMPANY_PRICE_DIVIDEND,
  COMPANY_PRICE_LOSS,
  COMPANY_PRICE_PROFIT,
  COMPANY_PRICE_WALK,
  COMPANY_PROSPECT_CHANCE,
  COMPANY_PROSPECT_OLD_HAND,
  COMPANY_PUMP_PLANT,
  COMPANY_PUMP_BREAK,
  COMPANY_PUMP_REPAIR,
  COMPANY_REGISTRATION_FEE,
  COMPANY_SELLOUT_FLOOR,
  COMPANY_SHARES,
  COMPANY_SHARE_PRICE,
  COMPANY_SUBSCRIPTIONS,
  COMPANY_TAKEUP_FEE,
  COMPANY_TIMBER_PLANT,
  COMPANY_UPTAKE_AGITATION,
  COMPANY_UPTAKE_BASE,
  COMPANY_UPTAKE_PROFIT,
  COMPANY_UPTAKE_STANDING,
  COMPANY_WALKOFF_STANDING,
  COMPANY_WET_LEVEL,
} from './constants';
import { freshnessOf } from './mining';
import { formatGold, formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, addStanding, legalRung, shaftRank } from './state';
import { season } from './time';
import type { Company, DrivingRate, GameState, Lease, LeasePlan } from './types';
import { availableFunds, debitFunds } from './wallet';

export { availableFunds as purse } from './wallet';

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

const NAME_HEADS = [
  'The Golden Hope',
  'The Band of Hope',
  'The Albion',
  'The Perseverance',
  'The Try Again',
  'The Nil Desperandum',
  'The Prince of Wales',
  'The Star of the West',
  'The Great Extended',
  'The Homeward Bound',
  'The Victoria United',
  'The Cornish Boys',
];

const NAME_TAILS = [
  'Quartz Mining Co.',
  'Gold Mining Company',
  'Consols',
  'Reef & Crushing Co.',
  'Quartz Crushing Company',
  'Gold Mining Co. (No Liability)',
  'Deep Lead Company',
];

export function companyName(rng: RNG): string {
  const head = rng.pick(NAME_HEADS);
  if (rng.chance(0.25)) {
    let other = rng.pick(NAME_HEADS);
    if (other === head) other = 'Albion';
    return `${head} & ${other.replace(/^The /, '')} ${rng.pick(NAME_TAILS)}`;
  }
  return `${head} ${rng.pick(NAME_TAILS)}`;
}

/** What the mines themselves are called; a lease keeps its name for good (§19.4). */
const MINE_NAMES = [
  'the North Star',
  'the Morning Star',
  'the Perseverance',
  'the Caledonia',
  'the Britannia',
  'the Golden Fleece',
  'the Duke of Cornwall',
  'the Hand and Band',
  'the Rose of Denmark',
  'the Specimen Hill',
  'the Black Lead',
  'the Welcome',
];

export function mineName(rng: RNG, taken: string[]): string {
  const free = MINE_NAMES.filter((n) => !taken.includes(n));
  return free.length > 0 ? rng.pick(free) : rng.pick(MINE_NAMES);
}

/** A freshly bottomed level's stone, rolled: deeper is richer, before luck (§19.4). */
export function rollYield(rng: RNG, reef: number, level: number): number {
  const depth = 1 + COMPANY_DEPTH_BONUS * Math.max(0, level - 1);
  return Math.max(10, Math.round(reef * depth * Math.max(0.25, Math.min(3, rng.exponential()))));
}

/** Ground below the water line: needs a pumping plant to sink or mine (§19.4). */
export function leaseIsWet(lease: Lease): boolean {
  return lease.wet || lease.level >= COMPANY_WET_LEVEL;
}

// ---------------------------------------------------------------------------
// Floating
// ---------------------------------------------------------------------------

export interface Requirement {
  met: boolean;
  text: string;
}

/** What the registrar asks of a man before he will write him up as a company. */
export function floatRequirements(state: GameState): Requirement[] {
  const claim = state.claims['deep-mountains'];
  return [
    {
      met: state.standing >= COMPANY_FLOAT_STANDING,
      text: `standing of ${COMPANY_FLOAT_STANDING}/100 on the field (you have ${Math.floor(state.standing)}/100)`,
    },
    {
      met: legalRung(state.legal) <= COMPANY_FLOAT_MAX_RUNG,
      text: 'a character no worse than a petty criminal',
    },
    {
      met: !!claim && claim.proven,
      text: `ground of your own in the ${CAMP_DEFS['deep-mountains'].name}, bottomed on payable wash`,
    },
    {
      met: availableFunds(state) >= COMPANY_FLOAT_CAPITAL,
      text: `${formatMoney(COMPANY_FLOAT_CAPITAL)} in hand and bank; the clerk will not register paupers`,
    },
  ];
}

export function canFloat(state: GameState): boolean {
  return !state.company && floatRequirements(state).every((r) => r.met);
}

/** Fee, then subscription, taken from the pocket first and the bank after. */
function drawFrom(state: GameState, amount: number): boolean {
  return debitFunds(state, amount);
}

export function subscriptionCost(shares: number): number {
  return COMPANY_SHARE_PRICE * shares;
}

export function floatCompany(state: GameState, rng: RNG, log: Log, shares: number): boolean {
  if (state.company) {
    log.raw('You have a company already, and one is trouble enough.', 'neutral');
    return false;
  }
  if (!COMPANY_SUBSCRIPTIONS.includes(shares)) {
    log.raw('The prospectus allows eight, twelve or sixteen shares to the promoter.', 'bad');
    return false;
  }
  const unmet = floatRequirements(state).filter((r) => !r.met);
  if (unmet.length > 0) {
    log.say('company.float.refused', { want: unmet[0].text }, 'bad');
    return false;
  }
  const outlay = COMPANY_REGISTRATION_FEE + subscriptionCost(shares);
  if (!drawFrom(state, outlay)) {
    log.raw(
      `The fee and your subscription come to ${formatMoney(outlay)}, and you cannot find it.`,
      'bad',
    );
    return false;
  }

  const claim = state.claims['deep-mountains'];
  const reef = claim ? claim.richnessPct : 100;
  // The founding claim comes in bottomed at the first level: a going concern.
  const lease: Lease = {
    name: mineName(rng, []),
    reefPct: reef,
    level: 1,
    faceCrewWeeks: rng.int(4, 6),
    yieldNowPct: rollYield(rng, reef, 1),
    wet: rng.chance(COMPANY_LEASE_WET),
    pump: false,
    timbered: false,
    flooded: false,
    progressCrewWeeks: 0,
    plan: null,
  };
  state.claims['deep-mountains'] = null;
  if (state.shaft && state.shaft.camp === 'deep-mountains') state.shaft = null;

  const name = companyName(rng);
  state.company = {
    name,
    treasuryPence: subscriptionCost(shares),
    sharesOwned: shares,
    sharesPublic: 0,
    sharesUnsold: COMPANY_SHARES - shares,
    sharePricePence: COMPANY_SHARE_PRICE,
    crews: [],
    leases: [lease],
    weekProfitPence: [],
    lastWeekGoldCentiOz: 0,
    foundedOn: state.day,
    lastDividendDay: 0,
    relations: 0,
    supplyContractUntilDay: 0,
    battery: false,
    driving: 'ordinary',
    lastWeek: null,
  };
  log.say(
    'company.float',
    { name, shares, amount: formatMoney(subscriptionCost(shares)), fee: formatMoney(COMPANY_REGISTRATION_FEE) },
    'good',
  );
  addJournal(state, `Floated ${name}, and took ${shares} of the twenty shares myself.`, 'good');
  return true;
}

// ---------------------------------------------------------------------------
// Crews and leases
// ---------------------------------------------------------------------------

export function hireCrew(state: GameState, log: Log): boolean {
  const c = state.company;
  if (!c) return false;
  if (state.location !== 'deep-mountains') {
    log.raw('Men are taken on at the workings, not by letter.', 'bad');
    return false;
  }
  if (c.crews.length >= COMPANY_MAX_CREWS) {
    log.raw('Three crews are as many as the ground will carry.', 'neutral');
    return false;
  }
  if (c.treasuryPence < COMPANY_CREW_WAGES) {
    log.raw('You cannot take on men you have no week\'s wages for.', 'bad');
    return false;
  }
  c.crews.push({ task: 'mine' });
  log.say('company.crew.hire', { name: c.name, wages: formatMoney(COMPANY_CREW_WAGES) }, 'good');
  return true;
}

export function fireCrew(state: GameState, log: Log): boolean {
  const c = state.company;
  if (!c || c.crews.length === 0) {
    log.raw('There are no men on the books to pay off.', 'neutral');
    return false;
  }
  c.crews.pop();
  log.say('company.crew.fire', undefined, 'neutral');
  return true;
}

export function setCrewTask(
  state: GameState,
  log: Log,
  index: number,
  task: 'mine' | 'develop' | 'prospect',
  lease?: number,
): boolean {
  const c = state.company;
  if (!c || !c.crews[index]) return false;
  const crew = c.crews[index];
  if (crew.task === task && crew.lease === lease) return false;
  crew.task = task;
  crew.lease = lease;
  const key =
    task === 'mine'
      ? 'company.crew.mine'
      : task === 'develop'
        ? 'company.crew.develop'
        : 'company.crew.prospect';
  log.say(key, { n: index + 1 }, 'neutral');
  return true;
}

// ---------------------------------------------------------------------------
// Development, plant and policy (§19.4).
// ---------------------------------------------------------------------------

/** Crew-weeks an ordered plan wants before it comes to anything. */
export function developWeeksNeeded(lease: Lease): number {
  if (lease.flooded) return COMPANY_DEWATER_WEEKS;
  return lease.plan === 'sink' ? COMPANY_SINK_BASE_WEEKS + Math.floor(lease.level / 2) : 1;
}

/** What the developing crews are to do with a mine whose face has cut out. */
export function setLeasePlan(state: GameState, log: Log, lease: number, plan: LeasePlan): boolean {
  const c = state.company;
  const l = c?.leases[lease];
  if (!c || !l || l.level === 0 && plan === 'drive') return false;
  if (leaseIsWet(l) && !l.pump) {
    log.raw(`${l.name} cannot be developed below the water until a pumping plant is installed.`, 'bad');
    return false;
  }
  if (l.plan === plan) return false;
  l.plan = plan;
  l.progressCrewWeeks = 0;
  log.say(plan === 'sink' ? 'company.plan.sink' : 'company.plan.drive', { name: l.name }, 'neutral');
  return true;
}

/** Per-lease capital: the pumping plant or the standing timber-work. */
export function installPlant(
  state: GameState,
  log: Log,
  lease: number,
  plant: 'pump' | 'timber',
): boolean {
  const c = state.company;
  const l = c?.leases[lease];
  if (!c || !l) return false;
  const cost = plant === 'pump' ? COMPANY_PUMP_PLANT : COMPANY_TIMBER_PLANT;
  if ((plant === 'pump' && l.pump) || (plant === 'timber' && l.timbered)) return false;
  if (c.treasuryPence < cost) {
    log.raw('The treasury will not stand the machinery.', 'bad');
    return false;
  }
  c.treasuryPence -= cost;
  if (plant === 'pump') l.pump = true;
  else l.timbered = true;
  log.say(plant === 'pump' ? 'company.plant.pump' : 'company.plant.timber', { name: l.name }, 'good');
  return true;
}

/** The big capital decision the share float exists to finance (§19.4). */
export function buyBattery(state: GameState, log: Log): boolean {
  const c = state.company;
  if (!c || c.battery) return false;
  if (c.treasuryPence < COMPANY_BATTERY_COST) {
    log.raw('The treasury will not stand a battery.', 'bad');
    return false;
  }
  c.treasuryPence -= COMPANY_BATTERY_COST;
  c.battery = true;
  log.say('company.battery.bought', { name: c.name }, 'good');
  addJournal(state, `${c.name} raised its own stamping battery.`, 'good');
  return true;
}

/** Cautious, ordinary, or drive her hard (§19.4). */
export function setDriving(state: GameState, log: Log, rate: DrivingRate): boolean {
  const c = state.company;
  if (!c || c.driving === rate) return false;
  c.driving = rate;
  log.say(`company.driving.${rate}`, undefined, 'neutral');
  return true;
}

/** The last resort: plant and development forfeited with the ground (§19.4). */
export function abandonLease(state: GameState, log: Log, lease: number): boolean {
  const c = state.company;
  const l = c?.leases[lease];
  if (!c || !l) return false;
  c.leases.splice(lease, 1);
  for (const crew of c.crews) {
    if (crew.lease === lease) crew.lease = undefined;
    else if (crew.lease !== undefined && crew.lease > lease) crew.lease -= 1;
  }
  log.say('company.lease.abandon', { name: l.name }, 'bad');
  addJournal(state, `${c.name} abandoned ${l.name}, and everything sunk in it.`, 'bad');
  return true;
}

/** What the stone at the face is worth today, as a multiplier of an ordinary week. */
export function leaseValue(lease: Lease): number {
  if (lease.level === 0 || lease.faceCrewWeeks <= 0 || lease.flooded || (leaseIsWet(lease) && !lease.pump)) return 0;
  return lease.yieldNowPct / 100;
}

/** No stone at the face: the mine waits on a decision, it does not lapse (§19.4). */
export function leaseCutOut(lease: Lease): boolean {
  return lease.level > 0 && lease.faceCrewWeeks <= 0;
}

/** Never a number to the shareholders: a word, as the manager would put it. */
export function leaseWord(lease: Lease): string {
  if (lease.flooded) return `${lease.name}, full of water`;
  if (lease.level === 0) return `${lease.name}, an unbottomed show`;
  const v = lease.yieldNowPct / 100;
  const stone =
    v < 0.6
      ? 'poor stone'
      : v < 0.9
        ? 'fair stone'
        : v < 1.3
          ? 'good stone'
          : v < 1.9
            ? 'handsome stone'
            : 'a jeweller\'s shop';
  const stateWord = leaseCutOut(lease) ? 'the level cut out' : stone;
  return `${lease.name}, No. ${lease.level} level, ${stateWord}`;
}

function bestLease(c: Company): Lease | null {
  let best: Lease | null = null;
  for (const l of c.leases) {
    if (leaseValue(l) <= 0) continue;
    if (!best || leaseValue(l) > leaseValue(best)) best = l;
  }
  return best;
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

/** How readily the public will take up scrip this week (§19.1). */
export function uptakeChance(state: GameState): number {
  const c = state.company;
  const profitable = !!c && c.weekProfitPence.slice(-13).reduce((a, b) => a + b, 0) > 0;
  const p =
    COMPANY_UPTAKE_BASE +
    state.standing / COMPANY_UPTAKE_STANDING +
    (c?.relations ?? 0) / 250 +
    (profitable ? COMPANY_UPTAKE_PROFIT : 0) -
    state.agitation / COMPANY_UPTAKE_AGITATION;
  return Math.max(0.02, Math.min(0.95, p));
}

function walkPrice(state: GameState, rng: RNG, caveIns: number): void {
  const c = state.company;
  if (!c) return;
  const recent = c.weekProfitPence.slice(-4);
  const trend = recent.reduce((a, b) => a + b, 0);
  let factor = 1 + rng.range(-COMPANY_PRICE_WALK, COMPANY_PRICE_WALK);
  factor += trend > 0 ? COMPANY_PRICE_PROFIT : trend < 0 ? -COMPANY_PRICE_LOSS : 0;
  if (state.day - c.lastDividendDay <= 14) factor += COMPANY_PRICE_DIVIDEND;
  factor -= caveIns * COMPANY_PRICE_CAVEIN;
  factor -= state.agitation / 2000;
  factor += (c.relations ?? 0) / 5000;
  c.sharePricePence = Math.max(
    COMPANY_PRICE_CLAMP.lo,
    Math.min(COMPANY_PRICE_CLAMP.hi, Math.round(c.sharePricePence * factor)),
  );
}

function sellPublicShares(state: GameState, rng: RNG, log: Log): void {
  const c = state.company;
  if (!c || c.sharesUnsold <= 0) return;
  const p = uptakeChance(state);
  let sold = 0;
  for (let i = 0; i < c.sharesUnsold; i++) if (rng.chance(p)) sold += 1;
  if (sold <= 0) return;
  c.sharesUnsold -= sold;
  c.sharesPublic += sold;
  const proceeds = sold * c.sharePricePence;
  c.treasuryPence += proceeds;
  log.say('company.shares.taken', { n: sold, amount: formatMoney(proceeds) }, 'good');
}

function crewsWalkOff(state: GameState, log: Log): void {
  const c = state.company;
  if (!c) return;
  c.crews = [];
  c.sharePricePence = Math.max(COMPANY_PRICE_CLAMP.lo, Math.round(c.sharePricePence / 2));
  addStanding(state, -COMPANY_WALKOFF_STANDING);
  log.say('company.wages.unpaid', { name: c.name }, 'bad');
  addJournal(state, `${c.name} could not find the wages, and the men walked off.`, 'bad');
}

/**
 * A week at the workings, run wherever the player happens to be. Crews sell
 * their gold to the escort as they go, so the company keeps money, not dust.
 */
export function companyWeek(state: GameState, rng: RNG, log: Log): void {
  const c = state.company;
  if (!c) return;

  let revenue = 0;
  let crushing = 0;
  let development = 0;
  let upkeep = 0;
  let gold = 0;
  let caveIns = 0;
  let compensation = 0;
  const drive = COMPANY_DRIVING[c.driving];
  const quitters = new Set<Company['crews'][number]>();

  // Water is a property of each named mine, not a one-off event. A working
  // pump prevents winter flooding; when it breaks, the treasury repairs it if
  // it can and otherwise the plant stands idle until the director intervenes.
  for (const lease of c.leases) {
    if (lease.pump && rng.chance(COMPANY_PUMP_BREAK)) {
      const repair = rng.int(COMPANY_PUMP_REPAIR.lo, COMPANY_PUMP_REPAIR.hi);
      if (c.treasuryPence >= repair) {
        c.treasuryPence -= repair;
        upkeep += repair;
        log.say('company.pump.repaired', { name: lease.name, amount: formatMoney(repair) }, 'neutral');
      } else {
        lease.pump = false;
        log.say('company.pump.broken', { name: lease.name }, 'bad');
      }
    }
    if (
      season(state.day) === 'winter' &&
      leaseIsWet(lease) &&
      !lease.pump &&
      !lease.flooded &&
      rng.chance(COMPANY_FLOOD_CHANCE)
    ) {
      lease.flooded = true;
      lease.progressCrewWeeks = 0;
      log.say('company.flood', { name: lease.name }, 'bad');
    }
  }

  for (const crew of c.crews) {
    if (crew.task === 'prospect') {
      const p =
        COMPANY_PROSPECT_CHANCE + (shaftRank(state) === 'old hand' ? COMPANY_PROSPECT_OLD_HAND : 0);
      if (rng.chance(p)) {
        const q = Math.round(
          100 *
            freshnessOf(state, 'deep-mountains') *
            COMPANY_LEASE_REEF *
            (CLAIM_QUALITY_BASE + CLAIM_QUALITY_SPREAD * rng.exponential()),
        );
        const reef = Math.max(CLAIM_QUALITY_CLAMP.lo, Math.min(CLAIM_QUALITY_CLAMP.hi, q));
        if (c.leases.length < COMPANY_MAX_LEASES && c.treasuryPence >= COMPANY_TAKEUP_FEE) {
          c.treasuryPence -= COMPANY_TAKEUP_FEE;
          const lease: Lease = {
            name: mineName(rng, c.leases.map((l) => l.name)),
            reefPct: reef,
            level: 0,
            faceCrewWeeks: 0,
            yieldNowPct: 0,
            wet: rng.chance(COMPANY_LEASE_WET),
            pump: false,
            timbered: false,
            flooded: false,
            progressCrewWeeks: 0,
            plan: null,
          };
          c.leases.push(lease);
          log.say('company.prospect.strike', { name: c.name, word: leaseWord(lease) }, 'good');
          addJournal(state, `${c.name} took up ${lease.name} in the Blackcap Ranges.`, 'good');
        } else if (c.leases.length > 0) {
          // Both slots held: the find is driven into the poorest ground as a
          // fresh face on its present level.
          let worst = c.leases[0];
          for (const l of c.leases) if (leaseValue(l) < leaseValue(worst)) worst = l;
          if (worst.level > 0 && !worst.flooded) {
            worst.yieldNowPct = Math.max(worst.yieldNowPct, rollYield(rng, reef, worst.level));
            worst.faceCrewWeeks += rng.int(3, 5);
            log.say('company.prospect.extend', { name: c.name, word: leaseWord(worst) }, 'good');
            addJournal(state, `${c.name} drove ${worst.name} into fresh stone.`, 'good');
          }
        }
      }
      continue;
    }

    if (crew.task === 'develop') {
      const l = crew.lease !== undefined ? c.leases[crew.lease] : c.leases[0];
      if (!l) continue;
      if (l.flooded) {
        if (!l.pump) continue;
        l.progressCrewWeeks += 1;
        if (l.progressCrewWeeks >= COMPANY_DEWATER_WEEKS) {
          l.progressCrewWeeks = 0;
          l.flooded = false;
          log.say('company.dewatered', { name: l.name }, 'good');
        }
        continue;
      }
      if (!l.plan || (leaseIsWet(l) && !l.pump)) continue;
      const cost = l.plan === 'sink' ? COMPANY_SINK_COST : COMPANY_DRIVE_COST;
      if (c.treasuryPence < cost) continue;
      c.treasuryPence -= cost;
      development += cost;
      l.progressCrewWeeks += 1;
      if (l.progressCrewWeeks >= developWeeksNeeded(l)) {
        l.progressCrewWeeks = 0;
        if (l.plan === 'sink') {
          l.level += 1;
          l.yieldNowPct = rollYield(rng, l.reefPct, l.level);
          l.faceCrewWeeks = rng.int(COMPANY_FACE_WEEKS.lo, COMPANY_FACE_WEEKS.hi);
          log.say('company.sink.bottomed', { name: l.name, word: leaseWord(l) }, 'good');
        } else if (rng.chance(COMPANY_DRIVE_DUFFER)) {
          log.say('company.drive.duffer', { name: l.name }, 'bad');
        } else {
          l.yieldNowPct = Math.round(rollYield(rng, l.reefPct, l.level) * COMPANY_DRIVE_YIELD);
          l.faceCrewWeeks += rng.int(COMPANY_DRIVE_FACE.lo, COMPANY_DRIVE_FACE.hi);
          log.say('company.drive.fresh', { name: l.name, word: leaseWord(l) }, 'good');
        }
        l.plan = null;
      }
      continue;
    }

    const lease =
      crew.lease !== undefined && c.leases[crew.lease] && leaseValue(c.leases[crew.lease]) > 0
        ? c.leases[crew.lease]
        : bestLease(c);
    if (!lease) {
      log.say('company.lease.gone', { name: c.name }, 'bad');
      continue;
    }

    const caveP = COMPANY_CAVEIN_CHANCE * drive.cavein * (lease.timbered ? 0.5 : 1);
    if (rng.chance(caveP)) {
      caveIns += 1;
      const cost = rng.int(COMPANY_CAVEIN_COST.lo, COMPANY_CAVEIN_COST.hi);
      compensation += cost;
      lease.faceCrewWeeks = Math.max(0, lease.faceCrewWeeks - 1);
      log.say('company.cavein', { name: c.name, amount: formatMoney(cost) }, 'bad');
      if (rng.chance(COMPANY_CAVEIN_QUIT)) quitters.add(crew);
      continue;
    }

    const gross = Math.round(
      COMPANY_CREW_WEEK * leaseValue(lease) * drive.out * rng.exponential(),
    );
    const fee = c.battery ? 0 : Math.round(gross * COMPANY_CRUSH_FEE);
    revenue += gross;
    crushing += fee;
    gold += Math.round((gross * 100) / Math.max(1, state.bankRatePencePerOz));
    lease.faceCrewWeeks = Math.max(0, lease.faceCrewWeeks - drive.wear);
    if (leaseCutOut(lease) && !lease.plan) {
      log.say('company.face.cut', { name: lease.name }, 'neutral');
    }
  }

  if (c.battery) {
    const paid = Math.min(COMPANY_BATTERY_UPKEEP, Math.max(0, c.treasuryPence + revenue - crushing));
    upkeep += paid;
  }

  c.treasuryPence += revenue - crushing - upkeep;
  c.lastWeekGoldCentiOz = gold;

  if (compensation > 0) {
    const paid = Math.min(compensation, c.treasuryPence);
    c.treasuryPence -= paid;
    compensation = paid;
  }
  if (quitters.size > 0) {
    c.crews = c.crews.filter((crew) => !quitters.has(crew));
    for (let i = 0; i < quitters.size; i++) {
      log.say('company.crew.quit', undefined, 'bad');
    }
  }

  const contractFactor = (c.supplyContractUntilDay ?? 0) >= state.day ? 0.9 : 1;
  const wages = Math.round(c.crews.length * COMPANY_CREW_WAGES * contractFactor);
  let wagesPaid = 0;
  if (wages > 0) {
    if (c.treasuryPence >= wages) {
      c.treasuryPence -= wages;
      wagesPaid = wages;
    } else if (c.treasuryPence + state.moneyPence >= wages) {
      const fromPocket = wages - c.treasuryPence;
      c.treasuryPence = 0;
      state.moneyPence -= fromPocket;
      wagesPaid = wages;
      log.say('company.wages.pocket', { amount: formatMoney(fromPocket) }, 'bad');
    } else {
      crewsWalkOff(state, log);
    }
  }

  const net = revenue - crushing - wagesPaid - development - upkeep - compensation;
  c.weekProfitPence.push(net);
  if (c.weekProfitPence.length > 60) c.weekProfitPence.shift();
  c.lastWeek = {
    revenue,
    crushing,
    wages: wagesPaid,
    development,
    upkeep,
    compensation,
    net,
  };

  walkPrice(state, rng, caveIns);
  sellPublicShares(state, rng, log);

  if (state.location === 'deep-mountains' && c.crews.length > 0) {
    if (gold > 0) {
      log.say(
        'company.week.report',
        { name: c.name, gold: formatGold(gold), amount: formatMoney(revenue) },
        'good',
      );
    } else if (caveIns === 0) {
      log.say('company.week.poor', { name: c.name }, 'neutral');
    }
  }
}

// ---------------------------------------------------------------------------
// The scrip
// ---------------------------------------------------------------------------

export function issuedShares(c: Company): number {
  return c.sharesOwned + c.sharesPublic;
}

export function declareDividend(state: GameState, log: Log, perShare: number): boolean {
  const c = state.company;
  if (!c) return false;
  if (perShare <= 0) return false;
  const total = perShare * issuedShares(c);
  if (total > c.treasuryPence) {
    log.raw('The treasury will not stand a dividend of that size.', 'bad');
    return false;
  }
  c.treasuryPence -= total;
  const own = perShare * c.sharesOwned;
  state.moneyPence += own;
  c.lastDividendDay = state.day;
  c.sharePricePence = Math.min(
    COMPANY_PRICE_CLAMP.hi,
    Math.round(c.sharePricePence * (1 + Math.min(0.25, perShare / c.sharePricePence))),
  );
  log.say(
    'company.dividend',
    { name: c.name, per: formatMoney(perShare), amount: formatMoney(own) },
    'good',
  );
  addJournal(state, `${c.name} declared a dividend; ${formatMoney(own)} of it mine.`, 'good');
  return true;
}

/** Everything a man has left in his own company, paid out, and the books closed. */
export function sellOut(state: GameState, log: Log): boolean {
  const c = state.company;
  if (!c) return false;
  const amount = Math.round(
    c.sharesOwned * c.sharePricePence + (c.treasuryPence * c.sharesOwned) / COMPANY_SHARES,
  );
  state.moneyPence += amount;
  state.soldOut = { name: c.name, amount, day: state.day };
  log.say('company.sellout', { name: c.name, amount: formatMoney(amount) }, 'neutral');
  addJournal(state, `Sold out of ${c.name} for ${formatMoney(amount)}.`, 'good');
  state.company = null;
  return true;
}

export function sellOwnShares(state: GameState, rng: RNG, log: Log, n: number): boolean {
  const c = state.company;
  if (!c) return false;
  const want = Math.min(n, c.sharesOwned);
  if (want <= 0) {
    log.raw('You have no scrip left to sell.', 'neutral');
    return false;
  }
  const p = uptakeChance(state);
  let sold = 0;
  for (let i = 0; i < want; i++) if (rng.chance(p)) sold += 1;
  if (sold === 0) {
    log.say('company.shares.noappetite', { name: c.name }, 'bad');
    return false;
  }
  const amount = sold * c.sharePricePence;
  c.sharesOwned -= sold;
  c.sharesPublic += sold;
  state.moneyPence += amount;
  log.say('company.shares.sell', { n: sold, amount: formatMoney(amount), name: c.name }, 'neutral');
  if (c.sharesOwned < COMPANY_SELLOUT_FLOOR) return sellOut(state, log);
  return true;
}

export function buyBackShares(state: GameState, log: Log, n: number): boolean {
  const c = state.company;
  if (!c) return false;
  const available = c.sharesPublic + c.sharesUnsold;
  const want = Math.min(n, available, Math.floor(state.moneyPence / Math.max(1, c.sharePricePence)));
  if (want <= 0) {
    log.raw(
      available <= 0
        ? 'Every share is already yours.'
        : 'You have not the money to take up scrip today.',
      'bad',
    );
    return false;
  }
  const fromUnsold = Math.min(want, c.sharesUnsold);
  const fromPublic = want - fromUnsold;
  const amount = want * c.sharePricePence;
  state.moneyPence -= amount;
  c.sharesUnsold -= fromUnsold;
  c.sharesPublic -= fromPublic;
  c.sharesOwned += want;
  // Scrip bought back off the company's own hands puts money in the treasury;
  // scrip bought off a shareholder puts it in his.
  c.treasuryPence += fromUnsold * c.sharePricePence;
  log.say('company.shares.buy', { n: want, amount: formatMoney(amount), name: c.name }, 'neutral');
  return true;
}

/** Shareholders are nervous men, and the chairman was seen behind the slabs. */
export function shakeSharePrice(state: GameState, factor: number): void {
  const c = state.company;
  if (!c) return;
  c.sharePricePence = Math.max(
    COMPANY_PRICE_CLAMP.lo,
    Math.min(COMPANY_PRICE_CLAMP.hi, Math.round(c.sharePricePence * factor)),
  );
}

export const JOIN_PRICE_FACTOR = 1 - COMPANY_JOIN_PRICE_DROP;

/** The line the Times runs on the company's week. */
export function companyReport(state: GameState): string | null {
  const c = state.company;
  if (!c) return null;
  const last = c.weekProfitPence[c.weekProfitPence.length - 1] ?? 0;
  if (c.crews.length === 0) {
    return `MINING INTELLIGENCE. ${c.name} reports no men at work this week; the shares are quoted at ${formatMoney(c.sharePricePence)}, and quoted thinly.`;
  }
  if (c.lastWeekGoldCentiOz > 0) {
    return `MINING INTELLIGENCE. ${c.name} washed ${formatGold(c.lastWeekGoldCentiOz)} for the week, ${last >= 0 ? 'to a profit' : 'and still to a loss'}. Shares ${formatMoney(c.sharePricePence)}.`;
  }
  return `MINING INTELLIGENCE. ${c.name} reports a poor week at the workings and nothing worth crushing. Shares ${formatMoney(c.sharePricePence)}.`;
}
