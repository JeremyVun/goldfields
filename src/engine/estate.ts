/**
 * Property, the press, the public works and the bench (GAME_SPEC.md §26-§28).
 *
 * The company (§19) makes a digger a capitalist and the ranges (§23) make him a
 * captain, but the world goes on acting upon him either way. What is bought
 * here is not a yield: it is a rule struck out of the world's dice, with the
 * benefactor's name at the head of the list. Digger, then man of property,
 * then notable of the fields.
 */

import {
  CALLED_RUSH_BURN_DAYS,
  CALLED_RUSH_DELAY_DAYS,
  CALLED_RUSH_FACTOR,
  CALLED_RUSH_STALE,
  CALLED_RUSH_STANDING_LOSS,
  CAMP_DEFS,
  COURT_INTERVAL_DAYS,
  COURT_LENIENCY,
  COURT_SEVERITY,
  FLUSH_DAYS,
  GAZETTE_SHARE_PRICE,
  GAZETTE_STANDING,
  GAZETTE_WEEK_INCOME,
  HEAT_MAX,
  JP_FEE,
  JP_FORFEIT_STANDING,
  JP_STANDING,
  KILL_NOTICE_DAYS,
  LAWYER_DAYS,
  LAWYER_FEE,
  PRESS_AGITATION_DOWN,
  PRESS_AGITATION_UP,
  PRESS_SOOTHE_FLOOR,
  PRESS_SOOTHE_FLOOR_DAY,
  RUSH_DAYS,
  SHAMROCK_BRAWL_CHANCE,
  SHAMROCK_BRAWL_COST,
  SHAMROCK_PRICE,
  SHAMROCK_RUSH_FACTOR,
  SHAMROCK_RUSH_LEAD_DAYS,
  SHAMROCK_SHAKEDOWN_AGITATION,
  SHAMROCK_STANDING,
  SHAMROCK_TAKINGS,
  SHANTY_NOTORIETY,
  SHANTY_PRICE,
  SHANTY_RAID_CHANCE,
  SHANTY_RAID_HEAT,
  SHANTY_WARNING_DAYS,
  STORE_DYING_FRESHNESS,
  STORE_FAIR_THEFT,
  STORE_GOUGE_THEFT,
  STORE_GOUGE_FACTOR,
  STORE_POLICY_STANDING,
  STORE_PRICE,
  STORE_RUSH_FACTOR,
  STORE_STANDING,
  STORE_STOCK_PRICE,
  STORE_WEEK_BASE,
  STORY_COOLDOWN_DAYS,
  OWN_HOUSE_TAKINGS_FACTOR,
  WORK_DEFS,
} from './constants';
import { formatMoney, pounds } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { sayFixed } from '../content/say';
import {
  addJournal,
  addNotoriety,
  addStanding,
  bumpAgitation,
  hasWork,
  inAftermath,
  legalRung,
} from './state';
import type {
  CampId,
  GameState,
  StorePolicy,
  StoryKind,
  WorkId,
} from './types';
import { availableFunds, debitFunds } from './wallet';

// ---------------------------------------------------------------------------
// Money at the counter
// ---------------------------------------------------------------------------

/** Deeds are paid for out of the pocket first and the bank after. */
function drawFrom(state: GameState, amount: number): boolean {
  return debitFunds(state, amount);
}

/**
 * Respectability is bought with clean money. A petty scrape may be overlooked;
 * a man the Crown wants is refused at every counter in the district, and his
 * own sinks are in §28.3.
 */
export function respectable(state: GameState): boolean {
  return legalRung(state.legal) <= 1 && !state.outlawed;
}

export interface Requirement {
  met: boolean;
  text: string;
}

/**
 * §28.1's thirty days of a quiet field after a hard bench: theft and
 * claim-jumping while the memory of it is still fresh. Zero is never.
 */
export function courtCalmFactor(state: GameState): number {
  const until = state.estate.severityUntilDay;
  return until > 0 && state.day <= until ? COURT_SEVERITY.crimeFactor : 1;
}

/**
 * What the camp does about the man behind the counter (§26): the field
 * protects an honest storekeeper's tent and remembers a gouging one, in the
 * night-theft and claim-jump rolls at his own camp and nowhere else.
 */
export function storekeeperFactor(state: GameState, camp?: CampId): number {
  const store = state.estate.store;
  if (!store) return 1;
  const where = camp ?? (state.location as CampId);
  if (store.camp !== where) return 1;
  return store.policy === 'fair' ? STORE_FAIR_THEFT : STORE_GOUGE_THEFT;
}

