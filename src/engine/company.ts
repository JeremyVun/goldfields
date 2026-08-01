/**
 * The player's own company — labourer become capitalist (GAME_SPEC.md §19).
 *
 * A man who has proved ground in the Deep Mountains, kept his name clean and
 * put a hundred pounds together may take the last step the diggings allow: he
 * stops swinging a pick and starts paying men who do.
 */

import {
  CAMP_DEFS,
  CLAIM_QUALITY_BASE,
  CLAIM_QUALITY_CLAMP,
  CLAIM_QUALITY_SPREAD,
  COMPANY_CAVEIN_CHANCE,
  COMPANY_CAVEIN_COST,
  COMPANY_CAVEIN_QUIT,
  COMPANY_CREW_WAGES,
  COMPANY_CREW_WEEK,
  COMPANY_FLOAT_CAPITAL,
  COMPANY_FLOAT_MAX_RUNG,
  COMPANY_FLOAT_STANDING,
  COMPANY_JOIN_PRICE_DROP,
  COMPANY_LEASE_REEF,
  COMPANY_LEASE_WEAR,
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
  COMPANY_REGISTRATION_FEE,
  COMPANY_SELLOUT_FLOOR,
  COMPANY_SHARES,
  COMPANY_SHARE_PRICE,
  COMPANY_SUBSCRIPTIONS,
  COMPANY_UPTAKE_AGITATION,
  COMPANY_UPTAKE_BASE,
  COMPANY_UPTAKE_PROFIT,
  COMPANY_UPTAKE_STANDING,
  COMPANY_WALKOFF_STANDING,
  DEPLETION_FLOOR_DAYS,
} from './constants';
import { depletionFactor, freshnessOf } from './mining';
import { formatGold, formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, addStanding, legalRung, shaftRank } from './state';
import type { Company, GameState, Lease } from './types';

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

// ---------------------------------------------------------------------------
// Floating
// ---------------------------------------------------------------------------

export interface Requirement {
  met: boolean;
  text: string;
}

export function purse(state: GameState): number {
  return state.moneyPence + state.bankPence;
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
      met: purse(state) >= COMPANY_FLOAT_CAPITAL,
      text: `${formatMoney(COMPANY_FLOAT_CAPITAL)} in hand and bank; the clerk will not register paupers`,
    },
  ];
}

export function canFloat(state: GameState): boolean {
  return !state.company && floatRequirements(state).every((r) => r.met);
}

