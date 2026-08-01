import { JOURNAL_SECTIONS } from '../content/library';
import { hasKey, sayFixed } from '../content/say';
import { agitationWord, canSellSupplies, epilogueFor } from './agitation';
import {
  canBailUp,
  canBigJob,
  canBreakGaol,
  canBuyPassage,
  canMakeHideout,
  canRecruit,
  crimeVisible,
  fenceRate,
  intelCost,
} from './bandit';
import {
  canFloat,
  floatRequirements,
  leaseWord,
  purse,
  subscriptionCost,
} from './company';
import {
  BAILUP_VICTIMS,
  CAMP_DEFS,
  COACH_FARE,
  COMPANY_CREW_WAGES,
  COMPANY_FLOAT_STANDING,
  COMPANY_MAX_CREWS,
  COMPANY_REGISTRATION_FEE,
  COMPANY_SHARES,
  COMPANY_SUBSCRIPTIONS,
  HORSE_PRICE,
  HOSPITAL_FEE_PER_DAY,
  JOBS,
  LICENCE_COST,
  MATE_WAGE,
  MAX_SHARES,
  MINERS_RIGHT_COST,
  OWN_HOUSE_SHOUT_FACTOR,
  PARLOUR_STAKES,
  PUDDLER_RENT,
  QUACK_FEE,
  ROUTES,
  SECRET_TRAVEL_DAYS,
  SHARE_PRICE,
  SHOUT_CAP_DAYS,
  SHOUT_HEADS,
  SHOUT_HEAD_COST,
  SPREE_COST,
  STANDING_COUNCIL_JOB,
  GANG_MAX,
  PASSAGE_FARE,
  STANDING_PARTNER,
  STOCKADE_CAMP,
  WAGON_FARE,
  WORTH_SPARK_WIDTH,
  GAZETTE_SHARE_PRICE,
  JP_FEE,
  LAWYER_FEE,
  SHAMROCK_PRICE,
  SHANTY_NOTORIETY,
  SHANTY_PRICE,
  STORE_PRICE,
  STORE_STOCK_PRICE,
  STORY_COOLDOWN_DAYS,
  WORK_DEFS,
} from './constants';
import {
  canTakeCommission,
  commissionRequirements,
  courtDocket,
  courtDue,
  daysToNextStory,
  estateDeeds,
  estateWeeklyIncome,
  gazetteRequirements,
  isJP,
  plaqueLine,
  shamrockRequirements,
  storeRequirements,
  storyDue,
  WORK_NAMES,
} from './estate';
import { ILLNESS_NAMES, hospitalFee } from './health';
import {
  ITEM_HINTS,
  ITEM_NAMES,
  briggsDiscountLabel,
  buybackPriceOf,
  greensPrice,
  isGouged,
  priceOf,
  provisionsNote,
  provisionsQuote,
  rateAt,
  rateTrendPhrase,
  waterPrice,
} from './market';
import { METHOD_NAMES, checkMethod, hasMate, isWorkedOut, seasonEffect } from './mining';
import {
  drinkPrice,
  ownsThisHouse,
  ownsThisShanty,
  parlourOpen,
  receptionLine,
  receptionTier,
} from './shamrock';
import { formatGold, formatMoney, pounds, shillings } from './money';
import { campTalk, gazetteFor } from './news';
import {
  bushRankOf,
  companyWorth,
  estateWorth,
  healthWord,
  heatOf,
  heatWord,
  notorietyPhrase,
  rewardFor,
  stashWorth,
  inAftermath,
  isCamp,
  isLicensed,
  licenceWord,
  locationName,
  shaftRank,
  standingPhrase,
  statusLine,
  titleCase,
  washRank,
} from './state';
import { formatDate, season, seasonPhrase } from './time';
import { localTravelDays, planJourney } from './travel';
import type {
  Action,
  AsidePanel,
  AsideRow,
  BushRank,
  CampId,
  DrinkId,
  GameState,
  HeatZone,
  ItemId,
  MenuItem,
  MiningMethod,
  Route,
  ScreenView,
  SkillRank,
  WorkId,
} from './types';

function item(key: string, label: string, action: Action, note?: string, disabled?: boolean): MenuItem {
  return { key, label, action, note, disabled };
}

/** Letters available to menus after reserving M for the global map shortcut. */
export const MENU_LETTERS = 'ABCDEFGHIJKLNOPQRSTUVWXYZ'.split('');

/** Same, with a warning that must stay in the row rather than on the highlight. */
function warned(
  key: string,
  label: string,
  action: Action,
  alert: string | undefined,
  note?: string,
  disabled?: boolean,
): MenuItem {
  return { key, label, action, note, alert, disabled };
}

const back = (screen: ScreenView['screen']): MenuItem =>
  item('0', 'Back', { type: 'goto', screen });

function horseReport(state: GameState, kind: 'brumby' | 'hack'): string {
  const name = kind === 'brumby' ? 'Rough-coated bay' : 'Tall chestnut';
  const seen = (state.horseInspection[kind] ?? 0) + Math.floor(state.horseKnowledge / 5);
  if (seen <= 0) return `${name}: glossy sales talk and little else to judge by.`;
  if (seen === 1) {
    return kind === 'brumby'
      ? `${name}: plain-looking, sound feet, and used to scant feed.`
      : `${name}: long-striding and quick, though the near forefoot looks tender.`;
  }
  return kind === 'brumby'
    ? `${name}: moderate speed; exceptional endurance, footing and water sense.`
    : `${name}: exceptional speed on a made road; fair endurance, poor footing and water sense.`;
}

/** What is over the counter, at this house's prices (§31.4). */
const DRINK_ORDER: { id: DrinkId; label: string; note: string }[] = [
  { id: 'nobbler', label: 'A nobbler of brandy', note: 'the digger\'s measure' },
  { id: 'ale', label: 'A pot of ale', note: 'and the talk of the field' },
  { id: 'bottle', label: 'A bottle of ale or porter', note: 'bottled, and dearer for it' },
  { id: 'champagne', label: 'Champagne, the bottle', note: 'gold-mad, and they will not forget it' },
];