/** Heat comes down without splashing about, which is what addHeat is for. */
function coolHeat(state: GameState, zone: 'town' | 'camps', amount: number): void {
  state.heat[zone] = Math.max(0, Math.min(HEAT_MAX, state.heat[zone] - amount));
}

// ---------------------------------------------------------------------------
// §26 The premises
// ---------------------------------------------------------------------------

export function shamrockRequirements(state: GameState): Requirement[] {
  return [
    { met: state.location === 'fields-town', text: 'a word with Mrs. Doyle at the Crown & Cradle itself' },
    {
      met: state.standing >= SHAMROCK_STANDING,
      text: `standing of ${SHAMROCK_STANDING}/100 on the field (you have ${Math.floor(state.standing)}/100)`,
    },
    { met: respectable(state), text: 'a character the Licensing Bench will pass' },
    { met: availableFunds(state) >= SHAMROCK_PRICE, text: `${formatMoney(SHAMROCK_PRICE)} in hand and bank` },
  ];
}

export function buyShamrock(state: GameState, log: Log): boolean {
  if (state.estate.shamrock) {
    log.raw('The house is yours already, and one publican is enough for any man.', 'neutral');
    return false;
  }
  const unmet = shamrockRequirements(state).filter((r) => !r.met);
  if (unmet.length > 0) {
    log.say('estate.refused', { want: unmet[0].text }, 'bad');
    return false;
  }
  drawFrom(state, SHAMROCK_PRICE);
  state.estate.shamrock = true;
  addStanding(state, 5);
  log.say('estate.shamrock.buy', { amount: formatMoney(SHAMROCK_PRICE) }, 'good');
  addJournal(state, `Bought the Crown & Cradle for ${formatMoney(SHAMROCK_PRICE)}.`, 'good');
  return true;
}

export function storeRequirements(state: GameState, camp: CampId): Requirement[] {
  return [
    { met: state.location === camp, text: `a tent standing at ${CAMP_DEFS[camp].name} and a man on the ground` },
    {
      met: state.standing >= STORE_STANDING,
      text: `standing of ${STORE_STANDING}/100 (you have ${Math.floor(state.standing)}/100); Bell will not supply a stranger`,
    },
    { met: respectable(state), text: 'a character Bell will give credit to' },
    {
      met: availableFunds(state) >= STORE_PRICE + STORE_STOCK_PRICE,
      text: `${formatMoney(STORE_PRICE)} for the tent and licence and ${formatMoney(STORE_STOCK_PRICE)} for the opening stock`,
    },
  ];
}

export function openStore(state: GameState, log: Log, camp: CampId): boolean {
  if (state.estate.store) {
    log.raw('You keep a store already. A man cannot stand behind two counters.', 'neutral');
    return false;
  }
  const unmet = storeRequirements(state, camp).filter((r) => !r.met);
  if (unmet.length > 0) {
    log.say('estate.refused', { want: unmet[0].text }, 'bad');
    return false;
  }
  drawFrom(state, STORE_PRICE + STORE_STOCK_PRICE);
  state.estate.store = { camp, policy: 'fair', openedOn: state.day };
  log.say('estate.store.open', { camp: CAMP_DEFS[camp].name, amount: formatMoney(STORE_PRICE + STORE_STOCK_PRICE) }, 'good');
  addJournal(state, `Opened a store of my own at ${CAMP_DEFS[camp].name}.`, 'good');
  return true;
}

export function setStorePolicy(state: GameState, log: Log, policy: StorePolicy): boolean {
  const store = state.estate.store;
  if (!store) {
    log.raw('You have no counter to keep any sort of prices behind.', 'bad');
    return false;
  }
  if (store.policy === policy) return false;
  store.policy = policy;
  log.say(policy === 'fair' ? 'estate.store.fair' : 'estate.store.gouge', undefined, policy === 'fair' ? 'good' : 'neutral');
  addJournal(
    state,
    policy === 'fair'
      ? 'Set my prices at what the goods cost me and a fair margin, and let the field know it.'
      : 'Put the prices up to what the rush will bear.',
    policy === 'fair' ? 'good' : 'neutral',
  );
  return true;
}

