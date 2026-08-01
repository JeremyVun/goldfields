import {
  CAMP_DEFS,
  COACH_DAYS,
  COACH_FARE,
  JOBS,
  MAX_SHARES,
  NO_WORK_CHANCE,
  PUDDLER_RENT,
  QUACK_FEE,
  REST_RECOVERY,
  SHARE_PRICE,
  STANDING_COUNCIL_JOB,
  STANDING_WAGE_DAY,
  BUSH_ESCAPE,
  HIDEOUT_DAYS,
  HEAT_PER_CRIME,
  NOTORIETY_ESCAPE,
  NOTORIETY_THEFT,
  ROB_ESCORT_DAYS,
  STEAL_DRUNK,
  STEAL_KNOWN_CHANCE,
  STEAL_STORE,
  TWOUP_WIN,
  CARDS_WIN,
  CARDS_PAYOUT,
  WEEK_BONUS,
} from './constants';
import {
  agitationFromStory,
  resolveMeeting,
  resolveStockade,
  type StockadeChoice,
} from './agitation';
import {
  assizes,
  breakGaol,
  buyPassage,
  canBailUp,
  addHeat,
  canBreakGaol,
  crimeVisible,
  dismissGangMember,
  escapeChance,
  fenceGold,
  gainBush,
  gatherIntelligence,
  lurk,
  makeHideout,
  makeOutlaw,
  recruitGangMember,
  resolveBailUp,
  rewardNotice,
  robBank,
  robEscort,
  stash,
  takePardon,
  unstash,
  worsenForCrime,
} from './bandit';
import {
  buyBackShares,
  declareDividend,
  fireCrew,
  floatCompany,
  hireCrew,
  sellOut,
  sellOwnShares,
  setCrewTask,
} from './company';
import { endDay, passKeptDays } from './daily';
import {
  acceptCommission,
  buyGazetteShare,
  buyShamrock,
  buyShanty,
  holdCourt,
  openStore,
  placeStory,
  retainLawyer,
  ruleOn,
  setStorePolicy,
  subscribeWork,
} from './estate';
import { maybeRumour, payDividends, salvageValue } from './events';
import { checkGrave, contract, damage, heal, hospitalStay, illnessVars } from './health';
import { buyLicence, makeRun, offerBribe, toGaol, toTheLogs, worsen } from './law';
import {
  buyGreens,
  buyHorse,
  buyItem,
  sellItem,
  bankRefuses,
  buyProvisions,
  fillWater,
  sellGold,
} from './market';
import {
  abandonClaim,
  checkMethod,
  dissolvePartnership,
  hireMate,
  licenceDiesMidSpell,
  licenceLapsedToday,
  mineOneDay,
  pegClaim,
  prospectDay,
  takePartner,
  timberShaft,
} from './mining';
import { formatGold, formatMoney, pounds, shillings } from './money';
import { Log } from './narrate';
import { gazetteStokesTrouble } from './news';
import { drinkAt, oddsFactor, shoutTheBar } from './shamrock';
import type { RNG } from './rng';
import {
  addJournal,
  addNotoriety,
  addStanding,
  bushRankOf,
  heatZoneFor,
  clone,
  createInitialState,
  isCamp,
  isLicensed,
  netWorth,
  recordWorth,
} from './state';
import { arrive, beginJourney, localTravelDays, travelOneDay } from './travel';
import { DAYS_IN_YEAR } from './time';
import type {
  Action,
  CampId,
  GameState,
  LocationId,
  Pending,
  Screen,
  StepResult,
  Task,
} from './types';

export function screenForLocation(loc: LocationId): Screen {
  if (loc === 'suze-port') return 'suze';
  if (loc === 'fields-town') return 'ftown';
  if (loc === 'on-road') return 'ftown';
  if (loc === 'hideout') return 'hideout';
  if (loc === 'secret-mine') return 'secret-expedition';
  return 'camp';
}

// ---------------------------------------------------------------------------
// Multi-day tasks
// ---------------------------------------------------------------------------

function afterDay(state: GameState, rng: RNG, log: Log): boolean {
  if (state.gameOver) return false;
  checkGrave(state, rng, log);
  if (state.gameOver) return false;
  if (state.endOfYear) return false;
  return true;
}

/**
 * A meeting or a rising raised at the end of a day breaks off whatever the
 * player was doing; the rest of the spell waits on his answer.
 */
function interrupt(state: GameState, task: Task | null): void {
  if (!state.pending || state.gameOver || state.endOfYear) return;
  state.resumeTask = task;
  state.screen = 'encounter';
}

function runWork(state: GameState, rng: RNG, log: Log, task: Task & { kind: 'work' }): void {
  const job = JOBS[task.job];
  let earned = 0;
  let daysDone = 0;
  let left = -1;
  for (let i = 0; i < task.days; i++) {
    if (state.illness?.blinding && rng.chance(0.5)) {
      log.say('ill.blind', undefined, 'bad');
      endDay(state, rng, log, {});
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = task.days - i - 1;
        break;
      }
      continue;
    }
    if (rng.chance(NO_WORK_CHANCE)) {
      log.say('work.none', undefined, 'neutral');
      endDay(state, rng, log, {});
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = task.days - i - 1;
        break;
      }
      continue;
    }
    let wage = rng.int(job.lo, job.hi);
    if (state.health < 40) wage = Math.round(wage * 0.7);
    state.moneyPence += wage;
    earned += wage;
    daysDone += 1;
    state.stats.daysWorked += 1;
    addStanding(state, STANDING_WAGE_DAY);

    switch (task.job) {
      case 'gardener':
        state.daysWithoutGreens = 0;
        if (rng.chance(0.4)) log.say('work.greens', undefined, 'good');
        heal(state, 1);
        break;
      case 'barman':
        if (rng.chance(0.05)) {
          log.say('work.barman.brawl', undefined, 'bad');
          damage(state, rng.int(3, 10), 'a brawl at the Shamrock');
        }
        maybeRumour(state, rng, log, 3);
        break;
      case 'clerk':
        state.briggsDays += 1;
        if ([7, 21, 42].includes(state.briggsDays)) {
          const pct = state.briggsDays >= 42 ? 15 : state.briggsDays >= 21 ? 10 : 5;
          log.raw(`Briggs enters you on a better staff tier: ${pct}% off his marked prices.`, 'good');
        }
        break;
      case 'orderly':
        if (rng.chance(0.15)) log.say('work.orderly.lesson', undefined, 'good');
        heal(state, 1);
        break;
      default:
        break;
    }
    if (task.job === 'wharf') {
      state.fedToday = true;
      state.fatigue += 1;
      state.suzeStanding = Math.min(100, state.suzeStanding + 1);
    } else if (task.job === 'town') {
      state.suzeStanding = Math.min(100, state.suzeStanding + 2);
      state.horseKnowledge = Math.min(10, state.horseKnowledge + (rng.chance(0.35) ? 1 : 0));
      if (rng.chance(0.35)) state.fedToday = true;
    }
    // The Journal's own arithmetic: boom wages set against the colonial rate
    // of five shillings the week (§31.1).
    if ((task.job === 'wharf' || task.job === 'town') && rng.chance(0.12)) {
      log.say('work.boom', { wage: formatMoney(wage) }, 'good');
    }
    if (rng.chance(0.3)) {
      log.say('work.day', { job: job.name.toLowerCase(), wage: formatMoney(wage) }, 'neutral');
    }
    endDay(state, rng, log, { toil: true });
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = task.days - i - 1;
      break;
    }
  }
  if (daysDone >= 7) {
    state.moneyPence += WEEK_BONUS;
    earned += WEEK_BONUS;
    log.raw('The overseer adds a shilling for the week entire.', 'good');
  }
  log.say('work.week', { job: job.name.toLowerCase(), wage: formatMoney(earned) }, 'good');
  if (earned > 0) addJournal(state, `Earned ${formatMoney(earned)} at ${job.name.toLowerCase()}.`, 'neutral');
  if (left > 0) interrupt(state, { kind: 'work', job: task.job, days: left });
  else interrupt(state, null);
}

