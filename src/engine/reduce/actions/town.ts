import { QUACK_FEE } from '../../constants';
import { endDay } from '../../daily';
import { damage, heal } from '../../health';
import { bankRefuses } from '../../market';
import { prospectDay } from '../../mining';
import { formatMoney, shillings } from '../../money';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { isCamp } from '../../state';
import type { Action, GameState } from '../../types';
import { checkGraveAfter } from '../tasks';

// ---------------------------------------------------------------------------
// Slateford: the bank, the claim ledger, a dish of the ground, the quack.
// ---------------------------------------------------------------------------

export function deposit(s: GameState, log: Log, action: Extract<Action, { type: 'deposit' }>): void {
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
}

export function withdraw(s: GameState, log: Log, action: Extract<Action, { type: 'withdraw' }>): void {
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
}

export function registerClaim(s: GameState, log: Log, action: Extract<Action, { type: 'registerClaim' }>): void {
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
}

export function guardClaim(s: GameState, log: Log, action: Extract<Action, { type: 'guardClaim' }>): void {
  const claim = s.claims[action.camp];
  if (!claim) return;
  if (s.moneyPence < shillings(5)) {
    log.raw('The watchman will not stay on promises.', 'bad');
    return;
  }
  s.moneyPence -= shillings(5);
  claim.guardedUntilDay = Math.max(s.day, claim.guardedUntilDay ?? 0) + action.days;
  log.raw(`A watchman takes the claim through day ${claim.guardedUntilDay}.`, 'good');
}

export function prospect(s: GameState, rng: RNG, log: Log): void {
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
  checkGraveAfter(s, rng, log);
}

export function quack(s: GameState, rng: RNG, log: Log): void {
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
}
