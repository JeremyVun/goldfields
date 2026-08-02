import { BUSH_ESCAPE, NOTORIETY_ESCAPE } from '../constants';
import {
  assizes,
  breakGaol,
  canBreakGaol,
  escapeChance,
  gainBush,
  makeOutlaw,
  resolveBailUp,
  rewardNotice,
  worsenForCrime,
} from '../bandit';
import { endDay } from '../daily';
import { damage } from '../health';
import { toGaol } from '../law';
import { formatMoney } from '../money';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import { addNotoriety, bushRankOf } from '../state';
import type { Action, CampId, GameState, Pending } from '../types';
import { resumePending } from './encounters';
import { screenForLocation } from './screen';
import { advanceKept } from './tasks';

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
export function handlePatrolChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
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
    toGaol(state, rng, log, (days) => advanceKept(state, rng, log, days));
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
    toGaol(state, rng, log, (days) => advanceKept(state, rng, log, days));
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
export function handleBailUpChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
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

export function handleAssizesChoice(state: GameState, rng: RNG, log: Log, action: Action): void {
  if (action.type === 'breakGaol' && canBreakGaol(state)) {
    if (breakGaol(state, rng, log)) {
      state.resumeTask = null;
      return;
    }
    // The file broke, or the man outside did not come. The sentence doubles.
    assizes(state, log, true, rng, (days) => advanceKept(state, rng, log, days));
  } else {
    assizes(state, log, false, rng, (days) => advanceKept(state, rng, log, days));
  }
  state.pending = null;
  state.resumeTask = null;
  if (!state.gameOver) state.screen = screenForLocation(state.location);
}

export function handleClaimJumper(state: GameState, rng: RNG, log: Log, action: Action): void {
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
  let won: boolean;
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