export function gazetteRequirements(state: GameState): Requirement[] {
  return [
    { met: state.location === 'fields-town', text: 'the Times office in Bell Street, and Mr. Vale at his desk' },
    {
      met: state.standing >= GAZETTE_STANDING,
      text: `standing of ${GAZETTE_STANDING}/100 (you have ${Math.floor(state.standing)}/100); a paper is known by its proprietors`,
    },
    { met: respectable(state), text: 'a name the paper may print as its own' },
    { met: availableFunds(state) >= GAZETTE_SHARE_PRICE, text: `${formatMoney(GAZETTE_SHARE_PRICE)} for the half-share` },
  ];
}

export function buyGazetteShare(state: GameState, log: Log): boolean {
  if (state.estate.gazetteShare) {
    log.raw('You hold half the paper already, and Mr. Vale will not part with the other half.', 'neutral');
    return false;
  }
  const unmet = gazetteRequirements(state).filter((r) => !r.met);
  if (unmet.length > 0) {
    log.say('estate.refused', { want: unmet[0].text }, 'bad');
    return false;
  }
  drawFrom(state, GAZETTE_SHARE_PRICE);
  state.estate.gazetteShare = true;
  addStanding(state, 5);
  log.say('estate.gazette.buy', { amount: formatMoney(GAZETTE_SHARE_PRICE) }, 'good');
  addJournal(state, 'Bought a half-share in The Slateford Times.', 'good');
  return true;
}

// ---------------------------------------------------------------------------
// §26 The press
// ---------------------------------------------------------------------------

export function storyDue(state: GameState): boolean {
  return state.estate.storyPlacedOn === 0 || state.day - state.estate.storyPlacedOn >= STORY_COOLDOWN_DAYS;
}

export function daysToNextStory(state: GameState): number {
  return Math.max(0, STORY_COOLDOWN_DAYS - (state.day - state.estate.storyPlacedOn));
}

/**
 * A rush the paper called, told apart from a rush the field found: it begins
 * exactly two days after the story was set, and at the paper's own modest
 * factor. Nothing is written down that a reader of the Times could not work
 * out for himself.
 */
export function calledRush(state: GameState): boolean {
  const rush = state.rush;
  if (!rush || !state.estate.gazetteShare) return false;
  return (
    rush.since === state.estate.storyPlacedOn + CALLED_RUSH_DELAY_DAYS &&
    rush.factor <= CALLED_RUSH_FACTOR.hi + 0.001
  );
}

