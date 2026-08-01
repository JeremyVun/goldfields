/**
 * THE DARK LADDER (GAME_SPEC.md §23-§24).
 *
 * The second capability ladder: digger → bushranger, ending in captain of a
 * gang the way the honest road ends in owner of a company. There is no toggle;
 * the legal ladder of §13 is the entry ramp, and the wanted status stops being a
 * punishment and becomes a fork in identity.
 *
 * Pressure is the push, never the loop: heat exists to drive the outlaw up the
 * ladder — go quiet, change districts, or escalate — exactly as depletion pushes
 * the digger to fresh ground.
 */

import {
  BAILUP_FIND_BASE,
  BAILUP_FIND_HEAT,
  BAILUP_RESIST_HARM,
  BAILUP_SHOT_KILLS,
  BAILUP_TAKE_HEAT,
  BAILUP_VICTIMS,
  BANK_FULL_MULTIPLIER,
  BUSH_ESCAPE,
  BUSH_INTEL_COST,
  BUSH_SEARCH,
  BUSH_TAKINGS,
  ESCAPE_BASE,
  ESCAPE_HORSE,
  ESCAPE_NOTORIETY,
  FENCE_RATE,
  KILL_NOTICE_EXPOSED_NOTORIETY,
  KILL_NOTICE_EXPOSED_STANDING,
  KILL_NOTICE_HEAT_FACTOR,
  LAWYER_ACQUIT_CHANCE,
  LAWYER_ACQUIT_NOTORIETY,
  SHANTY_FENCE_RATE,
  FENCE_SHORT_LOSS,
  FENCE_SHORT_WEIGHT,
  GANG_INFORM_RATE,
  GANG_INFORM_SCALE,
  GANG_LOYALTY,
  GANG_LOYALTY_PER_JOB,
  GANG_MAX,
  GAOL_BREAK_CHANCE,
  HARD_LABOUR_DAYS,
  HEAT_AGITATION_RELIEF,
  HEAT_DECAY_PER_DAY,
  HEAT_MAX,
  HEAT_PER_BIG_JOB,
  HEAT_PER_CRIME,
  HEAT_SPLASH,
  HIDEOUT_DAYS,
  HIDEOUT_SEARCH_AT_FULL,
  HIDEOUT_SEARCH_BASE,
  HIDEOUT_SEARCH_HOSTILE,
  HIDEOUT_SEARCH_NOTORIETY,
  NOTORIETY_MAX,
  INTEL_DAYS,
  INTEL_TRAVELLER_DAYS,
  NOTORIETY_BAILUP,
  NOTORIETY_BAILUP_GATE,
  NOTORIETY_BANK,
  NOTORIETY_BIGJOB_GATE,
  NOTORIETY_ESCORT,
  NOTORIETY_GANG_GATE,
  NOTORIETY_GAOL_BREAK,
  NOTORIETY_HIDEOUT_GATE,
  NOTORIETY_KNOWN_CHANCE,
  NOTORIETY_KNOWN_GATE,
  NOTORIETY_KNOWN_NAME,
  NOTORIETY_PER_RUNG,
  PASSAGE_FARE,
  PASSAGE_RECOGNITION,
  PATROL_LURK_AT_FULL,
  PATROL_LURK_BASE,
  PATROL_TRAVELLER_AT_FULL,
  PURSUIT_OUTLAW_BASE,
  PURSUIT_OUTLAW_HEAT,
  PURSUIT_OUTLAW_NOTORIETY,
  ROB_BANK_CAPTURE,
  ROB_BANK_FAIL,
  ROB_BANK_TAKE,
  ROB_ESCORT_AMBUSH,
  ROB_ESCORT_BLIND_MEET,
  ROB_ESCORT_CAPTURE,
  ROB_ESCORT_DAYS,
  ROB_ESCORT_KILLED,
  ROB_ESCORT_MOUNTED,
  ROB_ESCORT_SUCCESS,
  ROB_ESCORT_TAKE,
  ROB_ESCORT_WOUNDED,
  STANDING_PER_RUNG,
  type VictimDef,
} from './constants';
import { contract, damage } from './health';
import { forfeitCommission } from './estate';
import { worsen } from './law';
import { formatGold, formatMoney, goldValue } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import {
  addJournal,
  addNotoriety,
  addStanding,
  adjacentZones,
  bushRank,
  bushRankOf,
  checkYearEnd,
  emptyClaims,
  fieldSympathy,
  heatOf,
  heatZoneFor,
  rewardFor,
  stashWorth,
} from './state';
import { HEAT_ZONES, type GameState, type HeatZone, type Route } from './types';

// ---------------------------------------------------------------------------
// Heat: the push
// ---------------------------------------------------------------------------

/**
 * While the licence question boils the troopers are busy hunting diggers, and
 * a man may go about his own business the easier for it (§23.3).
 */
export function heatGainFactor(state: GameState): number {
  return Math.max(0.25, 1 - state.agitation / HEAT_AGITATION_RELIEF);
}

/** A crime committed in a district, and the half of it that splashes about. */
export function addHeat(state: GameState, zone: HeatZone, amount: number): void {
  const gain = amount * heatGainFactor(state);
  state.heat[zone] = Math.min(HEAT_MAX, heatOf(state, zone) + gain);
  for (const near of adjacentZones(zone)) {
    state.heat[near] = Math.min(HEAT_MAX, heatOf(state, near) + gain * HEAT_SPLASH);
  }
}

/** The districts cool a little every day, whatever the man does. */
export function heatTick(state: GameState): void {
  // A fortnight of not being in the newspapers cools every district twice as
  // fast: the Camp is not reminded of him (§26, kill a reward notice).
  const quiet = state.estate.noticeKillUntilDay >= state.day ? KILL_NOTICE_HEAT_FACTOR : 1;
  for (const zone of HEAT_ZONES) {
    state.heat[zone] = Math.max(0, heatOf(state, zone) - HEAT_DECAY_PER_DAY * quiet);
  }
}