function drinkMenu(state: GameState, keys: string): MenuItem[] {
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
function shoutMenu(state: GameState, keys: string): MenuItem[] {
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

const STORE_ORDER: ItemId[] = [
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
const STORE_KEYS: Record<ItemId, string> = {
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

function storeMenu(state: GameState, homeScreen: ScreenView['screen']): MenuItem[] {
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
 * count his provisions in the kitty.
 */
function storeAside(state: GameState): AsidePanel {
  const rows: AsidePanel['rows'] = [
    { label: 'In hand', value: formatMoney(state.moneyPence) },
  ];
  if (state.bankPence > 0) rows.push({ label: 'In the bank', value: formatMoney(state.bankPence) });
  rows.push({ label: 'Gold', value: formatGold(state.goldCentiOz) });
  rows.push({ label: 'Gold buyer', value: 'the bank only' });
  if (state.location === 'suze-port' || state.location === 'fields-town') {
    rows.push({ label: 'Briggs standing', value: briggsDiscountLabel(state) });
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


/**
 * The way onto the dark ladder, offered at every hub. Before a man is a minor
 * criminal it is greyed with the reason, which is how this game teaches
 * everything else it teaches (§23.1).
 */
function banditEntry(state: GameState, key: string): MenuItem {
  const open = crimeVisible(state);
  return item(
    key,
    open ? 'Business of another kind' : 'The men in the back room',
    { type: 'goto', screen: 'bandit' },
    open
      ? state.outlawed
        ? 'the roads, the ranges, and the gold escort'
        : 'the roads, and the men who make a living off them'
      : 'they stop talking when you come in; nobody trusts a man with a clean sheet',
    !open,
  );
}

/**
 * The way onto the civic ladder, offered at every hub the way the dark one is
 * (§26). A man with nothing sees what the deeds would cost him.
 */
function estateEntry(state: GameState, key: string): MenuItem {
  const e = state.estate;
  const held = estateDeeds(state).length + e.works.length;
  return item(
    key,
    held > 0 ? 'Your property in the district' : 'What a man of property may buy here',
    { type: 'goto', screen: 'estate' },
    e.jpSince !== null
      ? 'deeds, subscriptions, and the business of the Bench'
      : held > 0
        ? 'deeds, the store\'s prices, and the paper'
        : 'a hotel, a store, a half-share in the Angus; standing buys what money cannot',
  );
}

/**
 * The house itself, offered where the house stands (§26). The one deed a man
 * buys at a bar: Mrs. Doyle names her price, and afterwards the same key opens
 * his own books rather than a second door to the same room.
 */
function shamrockEntry(state: GameState, key: string): MenuItem {
  if (state.estate.shamrock) {
    return item(
      key,
      'The house is yours — the books, and the rest of your property',
      { type: 'goto', screen: 'estate' },
      'Mrs. Doyle keeps the bar; the takings are settled of a Sunday',
    );
  }
  const unmet = shamrockRequirements(state).filter((r) => !r.met);
  return item(
    key,
    `Ask Mrs. Doyle what she wants for the house — ${formatMoney(SHAMROCK_PRICE)}`,
    { type: 'buyShamrock' },
    unmet.length === 0
      ? 'she stays on to run it; every rumour on this field crosses that bar'
      : `wants ${unmet[0].text}`,
    unmet.length > 0,
  );
}

/** What the subscription list strikes out of the world's dice (§27). */
const WORK_NOTES: Record<WorkId, string> = {
  bridge: 'no more bogging or flood-crossing on the Damp Camp road, for you or any bullocky on it',
  waterRace: 'summer halved at that camp, the Sandy Blight struck out, puddling the year round, and the ground goes off slower',
  ward: 'treatment free to the subscriber and half-price to the field; less dysentery and typhoid at every camp',
  school: 'no return whatever, this year; in the next, a lad off the school benches worth ten hired mates',
};

/**
 * The subscription list, the commission and the monthly court, added at the
 * foot of the Chambers menu (§27, §28.1).
 */
function civicCouncilItems(state: GameState): MenuItem[] {
  const out: MenuItem[] = [];
  const money = purse(state);
  const works: [string, WorkId, CampId | undefined][] = [
    ['4', 'bridge', undefined],
    ['5', 'waterRace', 'damp-camp'],
    ['6', 'waterRace', 'snakey-gully'],
    ['7', 'waterRace', 'deep-mountains'],
    ['8', 'ward', undefined],
    ['9', 'school', undefined],
  ];
  for (const [key, id, camp] of works) {
    const def = WORK_DEFS[id];
    const done = state.estate.works.some((w) => w.id === id);
    const label =
      id === 'waterRace'
        ? `Subscribe: a water race to ${CAMP_DEFS[camp as CampId].name} — ${formatMoney(def.cost)}`
        : `Subscribe: ${WORK_NAMES[id]} — ${formatMoney(def.cost)}`;
    if (done && id === 'waterRace' && !state.estate.works.some((w) => w.id === 'waterRace' && w.camp === camp)) {
      continue; // the race is cut, and it is cut to one camp only
    }
    out.push(
      item(key, label, { type: 'subscribeWork', work: id, camp },
        done ? 'subscribed, built, and the plaque up' : money < def.cost ? `the estimate is ${formatMoney(def.cost)}` : WORK_NOTES[id],
        done || money < def.cost),
    );
  }
  if (state.estate.jpSince === null) {
    const unmet = commissionRequirements(state).filter((r) => !r.met);
    // Not offered at all until the aftermath, when the Local Courts are formed.
    if (inAftermath(state)) {
      out.push(
        item('J', `Accept the commission of the peace — ${formatMoney(JP_FEE)}`, { type: 'acceptCommission' },
          canTakeCommission(state) ? 'gazetted a Justice of the Peace for this district' : `wants ${unmet[0].text}`,
          !canTakeCommission(state)),
      );
    }
  } else {
    out.push(
      item('H', 'Hold a court day', { type: 'holdCourt' },
        courtDue(state)
          ? 'two or three cases, and a day of your own time'
          : `the list is called again on day ${state.estate.nextCourtDay}`,
        !courtDue(state)),
    );
  }
  return out;
}

function article(rank: SkillRank): string {
  return rank === 'old hand' ? 'an old hand' : rank === 'digger' ? 'a digger' : 'a new chum';
}

function equipmentLines(state: GameState): string[] {
  const owned = STORE_ORDER.filter((i) => state.items[i] > 0).map(
    (i) => `${ITEM_NAMES[i]}${state.items[i] > 1 ? ` ×${state.items[i]}` : ''}`,
  );
  if (state.horse !== 'none') owned.push(`a ${state.horse}`);
  const claims = (Object.keys(state.claims) as CampId[]).filter((c) => state.claims[c]);
  const lines: string[] = [];
  lines.push(owned.length ? `You have ${owned.join(', ')}.` : 'You own nothing but the clothes you stand in.');
  lines.push(`Provisions: ${state.provisionDays} days. Water: ${state.waterDays} days.`);
  if (claims.length) lines.push(`Claims pegged at ${claims.map((c) => CAMP_DEFS[c].name).join(', ')}.`);
  if (state.shares > 0) lines.push(`${state.shares} share${state.shares === 1 ? '' : 's'} in a Deep Mountains company.`);
  if (state.company) {
    lines.push(
      `${state.company.sharesOwned} of the twenty shares in ${state.company.name}, at ${formatMoney(state.company.sharePrice)}.`,
    );
  }
  if (state.salvage > 0) lines.push(`${state.salvage} scavenged chest${state.salvage === 1 ? '' : 's'} from the road.`);
  return lines;
}

function standingNumber(standing: number): string {
  return Number.isInteger(standing) ? String(standing) : standing.toFixed(2).replace(/0+$/, '');
}

function companyEntryNote(state: GameState): string {
  if (state.company) return 'treasury, scrip, crews and leases';
  const reqs = floatRequirements(state);
  const met = reqs.filter((r) => r.met).length;
  return met === reqs.length
    ? 'all requirements met — the registrar has the ledger open'
    : `${met} of ${reqs.length} requirements met — see what the registrar still needs`;
}

/** The kitty (opened with ESC; the original "@" remains an alias). */
export function kittyView(state: GameState): ScreenView {
  const body: string[] = [];
  body.push(`${formatDate(state.day)} — day ${state.day} of your year, in ${seasonPhrase(state.day)}.`);
  body.push(`You are at ${locationName(state.location)}.`);
  body.push('');
  body.push(`Money in hand: ${formatMoney(state.moneyPence)}`);
  if (state.bankPence > 0) body.push(`In the Bank of Australasia: ${formatMoney(state.bankPence)}`);
  body.push(`Gold: ${formatGold(state.goldCentiOz)}`);
  body.push(
    `Exchange rate of the day: ${formatMoney(rateAt(state, state.location))} the ounce here` +
      (state.location === 'fields-town' ? '.' : ` (the bank at Fields Town: ${formatMoney(state.bankRate)}).`),
  );
  body.push(rateTrendPhrase(state));
  body.push('');
  body.push(...equipmentLines(state));
  body.push('');
  body.push(`Health: ${healthWord(state.health)}${state.illness ? ` — ${ILLNESS_NAMES[state.illness.id]}` : ''}`);
  body.push(`Legal record: ${state.outlawed ? 'Proclaimed an outlaw' : titleCase(state.legal)}`);
  body.push(`Licence: ${licenceWord(state)}`);
  body.push(
    `You came out a new chum; at the wash you are ${article(washRank(state))}, and underground ${article(shaftRank(state))}.`,
  );
  body.push(
    `Standing on the field: ${standingNumber(state.standing)}/100 — you are reckoned ${standingPhrase(state.standing)}.`,
  );
  body.push(
    `Standing opens doors: Council work at ${STANDING_COUNCIL_JOB}; a partner or company at ${COMPANY_FLOAT_STANDING}. Briggs' prices use days served and your legal record.`,
  );
  if (state.notoriety > 0 || state.outlawed) {
    body.push(`To the traps you are ${notorietyPhrase(state.notoriety)}, and in the bush ${bushArticle(bushRankOf(state))}.`);
    const reward = rewardFor(state);
    if (reward > 0) body.push(`There is ${formatMoney(reward)} on your head.`);
    if (state.outlawed) body.push('You are proclaimed an outlaw. There is no reforming out of this one.');
  }
  if (state.hideout) {
    body.push(
      `A camp in the ranges, and ${formatMoney(state.hideout.stashPence)} and ${formatGold(state.hideout.stashGold)} under the flat stone.`,
    );
  }
  if (state.gang.length > 0) body.push(`Riding with you: ${state.gang.map((g) => g.name).join(', ')}.`);
  if (state.employment) body.push(`Last engaged as: ${JOBS[state.employment.job].name}`);
  if (state.shaft) {
    body.push(
      `A shaft at ${CAMP_DEFS[state.shaft.camp].name}, ${state.shaft.depth} feet down` +
        (state.shaft.bottomed ? ', bottomed on payable wash' : `, bottoming somewhere below`) +
        `${state.shaft.timbered ? ', timbered' : ', untimbered'}${state.shaft.pumped ? ' and pumped' : ''}.`,
    );
  }

  const atBank = state.location === 'fields-town' || state.location === 'suze-port';
  const menu: MenuItem[] = [
    item('A', atBank ? 'Sell gold to the bank' : 'Gold is sold at a bank in town', atBank ? { type: 'sellGold', where: 'bank', watch: false } : { type: 'continue' }, atBank ? undefined : 'camp storekeepers do not buy gold', state.goldCentiOz <= 0 || !atBank),
    item('B', 'Save the game', { type: 'save' }),
    item('C', 'Finish the game', { type: 'finish' }),
    item('0', 'Return to what you were doing', { type: 'continue' }),
  ];
  return { screen: 'camp', title: 'THE KITTY', body, menu };
}

export function mapView(state: GameState): ScreenView {
  const body: string[] = [
    'Suze Port lies on the coast. Two tracks run inland to the diggings:',
    "Trickey's Track, the better and more popular road, and the Pass Road,",
    'which is shorter and lonelier and harder on man and beast.',
    '',
    'Fields Town stands on Blue River, at the head of the tracks. Damp Camp',
    'and Snakey Gully lie a day out; the Deep Mountains two days, in reef country.',
    '',
    `The star marks where you are: ${locationName(state.location)}.`,
  ];

  if (state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    const days = state.rush.untilDay - state.day + 1;
    body.push(
      `There is a RUSH at ${CAMP_DEFS[state.rush.camp].name}, and it will be over in ${days} day${days === 1 ? '' : 's'}.`,
    );
  }

  const pegged = (Object.keys(state.claims) as CampId[]).filter((c) => state.claims[c]);
  if (pegged.length) {
    const words = pegged.map((c) => {
      const claim = state.claims[c];
      return `${CAMP_DEFS[c].name}${claim && isWorkedOut(claim) ? ' (worked out)' : ''}`;
    });
    body.push(`Your stakes are in the ground at ${words.join(' and ')}.`);
  } else {
    body.push('You have pegs in no ground anywhere on this field.');
  }

  if (state.company) {
    body.push(
      `The workings of ${state.company.name} lie in the ${CAMP_DEFS['deep-mountains'].name}, on ${state.company.leases.length} lease${state.company.leases.length === 1 ? '' : 's'}.`,
    );
  }

  if (state.hideout) {
    body.push(
      'Beyond the Deep Mountains, where no surveyor has been and the map has no business going, is your camp in the ranges.',
    );
  }

  const reward = rewardFor(state);
  if (reward > 0) {
    body.push(
      `The notice pinned in the margin is your own: ${formatMoney(reward)} to the man who can take you, and it is pasted up in every township on this sheet.`,
    );
  }

  return {
    screen: 'camp',
    title: 'A MAP OF THE GOLDFIELDS',
    body,
    menu: [item('0', 'Back', { type: 'continue' })],
  };
}

// ---------------------------------------------------------------------------

/** Screens that only make sense with your boots on a camp's dirt. */
const CAMP_SCREENS = new Set(['camp', 'camp-store', 'camp-mine', 'camp-shares', 'camp-grog']);
const TOWN_SCREENS = new Set([
  'ftown',
  'ftown-bank',
  'ftown-store',
  'ftown-council',
  'ftown-work',
  'ftown-hospital',
  'ftown-hotel',
  'ftown-gamble',
  'ftown-twoup',
  'ftown-cards',
]);
const PORT_SCREENS = new Set([
  'suze',
  'suze-work',
  'suze-store',
  'suze-lodgings',
  'suze-horses',
  'suze-crime',
  'travel-route',
  'travel-mode',
]);

/** Where a player standing at `loc` belongs when no particular screen applies. */
function homeScreenFor(state: GameState): ScreenView['screen'] {
  if (state.location === 'suze-port') return 'suze';
  if (state.location === 'hideout') return 'hideout';
  if (state.location === 'secret-mine') return 'secret-expedition';
  if (isCamp(state.location)) return 'camp';
  return 'ftown';
}

/** Screens that only exist for a man with business in the ranges (§23). */
const BANDIT_SCREENS = new Set(['bandit', 'bandit-roads', 'gang']);
const HIDEOUT_SCREENS = new Set(['hideout', 'stash']);

export function getView(state: GameState): ScreenView {
  // An encounter that nothing is pending for has already been answered. Never
  // leave the player staring at a question with no action that resolves it.
  if (state.screen === 'encounter' && !state.pending) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // The camp in the ranges is not a place a man can be shown when he is not in
  // it, and there is no going to its screens from a public street.
  if (HIDEOUT_SCREENS.has(state.screen) && state.location !== 'hideout') {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  if (BANDIT_SCREENS.has(state.screen) && state.location === 'on-road') {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // Defensive: a player carted off to Calico House mid-shift must not be shown
  // a camp screen for a camp he is no longer standing in.
  if (CAMP_SCREENS.has(state.screen) && !isCamp(state.location)) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  if (state.screen === 'camp-shares' && state.location !== 'deep-mountains') {
    return getView({ ...state, screen: 'camp' });
  }
  // The company's books are at the workings and Council; its commercial business
  // is conducted with investors and shipping agents at Suze Port.
  if (
    state.screen === 'company' &&
    state.location !== 'deep-mountains' &&
    state.location !== 'fields-town' &&
    state.location !== 'suze-port'
  ) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // Likewise, a man at the diggings cannot walk into the Bank of Australasia.
  if (TOWN_SCREENS.has(state.screen) && state.location !== 'fields-town') {
    if (state.screen === 'ftown-bank' && state.location === 'suze-port') {
      // The Suze Port branch is the one exception.
    } else if (state.location !== 'on-road') {
      return getView({ ...state, screen: homeScreenFor(state) });
    }
  }
  if (PORT_SCREENS.has(state.screen) && state.location !== 'suze-port') {
    if (state.location !== 'on-road') return getView({ ...state, screen: homeScreenFor(state) });
  }

  switch (state.screen) {
    case 'title':
      return {
        screen: 'title',
        title: 'GOLDFIELDS',
        subtitle: 'The year is 1854',
        body: [
          'A simulation of life on the diggings.',
          '',
          'Press the SPACE BAR to start.',
        ],
        menu: [
          item('1', 'Begin a new game', { type: 'newGame' }),
          item('2', 'Take up a saved game', { type: 'resumePrompt' }),
        ],
      };

    case 'resume':
      return {
        screen: 'resume',
        title: 'TAKE UP A SAVED GAME',
        body: ['Enter the number of the game you wish to take up, and press RETURN.'],
        menu: [item('0', 'Back', { type: 'start' })],
        input: { prompt: 'Game number', kind: 'gameId' },
      };

    case 'intro':
      return {
        screen: 'intro',
        title: 'NEW ARRIVALS',
        body: [],
        menu: [item(' ', 'Press the SPACE BAR to go ashore', { type: 'continue' })],
      };

    // --- Suze Port -----------------------------------------------------
    case 'suze':
      return {
        screen: 'suze',
        title: 'SUZE PORT',
        subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
        body: [
          'Dirty, unlit streets, garish signs, and horses hitched to wooden railings.',
          'The place exists only for gold. There is plenty of work for those who stay,',
          'and because workers are scarce the wages are good.',
        ],
        menu: [
          item('1', 'Seek work about the port', { type: 'goto', screen: 'suze-work' }),
          item('2', "Briggs' agency store", { type: 'goto', screen: 'suze-store' }, 'goods are much cheaper here than at the diggings'),
          item('3', 'See about lodgings', { type: 'goto', screen: 'suze-lodgings' }, `at present: ${lodgingWord(state)}`),
          item('4', 'The horse dealer', { type: 'goto', screen: 'suze-horses' }),
          item('C', 'A hot meal at the cookshop — 1s', { type: 'buyMeal' }, state.fedToday ? 'you already have a meal waiting today' : 'eaten when the next day is spent', state.fedToday || state.moneyPence < shillings(1)),
          item('F', 'Fish the harbour for the day', { type: 'fishForFood' }, 'no wage; usually enough food for several days'),
          item('5', 'Read The Angus Gazette (1d)', { type: 'readGazette' }),
          item('6', 'Read A Goldfields Journal', { type: 'readJournal' }, state.items.journal ? undefined : 'you have no copy', state.items.journal < 1),
          item('7', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
          item('H', `A doctor in Main Street — ${formatMoney(HOSPITAL_FEE_PER_DAY)} the day`, { type: 'hospital', days: 3 }, 'three days under his care', state.moneyPence < HOSPITAL_FEE_PER_DAY),
          item('K', `A nobbler in a Main Street public house — ${formatMoney(drinkPrice(state, 'nobbler'))}`, { type: 'drink', what: 'nobbler' }, 'the port has not yet learned to charge diggings prices for it', state.moneyPence < drinkPrice(state, 'nobbler')),
          item('8', 'Take what is not yours', { type: 'goto', screen: 'suze-crime' }),
          item('9', 'The bank', { type: 'goto', screen: 'ftown-bank' }, 'safe from thieves; the diggings are a long way from your money'),
          item('G', 'Set out for the diggings', { type: 'goto', screen: 'travel-route' }),
          ...(state.company
            ? [item('O', `Attend to ${state.company.name}`, { type: 'goto', screen: 'company' }, 'investors and shipping agents do business at the port')]
            : []),
          banditEntry(state, 'B'),
          item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
        ],
      };

    case 'suze-work':
      return {
        screen: 'suze-work',
        title: 'WORK AT SUZE PORT',
        body: [
          'Ships lie in the harbour short-handed, their crews gone to the diggings.',
          'A man who will stay and work can always find a day\'s wage.',
        ],
        menu: [
          item('1', `${JOBS.wharf.name} — ${formatMoney(JOBS.wharf.lo)} to ${formatMoney(JOBS.wharf.hi)} a day`, { type: 'work', job: 'wharf', days: state.spellDays }, JOBS.wharf.blurb),
          item('2', `${JOBS.town.name} — ${formatMoney(JOBS.town.lo)} to ${formatMoney(JOBS.town.hi)} a day`, { type: 'work', job: 'town', days: state.spellDays }, JOBS.town.blurb),
          item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
          back('suze'),
        ],
      };

    case 'suze-store':
      return {
        screen: 'suze-store',
        title: "BRIGGS' AGENCY STORE, SUZE PORT",
        body: [
          'Prices keep rising, but equipment and supplies are much cheaper here than',
          'at the goldfields. Buy before you go, and buy carefully.',
          '',
          briggsDiscountLabel(state),
          ...(state.legal === 'honest' ? [] : [`Briggs adds a visible risk premium because your standing is ${state.legal}.`]),
        ],
        menu: storeMenu(state, 'suze'),
        aside: storeAside(state),
      };

    case 'suze-lodgings':
      return {
        screen: 'suze-lodgings',
        title: 'LODGINGS',
        body: [
          'Lodgings are scarce. There were no beds at the inn for us, at least none',
          'that we could afford.',
          'The inn and stable include a plain evening meal; tent ground does not.',
        ],
        menu: [
          item('1', 'Inn dormitory — 10s a night', { type: 'setLodging', kind: 'inn' }, 'flea-ridden stretchers, but safe enough'),
          item('2', 'A stable, on clean straw — 5s a night', { type: 'setLodging', kind: 'stable' }, 'a stall shared with two others and perhaps a horse'),
          item('3', 'Rent tent ground — 5s a week', { type: 'setLodging', kind: 'tentground' }, state.items.tent ? 'the canvas town' : 'you would need a tent', state.items.tent < 1),
          item('4', 'Sleep rough — nothing', { type: 'setLodging', kind: 'rough' }, 'free, and it may cost you dear'),
          back('suze'),
        ],
      };

    case 'suze-horses':
      return {
        screen: 'suze-horses',
        title: 'THE HORSE DEALER',
        body: [
          'Two horses stand at the rail. Their prices are chalked up; their virtues are not.',
          'Horse knowledge comes from looking, work around the port, or paying someone',
          'whose livelihood does not depend on selling either animal.',
          '',
          horseReport(state, 'brumby'),
          horseReport(state, 'hack'),
        ],
        menu: [
          item('1', `The rough-coated bay — ${formatMoney(HORSE_PRICE.brumby)}`, { type: 'buyHorse', kind: 'brumby' }, undefined, state.moneyPence < HORSE_PRICE.brumby),
          item('2', `The tall chestnut — ${formatMoney(HORSE_PRICE.hack)}`, { type: 'buyHorse', kind: 'hack' }, undefined, state.moneyPence < HORSE_PRICE.hack),
          item('3', 'Inspect the rough-coated bay', { type: 'inspectHorse', kind: 'brumby', method: 'look' }, 'look at teeth, legs and feet; no time or money'),
          item('4', 'Inspect the tall chestnut', { type: 'inspectHorse', kind: 'hack', method: 'look' }, 'look at teeth, legs and feet; no time or money'),
          item('5', 'Pay an independent ostler to judge both — 1s', { type: 'inspectHorse', kind: 'brumby', method: 'ostler' }, 'a plain account of speed, stamina and bush sense', state.moneyPence < shillings(1)),
          item('6', 'Trial both horses for a day — 5s', { type: 'inspectHorse', kind: 'hack', method: 'trial' }, 'the road tells what the rail conceals', state.moneyPence < shillings(5)),
          back('suze'),
        ],
      };

    case 'suze-crime':
      return {
        screen: 'suze-crime',
        title: 'AN OPPORTUNITY',
        body: [
          'The streets are dark and unlit, and there are drunks enough in them.',
          'Most people happily tolerate grog sellers and licence dodgers. Thieves',
          'are another matter: harming your fellows is deeply despised.',
        ],
        menu: [
          item('1', 'Lift goods from a store', { type: 'steal', target: 'store' }, 'the better prize, the greater risk'),
          item('2', "Go through a drunk's pockets", { type: 'steal', target: 'drunk' }),
          banditEntry(state, '3'),
          back('suze'),
        ],
      };

    // --- reading -------------------------------------------------------
    case 'gazette':
      return {
        screen: 'gazette',
        title: 'THE ANGUS GAZETTE',
        body: gazetteFor(state),
        menu: [item('0', 'Put the paper down', { type: 'continue' })],
      };

    case 'journal': {
      const menu = JOURNAL_SECTIONS.slice(0, 20).map((sec, i) =>
        item(MENU_LETTERS[i], sec.title, { type: 'goto', screen: 'journal' }),
      );
      menu.push(item('0', 'Close the book', { type: 'continue' }));
      return {
        screen: 'journal',
        title: 'A GOLDFIELDS JOURNAL',
        subtitle: 'Nicholas Jacob Rowe, lately returned from the Gold Rushes',
        body: ['Choose a chapter.'],
        menu,
      };
    }

    // --- travel ---------------------------------------------------------
    case 'travel-route':
      return {
        screen: 'travel-route',
        title: 'THE ROAD TO THE DIGGINGS',
        body: [
          'The roads to the diggings are bad, summer or winter: raw dirt tracks',
          'winding through the bush, following the paths forced by the first diggers.',
        ],
        menu: [
          item('1', `${ROUTES.trickeys.name} — ${ROUTES.trickeys.walkDays} days afoot`, { type: 'chooseRoute', route: 'trickeys' }, ROUTES.trickeys.blurb),
          item('2', `${ROUTES.pass.name} — ${ROUTES.pass.walkDays} days afoot`, { type: 'chooseRoute', route: 'pass' }, ROUTES.pass.blurb),
          back('suze'),
        ],
      };

    case 'travel-mode': {
      const route = state.journey?.route ?? 'trickeys';
      const walk = planJourney(state, route, 'walk');
      const wagon = planJourney(state, route, 'wagon');
      const horse = planJourney(state, route, 'horse');
      return {
        screen: 'travel-mode',
        title: `HOW WILL YOU TRAVEL ${route === 'trickeys' ? "TRICKEY'S TRACK" : 'THE PASS ROAD'}?`,
        body: [
          'Prepare carefully. Some travellers are stark, staring, gold mad and head off',
          'with nothing. If they do not die on the way, they arrive with no tools,',
          'money or shelter. Others take far too much.',
          '',
          ...walk.problems.map((p) => `— ${p}`),
        ],
        menu: [
          item('1', `Walk — ${walk.days} days, nothing to pay`, { type: 'travel', route, mode: 'walk' }, 'hump your swag; you can carry no cradle without a barrow'),
          item('2', `Ride on a wagon — ${wagon.days} days, ${formatMoney(WAGON_FARE)}`, { type: 'travel', route, mode: 'wagon' }, 'faster than walking; all kit carried, and company makes robbery less likely; wagons bog in winter', state.moneyPence < WAGON_FARE),
          item('3', `On horseback — ${horse.days} days`, { type: 'travel', route, mode: 'horse' }, state.horse === 'none' ? 'you have no horse' : 'ride your own horse; fastest, but exposed to the road', state.horse === 'none'),
          back('suze'),
        ],
      };
    }

    // --- Fields Town -----------------------------------------------------
    case 'ftown':
      return {
        screen: 'ftown',
        title: 'FIELDS TOWN',
        subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
        body: [
          'A street a mile long and wide enough to turn a bullock team, lined with tin',
          'and rough-hewn wood, and beyond it nothing but tents. Only half the town digs;',
          'the rest supply the diggers, and do better out of it.',
        ],
        menu: [
          item('1', 'The Bank of Australasia', { type: 'goto', screen: 'ftown-bank' }, `gold at ${formatMoney(state.bankRate)} the ounce`),
          item('2', "Briggs' Store", { type: 'goto', screen: 'ftown-store' }, 'everything from a pick to a needle, at diggings prices'),
          item('3', 'The Council Chambers', { type: 'goto', screen: 'ftown-council' }, isLicensed(state) ? licenceWord(state) : 'no licence'),
          item('4', 'Seek work in the town', { type: 'goto', screen: 'ftown-work' }),
          item('5', 'Calico House (the hospital)', { type: 'goto', screen: 'ftown-hospital' }),
          item('6', 'The Shamrock Hotel', { type: 'goto', screen: 'ftown-hotel' }),
          item('7', `Cobb & Co. to Suze Port — ${formatMoney(COACH_FARE)}`, { type: 'coach' }, '2 days, and mostly bushranger-proof', state.moneyPence < COACH_FARE),
          item('8', 'Out to the diggings', { type: 'goto', screen: 'ftown-depart' }),
          item('9', 'Read The Angus Gazette (1d)', { type: 'readGazette' }),
          item('R', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
          item('J', 'Read A Goldfields Journal', { type: 'readJournal' }, undefined, state.items.journal < 1),
          estateEntry(state, 'E'),
          banditEntry(state, 'B'),
          item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
        ],
      };

    case 'ftown-bank': {
      const atPort = state.location === 'suze-port';
      const rate = atPort ? rateAt(state, 'suze-port') : state.bankRate;
      return {
        screen: 'ftown-bank',
        title: atPort ? 'THE BANK, MAIN STREET, SUZE PORT' : 'THE BANK OF AUSTRALASIA',
        body: [
          atPort
            ? 'One of the few brick buildings in the port, and busy with importers, agents'
            : "A glass window on the street, a fireplace at one end, the manager's bed and",
          atPort
            ? 'and diggers turning their dust into notes before they take ship again.'
            : 'the safe at the other, and a few remodelled gin cases for a desk.',
          '',
          `Gold today: ${formatMoney(rate)} the ounce${atPort ? ' (the Fields Town bank pays better)' : ' — the best rate in the colony'}.`,
          rateTrendPhrase(state),
          `You hold ${formatGold(state.goldCentiOz)} and ${formatMoney(state.moneyPence)}.`,
          `On deposit: ${formatMoney(state.bankPence)}.`,
        ],
        menu: [
          item('1', 'Sell all your gold', { type: 'sellGold', where: 'bank', watch: true }, undefined, state.goldCentiOz <= 0),
          item('2', 'Deposit all your money', { type: 'deposit', amount: -1 }, 'safe from thieves and bushrangers', state.moneyPence <= 0),
          item('3', 'Withdraw ten shillings', { type: 'withdraw', amount: shillings(10) }, undefined, state.bankPence < shillings(10)),
          item('4', 'Withdraw one pound', { type: 'withdraw', amount: pounds(1) }, undefined, state.bankPence < pounds(1)),
          item('5', 'Withdraw five pounds', { type: 'withdraw', amount: pounds(5) }, undefined, state.bankPence < pounds(5)),
          item('6', 'Withdraw everything', { type: 'withdraw', amount: -1 }, undefined, state.bankPence <= 0),
          back(atPort ? 'suze' : 'ftown'),
        ],
      };
    }

    case 'ftown-store':
      return {
        screen: 'ftown-store',
        title: "BRIGGS' STORE, FIELDS TOWN",
        body: [
          'Briggs\' Supplies is a gold mine in itself. Demand is so great that the supply',
          'cannot keep up, and the storekeepers can charge what they like.',
          '',
          briggsDiscountLabel(state),
          ...(state.legal === 'honest' ? [] : [`Your ${state.legal} standing adds a visible risk premium to Briggs' prices.`]),
        ],
        menu: storeMenu(state, 'ftown'),
        aside: storeAside(state),
      };

    case 'store-sell': {
      const storeScreen: ScreenView['screen'] =
        state.location === 'suze-port' ? 'suze-store' : isCamp(state.location) ? 'camp-store' : 'ftown-store';
      const menu: MenuItem[] = [];
      for (const it of STORE_ORDER) {
        if (state.items[it] < 1) continue;
        const price = buybackPriceOf(state, it);
        menu.push(
          warned(STORE_KEYS[it], `${titleCase(ITEM_NAMES[it])} — ${formatMoney(price)}`,
            { type: 'sellItem', item: it }, `you have ${state.items[it]}`, ITEM_HINTS[it]),
        );
      }
      menu.push(back(storeScreen));
      return {
        screen: 'store-sell',
        title: 'SELLING BACK TO THE STORE',
        body: [
          'The storekeeper values second-hand goods from the port wholesale list,',
          'and offers one quarter of that price wherever you sell them.',
        ],
        menu,
        aside: storeAside(state),
      };
    }

    case 'ftown-council':
      return {
        screen: 'ftown-council',
        title: 'THE COUNCIL CHAMBERS',
        body: [
          'Licences, claims and complaints. Attached are the police camp and the logs.',
          'A travelling magistrate hears cases once a month; until then, prisoners wait',
          'in chains.',
          '',
          `Your licence: ${licenceWord(state)}.`,
          ...(inAftermath(state)
            ? []
            : [
                'Thirty shillings the month is one shilling a day, or eighteen pounds a year,',
                "when a labourer's wage is five shillings a week and a shepherd receives a",
                'miserable ten pounds a year.',
              ]),
        ],
        menu: [
          inAftermath(state)
            ? item('1', `Take out a miner's right — ${formatMoney(MINERS_RIGHT_COST)} for the year`, { type: 'buyLicence' }, 'a pound the year, and the vote with it; the licence is abolished', state.moneyPence < MINERS_RIGHT_COST)
            : item('1', `Take out a miner's licence — ${formatMoney(LICENCE_COST)} for thirty days`, { type: 'buyLicence' }, 'one shilling a day, when a labourer earns five shillings a week', state.moneyPence < LICENCE_COST),
          item('2', 'Lodge a complaint', { type: 'complain' }, 'it will be written in a fine round hand and filed'),
          ...(['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[])
            .filter((camp) => !!state.claims[camp] && !state.claims[camp]?.registered)
            .map((camp, i) => item('RTY'[i], `Register the claim at ${CAMP_DEFS[camp].name} — 5s`, { type: 'registerClaim', camp }, 'the Council ledger gives you a strong remedy against jumpers', state.moneyPence < shillings(5))),
          item(
            'C',
            state.company
              ? `The books of ${state.company.name}`
              : canFloat(state)
                ? 'Register a mining company'
                : 'Ask about registering a mining company',
            { type: 'goto', screen: 'company' },
            companyEntryNote(state),
          ),
          ...civicCouncilItems(state),
          back('ftown'),
        ],
      };

    case 'ftown-work': {
      const menu: MenuItem[] = [];
      const jobs: (keyof typeof JOBS)[] = ['orderly', 'clerk', 'barman', 'gardener', 'council'];
      jobs.forEach((j, i) => {
        const def = JOBS[j];
        const record = j === 'council' && state.legal !== 'honest';
        const unknown = j === 'council' && state.standing < STANDING_COUNCIL_JOB;
        const blocked = record || unknown;
        menu.push(
          item(
            String(i + 1),
            `${def.name} — ${formatMoney(def.lo)} to ${formatMoney(def.hi)} a day`,
            { type: 'work', job: j, days: state.spellDays },
            record
              ? 'they will not have a man with a record'
              : unknown
                ? 'the Council takes its clerks from men it has heard of'
                : def.blurb,
            blocked,
          ),
        );
      });
      menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
      menu.push(back('ftown'));
      return {
        screen: 'ftown-work',
        title: 'WORK IN FIELDS TOWN',
        body: [
          'If you are wondering where to begin to make your fortune, consider trying',
          'short-term work in Fields Town. No licence is wanted for honest wages.',
        ],
        menu,
      };
    }

    case 'ftown-hospital':
      return {
        screen: 'ftown-hospital',
        title: 'CALICO HOUSE',
        body: [
          'A collection of tents packed with stretchers on earthen floors. My advice to',
          'diggers is not to get sick.',
          '',
          `Health: ${healthWord(state.health)}${state.illness ? ` — ${ILLNESS_NAMES[state.illness.id]}` : ''}.`,
          hospitalFee(state) === 0
            ? 'Nothing is asked of the man who endowed the ward, and half of it of the field. The days are lost to you all the same.'
            : `Ten shillings the day, and the days are lost to you.`,
        ],
        menu: [
          item('1', `Three days under care — ${formatMoney(hospitalFee(state) * 3)}`, { type: 'hospital', days: 3 }, undefined, state.moneyPence < hospitalFee(state)),
          item('2', `Seven days under care — ${formatMoney(hospitalFee(state) * 7)}`, { type: 'hospital', days: 7 }, undefined, state.moneyPence < hospitalFee(state)),
          item('3', 'Rest instead, and save the money', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
          back('ftown'),
        ],
      };

    case 'ftown-hotel':
      return {
        screen: 'ftown-hotel',
        title: 'THE SHAMROCK HOTEL',
        body: [
          'Briggs Street is lined on both sides with buildings, and they centre on the',
          'Shamrock. Half the town does not dig at all; a good deal of what it knows is',
          'known here first.',
          '',
          receptionLine(state),
          '',
          campTalk(state),
        ],
        menu: [
          ...drinkMenu(state, '1234'),
          item('5', 'Two-up in the yard', { type: 'goto', screen: 'ftown-gamble' }, parlourOpen(state) ? 'and the parlour, if you are wanted in it' : undefined),
          ...shoutMenu(state, 'SP'),
          // The deed is done across this counter and no other (§26): a man
          // asks Mrs. Doyle in her own bar, not at a desk in the Chambers.
          shamrockEntry(state, 'H'),
          back('ftown'),
        ],
      };

    case 'ftown-gamble': {
      const stakes = [12, 60, 240, 1200];
      const menu = stakes.map((st, i) =>
        item(String(i + 1), `Two-up for ${formatMoney(st)}`, { type: 'startGamble', game: 'twoup', stake: st }, i === 0 && receptionTier(state) === 'chum' ? 'call heads or tails, then collect or let the winnings ride' : 'call heads or tails, then decide whether to press', state.moneyPence < st),
      );
      stakes.forEach((st, i) =>
        menu.push(item('ABCD'[i], `Cards for ${formatMoney(st)}`, { type: 'startGamble', game: 'cards', stake: st }, 'read your hand and the other man, then fold, call, raise or bluff', state.moneyPence < st)),
      );
      // The settlers' corner will play for pounds, and plays them straight (§30.1).
      if (parlourOpen(state)) {
        PARLOUR_STAKES.forEach((st, i) =>
          menu.push(
            item('EFG'[i], `Cards in the parlour for ${formatMoney(st)}`, { type: 'startGamble', game: 'cards', stake: st }, 'squatters and warders, and a straight deck', state.moneyPence < st),
          ),
        );
      }
      menu.push(back('ftown-hotel'));
      return {
        screen: 'ftown-gamble',
        title: 'THE YARD BEHIND THE SHAMROCK',
        body: [
          'Diggers come to town to exchange their gold, then spend up big — gambling and',
          'carousing, often losing a small fortune overnight.',
          ...(parlourOpen(state)
            ? ['', 'The parlour door is open to you. They play for pounds in there.']
            : []),
        ],
        menu,
      };
    }

    case 'ftown-twoup': {
      const g = state.gambling;
      return {
        screen: 'ftown-twoup',
        title: 'TWO-UP IN THE YARD',
        body: [
          'The spinner sets two pennies on the kip. Heads wins your call; tails wins the other.',
          'Odds are tossed again. There is no house hand to read—only the call and whether',
          'you have the nerve to leave a winning stake down.',
          '',
          g && g.pot > 0 ? `${formatMoney(g.pot)} is waiting on your side of the ring.` : `Your stake is ${formatMoney(g?.stake ?? 0)}. Make the call.`,
        ],
        menu: g && g.pot > 0
          ? [
              item('1', 'Collect the winnings', { type: 'twoUpCollect' }),
              item('2', 'Let it all ride on heads', { type: 'twoUpCall', side: 'heads' }),
              item('3', 'Let it all ride on tails', { type: 'twoUpCall', side: 'tails' }),
            ]
          : [
              item('1', 'Call heads', { type: 'twoUpCall', side: 'heads' }),
              item('2', 'Call tails', { type: 'twoUpCall', side: 'tails' }),
              back('ftown-gamble'),
            ],
      };
    }

    case 'ftown-cards': {
      const g = state.gambling;
      const hand = !g ? 'No hand is dealt.' : g.hand <= 3 ? 'A poor hand.' : g.hand <= 6 ? 'A middling hand.' : g.hand <= 8 ? 'A strong hand.' : 'A hand fit to break a man.';
      const tell = !g ? '' : g.tell === 'eager' ? 'The other man reaches for his money before you speak.' : g.tell === 'uneasy' ? 'The other man keeps rubbing his thumb along the card edge.' : 'The other man sits very still.';
      return {
        screen: 'ftown-cards',
        title: 'A HAND OF CARDS',
        body: [hand, tell, '', `The stake is ${formatMoney(g?.stake ?? 0)}. A raise risks another stake and pays two if it comes home.`],
        menu: [
          item('1', 'Fold', { type: 'cardsDecision', choice: 'fold' }, 'lose half the stake and keep the rest'),
          item('2', 'Call', { type: 'cardsDecision', choice: 'call' }, 'show the hands for the original stake'),
          item('3', 'Raise', { type: 'cardsDecision', choice: 'raise' }, 'stronger reward, but another stake at risk', !g || state.moneyPence < g.stake * 2),
          item('4', 'Bluff', { type: 'cardsDecision', choice: 'bluff' }, 'best against a weak-looking opponent; costly when called'),
        ],
      };
    }

    // The camp's grog tent: the same trade, worse liquor, and no licence (§30, §31.4).
    case 'camp-grog': {
      const shanty = ownsThisShanty(state);
      return {
        screen: 'camp-grog',
        title: shanty ? 'YOUR OWN SLY-GROG SHANTY' : 'THE GROG TENT',
        body: [
          'The grog shops offer some relief to tired, lonely diggers. Some become fighting',
          'drunk, but most just relax. Grog shops are illegal, and most are protected by',
          'the police — for a fee.',
          '',
          receptionLine(state),
          ...(shanty
            ? ['', 'It is your tent, your rum, and your men drinking it.']
            : state.notoriety >= SHANTY_NOTORIETY && !state.estate.shanty
              ? [
                  '',
                  'The keeper has been asking after you by name, and lets it be known he',
                  'would sell the place tomorrow to a man the traps already want.',
                ]
              : []),
        ],
        menu: [...drinkMenu(state, '1234'), ...shoutMenu(state, 'SP'), back('camp')],
      };
    }

    case 'ftown-depart': {
      const menu: MenuItem[] = [];
      // There is no sense in setting out for the camp you are already standing in.
      const camps: CampId[] = (['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]).filter(
        (c) => c !== state.location,
      );
      let n = 1;
      for (const c of camps) {
        const days = localTravelDays(state, c);
        menu.push(
          item(String(n++), `${CAMP_DEFS[c].name} — ${days} day${days === 1 ? '' : 's'}`, { type: 'travelTo', place: c }, CAMP_DEFS[c].blurb),
        );
      }
      if (isCamp(state.location)) {
        menu.push(item(String(n++), 'Back to Fields Town', { type: 'travelTo', place: 'fields-town' }));
      }
      if (state.secret && !state.secret.chased) {
        menu.push(
          item(String(n++), 'Follow the talk of a secret mine', { type: 'followRumour' }, `${SECRET_TRAVEL_DAYS} days out, and it may be nothing at all`),
        );
      }
      menu.push(item(String(n++), 'Back to Suze Port on foot', { type: 'travel', route: 'trickeys', mode: state.horse !== 'none' ? 'horse' : 'walk' }));
      menu.push(back(isCamp(state.location) ? 'camp' : 'ftown'));
      return {
        screen: 'ftown-depart',
        title: 'OUT TO THE DIGGINGS',
        body: ['In the scattered mining camps around Goldfields the work is tough, but there is always a chance to make a fortune.'],
        menu,
      };
    }

    case 'secret-expedition': {
      const e = state.secretExpedition;
      const trail = e?.trail ?? 0;
      const clues = [
        'The old fire-hole is found, but the country beyond it is a blank of stone and glare.',
        'A line of shallow dish-holes leads away from the abandoned working.',
        'A broken pick-head and a cairn confirm that somebody followed this reef before you.',
        'Under the cairn is a scratched direction: THREE RED GUMS — BLACK LEADER.',
        'The black leader is under your feet. If the promised nugget exists, this is its bed.',
      ];
      return {
        screen: 'secret-expedition',
        title: 'THE SECRET WORKING',
        subtitle: `${formatDate(state.day)} · ${state.waterDays} days of water`,
        body: [
          'There is no camp here: no store, troopers, claims or company office. Only the',
          'abandoned holes and the story of The Southern Cross—a nugget said to be so large',
          'that two men could scarcely lift it from the earth.',
          '',
          clues[Math.min(4, trail)],
          ...(e?.nuggetFound ? ['', 'The great nugget is yours. Nothing here can equal that moment again.'] : []),
          ...(e?.exhausted && !e.nuggetFound ? ['', 'The trail has failed. More digging here would only spend water and life.'] : []),
        ],
        menu: [
          item('1', 'Search the old workings for the next sign', { type: 'searchSecret', approach: 'search' }, 'a hard day in the desert', !!e?.exhausted || !!e?.nuggetFound),
          item('2', 'Dig the black leader for The Southern Cross', { type: 'searchSecret', approach: 'dig' }, trail >= 4 ? 'the promised bed is found' : 'you have not followed the trail far enough', trail < 4 || !!e?.exhausted || !!e?.nuggetFound),
          item('3', 'Winnow a little dry dirt by hand', { type: 'searchSecret', approach: 'winnow' }, 'a small side chance for ordinary gold, not the purpose of the expedition', !!e?.exhausted),
          item('4', 'Rest for a day', { type: 'rest', days: 1 }, 'save your strength, but water and food still go'),
          item('5', 'Turn back towards Fields Town', { type: 'travelTo', place: 'fields-town' }, `${localTravelDays(state, 'fields-town')} days away`),
        ],
      };
    }

    // --- camps -----------------------------------------------------------
    case 'camp': {
      const camp = state.location as CampId;
      const def = CAMP_DEFS[camp];
      const claim = state.claims[camp];
      // What is distinct about this camp today comes first, so that moving on
      // feels like arriving somewhere new.
      const body: string[] = [groundLine(state, camp), '', ...campCharacter(state, camp), ''];
      if (claim) {
        body.push(
          isWorkedOut(claim)
            ? 'Your stakes are in the ground, but the wash has gone off it entirely.'
            : claim.workedDays === 0
              ? 'Your stakes are in the ground, and not a sod of it turned yet.'
              : `Your stakes are in the ground, and you have worked it ${claim.workedDays} day${claim.workedDays === 1 ? '' : 's'}.`,
        );
        body.push(claim.registered ? 'The claim is entered in the Council ledger.' : 'The claim is unregistered.');
        if ((claim.guardedUntilDay ?? 0) >= state.day) body.push(`A watchman is paid through day ${claim.guardedUntilDay}.`);
      } else {
        body.push('You have pegged no claim here.');
      }
      if (state.partner) body.push('You are gone mates with a digger, share and share alike.');
      if (!isLicensed(state)) body.push('You have no licence. The troopers hunt diggers here.');
      if (state.shaft && state.shaft.camp === camp) {
        body.push(
          `Your shaft stands at ${state.shaft.depth} feet${state.shaft.bottomed ? ', bottomed on payable wash' : ''}${state.shaft.timbered ? ', timbered' : ', untimbered'}.`,
        );
      }
      body.push('');
      body.push(campTalk(state));

      const menu: MenuItem[] = [
        item('1', 'Dig', { type: 'goto', screen: 'camp-mine' }, `spells of ${state.spellDays} days`),
        item('2', 'Peg a claim (twelve feet square)', { type: 'pegClaim' }, claim ? 'already pegged' : 'free, one to a camp', !!claim),
        item('3', "The camp storekeeper", { type: 'goto', screen: 'camp-store' }, 'food and equipment at camp prices; gold is sold at the bank'),
        item('4', `Hire a mate — ${formatMoney(MATE_WAGE)} a day`, { type: 'hireMate', days: state.spellDays }, state.partner ? 'you have a partner already' : state.mateUntilDay >= state.day ? `you have a mate until day ${state.mateUntilDay}` : 'one rocks while the other shovels', state.partner),
        item('5', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
        item('6', `A camp "doctor" — ${formatMoney(QUACK_FEE)}`, { type: 'quack' }, 'a butcher by trade; I would rather be treated by a horse-coper', state.moneyPence < QUACK_FEE),
        item('7', 'Move on', { type: 'goto', screen: 'ftown-depart' }),
        item('8', 'Back to Fields Town', { type: 'travelTo', place: 'fields-town' }),
        item('P', 'Try the ground with a dish', { type: 'prospect' }, state.items.pan < 1 ? 'you want a pan for it' : claim ? 'a day spent learning what your claim is worth' : 'a day spent learning what the field has left', state.items.pan < 1),
      ];
      if (claim) {
        menu.push(
          item('A', 'Give up the claim', { type: 'abandonClaim' }, isWorkedOut(claim) ? 'worked out; peg fresh ground and start again' : 'the pegs come out, and any man may take it'),
        );
        menu.push(item('W', 'Pay a watchman for seven days — 5s', { type: 'guardClaim', camp, days: 7 }, 'he stays when you leave; registration and standing reduce the risk further', state.moneyPence < shillings(5)));
      }
      if (state.partner) {
        menu.push(item('N', 'Part with your partner', { type: 'dissolvePartnership' }, 'and keep all you win, and do all the work'));
      } else {
        menu.push(
          item('N', 'Go mates with a digger', { type: 'takePartner' },
            state.standing >= STANDING_PARTNER ? 'no wage, but a quarter of the gold' : 'no man here knows you well enough yet',
            state.standing < STANDING_PARTNER),
        );
      }
      if (camp === 'deep-mountains') {
        menu.push(item('9', 'The company office — shares and wages', { type: 'goto', screen: 'camp-shares' }, `shares at ${formatMoney(SHARE_PRICE)}`));
        menu.push(
          item(
            'C',
            state.company
              ? `The books of ${state.company.name}`
              : canFloat(state)
                ? 'Float a company of your own'
                : 'Ask about floating a company of your own',
            { type: 'goto', screen: 'company' },
            companyEntryNote(state),
          ),
        );
      }
      menu.push(
        item(
          'G',
          ownsThisShanty(state) ? 'Your own sly-grog shanty' : 'The grog tent',
          { type: 'goto', screen: 'camp-grog' },
          ownsThisShanty(state) ? 'no licence, no ledger, and it is yours' : 'illegal, and protected by the police for a fee',
        ),
      );
      if (state.shaft && state.shaft.camp === camp) {
        if (!state.shaft.timbered && state.items.timber > 0) {
          menu.push(item('T', 'Timber the shaft', { type: 'timberShaft' }, 'avoid cave-ins by installing timber supports'));
        }
        menu.push(item('X', 'Abandon the shaft', { type: 'abandonShaft' }, 'and start afresh somewhere else on your ground'));
      }
      if (state.secret && !state.secret.chased) {
        menu.push(item('S', 'Follow the talk of a secret mine', { type: 'followRumour' }, 'it may be a hoax'));
      }
      if (state.items.journal > 0) menu.push(item('J', 'Read A Goldfields Journal', { type: 'readJournal' }));
      menu.push(estateEntry(state, 'E'));
      menu.push(banditEntry(state, 'B'));
      menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
      return {
        screen: 'camp',
        title: def.name.toUpperCase(),
        subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
        body,
        menu,
      };
    }

    case 'camp-mine': {
      const methods: MiningMethod[] = ['fossick', 'pan', 'cradle', 'puddle', 'dryblow', 'shaft', 'company'];
      const menu: MenuItem[] = [];
      let n = 1;
      for (const m of methods) {
        const chk = checkMethod(state, m);
        if (!chk.ok && (m === 'puddle' || m === 'dryblow' || m === 'company')) {
          // Methods peculiar to one camp are simply not offered elsewhere.
          const wrongPlace =
            (m === 'puddle' && state.location !== 'snakey-gully') ||
            (m === 'dryblow' && state.location !== 'secret-mine') ||
            (m === 'company' && state.location !== 'deep-mountains');
          if (wrongPlace) continue;
        }
        let note = chk.ok ? undefined : chk.reason;
        if (m === 'cradle' && chk.ok && !hasMate(state)) note = 'without a mate the yields are halved';
        // The warning about watching your dirt is on the camp screen already;
        // this row has a season to carry as well and cannot hold both.
        if (m === 'puddle' && chk.ok) note = `${formatMoney(PUDDLER_RENT)} a day to the owner`;
        if (m === 'company' && chk.ok) note = 'wages, and none of the gold is yours';
        // The season decides half of what a method is worth, so it is said here,
        // where the choice is made, and not left to be inferred from the takings.
        if (chk.ok) {
          const weather = seasonEffect(state, m).note;
          if (weather) note = note ? `${note}; ${weather}` : weather;
        }
        menu.push(
          item(String(n++), METHOD_NAMES[m], { type: 'mine', method: m, days: state.spellDays }, note, !chk.ok),
        );
      }
      menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
      menu.push(back('camp'));
      return {
        screen: 'camp-mine',
        title: 'HOW WILL YOU WORK?',
        subtitle: `A spell of ${state.spellDays} day${state.spellDays === 1 ? '' : 's'} · ${titleCase(seasonPhrase(state.day))}`,
        body: [
          'Cradling is the easiest and surest way of finding gold, but never in such',
          'large quantities as are possible with shaft mining.',
        ],
        menu,
      };
    }

    case 'camp-store':
      return {
        screen: 'camp-store',
        title: "THE STOREKEEPER'S TENT",
        body: [
          'The tent carries food and equipment at the freight-heavy prices of the fields.',
          'It does not buy gold. For that you must take your dust to a bank in town.',
        ],
        menu: storeMenu(state, 'camp'),
        aside: storeAside(state),
      };

    case 'company':
      return companyView(state);

    // --- the civic ladder (§26-§28) ---------------------------------------
    case 'estate':
      return estateView(state);

    case 'press':
      return pressView(state);

    case 'court':
      return courtView(state);

    case 'camp-shares':
      return {
        screen: 'camp-shares',
        title: 'THE COMPANY OFFICE, DEEP MOUNTAINS',
        body: [
          'Big mines need many workers and plenty of money. Large companies are taking',
          'over from diggers as the main extractors of gold. A man may buy a share in one,',
          'or take their wages, or both.',
          '',
          `You hold ${state.shares} of a possible ${MAX_SHARES} shares.`,
        ],
        menu: [
          item('1', `Buy one share — ${formatMoney(SHARE_PRICE)}`, { type: 'buyShares', n: 1 }, 'a dividend at year end, if the company does well', state.shares >= MAX_SHARES || state.moneyPence < SHARE_PRICE),
          item('2', `Buy three shares — ${formatMoney(SHARE_PRICE * 3)}`, { type: 'buyShares', n: 3 }, undefined, state.shares > 0 || state.moneyPence < SHARE_PRICE * 3),
          item('3', 'Take a shift on wages', { type: 'mine', method: 'company', days: state.spellDays }),
          item(
            '4',
            state.company
              ? `Open the books of ${state.company.name}`
              : canFloat(state)
                ? 'Float a company of your own'
                : 'Ask about floating a company of your own',
            { type: 'goto', screen: 'company' },
            companyEntryNote(state),
          ),
          back('camp'),
        ],
      };


    // --- the dark ladder (§23) --------------------------------------------
    case 'bandit':
      return banditView(state);

    case 'bandit-roads':
      return roadsView(state);

    case 'gang':
      return gangView(state);

    case 'hideout':
      return hideoutView(state);

    case 'stash':
      return stashView(state);

    // --- encounters --------------------------------------------------------
    case 'encounter': {
      if (state.pending?.kind === 'claimJumper') {
        const camp = state.pending.data?.camp as CampId;
        const claim = state.claims[camp];
        return {
          screen: 'encounter',
          title: 'STRANGERS ON YOUR CLAIM',
          body: [
            'Two men have shifted your pegs and put down a shallow hole. One says the ground',
            'was deserted; the other keeps a hand near his belt. They know who you are—or do not.',
            '',
            claim?.registered
              ? 'Your claim is in the Council ledger, with its date and boundaries.'
              : 'You never registered the ground. At the Council it would be your word against theirs.',
          ],
          menu: [
            item('1', 'Order them off and stand your ground', { type: 'answerClaimJumper', choice: 'confront' }, 'standing, a gun and a mate all strengthen your hand'),
            item('2', 'Take the dispute to the Council', { type: 'answerClaimJumper', choice: 'council' }, claim?.registered ? 'lose two days, but registered ground is hard to steal' : 'without registration the result is doubtful'),
            item('3', 'Pull your remaining pegs and walk away', { type: 'answerClaimJumper', choice: 'abandon' }),
          ],
        };
      }
      if (state.pending?.kind === 'bailup') return bailUpView(state);
      if (state.pending?.kind === 'patrol' || state.pending?.kind === 'hideoutRaid') {
        return patrolView(state);
      }
      if (state.pending?.kind === 'shantyRaid') return shantyRaidView(state);
      if (state.pending?.kind === 'assizes') return assizesView(state);
      if (state.pending?.kind === 'pardon') return pardonView(state);
      if (state.pending?.kind === 'meeting') {
        return {
          screen: 'encounter',
          title: 'A MONSTER MEETING',
          body: [
            'They are lighting torches on the flat below the camp, and men are coming in',
            'from every gully with their hats off and their pipes out. There will be',
            'speeches against the fee, against the Commissioner, and against the hunts;',
            'a hundred men will put their names to a petition and a good many more will',
            'shout for something a deal stronger than a petition.',
            '',
            `The field is ${agitationWord(state.agitation)} on the licence question tonight.`,
          ],
          menu: [
            item('1', 'Go down and stand with them', { type: 'attendMeeting', attend: true },
              state.legal === 'honest'
                ? 'a man is known by the meetings he is seen at'
                : 'and the traps take names, and they have yours already'),
            item('2', 'Keep to your tent', { type: 'attendMeeting', attend: false }, 'politics never washed a dish of dirt'),
          ],
        };
      }
      if (state.pending?.kind === 'stockade') {
        const canSell = canSellSupplies(state);
        return {
          screen: 'encounter',
          title: `THE STOCKADE AT ${CAMP_DEFS[STOCKADE_CAMP].name.toUpperCase()}`,
          body: [
            'The diggers have thrown up a stockade of slabs and overturned drays on the',
            'flat, and hoisted a flag of their own over it — the Cross of the south, in',
            'white on blue. Inside, men are drilling with pikes made that afternoon and',
            'swearing by the Southern Cross to stand by each other. The soldiers are',
            'camped a mile off and everybody knows what the morning brings.',
            '',
            'It will not hold. Everybody knows that too.',
          ],
          menu: [
            item('1', 'Go in behind the slabs with them', { type: 'joinStockade' }, 'and take what comes of it'),
            item('2', 'Keep well clear of the whole business', { type: 'keepClear' }, 'you came out to dig gold, not to be shot at'),
            item(
              '3',
              'Sell to both sides while you may',
              { type: 'sellSupplies' },
              canSell ? 'flour and powder fetch what you ask tonight; the field will remember it' : 'you have nothing either side would buy',
              !canSell,
            ),
          ],
        };
      }
      if (state.pending?.kind === 'trooper') {
        return {
          screen: 'encounter',
          title: 'A TROOPER HAS YOU',
          body: [
            'A rough-looking sergeant has you by the collar and wants to see a licence',
            'you have not got. A lot of the police are good men following orders, and a',
            'lot are as corrupt as five-day-old fish.',
          ],
          menu: [
            item('1', 'Offer him a five pound note', { type: 'bribe' }, 'a fiver is a good-sized bribe for most troopers', state.moneyPence < 1200),
            item('2', 'Go quietly to the logs', { type: 'submit' }, 'and wait for the travelling magistrate'),
            item('3', 'Make a run for the scrub', { type: 'resist' }, 'if he catches you it will go the worse'),
          ],
        };
      }
      return {
        screen: 'encounter',
        title: 'BAILED UP',
        body: [
          'Two men step out of the scrub with their faces covered. So many villains are',
          'drawn here that you should be armed.',
        ],
        menu: [
          item('1', state.items.gun > 0 ? 'Show them your loaded piece' : 'Fight them', { type: 'resist' }, state.items.gun > 0 ? 'they usually think better of it' : 'unarmed, and against two'),
          item('2', 'Hand over what you have', { type: 'submit' }, 'you cannot complain about it when you are dead'),
        ],
      };
    }

    // --- end ---------------------------------------------------------------
    case 'end':
      return endView(state);

    case 'obituary':
      return {
        screen: 'obituary',
        title: 'THE ANGUS GAZETTE — DEATHS',
        body: [
          deathNotice(state),
          '',
          `A new chum of ${state.day} days on the diggings, who won ${formatGold(state.stats.goldWon)} of gold in all,`,
          `and left ${formatMoney(state.moneyPence + state.bankPence)} and ${formatGold(state.goldCentiOz)} behind.`,
          '',
          ...buriedRumourLines(state),
          ...(state.outlawed || state.notoriety >= 15
            ? [
                'Few men on these diggings are killed by bushrangers. The bushranger',
                'himself is another matter, and does not commonly die of old age.',
              ]
            : [
                'Disease kills more people than do accidents, and only rarely is anyone killed',
                'by bushrangers. There would be many unmarked graves in the bush.',
              ]),
          '',
          ...epilogueFor(state),
        ],
        menu: [item('1', 'Begin again', { type: 'newGame' }), item('0', 'Return to the title', { type: 'quitToTitle' })],
      };

    default:
      return {
        screen: state.screen,
        title: locationName(state.location).toUpperCase(),
        body: [statusLine(state)],
        menu: [item('0', 'Continue', { type: 'continue' })],
      };
  }
}


// ---------------------------------------------------------------------------
// THE DARK LADDER (§23-§24)
// ---------------------------------------------------------------------------

function bushArticle(rank: BushRank): string {
  return rank === 'captain' ? 'a captain' : rank === 'flash cove' ? 'a flash cove' : 'a new chum';
}

function roadName(route: Route): string {
  return route === 'pass' ? 'the Pass Road' : "Trickey's Track";
}

/** What a man's papers are worth to a harbourer, put in a line (§23.4). */
function intelLine(state: GameState): string | null {
  const i = state.intel;
  if (!i || i.untilDay < state.day) return null;
  switch (i.kind) {
    case 'escort':
      return `You hold the word on the gold escort — ${i.strength ?? 6} troopers — good until day ${i.untilDay}.`;
    case 'bank':
      return `You know the bank's gold room is full, and will be until day ${i.untilDay}.`;
    default:
      return `A fat traveller is due on ${roadName((i.route ?? 'trickeys') as Route)} before day ${i.untilDay}.`;
  }
}

/** The heat books, in the words a shanty keeper would use. */
function heatLines(state: GameState): string[] {
  const zones: [HeatZone, string][] = [
    ['trickeys', "Trickey's Track"],
    ['pass', 'the Pass Road'],
    ['town', 'the two towns'],
    ['camps', 'the camps and ranges'],
  ];
  return zones.map(([z, name]) => `  ${tally(name, heatWord(heatOf(state, z)))}`);
}

/**
 * Everything a man may do that he would not care to explain. Options that are
 * not open to him yet are shown greyed with the reason, which is how this game
 * teaches everything else.
 */
export function banditView(state: GameState): ScreenView {
  const camp = isCamp(state.location);
  const town = state.location === 'fields-town' || state.location === 'suze-port';
  const body: string[] = [];
  body.push(
    camp || state.location === 'hideout'
      ? 'The sly-grog shanty at the back of the gully keeps no licence and no ledger, and the men in it have all been somewhere they would rather not name.'
      : 'There is a room behind the Shamrock where the talk stops when a stranger comes in, and a harbourer who will sell a word to a man he knows.',
  );
  body.push('');
  body.push(`The colony reckons you ${notorietyPhrase(state.notoriety)}.`);
  body.push(`In the bush you are ${bushArticle(bushRankOf(state))}.`);
  const reward = rewardFor(state);
  if (reward > 0) body.push(`There is ${formatMoney(reward)} on your head.`);
  body.push('');
  body.push('How the traps are riding:');
  body.push(...heatLines(state));
  const intel = intelLine(state);
  if (intel) {
    body.push('');
    body.push(intel);
  }
  if (state.gang.length > 0) {
    body.push('');
    body.push(`Riding with you: ${state.gang.map((g) => g.name).join(', ')}.`);
  }
  if (state.ambush) {
    body.push('');
    body.push('Somebody has sold you, and whatever you do next they will be ready for it.');
  }

  const roads = canBailUp(state);
  const hide = canMakeHideout(state);
  const gangGate = canRecruit(state);
  const job = canBigJob(state);
  const cost = intelCost(state);
  const menu: MenuItem[] = [
    item('1', 'Take to the roads', { type: 'goto', screen: 'bandit-roads' }, roads.note, !roads.ok),
    item(
      '2',
      cost > 0 ? `Buy a word of a harbourer — ${formatMoney(cost)}` : 'Hear what the shanty has to say',
      { type: 'gatherIntelligence' },
      crimeVisible(state)
        ? 'a day, and a plan instead of a coin toss'
        : 'the harbourers keep their words for men they know',
      !crimeVisible(state) || state.moneyPence < cost,
    ),
    item(
      '3',
      'Look for a man to ride with',
      { type: 'recruitGangMember' },
      gangGate.note,
      !gangGate.ok,
    ),
  ];
  if (state.gang.length > 0) {
    menu.push(item('4', 'The men who ride with you', { type: 'goto', screen: 'gang' }, `${state.gang.length} of a possible ${GANG_MAX}`));
  }
  if (state.location === 'deep-mountains' || !state.hideout) {
    menu.push(
      item('5', 'Make a camp in the ranges', { type: 'makeHideout' }, hide.note, !hide.ok),
    );
  }
  if (state.hideout && state.location !== 'hideout') {
    menu.push(
      item('6', 'Ride up to the camp in the ranges', { type: 'travelTo', place: 'hideout' }, 'safe sleep, and the stash under the stone'),
    );
  }
  if (state.location === 'fields-town') {
    menu.push(
      item('7', 'Stick up the Bank of Australasia', { type: 'robBank' }, job.ok ? 'the safe is at the far end, by the manager’s bed' : job.note, !job.ok),
    );
  }
  menu.push(
    item(
      '8',
      "Take the gold escort on Trickey's Track",
      { type: 'robEscort' },
      !job.ok
        ? job.note
        : state.intel?.kind === 'escort' && state.intel.untilDay >= state.day
          ? 'you know the day and the strength of it'
          : 'blind, and blind is how men ambush an empty road',
      !job.ok,
    ),
  );
  if (camp || state.location === 'hideout') {
    menu.push(
      item('F', `Put your gold through the fence — ${formatMoney(fenceRate(state))} the oz`, { type: 'fenceGold' },
        state.estate.shanty === state.location
          ? 'eight parts in ten of the bank, and the scales in that hut are yours'
          : 'six or seven parts in ten of the bank, and his scales are his own',
        state.goldCentiOz <= 0),
    );
  }
  // The dark ladder's own two sinks: respectability refuses him, so he buys
  // the room the talk is spoken in, and a man to speak for him (§28.3).
  if (camp && !state.estate.shanty) {
    menu.push(
      item('S', `Buy the sly-grog shanty here — ${formatMoney(SHANTY_PRICE)}`, { type: 'buyShanty' },
        state.notoriety < SHANTY_NOTORIETY
          ? `the keeper sells to men he has heard of; ${SHANTY_NOTORIETY} notoriety, and you have ${Math.floor(state.notoriety)}`
          : 'his scales become your scales, and every word in the place is yours',
        state.notoriety < SHANTY_NOTORIETY || state.moneyPence < SHANTY_PRICE),
    );
  }
  if (state.estate.shanty) {
    menu.push(
      item('L', `Retain an attorney — ${formatMoney(LAWYER_FEE)} the quarter`, { type: 'retainLawyer' },
        state.estate.lawyerUntilDay >= state.day
          ? `retained to day ${state.estate.lawyerUntilDay}; a defended trial instead of a plea`
          : 'at the assizes it is the difference between a defence and a plea; never for blood',
        state.moneyPence < LAWYER_FEE),
    );
  }
  if (state.location === 'suze-port') {
    const passage = canBuyPassage(state);
    menu.push(
      item('P', `A berth for California — ${formatMoney(PASSAGE_FARE)}`, { type: 'buyPassage' }, passage.note, !passage.ok),
    );
  }
  if (town && state.location === 'suze-port') {
    menu.push(item('T', 'Take what is not yours', { type: 'goto', screen: 'suze-crime' }));
  }
  menu.push(back(homeScreenFor(state)));
  return {
    screen: 'bandit',
    title: 'BUSINESS OF ANOTHER KIND',
    subtitle: `${formatDate(state.day)} · ${notorietyPhrase(state.notoriety)}`,
    body,
    menu,
  };
}

/** Which road to lie above (§23.4). */
export function roadsView(state: GameState): ScreenView {
  const gate = canBailUp(state);
  const body: string[] = [
    'Two roads run inland from the coast, and everything that leaves the diggings',
    'with gold on it comes down one or the other. A man with a horse, a pistol and',
    'the patience for it may lie above either and see what the day brings.',
    '',
    ...heatLines(state).slice(0, 2),
  ];
  const intel = intelLine(state);
  if (intel && state.intel?.kind === 'traveller') {
    body.push('');
    body.push(intel);
  }
  if (state.horse === 'none') {
    body.push('');
    body.push('You have no horse. A man afoot who is seen on a road is a man taken on it.');
  }
  const routes: Route[] = ['trickeys', 'pass'];
  const menu: MenuItem[] = routes.map((r, i) =>
    item(
      String(i + 1),
      `Lie up above ${roadName(r)}`,
      { type: 'bailUp', route: r },
      `${ROUTES[r].blurb} The district is ${heatWord(heatOf(state, r === 'pass' ? 'pass' : 'trickeys'))}.`,
      !gate.ok,
    ),
  );
  menu.push(back('bandit'));
  return { screen: 'bandit-roads', title: 'THE ROADS', body, menu };
}

export function gangView(state: GameState): ScreenView {
  const body: string[] = [
    'No wages are paid and none are asked. Every man takes an equal share of what',
    'the jobs bring, and every man knows to a penny what is on the captain’s head.',
    '',
  ];
  if (state.gang.length === 0) {
    body.push('Nobody rides with you. Whatever is done is done alone.');
  } else {
    for (const g of state.gang) {
      const word =
        g.loyalty >= 0.75 ? 'would hang beside you' : g.loyalty >= 0.45 ? 'steady enough' : 'watches the door too often';
      body.push(`  ${g.name} — joined day ${g.joined}, ${word}`);
    }
  }
  const gate = canRecruit(state);
  const menu: MenuItem[] = [
    item('1', 'Look for another man', { type: 'recruitGangMember' }, gate.note, !gate.ok),
  ];
  state.gang.forEach((g, i) =>
    menu.push(item('ABC'[i] ?? 'D', `Pay off ${g.name}`, { type: 'dismissGangMember', index: i }, 'and one fewer mouth to tell the traps')),
  );
  menu.push(back('bandit'));
  return { screen: 'gang', title: 'THE MEN WHO RIDE WITH YOU', body, menu };
}

export function hideoutView(state: GameState): ScreenView {
  const h = state.hideout;
  const body: string[] = [
    'A saddle in the ranges with a spring in it, one way in, and four miles of',
    'country visible from the rock above the fire. Nobody comes here who has not',
    'been brought. The sleep is free and it is the only safe sleep you get.',
    '',
  ];
  if (h) {
    body.push(`Under the flat stone: ${formatMoney(h.stashPence)} and ${formatGold(h.stashGold)}.`);
    body.push(`Worth of the stash at the bank's rate: ${formatMoney(stashWorth(state))}.`);
  }
  body.push(`The camps and the ranges are ${heatWord(heatOf(state, 'camps'))}.`);
  const search = state.diggersRobbed > 0
    ? 'You have robbed diggers, and the field informs on you. They will come up these gullies sooner for it.'
    : 'The field has no quarrel with you, and nobody down there has told them where this is.';
  body.push(search);

  const menu: MenuItem[] = [
    item('1', 'The stash under the stone', { type: 'goto', screen: 'stash' }, h ? `${formatMoney(stashWorth(state))} buried` : undefined),
    item('2', 'Lie up a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days, and the heat going off the districts`),
    item('3', 'Business of another kind', { type: 'goto', screen: 'bandit' }),
    item('4', 'Ride down to the Deep Mountains', { type: 'travelTo', place: 'deep-mountains' }),
    item('5', 'Ride down to Fields Town', { type: 'travelTo', place: 'fields-town' }),
    item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`),
  ];
  return {
    screen: 'hideout',
    title: 'THE CAMP IN THE RANGES',
    subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
    body,
    menu,
  };
}

export function stashView(state: GameState): ScreenView {
  const h = state.hideout;
  const body: string[] = [
    'An oilcloth parcel in a tin, under a flat stone at the foot of the rock, with',
    'the ground stamped back down over it. It is the only bank that will have you.',
    '',
    `Buried: ${formatMoney(h?.stashPence ?? 0)} and ${formatGold(h?.stashGold ?? 0)}.`,
    `About you: ${formatMoney(state.moneyPence)} and ${formatGold(state.goldCentiOz)}.`,
  ];
  const menu: MenuItem[] = [
    item('1', 'Bury everything in your pockets', { type: 'stash', what: 'money', amount: -1 }, undefined, state.moneyPence <= 0),
    item('2', 'Bury all your gold', { type: 'stash', what: 'gold', amount: -1 }, undefined, state.goldCentiOz <= 0),
    item('3', 'Lift a pound out', { type: 'unstash', what: 'money', amount: pounds(1) }, undefined, (h?.stashPence ?? 0) < pounds(1)),
    item('4', 'Lift five pounds out', { type: 'unstash', what: 'money', amount: pounds(5) }, undefined, (h?.stashPence ?? 0) < pounds(5)),
    item('5', 'Lift the lot out', { type: 'unstash', what: 'money', amount: -1 }, undefined, (h?.stashPence ?? 0) <= 0),
    item('6', 'Lift the gold out', { type: 'unstash', what: 'gold', amount: -1 }, undefined, (h?.stashGold ?? 0) <= 0),
    back('hideout'),
  ];
  return { screen: 'stash', title: 'UNDER THE FLAT STONE', body, menu };
}

/** How each sort of traveller takes it, once the word is said. */
const VICTIM_STAND: Record<string, string[]> = {
  newchum: [
    'The lad has his hands up before the word is out of your mouth, and higher',
    'than they need to be. He has read about this in a book on the ship.',
  ],
  digger: [
    'It is a digger with his year under his shirt. A digger’s pile is a year of',
    'wet feet and bad water, and the field does not forgive the man who takes one.',
  ],
  squatter: [
    'The horses are pulled up hard and the gentleman on the box is the colour of',
    'his own wool. He is calculating what the box under the seat is worth to him.',
  ],
  chinese: [
    'They set the poles down in the dust together, without a word between them,',
    'and wait. They have done this before and they know how long it takes.',
  ],
  parson: [
    'He does not put his hands up. He looks at the pistol, and then past it at you,',
    'and asks whether you would not rather have his dinner and his blessing.',
  ],
  buyer: [
    'The driver reaches for something under the seat and thinks better of it. The',
    'box is there under the tarpaulin, and every man on this road knows what is in it.',
  ],
  trooper: [
    'The carbine is across his saddle and his hand is on it, and he is looking at',
    'you the way a man looks at a thing he will describe under oath.',
  ],
};

/** The traveller stands in the road with his hands where you can see them. */
function bailUpView(state: GameState): ScreenView {
  const id = String(state.pending?.data?.victim ?? 'newchum');
  const victim = BAILUP_VICTIMS.find((v) => v.id === id);
  const digger = !!victim?.digger;
  const knows = state.pending?.data?.knows === true;
  // A party on the road is "them"; everybody else on the table is one man.
  const them = id === 'chinese';
  const him = them ? 'them' : 'him';
  const stand = VICTIM_STAND[id] ?? [
    'He has stopped. He is weighing you, the pistol, the distance to the timber,',
    'and how much he minds losing what he is carrying.',
  ];
  return {
    screen: 'encounter',
    title: 'STAND AND DELIVER',
    body: [
      'You step out of the timber with the pistol up and the word said, and the whole',
      'business now turns on the next half minute and on nothing else.',
      '',
      ...stand,
      ...(knows
        ? [
            '',
            them
              ? 'They have heard the name before, and none of them has the least intention'
              : 'He has heard the name before, and it is plain in his face that he has no',
            them
              ? 'of being the party that argued with it.'
              : 'intention whatever of being the man who argued with it.',
          ]
        : []),
    ],
    menu: [
      item('1', `Order ${him} to deliver`, { type: 'bailUpTake', shoot: false }, `and take what ${them ? 'they have' : 'he has'}`),
      item('2', `Cover ${him}, and fire if ${them ? 'they move' : 'he moves'}`, { type: 'bailUpTake', shoot: true }, 'they hang men for what may follow'),
      item(
        '3',
        `Let ${him} go by`,
        { type: 'letPass' },
        digger ? 'a digger’s pile is safe with you, and the camps will hear of it' : 'and take nothing at all',
      ),
    ],
  };
}

/** Troopers, and three ways of answering them. */
function patrolView(state: GameState): ScreenView {
  const raid = state.pending?.kind === 'hideoutRaid';
  return {
    screen: 'encounter',
    title: raid ? 'THE CAMP IS FOUND' : 'TROOPERS',
    body: raid
      ? [
          'They are coming up the only way in, on foot and spread out, and there is a',
          'sergeant behind them with a warrant and a great deal of patience. The stash is',
          'under the stone at your feet and there is no time to lift it.',
        ]
      : [
          'Mounted police, and they have seen you. There is a carbine across the nearest',
          'saddle and a description of you in the sergeant’s pocket that he has read so',
          'often he could recite it.',
        ],
    menu: [
      item('1', 'Ride for the gullies', { type: 'flee' }, state.horse === 'none' ? 'afoot, which is how men are taken' : 'what a horse and a knowledge of the country are for'),
      item('2', 'Stand and fight them', { type: 'resist' }, state.items.gun > 0 ? 'and cross the line there is no coming back over' : 'unarmed, against carbines'),
      item('3', 'Put your hands where they can see them', { type: 'submit' }, state.outlawed ? 'and answer for it at the assizes' : 'and take what the magistrate gives'),
    ],
  };
}

/** Waiting on the judge who is coming up from the capital (§24). */
function assizesView(state: GameState): ScreenView {
  const canBreak = canBreakGaol(state);
  return {
    screen: 'encounter',
    title: 'THE FIELDS TOWN LOCK-UP',
    body: [
      'A slab hut with a chain running through it and a trooper on the door. The',
      'monthly magistrate is not mentioned; you are for the assizes, and a judge is',
      'coming up from the capital for the purpose.',
      '',
      state.bloodShed
        ? 'There is blood on this account. Everybody in the hut knows what the assizes do about blood, and nobody says it.'
        : 'No man died at your hands, which is the whole of the difference between the yard and the hulks.',
      '',
      canBreak
        ? 'Word comes in with the bread that there are men on this field willing to be somewhere else at two in the morning.'
        : 'Nobody outside is offering to be anywhere near this wall tonight.',
    ],
    menu: [
      item(
        '1',
        'Try the wall tonight',
        { type: 'breakGaol' },
        canBreak ? 'two chances in five, and the sentence doubled if it fails' : 'there is nobody out there who would risk it for you',
        !canBreak,
      ),
      item('2', 'Wait for the assizes', { type: 'awaitAssizes' }, 'and let the judge say it'),
    ],
  };
}

/** The amnesty that followed December, offered once (§24). */
function pardonView(state: GameState): ScreenView {
  return {
    screen: 'encounter',
    title: 'THE AMNESTY',
    body: [
      'The men taken at the stockade have been tried and acquitted to a man, and the',
      'Government, having lost the licence, has no appetite left for hanging anybody.',
      'A magistrate who saw you behind the slabs sends word: the amnesty is a wide one,',
      'and he is willing to read it widely.',
      '',
      `It will cost the whole of the stash — ${formatMoney(stashWorth(state))} — paid into the court as restitution,`,
      'and the proclamation against you is withdrawn. The name stays; the price on it goes.',
    ],
    menu: [
      item('1', 'Take the pardon', { type: 'takePardon', take: true }, 'everything under the stone, for the right to be nobody again'),
      item('2', 'Refuse it', { type: 'takePardon', take: false }, 'and stay out in the ranges with what you have'),
    ],
  };
}

/**
 * What this camp is, and what a man can do here that he can do nowhere else
 * (§21). The prose is fixed to the day so a screen looked at twice reads the
 * same twice.
 */
function campCharacter(state: GameState, camp: CampId): string[] {
  const lines: string[] = [sayFixed(`camp.${camp}.lead`, state.day * 31 + camp.length)];
  const weather = `camp.${camp}.${season(state.day)}`;
  if (hasKey(weather)) lines.push(sayFixed(weather, state.day * 17 + 5));

  // Then whatever there is here to be done about it.
  switch (camp) {
    case 'snakey-gully':
      lines.push(
        `The horse-powered puddling machine stands at the head of the gully; ${formatMoney(PUDDLER_RENT)} the day to the man who owns it, and watch your piece of dirt while he works it.`,
      );
      break;
    case 'deep-mountains':
      lines.push(
        state.company
          ? `The office of ${state.company.name} keeps its books at the end of the flat, and they are your books.`
          : canFloat(state)
            ? 'The company office is at the end of the flat, and the registrar is ready to write you up as a company of your own.'
            : `The company office is at the end of the flat: shares, wages underground, and a registrar who will tell you what is needed to float a company of your own.`,
      );
      break;
    case 'secret-mine':
      lines.push(
        'There is no water within forty miles. Dryblowing is the only way of it here, and the desert takes its price out of you daily.',
      );
      break;
    default:
      break;
  }
  return lines;
}

/** What the ground here is like today — the first thing a man notices, and why camps differ. */
function groundLine(state: GameState, camp: CampId): string {
  if (state.rush && state.rush.camp === camp && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    const days = state.rush.untilDay - state.day + 1;
    return `A RUSH is on here. Every hole has three men in it, and the best of the ground will be pegged over inside ${days} day${days === 1 ? '' : 's'}.`;
  }
  const f = state.freshness[camp] ?? 1;
  if (f >= 1.25) return 'The ground here is all but untouched; the gullies have hardly been scratched.';
  if (f >= 1.0) return 'There is good ground here yet, and room enough to peg it.';
  if (f >= 0.8) return 'The flat has been well worked over, though there is gold in it still for a patient man.';
  if (f >= 0.6) return 'Old ground, this: mullock heaps to the skyline and the creek turned over twice.';
  return 'The field is picked clean. Whole streets of tents have gone elsewhere and left their holes behind.';
}

// ---------------------------------------------------------------------------
// THE CIVIC LADDER (§26-§28)
// ---------------------------------------------------------------------------

/** The deeds in the strongbox, and what a man of property may buy next. */
export function estateView(state: GameState): ScreenView {
  const e = state.estate;
  const home = homeScreenFor(state);
  const inTown = state.location === 'fields-town';
  const camp = isCamp(state.location) ? (state.location as CampId) : null;
  const body: string[] = [
    'Half the men on this field dig, and the other half supply the men who dig,',
    'and it is not the diggers who are buying land at Suze Port. What follows is',
    'bought with clean money, and pays in something other than gold.',
    '',
  ];
  const deeds = estateDeeds(state);
  if (deeds.length) {
    body.push('YOUR DEEDS');
    for (const d of deeds) body.push(`  ${d}`);
    body.push(`The estate turns in about ${formatMoney(estateWeeklyIncome(state))} the week, paid wherever you stand.`);
  } else {
    body.push('You hold no property whatever. Every man on this field began that way.');
  }
  if (e.works.length) {
    body.push('');
    body.push('SUBSCRIBED AT THE CHAMBERS');
    for (const w of e.works) body.push(`  ${WORK_NAMES[w.id]}${w.camp ? `, to ${CAMP_DEFS[w.camp].name}` : ''}`);
  }
  if (e.jpSince !== null) {
    body.push('');
    body.push(`Gazetted a Justice of the Peace on day ${e.jpSince}. The court sits at Fields Town on day ${e.nextCourtDay}.`);
  }

  const menu: MenuItem[] = [];
  if (!e.shamrock) {
    const unmet = shamrockRequirements(state).filter((r) => !r.met);
    menu.push(
      item('1', `Buy the Shamrock Hotel — ${formatMoney(SHAMROCK_PRICE)}`, { type: 'buyShamrock' },
        unmet.length === 0
          ? 'Mrs. Doyle stays on to run it; every rumour on this field crosses that bar'
          : `wants ${unmet[0].text}`,
        unmet.length > 0),
    );
  }
  if (!e.store) {
    const target: CampId = camp ?? 'damp-camp';
    const unmet = storeRequirements(state, target).filter((r) => !r.met);
    menu.push(
      item('2', `Open a store of your own — ${formatMoney(STORE_PRICE)} and ${formatMoney(STORE_STOCK_PRICE)} of stock`,
        { type: 'openStore', camp: target },
        camp
          ? unmet.length === 0
            ? `a counter at ${CAMP_DEFS[camp].name}; when the rush comes here you are the one selling`
            : `wants ${unmet[0].text}`
          : 'a store is opened at a camp, standing on the ground',
        unmet.length > 0),
    );
  } else {
    const store = e.store;
    menu.push(
      item('F', 'Deal fairly with the field', { type: 'setStorePolicy', policy: 'fair' },
        store.policy === 'fair' ? 'your prices already' : 'half the profit, and the camp protects its honest man',
        store.policy === 'fair'),
    );
    menu.push(
      item('G', 'Charge what the rush will bear', { type: 'setStorePolicy', policy: 'gouge' },
        store.policy === 'gouge' ? 'your prices already' : 'twice the profit, and the field remembers',
        store.policy === 'gouge'),
    );
  }
  if (!e.gazetteShare) {
    const unmet = gazetteRequirements(state).filter((r) => !r.met);
    menu.push(
      item('3', `Buy a half-share in The Angus Gazette — ${formatMoney(GAZETTE_SHARE_PRICE)}`, { type: 'buyGazetteShare' },
        unmet.length === 0 ? 'a pound a week, and the ear of eleven thousand men' : `wants ${unmet[0].text}`,
        unmet.length > 0),
    );
  } else {
    menu.push(
      item('P', 'The Angus office — set a story', { type: 'goto', screen: 'press' },
        inTown
          ? storyDue(state)
            ? 'the press is idle and the type is standing'
            : `the next story in ${daysToNextStory(state)} day${daysToNextStory(state) === 1 ? '' : 's'}`
          : 'copy is set in Briggs Street, not shouted across forty miles of scrub',
        !inTown || !storyDue(state)),
    );
  }
  if (inTown) {
    menu.push(item('W', 'The Council Chambers — the subscription list', { type: 'goto', screen: 'ftown-council' }, 'bridges, races, wards and schools'));
  }
  menu.push(back(home));
  return {
    screen: 'estate',
    title: 'YOUR PROPERTY IN THE DISTRICT',
    body,
    menu,
  };
}

/** The Angus office: a flatbed press, and the ear of the whole field. */
export function pressView(state: GameState): ScreenView {
  const body: string[] = [
    'Mr. Angus sets the type himself when the boy is drunk, which is on Fridays.',
    'The paper goes out on Saturday to every camp on the field, and what it says',
    'is believed by more men than have ever met a proprietor of it.',
    '',
    storyDue(state)
      ? `The press is idle. One story in ${STORY_COOLDOWN_DAYS} days is all the paper it has.`
      : `Nothing further can be set for ${daysToNextStory(state)} day${daysToNextStory(state) === 1 ? '' : 's'}.`,
  ];
  const camps: CampId[] = ['damp-camp', 'snakey-gully', 'deep-mountains'];
  const ready = storyDue(state) && state.location === 'fields-town';
  const menu: MenuItem[] = camps.map((c, i) =>
    item(String(i + 1), `Cry up the ground at ${CAMP_DEFS[c].name}`, { type: 'placeStory', kind: 'talkUp', camp: c },
      'a rush there in two days; try the ground with a dish first, or the field will learn whose paper called it',
      !ready),
  );
  menu.push(item('4', 'Press the licence question', { type: 'placeStory', kind: 'pressLicence' }, 'the field grows angrier, and the next hunt is printed before it runs', !ready));
  menu.push(item('5', 'Counsel patience', { type: 'placeStory', kind: 'soothe' }, 'a leading article, and the field simmers a degree lower', !ready));
  menu.push(
    item('6', 'Kill a notice concerning yourself', { type: 'placeStory', kind: 'killNotice' },
      state.estate.noticeKillUsed
        ? 'Angus has done that for you once this year, and has a memory'
        : 'a fortnight in which the Camp is not reminded of you',
      !ready || state.estate.noticeKillUsed || state.outlawed),
  );
  menu.push(back('estate'));
  return { screen: 'press', title: 'THE ANGUS GAZETTE, BRIGGS STREET', body, menu };
}

/** The Local Court, in the Council's main hall, with the field at the back of it. */
export function courtView(state: GameState): ScreenView {
  const docket = courtDocket(state);
  const body: string[] = [
    'A table, a Bible, a constable at the door and the whole of the diggings at',
    'the back of the hall, because a court on a goldfield is the best free',
    'entertainment in the district.',
    '',
    'BEFORE THE BENCH TODAY',
  ];
  for (const c of docket) {
    body.push(`  ${c.charge}`);
    body.push('');
  }
  return {
    screen: 'court',
    title: 'THE LOCAL COURT, FIELDS TOWN',
    subtitle: `${formatDate(state.day)} · ${docket.length} cases`,
    body,
    menu: [
      item('1', 'Deal lightly with them', { type: 'rule', ruling: 'leniency' }, 'the camps go quieter, and the field loves a soft bench'),
      item('2', 'Give them the full weight of the law', { type: 'rule', ruling: 'severity' }, 'the thieves go elsewhere for a month, and nobody drinks your health'),
    ],
  };
}

/** The morning after the troopers came for the shanty (§28.3). */
function shantyRaidView(state: GameState): ScreenView {
  const camp = state.pending?.data?.camp;
  return {
    screen: 'encounter',
    title: 'THE TRAPS BURN OUT THE SHANTY',
    body: [
      'They came down on the place at four in the morning with axes and a lamp,',
      'staved in every cask, took the scales away on a pack-horse and put a match',
      'to the bark roof. There is nothing to be done and nobody to complain to:',
      'the shanty was never on any paper in this colony, which was the whole of',
      'its value until this morning.',
      '',
      typeof camp === 'string'
        ? `Eighty pounds, gone at ${CAMP_DEFS[camp as CampId].name} in under an hour.`
        : 'Eighty pounds, gone in under an hour.',
    ],
    menu: [item('1', 'Watch it burn, and say nothing', { type: 'continue' })],
  };
}

/** The company office: the prospectus if there is no company, the books if there is. */
export function companyView(state: GameState): ScreenView {
  const c = state.company;
  const where = state.location === 'deep-mountains' ? 'camp' : state.location === 'suze-port' ? 'suze' : 'ftown';

  if (!c) {
    const reqs = floatRequirements(state);
    const body: string[] = [
      'The registrar keeps a ledger of companies, a box of blank scrip and a pot of',
      'sealing wax. Twenty shares to a company, ten pounds the share: the promoter',
      'takes what he will carry, and the public are invited to the rest.',
      '',
      `Registration fee: ${formatMoney(COMPANY_REGISTRATION_FEE)}. Before he will write you up he requires:`,
    ];
    for (const r of reqs) body.push(`  ${r.met ? '✓' : '✗'} ${r.text}`);
    if (!reqs.every((r) => r.met)) {
      body.push('');
      body.push('Come back when you can answer for all of it.');
    }
    const ok = canFloat(state);
    const menu: MenuItem[] = COMPANY_SUBSCRIPTIONS.map((n, i) => {
      const outlay = COMPANY_REGISTRATION_FEE + subscriptionCost(n);
      return item(
        String(i + 1),
        `Subscribe ${n} of the twenty shares — ${formatMoney(subscriptionCost(n))}`,
        { type: 'floatCompany', shares: n },
        `with the fee, ${formatMoney(outlay)} down; ${20 - n} shares offered to the public`,
        !ok || purse(state) < outlay,
      );
    });
    menu.push(back(where));
    return {
      screen: 'company',
      title: 'THE REGISTRAR OF COMPANIES',
      subtitle: 'Twenty shares at ten pounds',
      body,
      menu,
    };
  }

  const worth = companyWorth(state);

  // The books are a ledger, not prose, and there are a dozen things a director
  // may do about them. Stacked one above the other they cannot both be read,
  // so the books stand in a pane of their own and the actions get the height.
  const rows: AsideRow[] = [
    { label: 'Treasury', value: formatMoney(c.treasury), tone: c.treasury <= 0 ? 'bad' : undefined },
    { label: 'Price of the day', value: `${formatMoney(c.sharePrice)} the share` },
    { label: 'Your holding', value: formatMoney(worth) },
    { label: 'Wages', value: `${formatMoney(COMPANY_CREW_WAGES)} the week, each crew` },
    { label: 'Port relations', value: `${Math.round(c.relations ?? 0)}/100` },
    { label: 'Supply contract', value: (c.supplyContractUntilDay ?? 0) >= state.day ? `through day ${c.supplyContractUntilDay}` : 'none' },
    { label: 'Shares', value: '', heading: true },
    { label: 'Yours', value: String(c.sharesOwned) },
    { label: 'With the public', value: String(c.sharesPublic) },
    { label: 'Unsold', value: String(c.sharesUnsold) },
    { label: 'The crews', value: '', heading: true },
  ];
  if (c.crews.length === 0) {
    rows.push({ label: 'None at work', value: 'nothing is got out of it', tone: 'bad' });
  } else {
    c.crews.forEach((k, i) =>
      rows.push({
        label: `No. ${i + 1}`,
        value: k.task === 'mine' ? 'at the reef' : 'prospecting the ranges',
      }),
    );
  }
  if (c.leases.length) {
    rows.push({ label: 'The ground', value: '', heading: true });
    c.leases.forEach((l, i) => rows.push({ label: `Lease ${i + 1}`, value: leaseWord(l) }));
  }

  const body: string[] = [`Founded on day ${c.foundedOn}.`];
  const trail = c.weekProfit.slice(-6);
  if (trail.length) {
    // A run of sums set as a sentence wraps in the middle of a figure and can
    // be neither read nor compared. Ruled off in aligned columns, oldest
    // first, the shape of the quarter can be seen at a glance.
    const cells = trail.map((p) => (p >= 0 ? `+${formatMoney(p)}` : `-${formatMoney(-p)}`));
    const w = Math.max(...cells.map((t) => t.length));
    body.push('');
    body.push(`The last ${cells.length} week${cells.length === 1 ? '' : 's'}, oldest first:`);
    for (let i = 0; i < cells.length; i += 3) {
      body.push('  ' + cells.slice(i, i + 3).map((t) => t.padStart(w)).join('   '));
    }
  }
  if (c.lastWeekGold > 0) {
    body.push('');
    body.push(`The crews washed ${formatGold(c.lastWeekGold)} last week.`);
  }

  const issued = c.sharesOwned + c.sharesPublic;
  const menu: MenuItem[] = [];
  if (state.location === 'suze-port') {
    menu.push(item('R', 'Call on investors and agents — 10s, one day', { type: 'companyRelations' }, 'better relations improve public share demand and confidence', state.moneyPence < shillings(10) || (c.relations ?? 0) >= 100));
    menu.push(item('Q', 'Arrange a four-week supply contract — £4', { type: 'companySupplyContract' }, 'port purchasing trims weekly operating costs by ten per cent', state.moneyPence < pounds(4)));
  }
  c.crews.forEach((k, i) =>
    menu.push(
      item(
        String(i + 1),
        `Put the No. ${i + 1} crew to ${k.task === 'mine' ? 'prospecting' : 'the reef'}`,
        { type: 'setCrewTask', index: i, task: k.task === 'mine' ? 'prospect' : 'mine' },
        k.task === 'mine' ? 'looking for fresh ground to take up' : 'winning gold off the lease',
      ),
    ),
  );
  menu.push(
    item(
      'H',
      `Take on a crew — ${formatMoney(COMPANY_CREW_WAGES)} the week`,
      { type: 'hireCrew' },
      state.location === 'deep-mountains'
        ? 'four wages-men, engaged at the workings'
        : 'men are taken on at the workings, not by letter',
      state.location !== 'deep-mountains' ||
        c.crews.length >= COMPANY_MAX_CREWS ||
        c.treasury < COMPANY_CREW_WAGES,
    ),
  );
  menu.push(item('F', 'Pay off a crew', { type: 'fireCrew' }, undefined, c.crews.length === 0));
  const dividends: [string, number][] = [
    ['A', shillings(5)],
    ['B', shillings(10)],
    ['C', pounds(1)],
  ];
  for (const [key, per] of dividends) {
    menu.push(
      item(
        key,
        `Declare a dividend of ${formatMoney(per)} the share`,
        { type: 'declareDividend', perShare: per },
        `${formatMoney(per * issued)} out of the treasury, ${formatMoney(per * c.sharesOwned)} of it yours`,
        per * issued > c.treasury,
      ),
    );
  }
  menu.push(
    item('S', `Sell one share at ${formatMoney(c.sharePrice)}`, { type: 'sellOwnShares', n: 1 }, 'if there is any appetite for it', c.sharesOwned <= 0),
  );
  menu.push(
    item('V', 'Sell five shares', { type: 'sellOwnShares', n: 5 }, 'fewer than five retained and you are out of it altogether', c.sharesOwned <= 0),
  );
  menu.push(
    item('K', `Buy back a share at ${formatMoney(c.sharePrice)}`, { type: 'buyBackShares', n: 1 }, undefined,
      c.sharesPublic + c.sharesUnsold <= 0 || state.moneyPence < c.sharePrice),
  );
  menu.push(
    item('X', 'Sell out of the company entirely', { type: 'sellOut' }, `${formatMoney(c.sharesOwned * c.sharePrice)} for the lot, and your name off the door`),
  );
  menu.push(back(where));
  return {
    screen: 'company',
    title: c.name.toUpperCase(),
    subtitle: `${formatDate(state.day)} · ${c.sharesOwned} shares of ${COMPANY_SHARES}`,
    body,
    menu,
    aside: { title: 'The books', rows },
  };
}

// ---------------------------------------------------------------------------
// The shape of the year (§21)
// ---------------------------------------------------------------------------

/** Eight heights of block, low to high. Chrome, not narration. */
const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * A row of block glyphs scaled to the best week of the run. A year longer than
 * the row is bucketed, each bucket showing its best week, so the peaks survive.
 */
export function sparkline(values: number[], width = WORTH_SPARK_WIDTH): string {
  if (values.length === 0) return '';
  const buckets: number[] = [];
  if (values.length <= width) {
    buckets.push(...values);
  } else {
    for (let i = 0; i < width; i++) {
      const from = Math.floor((i * values.length) / width);
      const to = Math.max(from + 1, Math.floor(((i + 1) * values.length) / width));
      buckets.push(Math.max(...values.slice(from, to)));
    }
  }
  const peak = Math.max(...buckets);
  if (peak <= 0) return SPARK_GLYPHS[0].repeat(buckets.length);
  const top = SPARK_GLYPHS.length - 1;
  return buckets
    .map((v) => SPARK_GLYPHS[Math.max(0, Math.min(top, Math.round((Math.max(0, v) / peak) * top)))])
    .join('');
}

/** The chart of the year, with the figures that give the glyphs their scale. */
export function worthChartLines(state: GameState): string[] {
  const history = state.worthHistory;
  if (history.length < 2) return [];
  const row = sparkline(history);
  const start = history[0];
  const peak = Math.max(...history);
  const final = history[history.length - 1];
  return [
    'THE SHAPE OF YOUR YEAR — what you were worth, week by week',
    row,
    `Began ${formatMoney(start)} · best week ${formatMoney(peak)} · ended ${formatMoney(final)}`,
  ];
}

function lodgingWord(state: GameState): string {
  switch (state.lodging) {
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

/**
 * The head of the death notice. Most men die *of* something; a man who is
 * hanged or shot is not, and the column does not put it that way.
 */
function deathNotice(state: GameState): string {
  const cause = state.causeOfDeath ?? 'the hardships of the field';
  const where = `at ${locationName(state.location)}`;
  return /^(hanged|shot|killed|taken)/.test(cause)
    ? `Died on the ${formatDate(state.day)}: ${cause}.`
    : `Died on the ${formatDate(state.day)}, ${where}, of ${cause}.`;
}

/**
 * What the Gazette prints under an outlaw's death notice when he is known to
 * have had a camp in the ranges and nothing on him worth the naming: the
 * rumour of buried gold, which outlives every man it is told of (§24).
 */
function buriedRumourLines(state: GameState): string[] {
  const h = state.hideout;
  if (!h || h.discovered) return [];
  if (h.stashPence <= 0 && h.stashGold <= 0) return [];
  if (!state.outlawed && state.notoriety < 15) return [];
  return [sayFixed('end.buried.rumour', state.seed ^ (state.day * 7919)), ''];
}

/** One ruled line of a tally sheet: label, leader dots, figure. */
function tally(label: string, value: string): string {
  return `${label} ${'.'.repeat(Math.max(2, 24 - label.length - 1))} ${value}`;
}

/** How the outlaw's road finished, in the words the reckoning uses (§24). */
function outlawEndPhrase(state: GameState): string | null {
  switch (state.outlawEnd) {
    case 'hanged':
      return 'hanged at the Fields Town assizes';
    case 'hulks':
      return 'years of it, and the road ends in the hulks';
    case 'california':
      return 'a berth for California, under a name off the wharf';
    case 'pardoned':
      return 'the Eureka pardon, bought with the whole of the stash';
    case 'at large':
      return 'still out in the ranges, and looked for yet';
    default:
      return state.outlawed ? 'proclaimed, and not yet taken' : null;
  }
}

/**
 * The tally the bank does not keep: what the roads brought in, what is set down
 * against him, and how the road ended. Ruled in the same hand as the deposit
 * certificate above it, because it is the same year (§24).
 */
function otherLedgerLines(state: GameState): string[] {
  if (!state.hideout && state.notoriety <= 0 && !state.outlawed) return [];
  const out: string[] = ['', 'THE OTHER LEDGER — WHAT IS SET DOWN AGAINST YOU'];
  if (state.stats.takings > 0) out.push(tally('Taken on the roads', formatMoney(state.stats.takings)));
  if (state.stats.bailUps > 0) {
    out.push(
      tally(
        'Travellers stopped',
        `${state.stats.bailUps}${
          state.diggersRobbed > 0
            ? `, of whom ${state.diggersRobbed} were diggers`
            : ', and never a digger among them'
        }`,
      ),
    );
  }
  if (state.stats.bigJobs > 0) {
    out.push(
      tally(
        'Banks and escorts',
        `${state.stats.bigJobs} attempted, ${state.bigJobsDone} came off`,
      ),
    );
  }
  out.push(tally('Notoriety', notorietyPhrase(state.notoriety)));
  out.push(tally('In the bush', bushArticle(bushRankOf(state))));
  const reward = rewardFor(state);
  out.push(
    tally(
      'On your head',
      reward > 0 ? `${formatMoney(reward)}, and printed in the Angus` : 'nothing the Crown will pay for',
    ),
  );
  if (state.gang.length > 0) {
    out.push(tally('Riding with you', state.gang.map((g) => g.name).join(', ')));
  }
  if (state.hideout) {
    out.push(
      tally(
        'Under the stone',
        `${formatMoney(state.hideout.stashPence)} and ${formatGold(state.hideout.stashGold)}, worth ${formatMoney(stashWorth(state))}`,
      ),
    );
  }
  if (state.bloodShed) out.push(tally('Blood', 'shed, and the Crown hangs men for it'));
  const ended = outlawEndPhrase(state);
  if (ended) out.push(tally('How it ended', ended));
  return out;
}

/**
 * What a man's name is on at the end of the year: deeds, the plaques at the
 * Chambers, and the commission (§28.2). The works are worth nothing in the
 * tally above and everything in the paragraph below.
 */
function estateLedgerLines(state: GameState): string[] {
  const e = state.estate;
  const deeds = estateDeeds(state);
  if (deeds.length === 0 && e.works.length === 0 && e.jpSince === null) return [];
  const out: string[] = ['', 'THE ESTATE — WHAT YOUR NAME IS ON'];
  for (const d of deeds) out.push(tally('Deed', d));
  for (const w of e.works) {
    out.push(tally('Subscribed', `${WORK_NAMES[w.id]}${w.camp ? `, to ${CAMP_DEFS[w.camp].name}` : ''}, day ${w.day}`));
    out.push(`    ${plaqueLine(state, w.id)}`);
  }
  if (isJP(state)) {
    out.push(tally('Commission', `Justice of the Peace, gazetted day ${e.jpSince}`));
    out.push('    Arrived a new chum; sits on the Fields Town bench now.');
  }
  return out;
}

/** The Bank Draft tally at the end of the year (faithful: a bank draft sheet shipped with the game). */
export function endView(state: GameState): ScreenView {
  const gold = state.goldCentiOz;
  const c = state.company;
  const scrip = companyWorth(state);
  const buried = stashWorth(state);
  const deeds = estateWorth(state);
  const total =
    state.moneyPence + state.bankPence + Math.floor((gold * state.bankRate) / 100) + scrip + buried + deeds;
  const body: string[] = [];
  body.push(`After a year on the goldfields — ${formatDate(state.day)}.`);
  body.push('');
  body.push('THE BANK OF AUSTRALASIA — DEPOSIT CERTIFICATE');
  body.push(tally('Money in hand', formatMoney(state.moneyPence)));
  body.push(tally('On deposit', formatMoney(state.bankPence)));
  body.push(
    tally('Gold held', `${formatGold(gold)} (worth ${formatMoney(Math.floor((gold * state.bankRate) / 100))})`),
  );
  if (c) body.push(tally('Scrip and treasury', formatMoney(scrip)));
  if (buried > 0) body.push(tally('Buried in the ranges', `${formatMoney(buried)} (no bank knows of it)`));
  // Deeds at what was paid for them; the public works are worth nothing here
  // and everything below (§26, §28.2).
  if (deeds > 0) body.push(tally('Deeds and premises', formatMoney(deeds)));
  body.push(tally('IN ALL', formatMoney(total)));
  body.push('');
  const chart = worthChartLines(state);
  if (chart.length) {
    body.push(...chart);
    body.push('');
  }
  if (c) {
    body.push(`${c.name.toUpperCase()} — THE COMPANY'S BOOKS`);
    body.push(tally('Treasury', formatMoney(c.treasury)));
    body.push(
      tally('Shares', `${c.sharesOwned} yours of ${COMPANY_SHARES}, at ${formatMoney(c.sharePrice)} the share`),
    );
    body.push(
      tally(
        'Crews',
        `${c.crews.length}, on ${c.leases.length} lease${c.leases.length === 1 ? '' : 's'} (${c.leases.map(leaseWord).join('; ')})`,
      ),
    );
    body.push('');
  } else if (state.soldOut) {
    body.push(
      `You sold out of ${state.soldOut.name} on day ${state.soldOut.day} for ${formatMoney(state.soldOut.amount)}.`,
    );
    body.push('');
  }
  body.push(...equipmentLines(state));
  body.push(...estateLedgerLines(state));
  body.push(...otherLedgerLines(state));
  body.push('');
  body.push(`Health: ${healthWord(state.health)}. Legal record: ${state.outlawed ? 'Proclaimed an outlaw' : titleCase(state.legal)}.`);
  body.push(
    `You worked ${state.stats.daysWorked} days for wages and ${state.stats.daysDug} days at the diggings,`,
  );
  body.push(
    `won ${formatGold(state.stats.goldWon)} of gold, sank ${state.stats.shaftsSunk} shaft${state.stats.shaftsSunk === 1 ? '' : 's'},`,
  );
  body.push(
    `were robbed ${state.stats.timesRobbed} time${state.stats.timesRobbed === 1 ? '' : 's'} and arrested ${state.stats.timesArrested}.`,
  );
  body.push('');
  const notable = state.journal.filter((j) => j.tone === 'good' || j.tone === 'bad').slice(-8);
  if (notable.length) {
    body.push('FROM YOUR DIARY:');
    for (const n of notable) body.push(`  Day ${n.day}: ${n.text}`);
    body.push('');
  }
  for (const line of epilogueFor(state)) body.push(line);
  body.push('');
  body.push('The computer makes no judgment. Whether you have made your fortune is for you to say.');

  const menu: MenuItem[] = [];
  if (!state.gameOver) {
    menu.push(item('1', 'Stay on for another year', { type: 'nextYear' }));
  }
  menu.push(item('2', 'Begin a new game', { type: 'newGame' }));
  menu.push(item('0', 'Return to the title screen', { type: 'quitToTitle' }));
  return { screen: 'end', title: 'THE RECKONING', body, menu };
}

export function seasonOf(state: GameState) {
  return season(state.day);
}
