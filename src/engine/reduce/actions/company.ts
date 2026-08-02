import { floatCompany } from '../../company';
import { endDay } from '../../daily';
import { pounds, shillings } from '../../money';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import type { Action, GameState } from '../../types';

// ---------------------------------------------------------------------------
// Your own company: floating it, and the port's good opinion.
// ---------------------------------------------------------------------------

export function floatCompanyAction(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'floatCompany' }>): void {
  if (s.location !== 'deep-mountains' && s.location !== 'fields-town') {
    log.raw(
      'A company is registered at the Council Chambers, or at the company office in the Blackcap Ranges.',
      'bad',
    );
    return;
  }
  if (floatCompany(s, rng, log, action.shares)) s.screen = 'company';
}

export function companyRelations(s: GameState, rng: RNG, log: Log): void {
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
}

export function companySupplyContract(s: GameState, rng: RNG, log: Log): void {
  if (!s.company || s.location !== 'suze-port') return;
  if ((s.company.supplyContractUntilDay ?? 0) >= s.day) {
    log.raw(`The company is already supplied through day ${s.company.supplyContractUntilDay}.`, 'neutral');
    return;
  }
  if (s.moneyPence < pounds(4)) {
    log.raw('The shipping agent wants four pounds against the contract.', 'bad');
    return;
  }
  s.moneyPence -= pounds(4);
  s.company.supplyContractUntilDay = s.day + 27;
  s.company.relations = Math.min(100, (s.company.relations ?? 0) + 3);
  log.raw('Freight and stores are contracted at the port for four weeks; weekly working costs fall ten per cent.', 'good');
  endDay(s, rng, log, {});
}