/** How often an ordinary traveller meets a patrol on a warmed-up road. */
export function travellerPatrolChance(state: GameState, route: Route): number {
  const zone: HeatZone = route === 'pass' ? 'pass' : 'trickeys';
  return (heatOf(state, zone) / HEAT_MAX) * PATROL_TRAVELLER_AT_FULL;
}

/** And how often the man lying in the scrub waiting for him does. */
export function lurkPatrolChance(state: GameState, route: Route): number {
  const zone: HeatZone = route === 'pass' ? 'pass' : 'trickeys';
  return PATROL_LURK_BASE + (heatOf(state, zone) / HEAT_MAX) * PATROL_LURK_AT_FULL;
}

// ---------------------------------------------------------------------------
// Bushcraft — the third skill (§23.6)
// ---------------------------------------------------------------------------

export function gainBush(state: GameState, log: Log, days = 1): void {
  const before = bushRank(state.skill.bush);
  state.skill.bush += days;
  const after = bushRank(state.skill.bush);
  if (after === before) return;
  log.say(after === 'captain' ? 'bandit.skill.captain' : 'bandit.skill.flash', undefined, 'good');
  addJournal(
    state,
    after === 'captain'
      ? 'They have taken to calling me Captain, and mean it.'
      : 'A flash cove now, and known for one.',
    'neutral',
  );
}

/** Getting away from troopers: a horse, the gullies, and a knowledge of both. */
export function escapeChance(state: GameState): number {
  let p =
    ESCAPE_BASE +
    (state.horse !== 'none' ? ESCAPE_HORSE : 0) +
    BUSH_ESCAPE[bushRankOf(state)] -
    state.notoriety / ESCAPE_NOTORIETY;
  if (state.health > 60) p += 0.05;
  else if (state.health < 40) p -= 0.1;
  return Math.max(0.08, Math.min(0.94, p));
}

// ---------------------------------------------------------------------------
// The reward notice (§23.2)
// ---------------------------------------------------------------------------

/** The Times prints the notice when it is first offered, and when it rises. */
export function rewardNotice(state: GameState, log: Log): void {
  const reward = rewardFor(state);
  if (reward <= state.rewardPrinted) return;
  state.rewardPrinted = reward;
  log.say('bandit.reward', { amount: formatMoney(reward) }, 'bad');
  addJournal(state, `The Crown offers ${formatMoney(reward)} for me, alive or otherwise.`, 'bad');
}

/** The first big job, or a trooper wounded: the ninety clean days close (§23.1). */
export function makeOutlaw(state: GameState, log: Log): void {
  if (state.outlawed) return;
  state.outlawed = true;
  state.legal = 'wanted criminal';
  state.cleanDays = 0;
  log.say('bandit.outlawed', undefined, 'grave');
  addJournal(state, 'Proclaimed an outlaw. There is no going back from this one.', 'grave');
  // A man who bought the Times' silence finds the rival sheet printing that
  // he bought it, the moment he is worth printing about (§26).
  if (state.estate.noticeKillUsed) {
    addNotoriety(state, KILL_NOTICE_EXPOSED_NOTORIETY);
    addStanding(state, -KILL_NOTICE_EXPOSED_STANDING);
    log.say('estate.press.exposed', undefined, 'bad');
  }
}

// ---------------------------------------------------------------------------
// Gating (§23.1, §23.2)
// ---------------------------------------------------------------------------

/** Crime verbs show themselves from minor criminal, greyed before that. */
export function crimeVisible(state: GameState): boolean {
  return state.legal !== 'honest' && state.legal !== 'petty criminal';
}

export interface Gate {
  ok: boolean;
  note: string;
}

function gate(ok: boolean, note: string): Gate {
  return { ok, note };
}

export function canBailUp(state: GameState): Gate {
  if (!crimeVisible(state)) return gate(false, 'talk of the roads is not for a man of your standing');
  if (state.notoriety < NOTORIETY_BAILUP_GATE) {
    return gate(false, 'no man will ride with a name nobody has heard of');
  }
  if (state.items.gun < 1) return gate(false, 'you would want a loaded piece for that work');
  return gate(true, state.horse === 'none' ? 'afoot, and afoot is how men are taken' : 'a day on the road');
}

export function canMakeHideout(state: GameState): Gate {
  if (state.hideout) return gate(false, 'you have made Split Rock Camp already');
  if (state.notoriety < NOTORIETY_HIDEOUT_GATE) {
    return gate(false, 'nobody would keep such a place quiet for you yet');
  }
  if (state.location !== 'deep-mountains') {
    return gate(false, 'the ranges beyond the Blackcap Ranges are where such a camp is made');
  }
  if (state.items.tent < 1) return gate(false, 'you would want a tent for it');
  if (state.provisionDays < 7) return gate(false, 'and a week of flour to carry up');
  return gate(true, `${HIDEOUT_DAYS} days up the gullies, and nobody the wiser`);
}

export function canRecruit(state: GameState): Gate {
  if (state.notoriety < NOTORIETY_GANG_GATE) {
    return gate(false, 'no man puts his neck beside a name as small as yours');
  }
  if (state.gang.length >= GANG_MAX) return gate(false, 'three is as many as any road will carry');
  return gate(true, 'no wage, but an equal share of what the jobs bring');
}

export function canBigJob(state: GameState): Gate {
  if (state.notoriety < NOTORIETY_BIGJOB_GATE) {
    return gate(false, 'work of that size wants a name behind it');
  }
  if (state.gang.length < 2) return gate(false, 'not to be done under three men');
  if (state.items.gun < 1 + state.gang.length) {
    return gate(false, 'a loaded piece for every man, and you are short of them');
  }
  return gate(true, 'and God help the lot of you');
}

