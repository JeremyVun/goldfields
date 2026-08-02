/** The storekeeper's counter, which stands at the port, in the town and at every camp. */

import {
  ITEM_HINTS,
  ITEM_NAMES,
  briggsDiscountLabel,
  greensPrice,
  isGouged,
  priceOf,
  provisionsNote,
  provisionsQuote,
  rateAt,
  waterPrice,
} from '../market';
import { formatGold, formatMoney } from '../money';
import { isCamp, titleCase } from '../state';
import type { AsidePanel, GameState, ItemId, MenuItem, ScreenView } from '../types';
import { item, warned, back } from './shared';

export const STORE_ORDER: ItemId[] = [
  'pan',
  'cradle',
  'pick',
  'shovel',
  'ropeBucket',
  'tent',
  'swag',
  'gun',
  'waterBags',
  'barrow',
  'timber',
  'pump',
  'journal',
];

/**
 * One key to one article of trade, wherever the store stands. The list itself
 * shifts — no timber at the port, no greens in a camp — so a counted-off key
 * would move the pick under a man's finger from one store to the next.
 */
export const STORE_KEYS: Record<ItemId, string> = {
  pan: 'P',
  cradle: 'C',
  pick: 'K',
  shovel: 'H',
  ropeBucket: 'R',
  tent: 'T',
  swag: 'G',
  gun: 'N',
  waterBags: 'B',
  barrow: 'A',
  timber: 'I',
  pump: 'U',
  journal: 'J',
};

export function storeMenu(state: GameState, homeScreen: ScreenView['screen']): MenuItem[] {
  const menu: MenuItem[] = [];
  const oneWeek = provisionsQuote(state, 1);
  const fourWeeks = provisionsQuote(state, 4);
  for (const it of STORE_ORDER) {
    if ((it === 'timber' || it === 'pump') && state.location === 'suze-port') continue;
    const price = priceOf(state, it);
    const held = state.items[it];
    menu.push(
      warned(
        STORE_KEYS[it],
        `${titleCase(ITEM_NAMES[it])} — ${formatMoney(price)}`,
        { type: 'buy', item: it },
        isGouged(state, it)
          ? 'gouged today'
          : held > 0
            ? `you have ${held}`
            : undefined,
        ITEM_HINTS[it],
        state.moneyPence < price,
      ),
    );
  }
  // The storekeeper's long word on flour and bread is flavour and belongs on
  // the highlight line; only an empty swag is a warning worth the row.
  menu.push(
    warned('1', `${oneWeek.days === 7 ? "A week's" : `${oneWeek.days} days'`} provisions — ${formatMoney(oneWeek.cost)}`, {
      type: 'buyProvisions',
      weeks: 1,
    }, state.provisionDays <= 3 ? `${state.provisionDays} days left` : undefined,
      provisionsNote(state) ?? `${state.provisionDays} days of food in the swag`),
  );
  menu.push(
    item('4', `${fourWeeks.days === 28 ? "Four weeks'" : `${fourWeeks.days} days'`} provisions — ${formatMoney(fourWeeks.cost)}`, {
      type: 'buyProvisions',
      weeks: 4,
    }, fourWeeks.days === 28 ? 'ten per cent off a full four-week order' : 'a cap-aware top-up; you pay only for what fits', fourWeeks.days <= 0),
  );
  menu.push(
    warned('F', `Fill the water bags — ${formatMoney(waterPrice(state))}`, { type: 'fillWater' },
      state.items.waterBags < 1 ? 'you have no water bags' : undefined,
      `${state.waterDays} days of water`,
      state.items.waterBags < 1),
  );
  if (state.location === 'fields-town' || state.location === 'suze-port') {
    menu.push(
      item(
        'E',
        state.location === 'fields-town'
          ? `Greens from Lin Wu's garden — ${formatMoney(greensPrice(state))}`
          : `A basket of greens from the market — ${formatMoney(greensPrice(state))}`,
        { type: 'buyGreens' },
        `${state.daysWithoutGreens} days since you ate a vegetable`,
      ),
    );
  }
  if (state.location === 'suze-port' && state.salvage > 0) {
    menu.push(item('Y', `Sell ${state.salvage} scavenged chest${state.salvage === 1 ? '' : 's'}`, { type: 'sellSalvage' },
      'he asks where they came from, and does not wait for the answer'));
  }
  if (isCamp(state.location)) {
    menu.push(
      item('S', 'Sell all your gold here', { type: 'sellGold', where: 'camp', watch: false }, 'a poor camp rate, and his hand may be light on the scales', state.goldCentiOz <= 0),
      item('W', 'Watch the scales while he buys your gold', { type: 'sellGold', where: 'camp', watch: true }, 'the same poor rate, but much less chance of being short-weighted', state.goldCentiOz <= 0),
    );
  }
  const owned = STORE_ORDER.some((it) => state.items[it] > 0);
  menu.push(
    item('V', 'Sell your goods back', { type: 'goto', screen: 'store-sell' },
      owned ? 'second-hand kit fetches a quarter of its port price' : 'you have nothing he would want', !owned),
  );
  menu.push(back(homeScreen));
  return menu;
}

/**
 * The ledger kept open on the counter. Everything a man weighs a purchase
 * against, so that buying a pick does not mean shutting the store to go and
 * count his provisions in the menu.
 */
export function storeAside(state: GameState): AsidePanel {
  const rows: AsidePanel['rows'] = [
    { label: 'In hand', value: formatMoney(state.moneyPence) },
  ];
  if (state.bankPence > 0) rows.push({ label: 'In the bank', value: formatMoney(state.bankPence) });
  rows.push({ label: 'Gold', value: formatGold(state.goldCentiOz) });
  rows.push({
    label: 'Gold buyer',
    value: isCamp(state.location) ? `${formatMoney(rateAt(state, state.location))} the ounce here` : 'the bank pays best',
  });
  if (state.location === 'suze-port' || state.location === 'fields-town') {
    rows.push({ label: 'Bell standing', value: briggsDiscountLabel(state) });
  }
  rows.push({
    label: 'Provisions',
    value: `${state.provisionDays} days`,
    tone: state.provisionDays <= 3 ? 'bad' : state.provisionDays >= 14 ? 'good' : undefined,
  });
  rows.push({
    label: 'Water',
    value: state.items.waterBags > 0 ? `${state.waterDays} days` : 'no bags',
    tone: state.items.waterBags < 1 || state.waterDays <= 2 ? 'bad' : undefined,
  });
  const owned = STORE_ORDER.filter((i) => state.items[i] > 0);
  rows.push({
    label: 'You carry',
    value: owned.length
      ? owned.map((i) => `${ITEM_NAMES[i]}${state.items[i] > 1 ? ` ×${state.items[i]}` : ''}`).join(', ')
      : 'nothing but what you stand in',
  });
  return { title: 'Your account', rows };
}