function runMine(state: GameState, rng: RNG, log: Log, task: Task & { kind: 'mine' }): void {
  // A spell taken up again after an interruption may find the player carted,
  // gaoled or marched off the ground he meant to work.
  if (!isCamp(state.location)) return;
  let remaining = task.days;
  let won = 0;
  let left = -1;
  const camp = state.location;
  while (remaining > 0) {
    // Carted off to Calico House, or otherwise no longer on the ground.
    if (state.location !== camp) break;
    if (state.illness?.blinding && rng.chance(0.6)) {
      log.say('ill.blind', undefined, 'bad');
      endDay(state, rng, log, {});
      remaining -= 1;
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = remaining;
        break;
      }
      continue;
    }
    // The day the papers expire is a day the player is told about, even in the
    // middle of a fortnight's work (§21).
    if (licenceLapsedToday(state)) {
      log.raw(
        'Your licence ran out with yesterday. You are on this ground unlicensed now, and the troopers ride through it as they please.',
        'bad',
      );
    }
    const res = mineOneDay(state, rng, log, task.method);
    won += res.gold;
    if (res.stop === 'trooper') {
      state.resumeTask = { kind: 'mine', method: task.method, days: remaining - 1 };
      state.screen = 'encounter';
      return;
    }
    if (res.stop === 'dead') return;
    if (
      res.stop === 'cannotPay' ||
      res.stop === 'noClaim' ||
      res.stop === 'shaftGone' ||
      res.stop === 'workedOut'
    ) {
      remaining -= 1;
      endDay(state, rng, log, { toil: true });
      if (!afterDay(state, rng, log)) break;
      if (state.pending) {
        left = remaining;
        break;
      }
      if (res.stop !== 'shaftGone') break;
      continue;
    }
    remaining -= 1;
    endDay(state, rng, log, { toil: true });
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = remaining;
      break;
    }
  }
  if (won > 0) {
    log.raw(`In all you won ${formatGold(won)} of gold.`, 'good');
  }
  if (left > 0) interrupt(state, { kind: 'mine', method: task.method, days: left });
  else interrupt(state, null);
}

function runRest(state: GameState, rng: RNG, log: Log, days: number): void {
  let left = -1;
  for (let i = 0; i < days; i++) {
    heal(state, rng.int(REST_RECOVERY.lo, REST_RECOVERY.hi));
    if (state.illness && rng.chance(0.16)) {
      log.say('ill.recover', illnessVars(state.illness.id), 'good');
      state.illness = null;
    }
    endDay(state, rng, log, {});
    if (!afterDay(state, rng, log)) break;
    if (state.pending) {
      left = days - i - 1;
      break;
    }
  }
  log.say('health.rest', { days }, 'neutral');
  if (left > 0) interrupt(state, { kind: 'rest', days: left });
  else interrupt(state, null);
}

function runTravel(state: GameState, rng: RNG, log: Log): void {
  while (state.journey && !state.gameOver) {
    const stop = travelOneDay(state, rng, log);
    if (stop === 'bushrangers' || stop === 'trooper') {
      state.resumeTask = { kind: 'travel' };
      state.screen = 'encounter';
      return;
    }
    if (stop === 'dead') return;
    if (stop === 'yearEnd') return;
    if (stop === 'arrived') {
      arrive(state, log);
      state.screen = screenForLocation(state.location);
      return;
    }
    checkGrave(state, rng, log);
    if (state.gameOver) return;
  }
}