// ---------------------------------------------------------------------------
// Bailing up (§23.4)
// ---------------------------------------------------------------------------

function pickVictim(state: GameState, rng: RNG): VictimDef {
  // A word bought of a harbourer puts a fat traveller on the road for you.
  if (state.intel && state.intel.kind === 'traveller' && state.intel.untilDay >= state.day) {
    state.intel = null;
    return rng.weighted(
      BAILUP_VICTIMS.filter((v) => v.id === 'buyer' || v.id === 'squatter').map(
        (v) => [v, v.weight] as [VictimDef, number],
      ),
    );
  }
  return rng.weighted(BAILUP_VICTIMS.map((v) => [v, v.weight] as [VictimDef, number]));
}

export type LurkOutcome = 'nobody' | 'patrol' | 'victim';

/**
 * A day lying in the scrub above a road. Returns what came of it; the caller
 * raises the encounter and runs the day's upkeep.
 */
export function lurk(state: GameState, rng: RNG, log: Log, route: Route): LurkOutcome {
  gainBush(state, log, 1);

  // The harbourers warn a man the field has no quarrel with (§23.5), and a
  // word already bought and standing by — your own shanty's men, or a friend
  // at the bar — is spent here if it has not been spent elsewhere (§28.3,
  // §30.2). One warning the week, whichever friend gives it.
  let patrol = lurkPatrolChance(state, route);
  if (rng.chance(patrol)) {
    const wordInHand = state.estate.warnedUntilDay >= state.day;
    if ((fieldSympathy(state) || wordInHand) && state.day - state.warnedOn >= 7) {
      if (wordInHand) state.estate.warnedUntilDay = 0;
      state.warnedOn = state.day;
      log.say('bandit.harbourer.warn', undefined, 'good');
      return 'nobody';
    }
    log.say('bandit.patrol.road', undefined, 'bad');
    state.pending = { kind: 'patrol', data: { route } };
    return 'patrol';
  }

  const zone: HeatZone = route === 'pass' ? 'pass' : 'trickeys';
  const find = Math.max(0.15, BAILUP_FIND_BASE - heatOf(state, zone) * BAILUP_FIND_HEAT);
  if (!rng.chance(find)) {
    log.say('bandit.bailup.nobody', undefined, 'neutral');
    return 'nobody';
  }

  const victim = pickVictim(state, rng);
  const knows =
    state.notoriety >= NOTORIETY_KNOWN_GATE && rng.chance(NOTORIETY_KNOWN_CHANCE) && victim.resist < 0.8;
  log.say(`bandit.victim.${victim.id}`, undefined, 'neutral');
  state.pending = {
    kind: 'bailup',
    data: { victim: victim.id, route, knows },
  };
  return 'victim';
}

export interface BailUpResult {
  taken: number;
  gold: number;
}

/** What the man on the road has about him, less what the district's warning cost. */
function rollTakings(state: GameState, rng: RNG, victim: VictimDef, route: Route): BailUpResult {
  const zone: HeatZone = route === 'pass' ? 'pass' : 'trickeys';
  const chill = Math.max(0.4, 1 - heatOf(state, zone) * BAILUP_TAKE_HEAT);
  const skill = BUSH_TAKINGS[bushRankOf(state)];
  const factor = chill * skill;
  return {
    taken: Math.max(0, Math.round(rng.int(victim.money.lo, victim.money.hi) * factor)),
    gold: Math.max(0, Math.round(rng.int(victim.gold.lo, victim.gold.hi) * factor)),
  };
}

function victimDef(id: string): VictimDef {
  return BAILUP_VICTIMS.find((v) => v.id === id) ?? BAILUP_VICTIMS[0];
}

/**
 * A bail-up is the captain's own work: the gang matters on the big jobs and
 * nowhere else, so what comes off a road goes into one pocket (§23.4).
 */
function bank(state: GameState, log: Log, res: BailUpResult): void {
  const money = res.taken;
  const gold = res.gold;
  state.moneyPence += money;
  state.goldCentiOz += gold;
  state.stats.takings += money + goldValue(gold, state.bankRate);
  if (money > 0 && gold > 0) {
    log.say('bandit.bailup.take.both', { money: formatMoney(money), gold: formatGold(gold) }, 'good');
  } else if (money > 0) {
    log.say('bandit.bailup.take', { money: formatMoney(money) }, 'good');
  } else if (gold > 0) {
    log.say('bandit.bailup.take.gold', { gold: formatGold(gold) }, 'good');
  } else {
    log.say('bandit.bailup.take.nothing', undefined, 'neutral');
  }
}