/** Fee, then subscription, taken from the pocket first and the bank after. */
function drawFrom(state: GameState, amount: number): boolean {
  if (purse(state) < amount) return false;
  const fromHand = Math.min(amount, state.moneyPence);
  state.moneyPence -= fromHand;
  state.bankPence -= amount - fromHand;
  return true;
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
  const lease: Lease = {
    quality: claim ? claim.quality : 100,
    workedDays: claim ? Math.round(claim.workedDays / 2) : 0,
    proven: true,
  };
  state.claims['deep-mountains'] = null;
  if (state.shaft && state.shaft.camp === 'deep-mountains') state.shaft = null;

  const name = companyName(rng);
  state.company = {
    name,
    treasury: subscriptionCost(shares),
    sharesOwned: shares,
    sharesPublic: 0,
    sharesUnsold: COMPANY_SHARES - shares,
    sharePrice: COMPANY_SHARE_PRICE,
    crews: [],
    leases: [lease],
    weekProfit: [],
    lastWeekGold: 0,
    foundedOn: state.day,
    lastDividendDay: 0,
    relations: 0,
    supplyContractUntilDay: 0,
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
  if (c.treasury < COMPANY_CREW_WAGES) {
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
  task: 'mine' | 'prospect',
): boolean {
  const c = state.company;
  if (!c || !c.crews[index]) return false;
  if (c.crews[index].task === task) return false;
  c.crews[index].task = task;
  log.say(task === 'mine' ? 'company.crew.mine' : 'company.crew.prospect', { n: index + 1 }, 'neutral');
  return true;
}

/** What the ground is worth today: its quality worn down by the days upon it. */
export function leaseValue(lease: Lease): number {
  return (lease.quality / 100) * depletionFactor(lease.workedDays);
}

export function leaseWorkedOut(lease: Lease): boolean {
  return lease.workedDays >= DEPLETION_FLOOR_DAYS;
}

/** Never a number to the shareholders: a word, as the manager would put it. */
export function leaseWord(lease: Lease): string {
  const v = leaseValue(lease);
  const wash =
    v < 0.6
      ? 'poor stuff'
      : v < 0.9
        ? 'fair wash'
        : v < 1.3
          ? 'good wash'
          : v < 1.9
            ? 'handsome dirt'
            : 'a jeweller\'s shop';
  const worn =
    lease.workedDays < 12
      ? 'barely broken'
      : lease.workedDays < 30
        ? 'well opened'
        : lease.workedDays < 50
          ? 'going off'
          : 'worked out';
  return `${wash}, ${worn}`;
}

function bestLease(c: Company): Lease | null {
  let best: Lease | null = null;
  for (const l of c.leases) {
    if (leaseWorkedOut(l)) continue;
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
  const profitable = !!c && c.weekProfit.slice(-13).reduce((a, b) => a + b, 0) > 0;
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
  const recent = c.weekProfit.slice(-4);
  const trend = recent.reduce((a, b) => a + b, 0);
  let factor = 1 + rng.range(-COMPANY_PRICE_WALK, COMPANY_PRICE_WALK);
  factor += trend > 0 ? COMPANY_PRICE_PROFIT : trend < 0 ? -COMPANY_PRICE_LOSS : 0;
  if (state.day - c.lastDividendDay <= 14) factor += COMPANY_PRICE_DIVIDEND;
  factor -= caveIns * COMPANY_PRICE_CAVEIN;
  factor -= state.agitation / 2000;
  factor += (c.relations ?? 0) / 5000;
  c.sharePrice = Math.max(
    COMPANY_PRICE_CLAMP.lo,
    Math.min(COMPANY_PRICE_CLAMP.hi, Math.round(c.sharePrice * factor)),
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
  const proceeds = sold * c.sharePrice;
  c.treasury += proceeds;
  log.say('company.shares.taken', { n: sold, amount: formatMoney(proceeds) }, 'good');
}

function crewsWalkOff(state: GameState, log: Log): void {
  const c = state.company;
  if (!c) return;
  c.crews = [];
  c.sharePrice = Math.max(COMPANY_PRICE_CLAMP.lo, Math.round(c.sharePrice / 2));
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
  let gold = 0;
  let caveIns = 0;
  let compensation = 0;
  const quitters = new Set<Company['crews'][number]>();

  const dead = c.leases.filter(leaseWorkedOut).length;
  if (dead > 0) {
    c.leases = c.leases.filter((l) => !leaseWorkedOut(l));
    log.say('company.lease.abandoned', { name: c.name, n: dead }, 'neutral');
    addJournal(
      state,
      `${c.name} let ${dead === 1 ? 'a worked-out lease' : `${dead} worked-out leases`} lapse.`,
      'neutral',
    );
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
        const quality = Math.max(CLAIM_QUALITY_CLAMP.lo, Math.min(CLAIM_QUALITY_CLAMP.hi, q));
        if (c.leases.length < COMPANY_MAX_LEASES) {
          const lease: Lease = { quality, workedDays: 0, proven: true };
          c.leases.push(lease);
          log.say('company.prospect.strike', { name: c.name, word: leaseWord(lease) }, 'good');
          addJournal(state, `${c.name} proved a new lease in the Deep Mountains.`, 'good');
        } else {
          // At the cap the find is pegged as an extension of the poorest ground:
          // the lease takes the better quality and the fresh face wipes half its wear.
          let worst = c.leases[0];
          for (const l of c.leases) if (leaseValue(l) < leaseValue(worst)) worst = l;
          worst.quality = Math.max(worst.quality, quality);
          worst.workedDays = Math.floor(worst.workedDays / 2);
          log.say('company.prospect.extend', { name: c.name, word: leaseWord(worst) }, 'good');
          addJournal(state, `${c.name} extended a lease onto fresh ground.`, 'good');
        }
      }
      continue;
    }

    const lease = bestLease(c);
    if (!lease) {
      log.say('company.lease.gone', { name: c.name }, 'bad');
      continue;
    }

    if (rng.chance(COMPANY_CAVEIN_CHANCE)) {
      caveIns += 1;
      const cost = rng.int(COMPANY_CAVEIN_COST.lo, COMPANY_CAVEIN_COST.hi);
      compensation += cost;
      lease.workedDays += COMPANY_LEASE_WEAR;
      log.say('company.cavein', { name: c.name, amount: formatMoney(cost) }, 'bad');
      if (rng.chance(COMPANY_CAVEIN_QUIT)) quitters.add(crew);
      continue;
    }

    const value = Math.round(COMPANY_CREW_WEEK * leaseValue(lease) * rng.exponential());
    revenue += value;
    gold += Math.round((value * 100) / Math.max(1, state.bankRate));
    lease.workedDays += COMPANY_LEASE_WEAR;
  }

  c.treasury += revenue;
  c.lastWeekGold = gold;

  if (compensation > 0) {
    const paid = Math.min(compensation, c.treasury);
    c.treasury -= paid;
    compensation = paid;
  }
  if (quitters.size > 0) {
    c.crews = c.crews.filter((crew) => !quitters.has(crew));
    for (const _crew of quitters) {
      log.say('company.crew.quit', undefined, 'bad');
    }
  }

  const contractFactor = (c.supplyContractUntilDay ?? 0) >= state.day ? 0.9 : 1;
  const wages = Math.round(c.crews.length * COMPANY_CREW_WAGES * contractFactor);
  let wagesPaid = 0;
  if (wages > 0) {
    if (c.treasury >= wages) {
      c.treasury -= wages;
      wagesPaid = wages;
    } else if (c.treasury + state.moneyPence >= wages) {
      const fromPocket = wages - c.treasury;
      c.treasury = 0;
      state.moneyPence -= fromPocket;
      wagesPaid = wages;
      log.say('company.wages.pocket', { amount: formatMoney(fromPocket) }, 'bad');
    } else {
      crewsWalkOff(state, log);
    }
  }

  c.weekProfit.push(revenue - wagesPaid - compensation);
  if (c.weekProfit.length > 60) c.weekProfit.shift();

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
  if (total > c.treasury) {
    log.raw('The treasury will not stand a dividend of that size.', 'bad');
    return false;
  }
  c.treasury -= total;
  const own = perShare * c.sharesOwned;
  state.moneyPence += own;
  c.lastDividendDay = state.day;
  c.sharePrice = Math.min(
    COMPANY_PRICE_CLAMP.hi,
    Math.round(c.sharePrice * (1 + Math.min(0.25, perShare / c.sharePrice))),
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
  const amount = c.sharesOwned * c.sharePrice;
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
  const amount = sold * c.sharePrice;
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
  const want = Math.min(n, available, Math.floor(state.moneyPence / Math.max(1, c.sharePrice)));
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
  const amount = want * c.sharePrice;
  state.moneyPence -= amount;
  c.sharesUnsold -= fromUnsold;
  c.sharesPublic -= fromPublic;
  c.sharesOwned += want;
  // Scrip bought back off the company's own hands puts money in the treasury;
  // scrip bought off a shareholder puts it in his.
  c.treasury += fromUnsold * c.sharePrice;
  log.say('company.shares.buy', { n: want, amount: formatMoney(amount), name: c.name }, 'neutral');
  return true;
}

/** Shareholders are nervous men, and the chairman was seen behind the slabs. */
export function shakeSharePrice(state: GameState, factor: number): void {
  const c = state.company;
  if (!c) return;
  c.sharePrice = Math.max(
    COMPANY_PRICE_CLAMP.lo,
    Math.min(COMPANY_PRICE_CLAMP.hi, Math.round(c.sharePrice * factor)),
  );
}

export const JOIN_PRICE_FACTOR = 1 - COMPANY_JOIN_PRICE_DROP;

/** The line the Gazette runs on the company's week. */
export function companyReport(state: GameState): string | null {
  const c = state.company;
  if (!c) return null;
  const last = c.weekProfit[c.weekProfit.length - 1] ?? 0;
  if (c.crews.length === 0) {
    return `MINING INTELLIGENCE. ${c.name} reports no men at work this week; the shares are quoted at ${formatMoney(c.sharePrice)}, and quoted thinly.`;
  }
  if (c.lastWeekGold > 0) {
    return `MINING INTELLIGENCE. ${c.name} washed ${formatGold(c.lastWeekGold)} for the week, ${last >= 0 ? 'to a profit' : 'and still to a loss'}. Shares ${formatMoney(c.sharePrice)}.`;
  }
  return `MINING INTELLIGENCE. ${c.name} reports a poor week at the workings and nothing worth crushing. Shares ${formatMoney(c.sharePrice)}.`;
}