function runTask(state: GameState, rng: RNG, log: Log, task: Task): void {
  switch (task.kind) {
    case 'travel':
      runTravel(state, rng, log);
      break;
    case 'work':
      runWork(state, rng, log, task);
      break;
    case 'mine':
      runMine(state, rng, log, task);
      break;
    case 'rest':
      runRest(state, rng, log, task.days);
      break;
    case 'hospital': {
      // Only the days actually paid for are spent under care.
      const stayed = hospitalStay(state, rng, log, task.days);
      passKeptDays(state, rng, log, stayed);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

function resumePending(state: GameState, rng: RNG, log: Log): void {
  const task = state.resumeTask;
  state.resumeTask = null;
  state.pending = null;
  if (task && !state.gameOver && !state.endOfYear) {
    runTask(state, rng, log, task);
    // Only stay on the encounter screen if a *fresh* encounter was raised while
    // the interrupted task ran. Without the `pending` test, a task that had no
    // days left to run (a one-day spell, or the last day of a spell) would leave
    // the player stranded on an encounter screen with nothing pending and no
    // action that answers it — an unrecoverable softlock.
    if (state.pending && state.screen === 'encounter') return;
  }
  if (!state.gameOver && state.screen === 'encounter') {
    state.screen = screenForLocation(state.location);
  }
}

function handleTrooperChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  if (action.type === 'bribe') {
    const outcome = offerBribe(state, rng, log);
    if (outcome === 'nomoney') return;
    if (outcome === 'released') {
      resumePending(state, rng, log);
      return;
    }
    toTheLogs(state, rng, log);
  } else if (action.type === 'resist') {
    const outcome = makeRun(state, rng, log);
    if (outcome === 'escaped') {
      resumePending(state, rng, log);
      return;
    }
    toTheLogs(state, rng, log);
  } else {
    toTheLogs(state, rng, log);
  }
  state.pending = null;
  state.resumeTask = null;
  state.journey = null;
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

function handleBushrangerChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  const hasGun = state.items.gun > 0;
  if (action.type === 'resist') {
    if (hasGun) {
      if (rng.chance(0.82)) {
        log.say('bushranger.gun', undefined, 'good');
        resumePending(state, rng, log);
        return;
      }
      log.raw('You are slower than he is. The pistol is knocked from your hand.', 'bad');
      damage(state, rng.int(6, 20), 'bushrangers');
    } else {
      log.say('bushranger.resist.hurt', undefined, 'bad');
      damage(state, rng.int(8, 26), 'bushrangers');
      if (state.gameOver) {
        state.pending = null;
        state.resumeTask = null;
        return;
      }
    }
  }
  // They take what there is.
  state.stats.timesRobbed += 1;
  if (state.goldCentiOz > 0 && rng.chance(0.7)) {
    const lost = Math.floor(state.goldCentiOz * rng.range(0.5, 1));
    state.goldCentiOz -= lost;
    log.say('bushranger.gold', { gold: formatGold(lost) }, 'bad');
  }
  if (state.moneyPence > 0) {
    const lost = Math.floor(state.moneyPence * rng.range(0.5, 1));
    state.moneyPence -= lost;
    log.say('bushranger.robbed', { loss: formatMoney(lost) }, 'bad');
    addJournal(state, `Bailed up and robbed of ${formatMoney(lost)}.`, 'bad');
  } else if (state.goldCentiOz === 0) {
    log.say('bushranger.nothing', undefined, 'neutral');
  }
  resumePending(state, rng, log);
}

// ---------------------------------------------------------------------------
// The dark ladder's encounters (§23-§24)
// ---------------------------------------------------------------------------

/** What is waiting on the player now, read fresh after the law has had its say. */
function pendingKind(state: GameState): Pending['kind'] | undefined {
  return state.pending?.kind;
}

/**
 * Troopers come upon a man who has business on the roads: stand, run for the
 * scrub, or give himself up. Running is what bushcraft and a horse are for.
 */
function handlePatrolChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  const raid = state.pending?.kind === 'hideoutRaid';
  state.pending = null;

  if (action.type === 'resist') {
    // Standing and fighting troopers is how a man is proclaimed, and how blood
    // is shed on the wrong side of the Crown.
    const armed = state.items.gun > 0;
    const p = armed ? 0.5 + BUSH_ESCAPE[bushRankOf(state)] : 0.2;
    worsenForCrime(state, log);
    if (rng.chance(p)) {
      log.say('bandit.patrol.fought', undefined, 'bad');
      state.bloodShed = true;
      makeOutlaw(state, log);
      addNotoriety(state, NOTORIETY_ESCAPE);
      rewardNotice(state, log);
      gainBush(state, log, 1);
      resumePending(state, rng, log);
      return;
    }
    log.say('bandit.patrol.fought.lost', undefined, 'bad');
    damage(state, rng.int(10, 32), 'a trooper’s carbine');
    if (state.gameOver) {
      state.resumeTask = null;
      return;
    }
    toGaol(state, rng, log);
  } else if (action.type === 'flee' || action.type === 'bailUp') {
    if (rng.chance(escapeChance(state))) {
      log.say(raid ? 'bandit.hideout.slipped' : 'bandit.escape', undefined, 'good');
      addNotoriety(state, NOTORIETY_ESCAPE);
      gainBush(state, log, 1);
      rewardNotice(state, log);
      if (raid && state.hideout) {
        const lost = state.hideout.stashPence;
        state.hideout.stashPence = 0;
        state.hideout.stashGold = 0;
        state.hideout = null;
        state.location = 'deep-mountains';
        log.say('bandit.hideout.abandoned', { amount: formatMoney(lost) }, 'bad');
      }
      resumePending(state, rng, log);
      return;
    }
    log.say('bandit.caught', undefined, 'bad');
    damage(state, rng.int(3, 12), 'a trooper’s baton');
    if (state.gameOver) {
      state.resumeTask = null;
      return;
    }
    toGaol(state, rng, log);
  } else {
    log.say('bandit.surrender', undefined, 'bad');
    toGaol(state, rng, log);
  }

  if (pendingKind(state) === 'assizes') {
    state.resumeTask = null;
    state.screen = 'encounter';
    return;
  }
  state.resumeTask = null;
  state.journey = null;
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

/** The traveller stands in the road with his hands up, and it is your word. */
function handleBailUpChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  const choice =
    action.type === 'bailUpTake' ? (action.shoot ? 'shoot' : 'take') : action.type === 'letPass' ? 'pass' : 'take';
  resolveBailUp(state, rng, log, choice);
  if (state.gameOver) {
    state.pending = null;
    state.resumeTask = null;
    return;
  }
  resumePending(state, rng, log);
}

function handleAssizesChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  if (action.type === 'breakGaol' && canBreakGaol(state)) {
    if (breakGaol(state, rng, log)) {
      state.resumeTask = null;
      return;
    }
    // The file broke, or the man outside did not come. The sentence doubles.
    assizes(state, log, true, rng);
  } else {
    assizes(state, log, false, rng);
  }
  state.pending = null;
  state.resumeTask = null;
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

function handleClaimJumper(state: GameState, rng: RNG, log: Log, action: Action): void {
  if (action.type !== 'answerClaimJumper') return;
  const camp = state.pending?.data?.camp as CampId | undefined;
  if (!camp) return;
  const claim = state.claims[camp];
  state.pending = null;
  if (!claim || action.choice === 'abandon') {
    state.claims[camp] = null;
    if (state.shaft?.camp === camp) state.shaft = null;
    log.raw('You pull what pegs remain and leave the strangers to it.', 'bad');
    state.screen = screenForLocation(state.location);
    return;
  }
  let won = false;
  if (action.choice === 'council') {
    const chance = claim.registered ? 0.95 : Math.min(0.8, 0.35 + state.standing / 200);
    for (let i = 0; i < 2 && !state.gameOver; i++) endDay(state, rng, log, {});
    won = rng.chance(chance);
    log.raw(won
      ? 'The clerk finds the entry, and a constable restores the pegs under the Council seal.'
      : 'The Council hears both stories and decides it cannot put one unrecorded boundary above another.', won ? 'good' : 'bad');
  } else {
    const armed = state.items.gun > 0 ? 0.2 : 0;
    const backed = state.partner || state.mateUntilDay >= state.day ? 0.18 : 0;
    won = rng.chance(Math.min(0.98, 0.3 + state.standing / 160 + armed + backed));
    if (won) {
      log.raw('They measure you, your name and the support at your shoulder, then pull their tools out before dark.', 'good');
    } else {
      log.raw('They do not move. The quarrel turns ugly, and you come away hurt and without the ground.', 'bad');
      damage(state, rng.int(4, 12), 'a claim dispute');
    }
    if (!state.gameOver) endDay(state, rng, log, {});
  }
  if (won) {
    claim.jumpedOn = null;
    claim.lastAttendedDay = state.day;
  } else {
    state.claims[camp] = null;
    if (state.shaft?.camp === camp) state.shaft = null;
  }
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

function settle(state: GameState, rng: RNG, log: Log): void {
  if (state.gameOver) state.pending = null;
  // The camp in the ranges is the one screen that can outlive the place it
  // belongs to: a raid takes it away under the player's feet.
  if (
    (state.screen === 'hideout' || state.screen === 'stash') &&
    (state.location !== 'hideout' || !state.hideout)
  ) {
    state.screen = screenForLocation(state.location === 'hideout' ? 'deep-mountains' : state.location);
  }
  // A question raised anywhere in the engine is put to the player, whatever he
  // thought he was doing.
  if (state.pending && !state.endOfYear && state.screen !== 'encounter') {
    state.screen = 'encounter';
  }
  if (state.gameOver === 'dead') {
    // The Gazette prints a man's death once, not every time he is spoken to.
    if (state.screen !== 'obituary') {
      state.screen = 'obituary';
      log.say('end.obituary', undefined, 'grave');
    }
    return;
  }
  if (state.gameOver === 'finished') {
    if (state.screen !== 'end') {
      state.screen = 'end';
      // A man who calls it a day still owns his shares, and the company still
      // owes him whatever it owes him.
      payDividends(state, rng, log);
      state.shares = 0;
      recordWorth(state);
    }
    return;
  }
  if (state.endOfYear && state.screen !== 'end') {
    state.screen = 'end';
    log.say('end.summary', undefined, 'title');
    payDividends(state, rng, log);
    state.shares = 0;
    // The last reading of the year, taken after the dividends are in, so the
    // chart ends where the tally does (§21).
    recordWorth(state);
  }
}

export function step(state: GameState, action: Action, rng: RNG): StepResult {
  const s = clone(state);
  rng.restore(s.rngState);
  const log = new Log(rng);

  apply(s, action, rng, log);

  settle(s, rng, log);
  s.rngState = rng.save();
  return { state: s, events: log.events };
}

function apply(s: GameState, action: Action, rng: RNG, log: Log): void {
  // Encounters swallow everything until answered.
  if (s.pending && s.screen === 'encounter') {
    if (s.pending.kind === 'claimJumper') {
      handleClaimJumper(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'trooper') {
      handleTrooperChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'bushrangers') {
      handleBushrangerChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'patrol' || s.pending.kind === 'hideoutRaid') {
      handlePatrolChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'bailup') {
      handleBailUpChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'shantyRaid') {
      // Nothing to answer: the place is ash, and there is nobody to complain
      // to about it (§28.3).
      s.pending = null;
      s.screen = screenForLocation(s.location);
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'assizes') {
      handleAssizesChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'pardon') {
      takePardon(s, log, action.type === 'takePardon' && action.take);
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'meeting') {
      resolveMeeting(s, rng, log, action.type === 'attendMeeting' && action.attend);
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'stockade') {
      const choice: StockadeChoice =
        action.type === 'joinStockade'
          ? 'join'
          : action.type === 'sellSupplies'
            ? 'sellSupplies'
            : 'keepClear';
      resolveStockade(s, rng, log, choice);
      // A refused sale leaves the question standing.
      if (s.pending) return;
      resumePending(s, rng, log);
      return;
    }
  }

  switch (action.type) {
    // --- framing -------------------------------------------------------
    case 'start':
      s.screen = 'title';
      return;

    case 'newGame': {
      // Beginning again after a death must not deal the same year twice over.
      const seed = action.seed ?? (s.rngState === s.seed ? s.seed : Math.floor(rng.next() * 0xffffffff));
      const fresh = createInitialState(seed);
      Object.assign(s, fresh);
      rng.restore(seed >>> 0);
      s.screen = 'intro';
      log.say('intro.arrival', undefined, 'title');
      log.say('intro.newchum', undefined, 'neutral');
      return;
    }

    case 'resumePrompt':
      s.screen = 'resume';
      return;

    case 'resume':
      Object.assign(s, action.state);
      rng.restore(s.rngState);
      log.raw('The game is resumed where you left it.', 'good');
      return;

    case 'continue':
      if (s.screen === 'intro') s.screen = 'suze';
      else if (s.screen === 'obituary') s.screen = 'title';
      else s.screen = screenForLocation(s.location);
      return;

    case 'goto':
      // Choosing a route arms a journey for the travel-mode screen; backing out
      // of it must not leave that half-made journey lying about in the state.
      if (s.journey && s.location !== 'on-road' && action.screen !== 'travel-mode') {
        s.journey = null;
      }
      s.screen = action.screen;
      return;

    case 'cycleSpell': {
      const ladder = [1, 2, 3, 7, 14, 30];
      const i = ladder.indexOf(s.spellDays);
      s.spellDays = ladder[(i + 1) % ladder.length];
      log.raw(`A spell of work will now be ${s.spellDays} day${s.spellDays === 1 ? '' : 's'}.`, 'neutral');
      return;
    }

    case 'quitToTitle':
      Object.assign(s, createInitialState(s.seed));
      s.screen = 'title';
      return;

    case 'save': {
      const id = String(1000 + Math.floor(rng.next() * 8999));
      s.gameId = id;
      log.raw(
        `Your game is saved under the number ${id}. Write it down; you will need it to take up this game again.`,
        'title',
      );
      return;
    }

    case 'finish':
      s.gameOver = 'finished';
      return;

    case 'nextYear':
      s.yearsPlayed += 1;
      s.endOfYear = false;
      log.raw(
        `Another year on the diggings. It is ${DAYS_IN_YEAR} days more, and the gold does not care who you are.`,
        'title',
      );
      // The year may have run out with the player still on the road. Finish the
      // journey rather than leaving him nowhere, standing at a town he has not
      // reached.
      if (s.journey && s.location === 'on-road') {
        runTask(s, rng, log, { kind: 'travel' });
        if (s.screen === 'encounter' || s.gameOver || s.endOfYear) return;
      }
      s.screen = screenForLocation(s.location);
      return;

    // --- Suze Port -----------------------------------------------------
    case 'work': {
      const job = JOBS[action.job];
      // From wanted criminal no honest house in either town will engage him;
      // there is a notice of him on the wall of the police camp (§23.1).
      if (bankRefuses(s)) {
        log.say('bandit.work.refused', undefined, 'bad');
        return;
      }
      if (job.id === 'council' && s.legal !== 'honest') {
        log.say('work.council.refused', undefined, 'bad');
        return;
      }
      if (job.id === 'council' && s.standing < STANDING_COUNCIL_JOB) {
        log.say('work.council.unknown', undefined, 'bad');
        return;
      }
      s.employment = { job: action.job, since: s.day, daysWorked: action.days };
      runTask(s, rng, log, { kind: 'work', job: action.job, days: action.days });
      return;
    }

    case 'buy':
      buyItem(s, log, action.item, action.qty ?? 1);
      return;

    case 'sellItem':
      sellItem(s, log, action.item);
      return;

    case 'buyProvisions':
      buyProvisions(s, log, action.weeks);
      return;

    case 'buyGreens':
      buyGreens(s, log);
      return;

    case 'fillWater':
      fillWater(s, log);
      return;

    case 'buyHorse':
      buyHorse(s, rng, log, action.kind);
      return;

    case 'inspectHorse': {
      if (action.method === 'look') {
        s.horseInspection[action.kind] = Math.max(s.horseInspection[action.kind], 1);
        log.raw('You inspect the teeth, legs and feet, and make what you can of them.', 'neutral');
        return;
      }
      const fee = action.method === 'ostler' ? shillings(1) : shillings(5);
      if (s.moneyPence < fee) {
        log.raw('Knowledge has its price, and you cannot meet it.', 'bad');
        return;
      }
      s.moneyPence -= fee;
      s.horseInspection.brumby = 2;
      s.horseInspection.hack = 2;
      s.horseKnowledge = Math.min(10, s.horseKnowledge + 2);
      log.raw(action.method === 'ostler'
        ? 'The ostler gives a blunt account of both animals, with no dealer listening.'
        : 'A day on the road reveals what standing at a rail could not.', 'good');
      if (action.method === 'trial') endDay(s, rng, log, {});
      return;
    }

    case 'buyMeal':
      if (s.fedToday) {
        log.raw('You have a meal waiting already.', 'neutral');
      } else if (s.moneyPence < shillings(1)) {
        log.raw('The cookshop does not give credit.', 'bad');
      } else {
        s.moneyPence -= shillings(1);
        s.fedToday = true;
        log.raw('Stew, bread and onions: plain, hot and enough for today.', 'good');
      }
      return;

    case 'fishForFood': {
      const caught = rng.int(3, 7);
      s.provisionDays = Math.min(84, s.provisionDays + caught);
      log.raw(`A day among the pilings leaves you with ${caught} days' worth of fish to smoke or cook.`, caught >= 5 ? 'good' : 'neutral');
      endDay(s, rng, log, { toil: true });
      return;
    }

    case 'setLodging': {
      s.lodging = action.kind;
      const key =
        action.kind === 'inn'
          ? 'lodging.inn'
          : action.kind === 'stable'
            ? 'lodging.stable'
            : action.kind === 'tentground'
              ? 'lodging.tentground'
              : 'lodging.rough';
      log.say(key, undefined, 'neutral');
      return;
    }

    case 'sellSalvage': {
      if (s.salvage <= 0) {
        log.raw('You have nothing scavenged to sell.', 'neutral');
        return;
      }
      if (s.location !== 'suze-port') {
        log.raw(
          'Chests of finery are worth nothing at the diggings. Few people head away from the fields, and so the goods lie rotting.',
          'bad',
        );
        return;
      }
      const value = salvageValue(s, rng);
      s.moneyPence += value;
      log.raw(
        `The Suze Port dealers fall on your scavenged chests and pay ${formatMoney(value)} — a wonderful profit for goods that lay rotting on the track.`,
        'good',
      );
      addJournal(s, `Sold scavenged goods at Suze Port for ${formatMoney(value)}.`, 'good');
      s.salvage = 0;
      return;
    }

    case 'readGazette': {
      if (s.moneyPence < 1) {
        log.raw('The boy will not part with a Gazette for nothing.', 'bad');
        return;
      }
      s.moneyPence -= 1;
      // A licence story read over a pannikin of tea is worth a day's grumbling.
      if (s.gazetteReadOn !== s.day && gazetteStokesTrouble(s)) agitationFromStory(s);
      s.gazetteReadOn = s.day;
      maybeRumour(s, rng, log, 2.5);
      s.screen = 'gazette';
      return;
    }

    case 'readJournal':
      if (s.items.journal < 1) {
        log.raw('You have no copy of the Journal.', 'bad');
        return;
      }
      s.screen = 'journal';
      return;

    case 'steal': {
      const def = action.target === 'store' ? STEAL_STORE : STEAL_DRUNK;
      if (rng.chance(def.caught)) {
        log.say(action.target === 'store' ? 'steal.store.caught' : 'steal.drunk.caught', undefined, 'bad');
        worsen(s, log, 1);
        if (action.target === 'store') s.briggsBlacklisted = true;
        addNotoriety(s, NOTORIETY_THEFT);
        s.stats.timesArrested += 1;
        toGaol(s, rng, log);
        if (s.pending) {
          s.screen = 'encounter';
          return;
        }
        if (!s.gameOver) s.screen = screenForLocation(s.location);
        return;
      }
      const loot = rng.int(def.take.lo, def.take.hi);
      s.moneyPence += loot;
      s.stats.takings += loot;
      log.say(action.target === 'store' ? 'steal.store.ok' : 'steal.drunk.ok', { loot: formatMoney(loot) }, 'neutral');
      addJournal(s, `Took ${formatMoney(loot)} that was not yours.`, 'bad');
      addNotoriety(s, NOTORIETY_THEFT);
      // A thief who gets clean away is a thief still, and the name follows him
      // about the port soon enough — which is how the dark ladder is entered.
      if (rng.chance(STEAL_KNOWN_CHANCE)) worsenForCrime(s, log);
      rewardNotice(s, log);
      addHeat(s, heatZoneFor(s), HEAT_PER_CRIME);
      // Watching a store, or a drunk, is a night's work like any other.
      endDay(s, rng, log, {});
      checkGrave(s, rng, log);
      return;
    }

    // --- travel --------------------------------------------------------
    case 'chooseRoute':
      s.screen = 'travel-mode';
      s.journey = {
        route: action.route,
        mode: 'walk',
        daysLeft: 0,
        daysTravelled: 0,
        to: 'fields-town',
        from: s.location,
        salvage: 0,
      };
      return;

    case 'travel': {
      const to: LocationId = s.location === 'suze-port' ? 'fields-town' : 'suze-port';
      s.journey = null;
      if (!beginJourney(s, log, action.route, action.mode, to)) {
        s.screen = screenForLocation(s.location === 'on-road' ? 'suze-port' : s.location);
        return;
      }
      runTask(s, rng, log, { kind: 'travel' });
      return;
    }

    case 'coach': {
      if (s.moneyPence < COACH_FARE) {
        log.raw('Cobb & Co. carry travellers with money, not ordinary diggers.', 'bad');
        return;
      }
      s.moneyPence -= COACH_FARE;
      log.raw(
        'The driver is a Yankee with a long whip, longer pistols and a Bowie knife, and hair enough to frighten a bushranger. The team goes off with mud flying and diggers cursing.',
        'neutral',
      );
      for (let i = 0; i < COACH_DAYS; i++) {
        endDay(s, rng, log, { travelling: true });
        if (s.gameOver || s.endOfYear) return;
      }
      s.location = 'suze-port';
      s.screen = 'suze';
      log.say('travel.arrive.suze', undefined, 'neutral');
      return;
    }

    case 'travelTo': {
      if (action.place === s.location) {
        log.raw('You are standing in it already.', 'neutral');
        return;
      }
      const days = localTravelDays(s, action.place);
      s.journey = {
        route: 'trickeys',
        mode: s.horse !== 'none' ? 'horse' : 'walk',
        daysLeft: days,
        daysTravelled: 0,
        to: action.place,
        from: s.location,
        salvage: 0,
      };
      s.location = 'on-road';
      runTask(s, rng, log, { kind: 'travel' });
      return;
    }

    case 'followRumour': {
      if (!s.secret) {
        log.raw('There is no such talk about just now.', 'neutral');
        return;
      }
      s.secret.chased = true;
      if (!s.secret.genuine) {
        const wasted = rng.int(3, 7);
        for (let i = 0; i < wasted; i++) {
          endDay(s, rng, log, { travelling: true, toil: true });
          if (s.gameOver || s.endOfYear) return;
        }
        log.say('rumour.hoax', undefined, 'bad');
        addJournal(s, `Chased a hoax for ${wasted} days.`, 'bad');
        s.secret = null;
        return;
      }
      s.secretGenuineUsed = true;
      s.secretExpedition = { trail: 0, daysSearched: 0, nuggetFound: false, exhausted: false };
      log.say('rumour.genuine', undefined, 'good');
      s.journey = {
        route: 'pass',
        mode: s.horse !== 'none' ? 'horse' : 'walk',
        daysLeft: localTravelDays(s, 'secret-mine'),
        daysTravelled: 0,
        to: 'secret-mine',
        from: s.location,
        salvage: 0,
      };
      s.location = 'on-road';
      runTask(s, rng, log, { kind: 'travel' });
      return;
    }

    case 'searchSecret': {
      const e = s.secretExpedition;
      if (s.location !== 'secret-mine' || !e || e.exhausted || e.nuggetFound) return;
      if (action.approach === 'dig' && e.trail < 4) {
        log.raw('You have not yet found the black leader named in the scratched direction.', 'bad');
        return;
      }
      e.daysSearched += 1;
      if (action.approach === 'search') {
        if (e.trail < 4) {
          e.trail += 1;
          log.raw([
            'Beyond the fire-hole you find a line of shallow dish-holes, almost erased by weather.',
            'A rusted pick-head lies under a stone cairn. The old party came this way.',
            'The cairn bears a scratched direction: THREE RED GUMS — BLACK LEADER.',
            'At the three dead gums, your pick exposes a seam of blackened quartz. This is the bed named in the story.',
          ][e.trail - 1], 'good');
        } else {
          log.raw('You trench across the leader and narrow the place where the old party stopped.', 'neutral');
        }
      } else if (action.approach === 'winnow') {
        const gold = rng.chance(0.55) ? rng.int(8, 80) : 0;
        if (gold > 0) {
          s.goldCentiOz += gold;
          s.stats.goldWon += gold;
          log.raw(`Hand winnowing leaves ${formatGold(gold)} of ordinary fine gold in the dish.`, 'good');
        } else {
          log.raw('The wind takes the dust and leaves no colour worth keeping.', 'neutral');
        }
      } else {
        const chance = Math.min(0.9, 0.3 + Math.max(0, e.daysSearched - 5) * 0.15);
        if (rng.chance(chance)) {
          const gold = rng.int(60000, 110000);
          e.nuggetFound = true;
          s.goldCentiOz += gold;
          s.stats.goldWon += gold;
          log.raw(`The pick rings on metal. The Southern Cross comes out piece by piece—a single monstrous nugget of ${formatGold(gold)}, too heavy for one man to lift cleanly.`, 'good');
          addJournal(s, `Found The Southern Cross, a giant nugget of ${formatGold(gold)}, at the secret working.`, 'good');
        } else {
          log.raw('The leader pinches, turns and disappears. You widen the hole; the promise survives another day.', 'bad');
        }
      }
      damage(s, rng.int(1, 4), 'the desert search');
      if (!s.gameOver) endDay(s, rng, log, { toil: true });
      if (e.daysSearched >= 10 && !e.nuggetFound) {
        e.exhausted = true;
        log.raw('Ten days of signs and holes end in barren stone. The expedition is over; only the return remains.', 'bad');
      }
      return;
    }

    // --- Fields Town ---------------------------------------------------
    case 'deposit': {
      if (bankRefuses(s)) {
        log.say('bandit.bank.refused', undefined, 'bad');
        return;
      }
      const amount = action.amount < 0 ? s.moneyPence : Math.min(action.amount, s.moneyPence);
      if (amount <= 0) {
        log.raw('You have nothing to deposit.', 'neutral');
        return;
      }
      s.moneyPence -= amount;
      s.bankPence += amount;
      log.raw(
        `The manager writes you up in his ledger at a desk made of remodelled gin cases. ${formatMoney(amount)} deposited; the safe is at the far end, by his bed.`,
        'good',
      );
      return;
    }

    case 'withdraw': {
      if (bankRefuses(s)) {
        log.say('bandit.bank.refused', undefined, 'bad');
        return;
      }
      const amount = action.amount < 0 ? s.bankPence : Math.min(action.amount, s.bankPence);
      if (amount <= 0) {
        log.raw('There is nothing of yours in the safe.', 'neutral');
        return;
      }
      s.bankPence -= amount;
      s.moneyPence += amount;
      log.raw(`You draw out ${formatMoney(amount)}.`, 'neutral');
      return;
    }

    case 'sellGold':
      sellGold(s, rng, log, action.where, action.watch);
      return;

    case 'buyLicence':
      buyLicence(s, log);
      return;

    case 'registerClaim': {
      const claim = s.claims[action.camp];
      if (!claim) {
        log.raw('There is no claim of yours there to enter.', 'neutral');
      } else if (claim.registered) {
        log.raw('That claim is already in the ledger.', 'neutral');
      } else if (s.moneyPence < shillings(5)) {
        log.raw('The clerk wants five shillings for the entry and seal.', 'bad');
      } else {
        s.moneyPence -= shillings(5);
        claim.registered = true;
        log.raw(`The claim is copied into the Council ledger under your name for ${formatMoney(shillings(5))}.`, 'good');
      }
      return;
    }

    case 'guardClaim': {
      const claim = s.claims[action.camp];
      if (!claim) return;
      if (s.moneyPence < shillings(5)) {
        log.raw('The watchman will not stay on promises.', 'bad');
        return;
      }
      s.moneyPence -= shillings(5);
      claim.guardedUntilDay = Math.max(s.day, claim.guardedUntilDay ?? 0) + action.days;
      log.raw(`A watchman takes the claim through day ${claim.guardedUntilDay}.`, 'good');
      return;
    }

    case 'pegClaim':
      if (!isCamp(s.location)) {
        log.raw('You must be on the ground to peg it.', 'bad');
        return;
      }
      pegClaim(s, rng, log, s.location as CampId);
      return;

    case 'abandonClaim':
      if (!isCamp(s.location)) {
        log.raw('You have no ground here to give up.', 'neutral');
        return;
      }
      abandonClaim(s, log, s.location as CampId);
      return;

    case 'prospect': {
      if (!isCamp(s.location)) {
        log.raw('There is nothing here worth trying a dish of.', 'bad');
        return;
      }
      if (s.items.pan < 1) {
        log.raw('You want a pan to try the ground with.', 'bad');
        return;
      }
      const res = prospectDay(s, rng, log);
      if (res.stop === 'trooper') {
        s.screen = 'encounter';
        return;
      }
      if (res.stop === 'dead') return;
      endDay(s, rng, log, { toil: true });
      checkGrave(s, rng, log);
      return;
    }

    case 'complain':
      log.raw(
        rng.pick([
          'The clerk writes your complaint in a fine round hand, blots it, and puts it in a drawer with a great many others.',
          'A councillor hears you out. He owns the store, the hotel and the carting business, and agrees that something ought to be done.',
          'You complain of the state of the roads. So, it appears, has every man in the colony.',
          'You complain of the licence fee. The clerk observes that there will be rebellion soon, and goes back to his ledger.',
        ]),
        'neutral',
      );
      return;

    case 'hospital':
      runTask(s, rng, log, { kind: 'hospital', days: action.days });
      return;

    case 'quack': {
      if (s.moneyPence < QUACK_FEE) {
        log.raw('The "doctor" wants ten pounds before he will open his bag.', 'bad');
        return;
      }
      s.moneyPence -= QUACK_FEE;
      if (rng.chance(0.5)) {
        log.say('health.quack.good', { fee: formatMoney(QUACK_FEE) }, 'good');
        heal(s, rng.int(18, 32));
        if (s.illness && rng.chance(0.6)) s.illness = null;
      } else {
        log.say('health.quack.bad', { fee: formatMoney(QUACK_FEE) }, 'bad');
        damage(s, rng.int(8, 20), 'a camp doctor');
      }
      endDay(s, rng, log, {});
      return;
    }

    // The room reads him, and then serves him (§30.1, priced by §31.4).
    case 'drink': {
      const days = drinkAt(s, rng, log, action.what ?? 'nobbler');
      for (let i = 0; i < days && !s.gameOver && !s.endOfYear; i++) endDay(s, rng, log, {});
      return;
    }

    case 'shoutBar': {
      const result = shoutTheBar(s, rng, log, action.spree);
      for (let i = 0; i < result.days && !s.gameOver && !s.endOfYear; i++) {
        endDay(s, rng, log, {});
      }
      return;
    }

    case 'startGamble': {
      if (action.stake <= 0 || s.moneyPence < action.stake) {
        log.raw('You cannot cover the stake.', 'bad');
        return;
      }
      s.moneyPence -= action.stake;
      s.gambling = {
        game: action.game,
        stake: action.stake,
        pot: 0,
        round: 1,
        hand: rng.int(1, 10),
        tell: rng.pick(['steady', 'eager', 'uneasy'] as const),
      };
      s.screen = action.game === 'twoup' ? 'ftown-twoup' : 'ftown-cards';
      return;
    }

    case 'twoUpCall': {
      const g = s.gambling;
      if (!g || g.game !== 'twoup') return;
      const wager = g.pot > 0 ? g.pot : g.stake;
      const toss = rng.chance(0.5) ? 'heads' : 'tails';
      if (toss === action.side) {
        g.pot = wager * 2;
        g.round += 1;
        log.raw(`${toss.toUpperCase()}. The ring pays, and asks whether it rides again.`, 'good');
      } else {
        s.stats.gamblingNet -= g.stake;
        log.raw(`${toss.toUpperCase()}. Everything left in the ring is gone.`, 'bad');
        s.gambling = null;
        s.screen = 'ftown-gamble';
      }
      return;
    }

    case 'twoUpCollect': {
      const g = s.gambling;
      if (!g || g.game !== 'twoup' || g.pot <= 0) return;
      s.moneyPence += g.pot;
      s.stats.gamblingNet += g.pot - g.stake;
      log.raw(`You rake back ${formatMoney(g.pot)} and leave the spinner to the next man.`, 'good');
      s.gambling = null;
      s.screen = 'ftown-gamble';
      return;
    }

    case 'cardsDecision': {
      const g = s.gambling;
      if (!g || g.game !== 'cards') return;
      let totalRisk = g.stake;
      if (action.choice === 'fold') {
        const saved = Math.floor(g.stake / 2);
        s.moneyPence += saved;
        s.stats.gamblingNet -= g.stake - saved;
        log.raw(`You throw the hand in and save ${formatMoney(saved)} of the stake.`, 'neutral');
      } else {
        if (action.choice === 'raise') {
          if (s.moneyPence < g.stake) return;
          s.moneyPence -= g.stake;
          totalRisk *= 2;
        }
        const opponent = rng.int(1, 10);
        const tellBonus = g.tell === 'uneasy' ? 1 : g.tell === 'eager' ? -1 : 0;
        const player = g.hand + (action.choice === 'bluff' ? rng.int(-2, 4) + tellBonus : 0);
        const won = player >= opponent;
        if (won) {
          const returned = totalRisk * 2;
          s.moneyPence += returned;
          s.stats.gamblingNet += totalRisk;
          log.raw(action.choice === 'bluff' ? 'He looks once more at you, not his cards, and folds.' : `The hands turn over. Yours is good; ${formatMoney(returned)} comes across the table.`, 'good');
        } else {
          s.stats.gamblingNet -= totalRisk;
          log.raw(action.choice === 'bluff' ? 'He calls at once. Your story was better than your cards.' : 'The hands turn over. His is better.', 'bad');
        }
      }
      s.gambling = null;
      s.screen = 'ftown-gamble';
      return;
    }

    case 'gamble': {
      const stake = Math.min(action.stake, s.moneyPence);
      if (stake <= 0) {
        log.raw('You have nothing to stake.', 'bad');
        return;
      }
      // Card sharps seek out a new chum; the parlour plays straight (§30.1).
      const odds = oddsFactor(s, stake);
      if (action.game === 'twoup') {
        if (rng.chance(TWOUP_WIN * odds)) {
          s.moneyPence += stake;
          s.stats.gamblingNet += stake;
          log.say('gamble.twoup.win', { amount: formatMoney(stake) }, 'good');
        } else {
          s.moneyPence -= stake;
          s.stats.gamblingNet -= stake;
          log.say('gamble.twoup.lose', { amount: formatMoney(stake) }, 'bad');
        }
      } else {
        if (rng.chance(CARDS_WIN * odds)) {
          const won = Math.round(stake * CARDS_PAYOUT);
          s.moneyPence += won;
          s.stats.gamblingNet += won;
          log.say('gamble.cards.win', { amount: formatMoney(won) }, 'good');
        } else {
          s.moneyPence -= stake;
          s.stats.gamblingNet -= stake;
          log.say('gamble.cards.lose', { amount: formatMoney(stake) }, 'bad');
        }
      }
      return;
    }

    // --- the diggings ---------------------------------------------------
    case 'mine': {
      if (!isCamp(s.location)) {
        log.raw('There is no gold to be dug here.', 'bad');
        return;
      }
      if (action.method === 'company') {
        runTask(s, rng, log, { kind: 'work', job: 'companyMine', days: action.days });
        return;
      }
      const check = checkMethod(s, action.method);
      if (!check.ok) {
        log.raw(check.reason ?? 'You cannot work that way here.', 'bad');
        return;
      }
      if (action.method === 'puddle' && s.moneyPence < PUDDLER_RENT) {
        log.raw('The machine owner wants five shillings a day in advance.', 'bad');
        return;
      }
      if (!isLicensed(s)) {
        log.raw(
          'You put your pick in the ground without a licence. The troopers hunt diggers here.',
          'bad',
        );
      } else {
        const dying = licenceDiesMidSpell(s, action.days);
        if (dying) log.raw(dying, 'bad');
      }
      runTask(s, rng, log, { kind: 'mine', method: action.method, days: action.days });
      return;
    }

    case 'hireMate':
      hireMate(s, log, action.days);
      return;

    case 'takePartner':
      takePartner(s, log);
      return;

    case 'dissolvePartnership':
      dissolvePartnership(s, log);
      return;

    case 'rentPuddler': {
      const cost = PUDDLER_RENT * action.days;
      if (s.moneyPence < cost) {
        log.raw('Five shillings a day, and you cannot find it.', 'bad');
        return;
      }
      s.moneyPence -= cost;
      s.puddlerUntilDay = Math.max(s.day, s.puddlerUntilDay) + action.days;
      log.raw(`You engage the puddling machine for ${action.days} days, ${formatMoney(cost)}.`, 'neutral');
      return;
    }

    case 'timberShaft':
      if (timberShaft(s, log)) endDay(s, rng, log, { toil: true });
      return;

    case 'abandonShaft':
      if (!s.shaft) {
        log.raw('You have no shaft.', 'neutral');
        return;
      }
      s.shaft = null;
      log.raw('You leave the hole to fill with water and rubbish, as ten thousand others have been left.', 'neutral');
      return;

    case 'buyShares': {
      const n = Math.min(action.n, MAX_SHARES - s.shares);
      const cost = SHARE_PRICE * n;
      if (n <= 0) {
        log.raw('The company will not sell you more than three shares.', 'bad');
        return;
      }
      if (s.moneyPence < cost) {
        log.raw('Five pounds the share, and the clerk will not take less.', 'bad');
        return;
      }
      s.moneyPence -= cost;
      s.shares += n;
      log.say('shares.buy', { n, amount: formatMoney(cost) }, 'neutral');
      addJournal(s, `Took up ${n} share${n === 1 ? '' : 's'} in a company mine.`, 'neutral');
      return;
    }

    case 'rest':
      runTask(s, rng, log, { kind: 'rest', days: action.days });
      return;

    // --- your own company ------------------------------------------------
    case 'floatCompany': {
      if (s.location !== 'deep-mountains' && s.location !== 'fields-town') {
        log.raw(
          'A company is registered at the Council Chambers, or at the company office in the Deep Mountains.',
          'bad',
        );
        return;
      }
      if (floatCompany(s, rng, log, action.shares)) s.screen = 'company';
      return;
    }

    case 'hireCrew':
      hireCrew(s, log);
      return;

    case 'fireCrew':
      fireCrew(s, log);
      return;

    case 'setCrewTask':
      setCrewTask(s, log, action.index, action.task);
      return;

    case 'declareDividend':
      declareDividend(s, log, action.perShare);
      return;

    case 'sellOwnShares':
      sellOwnShares(s, rng, log, action.n);
      if (!s.company) s.screen = screenForLocation(s.location);
      return;

    case 'buyBackShares':
      buyBackShares(s, log, action.n);
      return;

    case 'sellOut':
      if (!s.company) {
        log.raw('You have no company to sell out of.', 'neutral');
        return;
      }
      sellOut(s, log);
      s.screen = screenForLocation(s.location);
      return;

    case 'companyRelations': {
      if (!s.company || s.location !== 'suze-port') return;
      if (s.moneyPence < shillings(10)) {
        log.raw('Calling on men of business costs money before it makes any.', 'bad');
        return;
      }
      s.moneyPence -= shillings(10);
      const gain = rng.int(5, 10) + Math.floor(s.suzeStanding / 20);
      s.company.relations = Math.min(100, (s.company.relations ?? 0) + gain);
      log.raw(`A day of offices, coffee rooms and introductions improves the company's port relations by ${gain}.`, 'good');
      endDay(s, rng, log, {});
      return;
    }

    case 'companySupplyContract':
      if (!s.company || s.location !== 'suze-port') return;
      if (s.moneyPence < pounds(4)) {
        log.raw('The shipping agent wants four pounds against the contract.', 'bad');
        return;
      }
      s.moneyPence -= pounds(4);
      s.company.supplyContractUntilDay = s.day + 27;
      s.company.relations = Math.min(100, (s.company.relations ?? 0) + 3);
      log.raw('Freight and stores are contracted at the port for four weeks; weekly working costs fall ten per cent.', 'good');
      endDay(s, rng, log, {});
      return;

    // --- the civic ladder (§26-§28) --------------------------------------
    case 'buyShamrock':
      buyShamrock(s, log);
      return;

    case 'openStore':
      openStore(s, log, action.camp);
      return;

    case 'setStorePolicy':
      setStorePolicy(s, log, action.policy);
      return;

    case 'buyGazetteShare':
      buyGazetteShare(s, log);
      return;

    case 'placeStory': {
      // Setting a story costs the day it takes to write, set and print it.
      if (!placeStory(s, rng, log, action.kind, action.camp)) return;
      endDay(s, rng, log, {});
      checkGrave(s, rng, log);
      if (!s.gameOver && !s.endOfYear) s.screen = screenForLocation(s.location);
      return;
    }

    case 'subscribeWork':
      subscribeWork(s, log, action.work, action.camp);
      return;

    case 'acceptCommission':
      acceptCommission(s, log);
      return;

    case 'holdCourt': {
      if (!holdCourt(s, log)) return;
      endDay(s, rng, log, {});
      checkGrave(s, rng, log);
      if (s.gameOver || s.endOfYear) return;
      s.screen = 'court';
      return;
    }

    case 'rule':
      if (s.screen !== 'court') {
        log.raw('The court is not sitting.', 'neutral');
        return;
      }
      ruleOn(s, log, action.ruling);
      s.screen = screenForLocation(s.location);
      return;

    case 'buyShanty':
      if (!isCamp(s.location)) {
        log.raw('Sly grog is sold at the diggings, not in a town with a licensed house in it.', 'bad');
        return;
      }
      buyShanty(s, log, s.location as CampId);
      return;

    case 'retainLawyer':
      retainLawyer(s, log);
      return;

    // --- the dark ladder (§23-§24) --------------------------------------
    case 'bailUp': {
      const gate = canBailUp(s);
      if (!gate.ok) {
        log.raw(`${gate.note.charAt(0).toUpperCase()}${gate.note.slice(1)}.`, 'bad');
        return;
      }
      if (s.location === 'on-road') {
        log.raw('You are on the road already, and going somewhere.', 'neutral');
        return;
      }
      const from = s.location;
      lurk(s, rng, log, action.route);
      endDay(s, rng, log, { toil: true });
      checkGrave(s, rng, log);
      if (s.gameOver || s.endOfYear) return;
      // He rides back to whatever roof he keeps; the road is a day's work.
      s.location = from;
      if (s.pending) s.screen = 'encounter';
      return;
    }

    case 'makeHideout': {
      if (!makeHideout(s, log)) return;
      for (let i = 0; i < HIDEOUT_DAYS; i++) {
        endDay(s, rng, log, { toil: true });
        if (s.gameOver || s.endOfYear) return;
      }
      s.location = 'hideout';
      s.screen = 'hideout';
      return;
    }

    case 'stash':
      stash(s, log, action.what, action.amount);
      return;

    case 'unstash':
      unstash(s, log, action.what, action.amount);
      return;

    case 'recruitGangMember':
      recruitGangMember(s, rng, log);
      return;

    case 'dismissGangMember':
      dismissGangMember(s, log, action.index);
      return;

    case 'gatherIntelligence': {
      if (!crimeVisible(s)) {
        log.raw('The harbourers keep their words for men they know.', 'bad');
        return;
      }
      if (!gatherIntelligence(s, rng, log)) return;
      endDay(s, rng, log, {});
      checkGrave(s, rng, log);
      return;
    }

    case 'fenceGold':
      fenceGold(s, rng, log);
      return;

    case 'robBank': {
      if (!robBank(s, rng, log)) return;
      endDay(s, rng, log, { toil: true });
      checkGrave(s, rng, log);
      if (s.pending) s.screen = 'encounter';
      return;
    }

    case 'robEscort': {
      if (!robEscort(s, rng, log)) return;
      for (let i = 0; i < ROB_ESCORT_DAYS; i++) {
        endDay(s, rng, log, { toil: true });
        if (s.gameOver || s.endOfYear) return;
      }
      checkGrave(s, rng, log);
      if (s.pending) s.screen = 'encounter';
      return;
    }

    case 'buyPassage':
      buyPassage(s, rng, log);
      if (s.pending) s.screen = 'encounter';
      return;

    // --- encounters when nothing is pending -----------------------------
    case 'bribe':
    case 'submit':
    case 'resist':
    case 'flee':
    case 'bailUpTake':
    case 'letPass':
    case 'breakGaol':
    case 'awaitAssizes':
    case 'takePardon':
    case 'watchWeighing':
    case 'attendMeeting':
    case 'joinStockade':
    case 'keepClear':
    case 'sellSupplies':
      return;
  }
}

/** Convenience for tests and bots: worth at the end of the year. */
export function finalWorth(state: GameState): number {
  return netWorth(state);
}

export const _internal = {
  runTask,
  screenForLocation,
  contract,
  CAMP_DEFS,
  shillings,
};