/** The player's answer to a stopped traveller: take it, or shoot, or let him go. */
export function resolveBailUp(
  state: GameState,
  rng: RNG,
  log: Log,
  choice: 'take' | 'shoot' | 'pass',
): void {
  const data = state.pending?.data ?? {};
  const victim = victimDef(String(data.victim ?? 'newchum'));
  const route: Route = data.route === 'pass' ? 'pass' : 'trickeys';
  const knows = data.knows === true;
  state.pending = null;

  if (choice === 'pass') {
    log.say(victim.digger ? 'bandit.bailup.letpass.digger' : 'bandit.bailup.letpass', undefined, 'neutral');
    if (victim.digger) addStanding(state, 1);
    return;
  }

  state.stats.bailUps += 1;
  addHeat(state, route === 'pass' ? 'pass' : 'trickeys', HEAT_PER_CRIME);
  worsenForCrime(state, log);

  // A name that goes before a man saves him the trouble of a fight (§23.2).
  const resists = !knows && rng.chance(victim.resist * (choice === 'shoot' ? 0.6 : 1));
  if (knows) log.say('bandit.bailup.knowsname', undefined, 'good');

  if (resists) {
    if (choice === 'shoot') {
      if (rng.chance(BAILUP_SHOT_KILLS)) {
        log.say('bandit.bailup.killed', undefined, 'grave');
        state.bloodShed = true;
        makeOutlaw(state, log);
        addJournal(state, 'A man died on the road, and I fired the shot.', 'grave');
      } else {
        log.say('bandit.bailup.wounded', undefined, 'bad');
        worsenForCrime(state, log);
        addJournal(state, 'Left a man bleeding in the road for the sake of his purse.', 'bad');
      }
      if (victim.id === 'trooper') makeOutlaw(state, log);
    } else {
      log.say('bandit.bailup.resist', undefined, 'bad');
      damage(state, rng.int(BAILUP_RESIST_HARM.lo, BAILUP_RESIST_HARM.hi), 'a traveller who fought back');
      if (state.gameOver) return;
      // He goes off down the road with his purse and a story about you.
      if (rng.chance(0.5)) {
        log.say('bandit.bailup.driveoff', undefined, 'bad');
        addHeat(state, route === 'pass' ? 'pass' : 'trickeys', HEAT_PER_CRIME * 0.5);
        return;
      }
    }
  }

  const res = rollTakings(state, rng, victim, route);
  bank(state, log, res);
  if (victim.salvage) state.salvage += victim.salvage;
  addNotoriety(state, NOTORIETY_BAILUP + (knows ? NOTORIETY_KNOWN_NAME : 0));
  rewardNotice(state, log);

  if (victim.digger) {
    state.diggersRobbed += 1;
    addStanding(state, -STANDING_PER_RUNG);
    log.say('bandit.digger.robbed', undefined, 'bad');
    addJournal(state, 'Took a digger’s pile. The field will not forget it.', 'bad');
  } else if (res.taken > 0 || res.gold > 0) {
    addJournal(
      state,
      `Stopped a traveller on ${route === 'pass' ? 'the Razorback Road' : "Mercer's Track"} and took ${formatMoney(res.taken)}.`,
      'neutral',
    );
  }
}

/** Every crime moves a man along the ladder of §13, and along this one too. */
export function worsenForCrime(state: GameState, log: Log): void {
  const before = state.legal;
  if (state.legal !== 'wanted criminal') worsen(state, log, 1);
  if (state.legal !== before) addNotoriety(state, NOTORIETY_PER_RUNG);
}

// ---------------------------------------------------------------------------
// The hideout (§23.4)
// ---------------------------------------------------------------------------

export function makeHideout(state: GameState, log: Log): boolean {
  const g = canMakeHideout(state);
  if (!g.ok) {
    log.raw(`${g.note.charAt(0).toUpperCase()}${g.note.slice(1)}.`, 'bad');
    return false;
  }
  state.hideout = { stashPence: 0, stashGold: 0, discovered: false, madeOn: state.day };
  log.say('bandit.hideout.make', undefined, 'good');
  addJournal(state, 'Made Split Rock Camp beyond the surveyed country.', 'good');
  return true;
}

export function stash(state: GameState, log: Log, what: 'money' | 'gold', amount: number): boolean {
  const h = state.hideout;
  if (!h) {
    log.raw('You have nowhere to put it that a trooper would not find.', 'bad');
    return false;
  }
  if (what === 'money') {
    const sum = amount < 0 ? state.moneyPence : Math.min(amount, state.moneyPence);
    if (sum <= 0) {
      log.raw('You have nothing in your pockets to bury.', 'neutral');
      return false;
    }
    state.moneyPence -= sum;
    h.stashPence += sum;
    log.say('bandit.stash.in', { what: formatMoney(sum) }, 'good');
    return true;
  }
  const sum = amount < 0 ? state.goldCentiOz : Math.min(amount, state.goldCentiOz);
  if (sum <= 0) {
    log.raw('You have no gold about you.', 'neutral');
    return false;
  }
  state.goldCentiOz -= sum;
  h.stashGold += sum;
  log.say('bandit.stash.in', { what: formatGold(sum) }, 'good');
  return true;
}

export function unstash(state: GameState, log: Log, what: 'money' | 'gold', amount: number): boolean {
  const h = state.hideout;
  if (!h) {
    log.raw('There is no stash to lift.', 'bad');
    return false;
  }
  if (what === 'money') {
    const sum = amount < 0 ? h.stashPence : Math.min(amount, h.stashPence);
    if (sum <= 0) {
      log.raw('The tin under the stone is empty.', 'neutral');
      return false;
    }
    h.stashPence -= sum;
    state.moneyPence += sum;
    log.say('bandit.stash.out', { what: formatMoney(sum) }, 'neutral');
    return true;
  }
  const sum = amount < 0 ? h.stashGold : Math.min(amount, h.stashGold);
  if (sum <= 0) {
    log.raw('There is no gold under the stone.', 'neutral');
    return false;
  }
  h.stashGold -= sum;
  state.goldCentiOz += sum;
  log.say('bandit.stash.out', { what: formatGold(sum) }, 'neutral');
  return true;
}

/** Chance the troopers come up the gullies and find the camp, in a given week. */
export function hideoutSearchChance(state: GameState): number {
  if (!state.hideout) return 0;
  // They quarter the ranges for a big enough name whether the camps are warm
  // or not; a hideout is quiet, never safe.
  let p =
    HIDEOUT_SEARCH_BASE +
    (heatOf(state, 'camps') / HEAT_MAX) * HIDEOUT_SEARCH_AT_FULL +
    (state.notoriety / NOTORIETY_MAX) * HIDEOUT_SEARCH_NOTORIETY;
  p *= BUSH_SEARCH[bushRankOf(state)];
  if (!fieldSympathy(state)) p *= HIDEOUT_SEARCH_HOSTILE;
  return p;
}