export function placeStory(
  state: GameState,
  rng: RNG,
  log: Log,
  kind: StoryKind,
  camp?: CampId,
): boolean {
  const e = state.estate;
  if (!e.gazetteShare) {
    log.raw('The Times prints what its proprietors please, and you are not one of them.', 'bad');
    return false;
  }
  if (state.location !== 'fields-town') {
    log.raw('Copy is set in Bell Street, not shouted across forty miles of scrub.', 'bad');
    return false;
  }
  if (!storyDue(state)) {
    log.raw(
      `The Times is a weekly with a small press and a smaller stock of paper. It will take your next story in ${daysToNextStory(state)} day${daysToNextStory(state) === 1 ? '' : 's'}.`,
      'neutral',
    );
    return false;
  }

  switch (kind) {
    case 'talkUp': {
      if (!camp || camp === 'secret-mine') {
        log.raw('You must name the ground the paper is to cry up.', 'bad');
        return false;
      }
      if (state.day - e.calledRushBurnedOn < CALLED_RUSH_BURN_DAYS) {
        log.say('estate.press.disbelieved', undefined, 'bad');
        return false;
      }
      if (state.rush && state.rush.untilDay >= state.day) {
        log.raw('There is a rush running already, and no paper ever called two at once.', 'neutral');
        return false;
      }
      e.storyPlacedOn = state.day;
      const since = state.day + CALLED_RUSH_DELAY_DAYS;
      const base = state.freshness[camp];
      // Men come, but they cannot dig gold out of ground that has none: a
      // rush cried up over duffer country lifts nothing at all, and goes off
      // in a week (§26).
      const stale = base < CALLED_RUSH_STALE;
      state.rush = {
        camp,
        since,
        untilDay: since + rng.int(RUSH_DAYS.lo, RUSH_DAYS.hi),
        factor: stale ? base : rng.range(CALLED_RUSH_FACTOR.lo, CALLED_RUSH_FACTOR.hi),
        base,
      };
      log.say('estate.press.talkup', { camp: CAMP_DEFS[camp].name }, 'good');
      addJournal(state, `Set the Times to cry a strike at ${CAMP_DEFS[camp].name}.`, 'neutral');
      return true;
    }

    case 'pressLicence': {
      e.storyPlacedOn = state.day;
      bumpAgitation(state, PRESS_AGITATION_UP);
      // The next sweep is printed before it runs (§26).
      state.hunt = {
        camp: rng.pick(['damp-camp', 'snakey-gully', 'deep-mountains'] as CampId[]),
        untilDay: state.day + rng.int(4, 9),
      };
      log.say('estate.press.licence', { camp: CAMP_DEFS[state.hunt.camp].name }, 'neutral');
      addJournal(state, 'Put the licence question on the front page, and named the next hunt.', 'neutral');
      return true;
    }

    case 'soothe': {
      e.storyPlacedOn = state.day;
      // The boil-over cannot be printed away: after the spring the column may
      // beg for patience all it likes, and history still happens (§26).
      const floor = state.day >= PRESS_SOOTHE_FLOOR_DAY ? PRESS_SOOTHE_FLOOR : 0;
      const target = Math.max(floor, state.agitation - PRESS_AGITATION_DOWN);
      const moved = state.agitation - target;
      state.agitation = target;
      if (moved < PRESS_AGITATION_DOWN) log.say('estate.press.soothe.floor', undefined, 'bad');
      else log.say('estate.press.soothe', undefined, 'neutral');
      addJournal(state, 'Printed a column counselling patience on the licence question.', 'neutral');
      return true;
    }

    case 'killNotice': {
      if (state.outlawed) {
        log.raw('No paper in the colony will unprint a proclamation. That is the Governor\'s own printing.', 'bad');
        return false;
      }
      if (legalRung(state.legal) < 1) {
        log.raw('There is no notice of you to kill, which is a thing to be glad of.', 'neutral');
        return false;
      }
      if (e.noticeKillUsed) {
        log.raw('You have had that favour of the paper once this year, and Mr. Vale has a memory.', 'bad');
        return false;
      }
      e.storyPlacedOn = state.day;
      e.noticeKillUsed = true;
      e.noticeKillUntilDay = state.day + KILL_NOTICE_DAYS;
      log.say('estate.press.killnotice', undefined, 'good');
      addJournal(state, 'What I have been up to did not appear in the Times this week.', 'neutral');
      return true;
    }
  }
}

// ---------------------------------------------------------------------------
// §27 Public works
// ---------------------------------------------------------------------------

export const WORK_NAMES: Record<WorkId, string> = {
  bridge: 'a bridge over the Slate River',
  waterRace: 'a water race',
  ward: 'a ward at Canvas House',
  school: 'a school at Slateford',
};

/** What the Council puts on the plaque, and the epilogue reads back (§27). */
export function plaqueLine(state: GameState, id: WorkId): string {
  const race = state.estate.works.find((w) => w.id === 'waterRace');
  switch (id) {
    case 'bridge':
      return 'THE SLATE RIVER BRIDGE — funded by the people of the fields, 1854, the list headed by a digger of this field.';
    case 'waterRace':
      return `THE WATER RACE TO ${(race?.camp ? CAMP_DEFS[race.camp].name : 'THE DIGGINGS').toUpperCase()} — publicly funded, 1854. Water where there was dust.`;
    case 'ward':
      return 'THE DIGGERS\' WARD, CANVAS HOUSE — for the sick of the diggings, without distinction of purse.';
    default:
      return 'THE SLATEFORD SCHOOL — that the children of this place may be something other than diggers.';
  }
}

export function fundWork(state: GameState, log: Log, id: WorkId, camp?: CampId): boolean {
  const def = WORK_DEFS[id];
  if (hasWork(state, id)) {
    log.raw('That work is funded and finished. The Council does not take the money twice.', 'neutral');
    return false;
  }
  if (state.location !== 'fields-town') {
    log.raw('Public works are funded at the Council Chambers, and nowhere else.', 'bad');
    return false;
  }
  if (!respectable(state)) {
    log.say('estate.refused', { want: 'a character the Council will print at the head of a list' }, 'bad');
    return false;
  }
  if (id === 'waterRace' && (!camp || camp === 'secret-mine')) {
    log.raw('A race must be cut to somewhere. Name the camp.', 'bad');
    return false;
  }
  if (availableFunds(state) < def.cost) {
    log.say('estate.refused', { want: `${formatMoney(def.cost)}, being the whole of the estimate` }, 'bad');
    return false;
  }
  drawFrom(state, def.cost);
  state.estate.works.push({ id, day: state.day, camp: id === 'waterRace' ? camp : undefined });
  addStanding(state, def.standing);
  const vars = { camp: camp ? CAMP_DEFS[camp].name : '', amount: formatMoney(def.cost) };
  log.say(`estate.work.${id}`, vars, 'good');
  addJournal(state, `Funded ${WORK_NAMES[id]} with ${formatMoney(def.cost)}.`, 'good');
  return true;
}

