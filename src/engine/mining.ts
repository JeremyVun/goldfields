import {
  CAMP_DEFS,
  CAVEIN_CHANCE,
  CAVEIN_DEATH,
  CAVEIN_INJURY_HEALTH,
  CLAIM_QUALITY_BASE,
  CLAIM_QUALITY_CLAMP,
  CLAIM_QUALITY_SPREAD,
  COMMON_GROUND_FACTOR,
  COMMON_GROUND_RUSH,
  CRADLE_SOLO_FACTOR,
  DEPLETION_FLOOR,
  DEPLETION_FLOOR_DAYS,
  DEPLETION_FREE_DAYS,
  DUFFER_CHANCE,
  FLOOD_CHANCE_WINTER,
  METHOD_YIELD,
  MATE_WAGE,
  PARTNER_SHARE,
  PROSPECT_FIND,
  PROSPECT_FIND_CHANCE,
  PUDDLER_RENT,
  PUDDLER_SKIM,
  PUDDLER_SKIM_CHANCE,
  PUMPMAN_FEE,
  SHAFT_BONANZA_CHANCE,
  SHAFT_BONANZA_MULT,
  SHAFT_DEPTH,
  SHAFT_FEET_PER_DAY,
  SHAFT_PAYABLE_CHANCE,
  SHAFT_PAYABLE_CHANCE_DEEP,
  SHAFT_RICH_DAYS,
  SKILL_DUFFER,
  SKILL_FEET,
  SKILL_PROSPECT_ERROR,
  SKILL_YIELD,
  STANDING_PARTNER,
} from './constants';
import { contract, damage } from './health';
import { huntChance, troopersCome } from './law';
import { formatGold, formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import {
  addJournal,
  hasMinersRight,
  hasWork,
  inAftermath,
  isCamp,
  isLicensed,
  shaftRank,
  skillRank,
  washRank,
} from './state';
import { dayOfMonth, monthName, ordinal, season } from './time';
import type { CampId, Claim, GameState, MiningMethod } from './types';

export const METHOD_NAMES: Record<MiningMethod, string> = {
  fossick: 'Fossick over the mullock heaps',
  pan: 'Pan the creek',
  cradle: 'Work the cradle',
  puddle: 'Rent the puddling machine',
  shaft: 'Sink and work a shaft',
  dryblow: 'Winnow dry dirt by hand',
  company: 'Take a shift for the company',
};

export interface MethodCheck {
  ok: boolean;
  reason?: string;
}

export function checkMethod(state: GameState, method: MiningMethod): MethodCheck {
  if (!isCamp(state.location)) return { ok: false, reason: 'There is no gold to be had here.' };
  const camp = state.location as CampId;
  switch (method) {
    case 'fossick':
      return { ok: true };
    case 'pan':
      if (state.items.pan < 1) return { ok: false, reason: 'You have no pan.' };
      if (camp === 'secret-mine') return { ok: false, reason: 'There is no water within forty miles.' };
      return { ok: true };
    case 'cradle':
      if (state.items.cradle < 1) return { ok: false, reason: 'You have no cradle.' };
      if (camp === 'secret-mine') return { ok: false, reason: 'A cradle wants water, and there is none.' };
      return { ok: true };
    case 'puddle':
      if (camp !== 'snakey-gully')
        return { ok: false, reason: 'The puddling machine is at Copperhead Gully.' };
      if (state.items.shovel < 1) return { ok: false, reason: 'You have no shovel to puddle with.' };
      return { ok: true };
    case 'dryblow':
      if (camp !== 'secret-mine')
        return { ok: false, reason: 'Hand winnowing is for desert country, where no water runs.' };
      if (state.items.shovel < 1 || state.items.pick < 1)
        return { ok: false, reason: 'You want a pick and a shovel for this work.' };
      return { ok: true };
    case 'shaft':
      if (state.items.pick < 1 || state.items.shovel < 1)
        return { ok: false, reason: 'A shaft wants a pick and a shovel at the least.' };
      if (state.items.ropeBucket < 1)
        return { ok: false, reason: 'You cannot raise washdirt without rope and bucket.' };
      if (!state.claims[camp]) return { ok: false, reason: 'You have pegged no claim here.' };
      return { ok: true };
    case 'company':
      if (camp !== 'deep-mountains')
        return { ok: false, reason: 'The big company mines are in the Blackcap Ranges.' };
      return { ok: true };
  }
}

/** How much gold a camp has left in it; a rush lifts it, and the year wears it down. */
export function freshnessOf(state: GameState, camp: CampId): number {
  return state.freshness[camp] ?? 1;
}

export function rushOn(state: GameState, camp: CampId): boolean {
  // A rush that has been heard of but not yet arrived at is no rush at all;
  // word takes two days to cross the field (§17.2, §26).
  const rush = state.rush;
  return !!rush && rush.camp === camp && rush.since <= state.day && rush.untilDay >= state.day;
}

/**
 * The ground gives full measure for a dozen days, then thins away to a third by
 * the fiftieth. A claim that reaches the floor is worked out for good.
 */
export function depletionFactor(workedDays: number): number {
  if (workedDays <= DEPLETION_FREE_DAYS) return 1;
  if (workedDays >= DEPLETION_FLOOR_DAYS) return DEPLETION_FLOOR;
  const t = (workedDays - DEPLETION_FREE_DAYS) / (DEPLETION_FLOOR_DAYS - DEPLETION_FREE_DAYS);
  return 1 - (1 - DEPLETION_FLOOR) * t;
}

export function isWorkedOut(claim: Claim): boolean {
  return claim.workedDays >= DEPLETION_FLOOR_DAYS;
}

/** What the ground you are standing on is worth, before you have turned a sod of it. */
export function rollQuality(state: GameState, rng: RNG, camp: CampId): number {
  const q = Math.round(
    100 * freshnessOf(state, camp) * (CLAIM_QUALITY_BASE + CLAIM_QUALITY_SPREAD * rng.exponential()),
  );
  return Math.max(CLAIM_QUALITY_CLAMP.lo, Math.min(CLAIM_QUALITY_CLAMP.hi, q));
}

export function pegClaim(state: GameState, rng: RNG, log: Log, camp: CampId): boolean {
  if (state.claims[camp]) {
    log.raw('Your stakes are already in the ground here.', 'neutral');
    return false;
  }
  state.claims[camp] = {
    quality: rollQuality(state, rng, camp),
    workedDays: 0,
    peggedOn: state.day,
    proven: false,
    registered: false,
    lastAttendedDay: state.day,
    guardedUntilDay: 0,
    jumpedOn: null,
  };
  log.say('mine.peg', { camp: CAMP_DEFS[camp].name }, 'good');
  addJournal(state, `Pegged a claim at ${CAMP_DEFS[camp].name}.`, 'neutral');
  return true;
}

export function abandonClaim(state: GameState, log: Log, camp: CampId): boolean {
  const claim = state.claims[camp];
  if (!claim) {
    log.raw('You have no ground here to give up.', 'neutral');
    return false;
  }
  state.claims[camp] = null;
  if (state.shaft && state.shaft.camp === camp) state.shaft = null;
  log.say(isWorkedOut(claim) ? 'mine.abandon.workedout' : 'mine.abandon', undefined, 'neutral');
  return true;
}

/** A mate at the windlass, hired by the day or gone shares with. */
export function hasMate(state: GameState): boolean {
  return state.partner || state.mateUntilDay >= state.day;
}

/** A partner draws no wage but takes half of everything won (§18.2). */
function partnerCut(state: GameState, log: Log, gold: number): number {
  if (!state.partner || gold <= 0) return gold;
  const share = Math.round(gold * PARTNER_SHARE);
  if (share <= 0) return gold;
  log.say('partner.share', { gold: formatGold(share) }, 'neutral');
  return gold - share;
}

export interface SeasonEffect {
  factor: number;
  /** What the season is doing to this method, in the game's voice. */
  note?: string;
}

/**
 * Seasonal effect on a wash-based method, and the reason for it. The number and
 * the words come out of the one function so that the menu can never tell a man
 * the creeks are low while the dice are paying him for a wet winter.
 */
export function seasonEffect(state: GameState, method: MiningMethod): SeasonEffect {
  const s = season(state.day);
  if (method === 'pan' || method === 'cradle') {
    // creeks dry up (faithful)
    if (s === 'summer') return { factor: 0.7, note: 'the creeks are low, and washing goes slow' };
    if (s === 'winter') return { factor: 1.1, note: 'the creek is running well with the winter' };
    return { factor: 1 };
  }
  if (method === 'puddle') {
    // good in winter when the creeks run
    if (s === 'winter') return { factor: 1.25, note: 'the winter water keeps the machine turning' };
    // A race brings water to the machine in February as in July, and the
    // puddlers work the year round (§27).
    if (s === 'summer') {
      return hasWork(state, 'waterRace', 'snakey-gully')
        ? { factor: 1, note: 'the race holds water at the machine through the summer' }
        : { factor: 0.6, note: 'summer, and scarcely water enough to puddle with' };
    }
    return { factor: 1 };
  }
  if (method === 'dryblow') {
    return s === 'summer'
      ? { factor: 1.15, note: 'the summer dirt is dry, and blows clean' }
      : { factor: 1 };
  }
  return { factor: 1 };
}

function seasonFactor(state: GameState, method: MiningMethod): number {
  return seasonEffect(state, method).factor;
}

/** Which trade a method belongs to: sinking is one craft, washing another. */
function rankFor(state: GameState, method: MiningMethod) {
  return method === 'shaft' ? shaftRank(state) : washRank(state);
}

/** Centi-ounces won by a day at this method, before any thieving. */
export function rollYield(state: GameState, rng: RNG, method: MiningMethod): number {
  const id = state.location as CampId;
  const camp = CAMP_DEFS[id];
  const rank = rankFor(state, method);
  if (rng.chance(DUFFER_CHANCE[method] * SKILL_DUFFER[rank])) return 0;

  const locFactor = method === 'shaft' ? camp.reef : camp.alluvial;
  let base = METHOD_YIELD[method] * locFactor;

  if (method === 'cradle' && !hasMate(state)) base *= CRADLE_SOLO_FACTOR;
  if (method === 'shaft' && hasMate(state)) base *= 1.15;

  // Your own ground pays what it is worth and wears out; the common ground pays
  // little and never does.
  if (method !== 'fossick') {
    const claim = state.claims[id];
    if (claim) {
      base *= (claim.quality / 100) * depletionFactor(claim.workedDays);
    } else {
      base *= COMMON_GROUND_FACTOR * freshnessOf(state, id);
      if (rushOn(state, id)) base *= COMMON_GROUND_RUSH;
    }
  }

  base *= seasonFactor(state, method) * SKILL_YIELD[rank];
  if (state.health < 40) base *= 0.65;
  else if (state.health < 60) base *= 0.85;

  const luck = rng.exponential();
  return Math.max(0, Math.round(base * luck));
}

/** A day at the wash or a day down the hole, and what it teaches. */
function gainSkill(state: GameState, log: Log, trade: 'wash' | 'shaft'): void {
  const before = skillRank(state.skill[trade]);
  state.skill[trade] += 1;
  const after = skillRank(state.skill[trade]);
  if (after === before) return;
  const key = `skill.${trade}.${after === 'old hand' ? 'oldhand' : 'digger'}`;
  log.say(key, undefined, 'good');
  addJournal(
    state,
    trade === 'wash'
      ? `They no longer call you a new chum at the wash: you are ${after === 'digger' ? 'a digger' : 'an old hand'}.`
      : `Underground you have become ${after === 'digger' ? 'a digger' : 'an old hand'}.`,
    'good',
  );
}

export interface MineDayResult {
  /** Something happened that needs the player's answer, or ends the run. */
  stop?: 'trooper' | 'dead' | 'shaftGone' | 'cannotPay' | 'noClaim' | 'workedOut';
  gold: number;
}

/**
 * A day's digging wears the ground. Returns true when the wash has gone off for
 * good, which stops the spell and sends the player looking for new ground.
 */
function wearClaim(state: GameState, camp: CampId, method: MiningMethod): boolean {
  if (method === 'fossick') return false;
  const claim = state.claims[camp];
  if (!claim) return false;
  claim.workedDays += 1;
  return isWorkedOut(claim);
}

function narrateYield(state: GameState, log: Log, gold: number): void {
  if (gold <= 0) {
    log.say('mine.nothing', undefined, 'neutral');
  } else if (gold < 12) {
    log.say('mine.small', { gold: formatGold(gold) }, 'neutral');
  } else if (gold < 60) {
    log.say('mine.good', { gold: formatGold(gold) }, 'good');
  } else {
    log.say('mine.rich', { gold: formatGold(gold) }, 'good');
    addJournal(state, `A splendid day's washing: ${formatGold(gold)}.`, 'good');
  }
}

function shaftHazards(state: GameState, rng: RNG, log: Log): boolean {
  const shaft = state.shaft;
  if (!shaft) return false;
  const s = season(state.day);

  const caveP = shaft.timbered ? CAVEIN_CHANCE.timbered : CAVEIN_CHANCE.untimbered;
  if (rng.chance(caveP)) {
    state.stats.caveIns += 1;
    if (rng.chance(CAVEIN_DEATH)) {
      log.say('mine.cavein.death', undefined, 'grave');
      damage(state, 999, 'a cave-in');
      return true;
    }
    if (rng.chance(0.7)) {
      log.say('mine.cavein.injury', undefined, 'bad');
      damage(state, rng.int(CAVEIN_INJURY_HEALTH.lo, CAVEIN_INJURY_HEALTH.hi), 'a cave-in');
      contract(state, rng, log, 'injury', rng.chance(0.4) ? 2 : 1);
    } else {
      log.say('mine.cavein.shaftlost', undefined, 'bad');
    }
    state.shaft = null;
    addJournal(state, 'The shaft fell in.', 'bad');
    return true;
  }

  if (s === 'winter') {
    const floodP = shaft.pumped ? FLOOD_CHANCE_WINTER.pumped : FLOOD_CHANCE_WINTER.unpumped;
    if (rng.chance(floodP)) {
      log.say('mine.flood', undefined, 'bad');
      if (shaft.pumped) {
        // A pump big enough to drain the excess (faithful) buys you a day.
        return false;
      }
      state.shaft = null;
      addJournal(state, 'Winter water drowned the shaft.', 'bad');
      return true;
    }
  }
  return false;
}

/**
 * Bell sells pumps no more (§19.4): a digger with a wet shaft engages the
 * pump-man at the Blackcap Ranges camp, and the shaft is kept dry for its life.
 */
export function hirePumpman(state: GameState, log: Log): boolean {
  const shaft = state.shaft;
  if (!shaft || state.location !== shaft.camp) {
    log.raw('The pump-man wants a shaft to keep dry before he wants your money.', 'neutral');
    return false;
  }
  if (shaft.pumped) {
    log.raw('The pump-man is already on your shaft.', 'neutral');
    return false;
  }
  if (state.moneyPence < PUMPMAN_FEE) {
    log.raw('The pump-man is not a charity.', 'bad');
    return false;
  }
  state.moneyPence -= PUMPMAN_FEE;
  shaft.pumped = true;
  log.say('mine.pumpman', undefined, 'good');
  return true;
}

/** One day at the diggings. The caller runs the day's upkeep afterwards. */
export function mineOneDay(
  state: GameState,
  rng: RNG,
  log: Log,
  method: MiningMethod,
): MineDayResult {
  const camp = state.location as CampId;
  state.stats.daysDug += 1;

  // Rent and wages first — the machine and the mate want paying.
  if (method === 'puddle') {
    if (state.moneyPence < PUDDLER_RENT) {
      log.raw('The machine owner wants five shillings a day, and you have not got it.', 'bad');
      return { stop: 'cannotPay', gold: 0 };
    }
    state.moneyPence -= PUDDLER_RENT;
  }

  // The digger hunt (faithful: base about one digging day in eight).
  if (rng.chance(huntChance(state))) {
    const outcome = troopersCome(state, rng, log);
    if (outcome === 'caught') {
      state.pending = { kind: 'trooper' };
      return { stop: 'trooper', gold: 0 };
    }
  }

  let gold = 0;

  if (method === 'shaft') {
    if (!state.claims[camp]) return { stop: 'noClaim', gold: 0 };
    if (!state.shaft || state.shaft.camp !== camp) {
      state.shaft = {
        camp,
        depth: 0,
        bottomAt: rng.int(SHAFT_DEPTH.lo, SHAFT_DEPTH.hi),
        bottomed: false,
        payable: false,
        richDaysLeft: 0,
        timbered: state.items.timber > 0,
        pumped: state.items.pump > 0,
      };
      if (state.items.timber > 0) state.items.timber -= 1;
      state.stats.shaftsSunk += 1;
      log.raw(
        'You set up a windlass of three poles, hang the block and tackle, and begin to sink.',
        'neutral',
      );
    }
    const shaft = state.shaft;
    if (!shaft.bottomed) {
      gainSkill(state, log, 'shaft');
      let feet = Math.round(
        rng.int(SHAFT_FEET_PER_DAY.lo, SHAFT_FEET_PER_DAY.hi) * SKILL_FEET[shaftRank(state)],
      );
      if (hasMate(state)) feet = Math.round(feet * 1.4);
      if (state.health < 50) feet = Math.max(1, Math.round(feet * 0.7));
      shaft.depth += feet;
      const gone = wearClaim(state, camp, 'shaft');
      if (shaft.depth >= shaft.bottomAt) {
        shaft.depth = shaft.bottomAt;
        shaft.bottomed = true;
        const payChance =
          camp === 'deep-mountains' ? SHAFT_PAYABLE_CHANCE_DEEP : SHAFT_PAYABLE_CHANCE;
        if (rng.chance(payChance)) {
          shaft.payable = true;
          shaft.richDaysLeft = rng.int(SHAFT_RICH_DAYS.lo, SHAFT_RICH_DAYS.hi);
          // Ground with payable wash under it is ground a company can be floated on.
          const claim = state.claims[camp];
          if (claim) claim.proven = true;
          log.say('mine.shaft.bottom.payable', { depth: shaft.bottomAt }, 'good');
          addJournal(state, `Bottomed at ${shaft.bottomAt} feet on payable wash.`, 'good');
        } else {
          log.say('mine.shaft.bottom.duffer', { depth: shaft.bottomAt }, 'bad');
          addJournal(state, `Bottomed at ${shaft.bottomAt} feet on a duffer.`, 'bad');
          state.shaft = null;
        }
      } else {
        log.say('mine.shaft.sink', { feet, depth: shaft.depth }, 'neutral');
      }
      if (shaftHazards(state, rng, log)) return { stop: state.gameOver ? 'dead' : 'shaftGone', gold: 0 };
      if (gone) {
        log.say('mine.ground.gone', undefined, 'bad');
        return { stop: 'workedOut', gold: 0 };
      }
      return { gold: 0 };
    }

    // Working a payable drive.
    gainSkill(state, log, 'shaft');
    gold = rollYield(state, rng, 'shaft');
    if (rng.chance(SHAFT_BONANZA_CHANCE)) {
      gold = Math.round(gold * rng.range(SHAFT_BONANZA_MULT.lo, SHAFT_BONANZA_MULT.hi));
      log.say('mine.shaft.bonanza', undefined, 'good');
    }
    gold = partnerCut(state, log, gold);
    shaft.richDaysLeft -= 1;
    const worn = wearClaim(state, camp, 'shaft');
    narrateYield(state, log, gold);
    state.goldCentiOz += gold;
    state.stats.goldWon += gold;
    if (shaft.richDaysLeft <= 0) {
      log.say('mine.shaft.workedout', undefined, 'neutral');
      state.shaft = null;
    } else if (shaftHazards(state, rng, log)) {
      return { stop: state.gameOver ? 'dead' : 'shaftGone', gold };
    }
    if (worn) {
      log.say('mine.ground.gone', undefined, 'bad');
      return { stop: 'workedOut', gold };
    }
    return { gold };
  }

  // Surface methods.
  if (method !== 'fossick') gainSkill(state, log, 'wash');
  gold = rollYield(state, rng, method);

  if (method === 'puddle' && gold > 0 && rng.chance(PUDDLER_SKIM_CHANCE)) {
    const skim = Math.floor(gold * rng.range(PUDDLER_SKIM.lo, PUDDLER_SKIM.hi));
    if (skim > 0) {
      gold -= skim;
      log.say('mine.puddler.skim', undefined, 'bad');
    }
  }
  if (method === 'fossick' && rng.chance(0.35)) log.say('mine.fossick', undefined, 'neutral');
  if (method === 'dryblow' && rng.chance(0.3)) log.say('mine.dryblow', undefined, 'neutral');

  gold = partnerCut(state, log, gold);
  const worn = wearClaim(state, camp, method);
  narrateYield(state, log, gold);
  state.goldCentiOz += gold;
  state.stats.goldWon += gold;

  // The desert takes its toll (faithful: brutal in summer).
  if (camp === 'secret-mine') {
    const s = season(state.day);
    damage(state, s === 'summer' ? rng.int(2, 5) : rng.int(1, 3), 'the desert');
    if (state.gameOver) return { stop: 'dead', gold };
  }

  if (worn) {
    log.say('mine.ground.gone', undefined, 'bad');
    return { stop: 'workedOut', gold };
  }
  return { gold };
}

/**
 * A day spent trying the ground rather than working it (§17.3). It costs a day
 * and counts as a digging day, which the troopers are as interested in as you are.
 */
export function prospectDay(state: GameState, rng: RNG, log: Log): MineDayResult {
  const camp = state.location as CampId;
  state.stats.daysDug += 1;

  if (rng.chance(huntChance(state))) {
    const outcome = troopersCome(state, rng, log);
    if (outcome === 'caught') {
      state.pending = { kind: 'trooper' };
      return { stop: 'trooper', gold: 0 };
    }
  }

  gainSkill(state, log, 'wash');

  const claim = state.claims[camp];
  if (claim) {
    const err = SKILL_PROSPECT_ERROR[washRank(state)];
    const estimate = claim.quality * rng.range(1 - err, 1 + err);
    const key =
      estimate < 60
        ? 'prospect.duffer'
        : estimate < 90
          ? 'prospect.poor'
          : estimate < 130
            ? 'prospect.fair'
            : estimate < 180
              ? 'prospect.promising'
              : 'prospect.rich';
    log.say(key, undefined, estimate < 90 ? 'bad' : estimate < 130 ? 'neutral' : 'good');
    if (isWorkedOut(claim)) log.say('prospect.workedout', undefined, 'bad');
  } else {
    const f = freshnessOf(state, camp);
    const key = f < 0.8 ? 'prospect.ground.picked' : f < 1.15 ? 'prospect.ground.fair' : 'prospect.ground.fresh';
    log.say(key, { camp: CAMP_DEFS[camp].name }, f < 0.8 ? 'neutral' : 'good');
  }

  let gold = 0;
  if (rng.chance(PROSPECT_FIND_CHANCE)) {
    gold = rng.int(PROSPECT_FIND.lo, PROSPECT_FIND.hi);
    state.goldCentiOz += gold;
    state.stats.goldWon += gold;
    log.say('prospect.find', { gold: formatGold(gold) }, 'good');
  }

  if (camp === 'secret-mine') {
    damage(state, season(state.day) === 'summer' ? rng.int(2, 5) : rng.int(1, 3), 'the desert');
    if (state.gameOver) return { stop: 'dead', gold };
  }
  return { gold };
}

/** A man of standing is offered a share of the work rather than a wage (§18.2). */
export function takePartner(state: GameState, log: Log): boolean {
  if (state.partner) {
    log.raw('You are already gone mates with a man.', 'neutral');
    return false;
  }
  if (state.standing < STANDING_PARTNER) {
    log.say('partner.refused', undefined, 'bad');
    return false;
  }
  state.partner = true;
  state.mateUntilDay = 0;
  log.say('partner.take', undefined, 'good');
  addJournal(state, 'Went mates with a digger, share and share alike.', 'good');
  return true;
}

export function dissolvePartnership(state: GameState, log: Log): boolean {
  if (!state.partner) {
    log.raw('You have no partner to part from.', 'neutral');
    return false;
  }
  state.partner = false;
  log.say('partner.dissolve', undefined, 'neutral');
  return true;
}

export function hireMate(state: GameState, log: Log, days: number): boolean {
  if (state.partner) {
    log.raw('Your partner would think little of you paying wages to a third man.', 'neutral');
    return false;
  }
  // Year two, and the school you subscribed for sends its first youngster out
  // to the diggings. He will not hear of wages (§27).
  const lad = hasWork(state, 'school') && state.yearsPlayed > 1;
  if (lad) {
    const from = Math.max(state.day, state.mateUntilDay + 1);
    state.mateUntilDay = from + days - 1;
    log.say('works.school.lad', undefined, 'good');
    return true;
  }
  const cost = MATE_WAGE * days;
  if (state.moneyPence < cost) {
    log.raw('No man will swing a pick for you on promises.', 'bad');
    return false;
  }
  state.moneyPence -= cost;
  const from = Math.max(state.day, state.mateUntilDay + 1);
  state.mateUntilDay = from + days - 1;
  log.raw(
    `You take on a mate for ${days} day${days === 1 ? '' : 's'} at two shillings a day — ${formatMoney(cost)}. One rocks while the other shovels.`,
    'good',
  );
  return true;
}

export function timberShaft(state: GameState, log: Log): boolean {
  if (!state.shaft) {
    log.raw('There is no shaft to timber.', 'bad');
    return false;
  }
  if (state.items.timber < 1) {
    log.raw('You have no timber supports.', 'bad');
    return false;
  }
  if (state.shaft.timbered) {
    log.raw('The shaft is already slabbed and propped.', 'neutral');
    return false;
  }
  state.items.timber -= 1;
  state.shaft.timbered = true;
  log.raw('You slab the sides and set props. It costs a day of gold and may cost you nothing at all — which is the point.', 'good');
  return true;
}

export function licenceWarning(state: GameState): string | null {
  if (isLicensed(state)) return null;
  return 'You are digging without a licence. The troopers hunt diggers here.';
}

/**
 * A thirty-shilling licence that will run out before the spell of work does
 * (§21). The miner's right runs the year and wants no such warning.
 */
export function licenceDiesMidSpell(state: GameState, days: number): string | null {
  if (days <= 1 || hasMinersRight(state) || inAftermath(state)) return null;
  if (state.licenceUntilDay < state.day) return null;
  const last = state.licenceUntilDay;
  if (last >= state.day + days - 1) return null;
  return `Your licence dies on the ${ordinal(dayOfMonth(last))} of ${monthName(last)}, mid-spell. The troopers will not take a promise to renew it.`;
}

/** The morning a man's papers are worth nothing, and he is on the ground anyway. */
export function licenceLapsedToday(state: GameState): boolean {
  if (hasMinersRight(state) || inAftermath(state)) return false;
  return state.licenceUntilDay > 0 && state.licenceUntilDay === state.day - 1;
}