/** The weekly roll for the camp in the ranges. */
export function hideoutWeek(state: GameState, rng: RNG, log: Log): void {
  const h = state.hideout;
  if (!h || h.discovered) return;
  if (!rng.chance(hideoutSearchChance(state))) return;
  if (state.location === 'hideout') {
    log.say('bandit.hideout.raid', undefined, 'bad');
    state.pending = { kind: 'hideoutRaid' };
    return;
  }
  h.discovered = true;
  const lost = h.stashPence + goldValue(h.stashGold, state.bankRate);
  h.stashPence = 0;
  h.stashGold = 0;
  state.hideout = null;
  log.say('bandit.hideout.found', { amount: formatMoney(lost) }, 'bad');
  addJournal(state, `The traps found Split Rock Camp and took ${formatMoney(lost)} out of it.`, 'bad');
}

// ---------------------------------------------------------------------------
// The gang (§23.4)
// ---------------------------------------------------------------------------

const GANG_NAMES = [
  'Long Tom Curran',
  'Scotty Byrne',
  'Jack the Ticket',
  'Paddy Roe',
  'Micky the Kicker',
  'Ned Sheedy',
  'Silent Bill Hoare',
  'Dutch Hans',
  'Yankee Fitz',
  'Corny Dwyer',
  'Bob the Bolter',
  'Tanner Mullane',
];

export function recruitGangMember(state: GameState, rng: RNG, log: Log): boolean {
  const g = canRecruit(state);
  if (!g.ok) {
    log.say('bandit.gang.refused', undefined, 'bad');
    return false;
  }
  const taken = new Set(state.gang.map((m) => m.name));
  const free = GANG_NAMES.filter((n) => !taken.has(n));
  if (free.length === 0) {
    log.raw('There is nobody in this shanty worth the powder.', 'neutral');
    return false;
  }
  const name = rng.pick(free);
  state.gang.push({
    name,
    joined: state.day,
    loyalty: rng.range(GANG_LOYALTY.lo, GANG_LOYALTY.hi),
  });
  log.say('bandit.gang.join', { name }, 'good');
  addJournal(state, `${name} has thrown in with me.`, 'neutral');
  return true;
}

export function dismissGangMember(state: GameState, log: Log, index: number): boolean {
  const man = state.gang[index];
  if (!man) {
    log.raw('There is no such man riding with you.', 'neutral');
    return false;
  }
  state.gang.splice(index, 1);
  log.say('bandit.gang.dismiss', { name: man.name }, 'neutral');
  return true;
}

/** Each man, each week, may sell you for what the Crown is offering (§23.4). */
export function gangWeek(state: GameState, rng: RNG, log: Log): void {
  if (state.gang.length === 0) return;
  const reward = rewardFor(state);
  if (reward <= 0) return;
  for (let i = state.gang.length - 1; i >= 0; i--) {
    const man = state.gang[i];
    const p = (reward / GANG_INFORM_SCALE) * GANG_INFORM_RATE * (2 - man.loyalty);
    if (!rng.chance(p)) continue;
    state.gang.splice(i, 1);
    state.ambush = true;
    log.say('bandit.gang.inform', { name: man.name }, 'bad');
    addJournal(state, `${man.name} has gone into Slateford and sold me.`, 'bad');
    return;
  }
}

// ---------------------------------------------------------------------------
// Intelligence (§23.4)
// ---------------------------------------------------------------------------

export function intelCost(state: GameState): number {
  // The keeper of the shanty and the landlord of the Crown & Cradle both hear it
  // all for nothing; it is said across their own counters (§26, §28.3).
  if (state.estate.shanty || state.estate.shamrock) return 0;
  return BUSH_INTEL_COST[bushRankOf(state)];
}

/** A day and five shillings of shouted drinks, and a word worth having. */
export function gatherIntelligence(state: GameState, rng: RNG, log: Log): boolean {
  const cost = intelCost(state);
  if (state.moneyPence < cost) {
    log.raw('Nobody talks to a man who cannot shout a drink.', 'bad');
    return false;
  }
  state.moneyPence -= cost;
  gainBush(state, log, 1);
  if (cost === 0) log.say('bandit.intel.shouted', undefined, 'good');

  // A man who has been sold has one thing worth buying before anything else:
  // where the traps are lying up for him, and a fortnight of not going there.
  if (state.ambush) {
    state.ambush = false;
    log.say('bandit.intel.ambush', undefined, 'good');
    addJournal(state, 'Bought the word of where the traps were lying up for me.', 'good');
    return true;
  }

  const kind = rng.weighted([
    ['escort', 4],
    ['bank', 3],
    ['traveller', 4],
    ['nothing', 2],
  ] as [string, number][]);

  if (kind === 'nothing') {
    log.say(cost === 0 ? 'bandit.intel.none.free' : 'bandit.intel.none', undefined, 'neutral');
    return true;
  }
  if (kind === 'escort') {
    state.intel = {
      kind: 'escort',
      learnedOn: state.day,
      untilDay: state.day + INTEL_DAYS,
      strength: rng.int(4, 9),
    };
    log.say('bandit.intel.escort', { men: state.intel.strength ?? 6, day: state.intel.untilDay }, 'good');
    return true;
  }
  if (kind === 'bank') {
    state.intel = { kind: 'bank', learnedOn: state.day, untilDay: state.day + INTEL_DAYS };
    log.say('bandit.intel.bank', { day: state.intel.untilDay }, 'good');
    return true;
  }
  const route: Route = rng.chance(0.5) ? 'trickeys' : 'pass';
  state.intel = {
    kind: 'traveller',
    learnedOn: state.day,
    untilDay: state.day + INTEL_TRAVELLER_DAYS,
    route,
  };
  log.say(
    'bandit.intel.traveller',
    { road: route === 'pass' ? 'the Razorback Road' : "Mercer's Track" },
    'good',
  );
  return true;
}