// ---------------------------------------------------------------------------
// §28.1 The bench
// ---------------------------------------------------------------------------

export function commissionRequirements(state: GameState): Requirement[] {
  const property =
    (state.estate.shamrock ? 1 : 0) + (state.estate.store ? 1 : 0) + (state.estate.gazetteShare ? 1 : 0);
  return [
    { met: state.location === 'fields-town', text: 'attendance at the Council Chambers' },
    { met: inAftermath(state), text: 'the aftermath of the licence business, when the Local Courts are formed' },
    {
      met: state.standing >= JP_STANDING,
      text: `standing of ${JP_STANDING}/100 (you have ${Math.floor(state.standing)}/100)`,
    },
    { met: state.legal === 'honest' && !state.outlawed, text: 'a clean sheet: the Bench is not given to men with records' },
    {
      met: property >= 1 || state.estate.works.length >= 2,
      text: 'a property in the district, or two public works funded',
    },
    { met: availableFunds(state) >= JP_FEE, text: `${formatMoney(JP_FEE)} for the Court fund` },
  ];
}

export function canTakeCommission(state: GameState): boolean {
  return state.estate.jpSinceDay === null && commissionRequirements(state).every((r) => r.met);
}

export function acceptCommission(state: GameState, log: Log): boolean {
  if (state.estate.jpSinceDay !== null) {
    log.raw('You are on the Bench already.', 'neutral');
    return false;
  }
  const unmet = commissionRequirements(state).filter((r) => !r.met);
  if (unmet.length > 0) {
    log.say('estate.refused', { want: unmet[0].text }, 'bad');
    return false;
  }
  drawFrom(state, JP_FEE);
  state.estate.jpSinceDay = state.day;
  state.estate.nextCourtDay = state.day;
  addStanding(state, 5);
  log.say('estate.jp.gazetted', { amount: formatMoney(JP_FEE) }, 'good');
  addJournal(state, 'Gazetted a Justice of the Peace for the Slateford district.', 'good');
  return true;
}

/** A conviction for anything real, and the commission goes with it (§28.1). */
export function forfeitCommission(state: GameState, log: Log): void {
  if (state.estate.jpSinceDay === null) return;
  state.estate.jpSinceDay = null;
  state.estate.nextCourtDay = 0;
  addStanding(state, -JP_FORFEIT_STANDING);
  log.say('estate.jp.forfeit', undefined, 'bad');
  addJournal(state, 'Struck off the commission of the peace, and the Times on the front page about it.', 'bad');
}

export function isJP(state: GameState): boolean {
  return state.estate.jpSinceDay !== null;
}

export function courtDue(state: GameState): boolean {
  return isJP(state) && state.day >= state.estate.nextCourtDay;
}

export interface CourtCase {
  id: string;
  charge: string;
  leniency: string;
  severity: string;
}

const CASE_IDS = ['jumper', 'drunk', 'bushranger', 'candle', 'grog'] as const;

/**
 * The day's list. Drawn from the game's own vocabulary of trouble, and drawn
 * the same way every time the screen is looked at, so that a bench does not
 * find a different docket in front of it on second glance.
 */
export function courtDocket(state: GameState): CourtCase[] {
  const salt = state.estate.nextCourtDay * 977 + 13;
  const pool: string[] = [inAftermath(state) ? 'vagrant' : 'licence', ...CASE_IDS];
  const n = 2 + ((salt >>> 3) % 2);
  const chosen: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (salt * (i + 7)) % pool.length;
    const id = pool.splice(idx, 1)[0];
    chosen.push(id);
  }
  return chosen.map((id, i) => ({
    id,
    charge: sayFixed(`court.case.${id}.charge`, salt + i),
    leniency: sayFixed(`court.case.${id}.leniency`, salt + i),
    severity: sayFixed(`court.case.${id}.severity`, salt + i),
  }));
}

