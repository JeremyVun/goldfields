import { CAMP_DEFS } from '../constants';
import { contract } from '../health';
import { shillings } from '../money';
import { netWorth } from '../state';
import type { GameState } from '../types';
import { screenForLocation } from './screen';
import { runTask } from './tasks';

export { step } from './dispatch';
export { screenForLocation } from './screen';

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