export function intelStale(state: GameState): void {
  if (state.intel && state.intel.untilDay < state.day) state.intel = null;
}

// ---------------------------------------------------------------------------
// The fence (§23.4)
// ---------------------------------------------------------------------------

export function fenceRate(state: GameState): number {
  // A man fencing at his own shanty sets his own rate, and it is a good deal
  // better than the one a keeper gives a stranger (§28.3).
  if (state.estate.shanty && state.estate.shanty === state.location) {
    return Math.round(state.bankRate * SHANTY_FENCE_RATE);
  }
  const f = FENCE_RATE.lo + ((state.day * 37) % 100) / 100 * (FENCE_RATE.hi - FENCE_RATE.lo);
  return Math.round(state.bankRate * f);
}

/** A wanted man's gold goes through the shanty keeper, and the scales are his. */
export function fenceGold(state: GameState, rng: RNG, log: Log): number {
  if (state.goldCentiOz <= 0) {
    log.raw('You have no gold to put on his scales.', 'neutral');
    return 0;
  }
  const rate = fenceRate(state);
  const ownScales = !!state.estate.shanty && state.estate.shanty === state.location;
  let weighed = state.goldCentiOz;
  // No man short-weights himself: at his own shanty the thumb on the scale is
  // his own thumb (§28.3).
  if (!ownScales && rng.chance(FENCE_SHORT_WEIGHT)) {
    const loss = rng.range(FENCE_SHORT_LOSS.lo, FENCE_SHORT_LOSS.hi);
    weighed = Math.floor(weighed * (1 - loss));
    log.say('bandit.fence.shortweight', undefined, 'bad');
  }
  const money = goldValue(weighed, rate);
  state.goldCentiOz = 0;
  state.moneyPence += money;
  log.say('bandit.fence.sell', { gold: formatGold(weighed), money: formatMoney(money) }, 'good');
  log.raw(`He allowed ${formatMoney(rate)} the ounce, and would not be argued with.`, 'neutral');
  return money;
}

// ---------------------------------------------------------------------------
// The big jobs (§23.4)
// ---------------------------------------------------------------------------

/** Share and share alike: every man who rode takes an equal cut (§23.4). */
function splitAmong(state: GameState, log: Log, amount: number): number {
  const parts = state.gang.length + 1;
  for (const g of state.gang) g.loyalty = Math.min(1, g.loyalty + GANG_LOYALTY_PER_JOB);
  if (state.gang.length > 0) log.say('bandit.gang.share', { men: state.gang.length }, 'neutral');
  return Math.floor(amount / parts);
}

export function robBank(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept?: (days: number) => void,
): boolean {
  const g = canBigJob(state);
  if (!g.ok) {
    log.raw(`${g.note.charAt(0).toUpperCase()}${g.note.slice(1)}.`, 'bad');
    return false;
  }
  if (state.location !== 'fields-town') {
    log.raw('The Bank of Australasia stands in Slateford and nowhere else.', 'bad');
    return false;
  }
  state.stats.bigJobs += 1;
  const full = state.intel?.kind === 'bank' && state.intel.untilDay >= state.day;
  if (full) state.intel = null;
  const ambushed = state.ambush;
  state.ambush = false;

  log.say('bandit.bank.go', undefined, 'grave');
  const fail = ROB_BANK_FAIL + (ambushed ? 0.25 : 0);
  if (rng.chance(fail)) {
    log.say(ambushed ? 'bandit.bank.ambush' : 'bandit.bank.fail', undefined, 'bad');
    makeOutlaw(state, log);
    addHeat(state, 'town', HEAT_PER_BIG_JOB);
    damage(state, rng.int(8, 30), 'a bank clerk with a pistol');
    if (state.gameOver) return true;
    if (rng.chance(ROB_BANK_CAPTURE)) {
      captured(state, rng, log, 'town', advanceKept);
      return true;
    }
    log.say('bandit.job.bolted', undefined, 'neutral');
    gainBush(state, log, 1);
    return true;
  }

  let take = rng.int(ROB_BANK_TAKE.lo, ROB_BANK_TAKE.hi);
  if (full) take = Math.round(take * BANK_FULL_MULTIPLIER);
  const mine = splitAmong(state, log, take);
  state.moneyPence += mine;
  state.stats.takings += mine;
  state.bigJobsDone += 1;
  addNotoriety(state, NOTORIETY_BANK);
  addHeat(state, 'town', HEAT_PER_BIG_JOB);
  makeOutlaw(state, log);
  rewardNotice(state, log);
  gainBush(state, log, 1);
  log.say('bandit.bank.success', { amount: formatMoney(mine), gross: formatMoney(take) }, 'good');
  addJournal(state, `Took ${formatMoney(take)} out of the Bank of Australasia.`, 'good');
  return true;
}

