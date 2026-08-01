import type { GameState } from './types';

/** Clean money available across the pocket and bank. */
export function availableFunds(state: Pick<GameState, 'moneyPence' | 'bankPence'>): number {
  return state.moneyPence + state.bankPence;
}

/** Pay cash first and then the bank, atomically; leave both unchanged on refusal. */
export function debitFunds(
  state: Pick<GameState, 'moneyPence' | 'bankPence'>,
  amount: number,
): boolean {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) return false;
  if (availableFunds(state) < amount) return false;
  const fromHand = Math.min(amount, state.moneyPence);
  state.moneyPence -= fromHand;
  state.bankPence -= amount - fromHand;
  return true;
}
