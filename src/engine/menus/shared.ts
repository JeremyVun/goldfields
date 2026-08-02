/**
 * The pieces every screen is built out of: a menu row, the Back key, the
 * letters a menu may use, and the few phrasings more than one family needs.
 */

import { isCamp } from '../state';
import { season } from '../time';
import type { Action, BushRank, GameState, MenuItem, ScreenView } from '../types';

export function item(key: string, label: string, action: Action, note?: string, disabled?: boolean): MenuItem {
  return { key, label, action, note, disabled };
}

export function isMenuItem(value: MenuItem | null): value is MenuItem {
  return value !== null;
}

/** Letters available to menus after reserving M for the global map shortcut. */
export const MENU_LETTERS = 'ABCDEFGHIJKLNOPQRSTUVWXYZ'.split('');

/** Same, with a warning that must stay in the row rather than on the highlight. */
export function warned(
  key: string,
  label: string,
  action: Action,
  alert: string | undefined,
  note?: string,
  disabled?: boolean,
): MenuItem {
  return { key, label, action, note, alert, disabled };
}

export const back = (screen: ScreenView['screen']): MenuItem =>
  item('0', 'Back', { type: 'goto', screen });

/** Where a player standing at `loc` belongs when no particular screen applies. */
export function homeScreenFor(state: GameState): ScreenView['screen'] {
  if (state.location === 'suze-port') return 'suze';
  if (state.location === 'hideout') return 'hideout';
  if (state.location === 'secret-mine') return 'secret-expedition';
  if (isCamp(state.location)) return 'camp';
  return 'ftown';
}

export function bushArticle(rank: BushRank): string {
  return rank === 'captain' ? 'a captain' : rank === 'flash cove' ? 'a flash cove' : 'a new chum';
}

export function lodgingWord(state: GameState, location: 'suze-port' | 'fields-town'): string {
  const lodging = location === 'fields-town' ? state.slatefordLodging : state.lodging;
  switch (lodging) {
    case 'inn':
      return 'the inn dormitory, 10s a night';
    case 'stable':
      return 'a stable, 5s a night';
    case 'tentground':
      return 'rented tent ground, 5s a week';
    default:
      return 'sleeping rough';
  }
}

/** One ruled line of a tally sheet: label, leader dots, figure. */
export function tally(label: string, value: string): string {
  return `${label} ${'.'.repeat(Math.max(2, 24 - label.length - 1))} ${value}`;
}

export function seasonOf(state: GameState) {
  return season(state.day);
}