export function robEscort(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept?: (days: number) => void,
): boolean {
  const g = canBigJob(state);
  if (!g.ok) {
    log.raw(`${g.note.charAt(0).toUpperCase()}${g.note.slice(1)}.`, 'bad');
    return false;
  }
  const known = state.intel?.kind === 'escort' && state.intel.untilDay >= state.day;
  if (known) state.intel = null;
  const ambushed = state.ambush;
  state.ambush = false;
  state.stats.bigJobs += 1;

  log.say('bandit.escort.ride', undefined, 'grave');
  addHeat(state, 'trickeys', HEAT_PER_BIG_JOB);

  if (!known && !rng.chance(ROB_ESCORT_BLIND_MEET)) {
    log.say('bandit.escort.missed', undefined, 'bad');
    gainBush(state, log, ROB_ESCORT_DAYS);
    return true;
  }

  const mounted = state.horse !== 'none';
  let p = ROB_ESCORT_SUCCESS;
  if (mounted) p += ROB_ESCORT_MOUNTED;
  if (ambushed) p -= ROB_ESCORT_AMBUSH;
  if (!known) p -= 0.1;
  p = Math.max(0.05, Math.min(0.92, p));

  if (!rng.chance(p)) {
    log.say(ambushed ? 'bandit.escort.ambush' : 'bandit.escort.fail', undefined, 'grave');
    makeOutlaw(state, log);
    // The running fight: every man in it takes his chance. Blood on the ground
    // is what the assizes hang for, and it is not shed every time (§24).
    for (let i = state.gang.length - 1; i >= 0; i--) {
      if (rng.chance(ROB_ESCORT_KILLED)) {
        log.say('bandit.escort.manlost', { name: state.gang[i].name }, 'grave');
        state.gang.splice(i, 1);
        state.bloodShed = true;
      }
    }
    if (rng.chance(ROB_ESCORT_KILLED)) {
      log.say('bandit.escort.killed', undefined, 'grave');
      addJournal(state, 'Shot off my horse on Mercer’s Track, with the escort’s gold in sight.', 'grave');
      damage(state, 999, 'a carbine ball on Mercer’s Track');
      return true;
    }
    if (rng.chance(ROB_ESCORT_WOUNDED)) {
      log.say('bandit.escort.wounded', undefined, 'bad');
      damage(state, rng.int(14, 34), 'a wound taken robbing the escort');
      if (!state.gameOver) contract(state, rng, log, 'injury', 2);
      if (state.gameOver) return true;
    }
    if (rng.chance(ROB_ESCORT_CAPTURE)) {
      captured(state, rng, log, 'trickeys', advanceKept);
      return true;
    }
    log.say('bandit.job.bolted', undefined, 'neutral');
    gainBush(state, log, ROB_ESCORT_DAYS);
    return true;
  }

  const take = rng.int(ROB_ESCORT_TAKE.lo, ROB_ESCORT_TAKE.hi);
  const mine = splitAmong(state, log, take);
  state.moneyPence += mine;
  state.stats.takings += mine;
  state.bigJobsDone += 1;
  addNotoriety(state, NOTORIETY_ESCORT);
  for (const zone of HEAT_ZONES) addHeat(state, zone, HEAT_PER_BIG_JOB);
  makeOutlaw(state, log);
  rewardNotice(state, log);
  gainBush(state, log, ROB_ESCORT_DAYS);
  log.say('bandit.escort.success', { amount: formatMoney(mine), gross: formatMoney(take) }, 'good');
  addJournal(state, `Took the gold escort on Mercer’s Track: ${formatMoney(take)} in all.`, 'good');
  return true;
}

// ---------------------------------------------------------------------------
// Being hunted, and the assizes (§24)
// ---------------------------------------------------------------------------

/** The daily roll for a man the Crown wants, escalating with heat and name. */
export function pursuitChance(state: GameState): number {
  if (!state.outlawed) return 0;
  // A camp in the ranges is not a lodging house; they must come and find it.
  if (state.location === 'hideout') return 0;
  const zone = heatZoneFor(state);
  return (
    PURSUIT_OUTLAW_BASE +
    (state.notoriety / 100) * PURSUIT_OUTLAW_NOTORIETY +
    (heatOf(state, zone) / HEAT_MAX) * PURSUIT_OUTLAW_HEAT
  );
}

/** Taken, and held for the assizes at Slateford. */
export function captured(
  state: GameState,
  rng: RNG,
  log: Log,
  zone: HeatZone,
  advanceKept: (days: number) => void = (days) => { state.day += days; },
): void {
  void zone;
  state.stats.timesArrested += 1;
  state.journey = null;
  state.location = 'fields-town';
  log.say('bandit.taken', undefined, 'grave');
  const held = rng.int(4, 14);
  advanceKept(held);
  damage(state, Math.round(held * 0.4), 'the lock-up at Slateford');
  checkYearEnd(state);
  if (state.gameOver) return;
  state.pending = { kind: 'assizes' };
  state.screen = 'encounter';
}

/** Whether there is anyone left outside willing to lever a bar for him (§24). */
export function canBreakGaol(state: GameState): boolean {
  if (state.gaolBreakOffered) return false;
  return fieldSympathy(state) && (state.gang.length > 0 || state.diggersRobbed === 0);
}

export function breakGaol(state: GameState, rng: RNG, log: Log): boolean {
  state.gaolBreakOffered = true;
  if (rng.chance(GAOL_BREAK_CHANCE)) {
    addNotoriety(state, NOTORIETY_GAOL_BREAK);
    state.pending = null;
    log.say('bandit.gaolbreak.ok', undefined, 'good');
    addJournal(state, 'Went out over the lock-up wall with a file and a friend.', 'good');
    rewardNotice(state, log);
    gainBush(state, log, 1);
    state.location = state.hideout ? 'hideout' : 'deep-mountains';
    state.screen = state.hideout ? 'hideout' : 'camp';
    return true;
  }
  log.say('bandit.gaolbreak.fail', undefined, 'bad');
  damage(state, rng.int(6, 18), 'a warder’s baton');
  return false;
}

/**
 * The assizes at Slateford: hanged where blood was shed, and years in the
 * hulks otherwise. Either way the Crown takes everything it can lay hands on.
 */
