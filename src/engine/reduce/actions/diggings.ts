import { PUDDLER_RENT } from '../../constants';
import { checkMethod, licenceDiesMidSpell } from '../../mining';
import { formatMoney } from '../../money';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { isCamp, isLicensed } from '../../state';
import type { Action, GameState } from '../../types';
import { runTask } from '../tasks';

// ---------------------------------------------------------------------------
// The diggings: a spell at the face, and the puddling machine.
// ---------------------------------------------------------------------------

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
