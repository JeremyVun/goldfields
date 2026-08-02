/** What is sold over a bar, in the hotel and in the grog tent alike (§30, §31.4). */

import {
  OWN_HOUSE_SHOUT_FACTOR,
  SHOUT_CAP_DAYS,
  SHOUT_HEADS,
  SHOUT_HEAD_COST,
  SPREE_COST,
} from '../constants';
import { drinkPrice, ownsThisHouse, ownsThisShanty, receptionTier } from '../shamrock';
import { formatMoney } from '../money';
import type { DrinkId, GameState, MenuItem } from '../types';
import { item } from './shared';

/** What is over the counter, at this house's prices (§31.4). */
const DRINK_ORDER: { id: DrinkId; label: string; note: string }[] = [
  { id: 'nobbler', label: 'A nobbler of brandy', note: 'the digger\'s measure' },
  { id: 'ale', label: 'A pot of ale', note: 'and the talk of the field' },
  { id: 'bottle', label: 'A bottle of ale or porter', note: 'bottled, and dearer for it' },
  { id: 'champagne', label: 'Champagne, the bottle', note: 'gold-mad, and they will not forget it' },
];

export function drinkMenu(state: GameState, keys: string): MenuItem[] {
  return DRINK_ORDER.map((d, i) => {
    const price = drinkPrice(state, d.id);
    return item(
      keys[i],
      `${d.label} — ${formatMoney(price)}`,
      { type: 'drink', what: d.id },
      receptionTier(state) === 'chum' && d.id === 'nobbler'
        ? 'watered, and you will not be the one to say so'
        : d.note,
      state.moneyPence < price,
    );
  });
}

/** Shouting the bar, and the whole gold-mad performance (§30.2). */
export function shoutMenu(state: GameState, keys: string): MenuItem[] {
  const own = ownsThisHouse(state);
  const band = state.location === 'fields-town' ? SHOUT_HEADS.town : SHOUT_HEADS.camp;
  const lo = SHOUT_HEAD_COST * band.lo * (own ? OWN_HOUSE_SHOUT_FACTOR : 1);
  const hi = SHOUT_HEAD_COST * band.hi * (own ? OWN_HOUSE_SHOUT_FACTOR : 1);
  const spreeLo = SPREE_COST.lo * (own ? OWN_HOUSE_SHOUT_FACTOR : 1);
  const spreeHi = SPREE_COST.hi * (own ? OWN_HOUSE_SHOUT_FACTOR : 1);
  const capped =
    state.estate.shoutedOn > 0 && state.day - state.estate.shoutedOn < SHOUT_CAP_DAYS;
  return [
    item(
      keys[0],
      `Shout the room — ${formatMoney(lo)} to ${formatMoney(hi)}`,
      { type: 'shoutBar', spree: false },
      ownsThisShanty(state)
        ? 'your own men, your own rum: it buys loyalty, not a name'
        : capped
          ? 'you shouted within the fortnight; they will drink it and remember nothing'
          : `two shillings a head${own ? ', at your own wholesale price' : ''}`,
      state.moneyPence < lo,
    ),
    item(
      keys[1],
      `The spree — ${formatMoney(spreeLo)} to ${formatMoney(spreeHi)}`,
      { type: 'shoutBar', spree: true },
      'champagne for the house and the fiddler paid till dawn; tomorrow is lost',
      state.moneyPence < spreeLo,
    ),
  ];
}
