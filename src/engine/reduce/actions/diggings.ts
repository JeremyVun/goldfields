import { PUDDLER_RENT } from '../../constants';
import { abandonClaim, checkMethod, licenceDiesMidSpell, pegClaim } from '../../mining';
import { formatMoney } from '../../money';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { isCamp, isLicensed } from '../../state';
import type { Action, CampId, GameState } from '../../types';
import { runTask } from '../tasks';

// ---------------------------------------------------------------------------
// The diggings: pegging ground, a spell at the face, and the puddling machine.
// ---------------------------------------------------------------------------

export function pegClaimAction(s: GameState, rng: RNG, log: Log): void {
  if (!isCamp(s.location)) {
    log.raw('You must be on the ground to peg it.', 'bad');
    return;
  }
  pegClaim(s, rng, log, s.location as CampId);
}

export function abandonClaimAction(s: GameState, log: Log): void {
  if (!isCamp(s.location)) {
    log.raw('You have no ground here to give up.', 'neutral');
    return;
  }
  abandonClaim(s, log, s.location as CampId);
}

export function abandonShaft(s: GameState, log: Log): void {
  if (!s.shaft) {
    log.raw('You have no shaft.', 'neutral');
    return;
  }
  s.shaft = null;
  log.raw('You leave the hole to fill with water and rubbish, as ten thousand others have been left.', 'neutral');
}

export function mine(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'mine' }>): void {
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
}

export function rentPuddler(s: GameState, log: Log, action: Extract<Action, { type: 'rentPuddler' }>): void {
  const cost = PUDDLER_RENT * action.days;
  if (s.moneyPence < cost) {
    log.raw('Five shillings a day, and you cannot find it.', 'bad');
    return;
  }
  s.moneyPence -= cost;
  s.puddlerUntilDay = Math.max(s.day, s.puddlerUntilDay) + action.days;
  log.raw(`You engage the puddling machine for ${action.days} days, ${formatMoney(cost)}.`, 'neutral');
}
