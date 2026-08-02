import type { Action } from '../types';

function positiveInt(value: number, max = 365): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= max;
}

function nonNegativeIndex(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Runtime trust boundary for the exported reducer; TypeScript is not present in saves or callers. */
export function actionPayloadValid(action: Action): boolean {
  switch (action.type) {
    case 'work': case 'hospital': case 'mine': case 'hireMate': case 'rentPuddler':
    case 'rest': case 'guardClaim':
      return positiveInt(action.days);
    case 'buyProvisions':
      return positiveInt(action.weeks, 12);
    case 'buy':
      return action.qty === undefined || positiveInt(action.qty, 100);
    case 'gamble': case 'startGamble':
      return positiveInt(action.stake, 1_000_000_000);
    case 'sellOwnShares': case 'buyBackShares':
      return positiveInt(action.n, 20);
    case 'declareDividend': case 'sendRemittance':
      return positiveInt(action.type === 'declareDividend' ? action.perShare : action.amount, 1_000_000_000);
    case 'setCrewTask':
      return nonNegativeIndex(action.index) && (action.lease === undefined || nonNegativeIndex(action.lease));
    case 'setLeasePlan': case 'installPlant': case 'abandonLease':
      return nonNegativeIndex(action.lease);
    case 'dismissGangMember':
      return nonNegativeIndex(action.index);
    case 'deposit': case 'withdraw': case 'stash': case 'unstash':
      return action.amount === -1 || positiveInt(action.amount, 1_000_000_000);
    case 'homeStash': case 'homeUnstash':
      return positiveInt(action.amount, 1_000_000_000);
    case 'newGame':
      return action.seed === undefined || nonNegativeIndex(action.seed);
    default:
      return true;
  }
}