export function assizes(
  state: GameState,
  log: Log,
  doubled = false,
  rng?: RNG,
  advanceKept: (days: number) => void = (days) => { state.day += days; },
): void {
  state.pending = null;
  // Sixty pounds the quarter buys a defence instead of a plea. Hanging is
  // never lawyered away: blood is blood (§28.3).
  if (rng && !state.bloodShed && state.estate.lawyerUntilDay >= state.day) {
    if (rng.chance(LAWYER_ACQUIT_CHANCE)) {
      addNotoriety(state, LAWYER_ACQUIT_NOTORIETY);
      state.location = 'fields-town';
      log.say('estate.lawyer.acquit', undefined, 'good');
      addJournal(state, 'Acquitted at the Slateford assizes, and walked out into the sunlight.', 'good');
      return;
    }
    log.say('estate.lawyer.fail', undefined, 'bad');
  }
  // A magistrate convicted is a magistrate no longer (§28.1).
  forfeitCommission(state, log);
  const confiscated = state.moneyPence + state.bankPence + goldValue(state.goldCentiOz, state.bankRate);
  state.moneyPence = 0;
  state.bankPence = 0;
  state.goldCentiOz = 0;
  state.claims = emptyClaims();
  state.shaft = null;
  state.gang = [];

  if (state.bloodShed) {
    state.outlawEnd = 'hanged';
    if (state.hideout) {
      state.hideout.stashPence = 0;
      state.hideout.stashGold = 0;
    }
    log.say('bandit.assizes.hanged', undefined, 'grave');
    addJournal(state, 'Hanged at the Slateford assizes, before a great crowd.', 'grave');
    state.health = 0;
    state.gameOver = 'dead';
    state.causeOfDeath = 'hanged at the Slateford assizes';
    return;
  }

  state.outlawEnd = 'hulks';
  log.say(doubled ? 'bandit.assizes.hulks.doubled' : 'bandit.assizes.hulks', undefined, 'grave');
  log.raw(
    `The Crown takes ${formatMoney(confiscated)} of yours, and everything the Crown could find.`,
    'bad',
  );
  addJournal(state, 'Sentenced at the assizes: years of it, in the hulks.', 'grave');
  advanceKept(HARD_LABOUR_DAYS);
  checkYearEnd(state);
  state.gameOver = 'finished';
}

// ---------------------------------------------------------------------------
// Chosen endings (§24)
// ---------------------------------------------------------------------------

export function canBuyPassage(state: GameState): Gate {
  if (state.location !== 'suze-port') return gate(false, 'ships sail from Port Gannet and nowhere else');
  if (!crimeVisible(state)) return gate(false, 'there is nothing you need to run from');
  if (state.moneyPence < PASSAGE_FARE) {
    return gate(false, `the master wants ${formatMoney(PASSAGE_FARE)}, under whatever name you like`);
  }
  return gate(true, 'California, under a false name, and never come back');
}

/**
 * A berth for California under a false name. What he carries aboard is all he
 * keeps: the bank holds whatever was left in it, and the claims go to whoever
 * pulls the pegs (§24).
 */
export function buyPassage(
  state: GameState,
  rng: RNG,
  log: Log,
  advanceKept?: (days: number) => void,
): boolean {
  const g = canBuyPassage(state);
  if (!g.ok) {
    log.raw(`${g.note.charAt(0).toUpperCase()}${g.note.slice(1)}.`, 'bad');
    return false;
  }
  state.moneyPence -= PASSAGE_FARE;
  let recognition = state.notoriety / PASSAGE_RECOGNITION;
  if (bushRankOf(state) === 'captain') recognition /= 2;
  if (rng.chance(recognition)) {
    log.say('bandit.passage.recognised', undefined, 'grave');
    if (state.outlawed) {
      captured(state, rng, log, 'town', advanceKept);
    } else {
      log.say('bandit.passage.turnedback', undefined, 'bad');
    }
    return true;
  }
  log.say('bandit.passage.sail', undefined, 'good');
  addJournal(state, 'Went aboard for California under a name that was not mine.', 'good');
  state.outlawEnd = 'california';
  // Only what he carried up the gangway, and what is under the stone, is his.
  state.bankPence = 0;
  state.company = null;
  state.shares = 0;
  state.claims = emptyClaims();
  state.gameOver = 'finished';
  return true;
}

/** The Eureka pardon: everything under the stone, for a clean name (§24). */
export function offerPardon(state: GameState): boolean {
  return (
    state.outlawed &&
    !state.pardonOffered &&
    state.stockadeRole === 'joined' &&
    state.stockadeDone &&
    !state.gameOver
  );
}

export function takePardon(state: GameState, log: Log, take: boolean): void {
  state.pardonOffered = true;
  state.pending = null;
  if (!take) {
    log.say('bandit.pardon.refuse', undefined, 'neutral');
    return;
  }
  const restitution = stashWorth(state);
  if (state.hideout) {
    state.hideout.stashPence = 0;
    state.hideout.stashGold = 0;
  }
  state.outlawed = false;
  state.outlawEnd = 'pardoned';
  state.legal = 'petty criminal';
  state.cleanDays = 0;
  state.bloodShed = false;
  state.gang = [];
  log.say('bandit.pardon.accept', { amount: formatMoney(restitution) }, 'good');
  addJournal(
    state,
    `Pardoned under the amnesty, and it cost every penny of ${formatMoney(restitution)} in restitution.`,
    'good',
  );
}

// ---------------------------------------------------------------------------
// Daily and weekly ticks
// ---------------------------------------------------------------------------

/** Everything the dark ladder does at the close of a day. */
export function banditDayTick(state: GameState, log: Log): void {
  heatTick(state);
  intelStale(state);
  if (state.location === 'hideout') gainBush(state, log, 1);
  if (offerPardon(state) && !state.pending) {
    state.pending = { kind: 'pardon' };
  }
}

/** And at the close of every seventh day. */
export function banditWeek(state: GameState, rng: RNG, log: Log): void {
  gangWeek(state, rng, log);
  hideoutWeek(state, rng, log);
}