/** Opening the court: it costs the day, whichever way the bench goes after. */
export function holdCourt(state: GameState, log: Log): boolean {
  if (!isJP(state)) {
    log.raw('The Bench is for the gazetted, and you are not of them.', 'bad');
    return false;
  }
  if (state.location !== 'fields-town') {
    log.raw('The Local Court sits in the Council\'s main hall at Slateford.', 'bad');
    return false;
  }
  if (!courtDue(state)) {
    const days = state.estate.nextCourtDay - state.day;
    log.raw(`The court sits monthly. There are ${days} day${days === 1 ? '' : 's'} to run before the next list.`, 'neutral');
    return false;
  }
  state.estate.nextCourtDay = state.day + COURT_INTERVAL_DAYS;
  log.say('estate.court.open', undefined, 'neutral');
  return true;
}

/**
 * The bench's temper, applied to the whole of the day's list. Leniency buys
 * the field's affection and quiets the camps; severity cools the town and
 * keeps the thieves off the diggings for a month, and is not loved for it.
 */
export function ruleOn(state: GameState, log: Log, ruling: 'leniency' | 'severity'): boolean {
  if (!isJP(state)) return false;
  const docket = courtDocket(state);
  for (const c of docket) {
    log.raw(ruling === 'leniency' ? c.leniency : c.severity, ruling === 'leniency' ? 'good' : 'neutral');
    if (ruling === 'leniency') {
      coolHeat(state, 'camps', -COURT_LENIENCY.heat);
      bumpAgitation(state, COURT_LENIENCY.agitation);
      addStanding(state, COURT_LENIENCY.standing);
    } else {
      coolHeat(state, 'town', -COURT_SEVERITY.heat);
      addStanding(state, COURT_SEVERITY.standing);
    }
  }
  if (ruling === 'severity') {
    state.estate.severityUntilDay = state.day + COURT_SEVERITY.calmDays;
  }
  log.say(ruling === 'leniency' ? 'estate.court.lenient' : 'estate.court.severe', { n: docket.length }, 'neutral');
  addJournal(
    state,
    ruling === 'leniency'
      ? `Sat the bench on ${docket.length} cases and dealt lightly with all of them.`
      : `Sat the bench on ${docket.length} cases, and the field will call me a hard man for it.`,
    'neutral',
  );
  return true;
}

/** A J.P.'s own petty scrapes are quietly no-billed while he sits (§28.1). */
export function noBilled(state: GameState, log: Log): boolean {
  if (!isJP(state)) return false;
  log.say('estate.jp.nobill', undefined, 'good');
  return true;
}

// ---------------------------------------------------------------------------
// §28.3 The dark mirror
// ---------------------------------------------------------------------------

export function buyShanty(state: GameState, log: Log, camp: CampId): boolean {
  if (state.estate.shanty) {
    log.raw('You keep a shanty already, and two would only draw the traps.', 'neutral');
    return false;
  }
  if (camp === 'secret-mine') {
    log.raw('There is nobody within forty miles of that place to sell grog to.', 'bad');
    return false;
  }
  if (state.notoriety < SHANTY_NOTORIETY) {
    log.raw('The keeper will not sell to a man he has never heard of. Make a name first.', 'bad');
    return false;
  }
  if (state.moneyPence < SHANTY_PRICE) {
    log.raw(`Eighty pounds, cash, and no paper. You have not got ${formatMoney(SHANTY_PRICE)}.`, 'bad');
    return false;
  }
  state.moneyPence -= SHANTY_PRICE;
  state.estate.shanty = camp;
  addNotoriety(state, 3);
  log.say('estate.shanty.buy', { camp: CAMP_DEFS[camp].name, amount: formatMoney(SHANTY_PRICE) }, 'good');
  addJournal(state, `Bought the sly-grog shanty at ${CAMP_DEFS[camp].name}.`, 'neutral');
  return true;
}

export function retainLawyer(state: GameState, log: Log): boolean {
  if (!state.estate.shanty) {
    log.raw('No attorney in Bell Street takes that sort of client off the street; it wants an introduction.', 'bad');
    return false;
  }
  if (state.moneyPence < LAWYER_FEE) {
    log.raw(`Sixty pounds the quarter, in advance. You have not got ${formatMoney(LAWYER_FEE)}.`, 'bad');
    return false;
  }
  state.moneyPence -= LAWYER_FEE;
  const from = Math.max(state.day, state.estate.lawyerUntilDay);
  state.estate.lawyerUntilDay = from + LAWYER_DAYS;
  log.say('estate.lawyer.retain', { amount: formatMoney(LAWYER_FEE), until: state.estate.lawyerUntilDay }, 'good');
  addJournal(state, `Retained an attorney at ${formatMoney(LAWYER_FEE)} the quarter.`, 'neutral');
  return true;
}

export function hasLawyer(state: GameState): boolean {
  return state.estate.lawyerUntilDay >= state.day;
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

function shamrockWeek(state: GameState, rng: RNG, log: Log): void {
  if (!state.estate.shamrock) return;
  const rush = !!state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day;
  // Only a spree held at the Crown & Cradle itself fills the Crown & Cradle (§30.2).
  const houseSpree = state.estate.houseSpreeOn;
  const flush = houseSpree > 0 && state.day <= houseSpree + FLUSH_DAYS;
  let takings = rng.int(SHAMROCK_TAKINGS.lo, SHAMROCK_TAKINGS.hi);
  if (rush) takings = Math.round(takings * SHAMROCK_RUSH_FACTOR);
  // A landlord who has been shouting his own bar is a landlord with a full
  // house all week after it (§30.2).
  if (flush) takings = Math.round(takings * OWN_HOUSE_TAKINGS_FACTOR);
  state.moneyPence += takings;
  log.say(rush ? 'estate.shamrock.week.rush' : 'estate.shamrock.week', { amount: formatMoney(takings) }, 'good');

  if (rng.chance(SHAMROCK_BRAWL_CHANCE)) {
    const cost = Math.min(
      state.moneyPence,
      rng.int(SHAMROCK_BRAWL_COST.lo, SHAMROCK_BRAWL_COST.hi),
    );
    state.moneyPence -= cost;
    log.say('estate.shamrock.brawl', { amount: formatMoney(cost) }, 'bad');
  }

  if (state.agitation > SHAMROCK_SHAKEDOWN_AGITATION && rng.chance(0.25)) {
    if (state.moneyPence >= pounds(5)) {
      state.moneyPence -= pounds(5);
      log.say('estate.shamrock.shakedown.paid', { amount: formatMoney(pounds(5)) }, 'bad');
    } else {
      bumpAgitation(state, 5);
      log.say('estate.shamrock.shakedown.refused', undefined, 'bad');
    }
  }
}

/** What a week behind your own counter is worth, at today's ground (§26). */
export function storeWeekProfit(state: GameState): number {
  const store = state.estate.store;
  if (!store) return 0;
  const fresh = state.freshness[store.camp] ?? 1;
  const rush =
    !!state.rush &&
    state.rush.camp === store.camp &&
    state.rush.since <= state.day &&
    state.rush.untilDay >= state.day;
  const base = STORE_WEEK_BASE * fresh * (rush ? STORE_RUSH_FACTOR : 1);
  return Math.round(base * (store.policy === 'gouge' ? STORE_GOUGE_FACTOR : 1));
}

function storeWeek(state: GameState, log: Log): void {
  const store = state.estate.store;
  if (!store) return;
  const profit = storeWeekProfit(state);
  state.moneyPence += profit;
  const fresh = state.freshness[store.camp] ?? 1;
  const rush =
    !!state.rush &&
    state.rush.camp === store.camp &&
    state.rush.since <= state.day &&
    state.rush.untilDay >= state.day;
  const camp = CAMP_DEFS[store.camp].name;
  if (rush) log.say('estate.store.week.rush', { camp, amount: formatMoney(profit) }, 'good');
  else if (fresh < STORE_DYING_FRESHNESS) log.say('estate.store.week.dying', { camp, amount: formatMoney(profit) }, 'bad');
  else log.say('estate.store.week', { camp, amount: formatMoney(profit) }, 'good');

  addStanding(state, store.policy === 'fair' ? STORE_POLICY_STANDING : -STORE_POLICY_STANDING);
}

/** The rush the paper called, gone off in a week of duffer ground (§26). */
function calledRushDay(state: GameState, log: Log): void {
  const rush = state.rush;
  if (!rush || !calledRush(state)) return;
  if (state.day - rush.since < 7) return;
  if (rush.base >= CALLED_RUSH_STALE) return;

  state.rush = null;
  state.freshness[rush.camp] = rush.base;
  state.estate.calledRushBurnedOn = state.day;
  addStanding(state, -CALLED_RUSH_STANDING_LOSS);
  log.say('estate.press.collapse', { camp: CAMP_DEFS[rush.camp].name }, 'bad');
  addJournal(state, `The rush I called at ${CAMP_DEFS[rush.camp].name} came to nothing, and the field knows whose paper called it.`, 'bad');
}

function shantyWeek(state: GameState, rng: RNG, log: Log): void {
  const shanty = state.estate.shanty;
  if (!shanty) return;
  // The harbourers of a man's own shanty keep a word by them for him every
  // week, whatever the field thinks of his trade (§28.3 extends §23.5). It is
  // the same word a friend at the bar gives, and is spent the same way.
  if (state.estate.warnedUntilDay < state.day + SHANTY_WARNING_DAYS) {
    state.estate.warnedUntilDay = state.day + SHANTY_WARNING_DAYS;
  }
  if (state.heat.camps <= SHANTY_RAID_HEAT) return;
  if (!rng.chance(SHANTY_RAID_CHANCE)) return;
  state.estate.shanty = null;
  log.say('estate.shanty.raid', { camp: CAMP_DEFS[shanty].name }, 'bad');
  addJournal(state, `The traps burnt out the shanty at ${CAMP_DEFS[shanty].name}; eighty pounds gone in an hour.`, 'bad');
  if (state.location === shanty) state.pending = { kind: 'shantyRaid', data: { camp: shanty } };
}

/**
 * What a man of property is told at the close of a day. The landlord of the
 * Crown & Cradle has word of a strike the evening it is made, two days before the
 * Times can set it (§26) — which is the whole use of the house.
 */
export function estateDay(state: GameState, log: Log): void {
  calledRushDay(state, log);
  const rush = state.rush;
  if (!state.estate.shamrock || !rush) return;
  if (rush.since !== state.day + SHAMROCK_RUSH_LEAD_DAYS) return;
  // No use telling a man what his own paper printed the day before.
  if (calledRush(state)) return;
  log.say('estate.shamrock.rushword', { camp: CAMP_DEFS[rush.camp].name }, 'good');
  addJournal(state, `Word at my own bar of heavy wash at ${CAMP_DEFS[rush.camp].name}, two days before the paper has it.`, 'good');
}

/**
 * A Sunday's business for a man of property, settled wherever he happens to
 * be standing: the house, the counter, the paper, and whatever the troopers
 * did about the shanty (§26, §28.3).
 */
export function estateWeek(state: GameState, rng: RNG, log: Log): void {
  const e = state.estate;
  shamrockWeek(state, rng, log);
  storeWeek(state, log);
  if (e.gazetteShare) {
    state.moneyPence += GAZETTE_WEEK_INCOME;
    log.say('estate.gazette.week', { amount: formatMoney(GAZETTE_WEEK_INCOME) }, 'neutral');
  }
  shantyWeek(state, rng, log);
}

// ---------------------------------------------------------------------------
// What the menu and the reckoning say of it
// ---------------------------------------------------------------------------

/** The deeds, in the words the strongbox would use. */
export function estateDeeds(state: GameState): string[] {
  const e = state.estate;
  const out: string[] = [];
  if (e.shamrock) out.push(`The Crown & Cradle, Slateford — ${formatMoney(SHAMROCK_PRICE)}`);
  if (e.store) {
    out.push(
      `A store at ${CAMP_DEFS[e.store.camp].name} — ${formatMoney(STORE_PRICE)}, ${e.store.policy === 'fair' ? 'fair dealing' : 'and the prices what the rush will bear'}`,
    );
  }
  if (e.gazetteShare) out.push(`A half-share in The Slateford Times — ${formatMoney(GAZETTE_SHARE_PRICE)}`);
  if (e.shanty) out.push(`The sly-grog shanty at ${CAMP_DEFS[e.shanty].name} — ${formatMoney(SHANTY_PRICE)}, and no deed for it anywhere`);
  return out;
}

/** What a week of the estate pays, before the brawls and the troopers. */
export function estateWeeklyIncome(state: GameState): number {
  const e = state.estate;
  let sum = 0;
  if (e.shamrock) sum += Math.round((SHAMROCK_TAKINGS.lo + SHAMROCK_TAKINGS.hi) / 2);
  if (e.store) sum += storeWeekProfit(state);
  if (e.gazetteShare) sum += GAZETTE_WEEK_INCOME;
  return sum;
}
