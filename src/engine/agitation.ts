/**
 * A year with a shape: the licence agitation of 1854 (GAME_SPEC.md §20).
 *
 * The fee is a shilling a day when a labourer earns five shillings a week, and
 * the troopers ride through the holes twice a month to collect it. The field
 * grows angrier all year, meets by torchlight at winter's end, and in December
 * puts up slabs at Snakey Gully. The stockade always falls; the licence dies
 * with it.
 */

import {
  AGITATION_FROM_DAY,
  AGITATION_PER_DAY,
  AGITATION_PER_HUNT,
  AGITATION_PER_STORY,
  CAMP_DEFS,
  MEETING_AGITATION,
  MEETING_ARREST_CHANCE,
  MEETING_STANDING,
  MEETING_WINDOW,
  STOCKADE_CAMP,
  STOCKADE_JOIN,
  STOCKADE_JOIN_STANDING,
  STOCKADE_SELL_PROFIT,
  STOCKADE_SELL_STANDING,
  STOCKADE_WINDOW,
} from './constants';
import { JOIN_PRICE_FACTOR, shakeSharePrice } from './company';
import { contract, damage } from './health';
import { formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import {
  addJournal,
  addStanding,
  agitationHuntFactor,
  betrayalFactor,
  bumpAgitation,
  checkYearEnd,
  inAftermath,
  isCamp,
  legalRung,
  netWorth,
} from './state';
import { sayFixed } from '../content/say';
import type { GameState, StockadeRole } from './types';

export { agitationHuntFactor, betrayalFactor, bumpAgitation };

// ---------------------------------------------------------------------------
// The temperature of the field
// ---------------------------------------------------------------------------

/** The word the Gazette and the camp use for how things stand. */
export function agitationWord(level: number): string {
  if (level >= 85) return 'past bearing';
  if (level >= 60) return 'openly defiant';
  if (level >= 35) return 'sullen and loud';
  if (level >= 15) return 'grumbling';
  return 'quiet enough';
}

export function meetingWindow(state: GameState): boolean {
  return state.day >= MEETING_WINDOW.from && state.day <= MEETING_WINDOW.to;
}

export function stockadeWindow(state: GameState): boolean {
  return state.day >= STOCKADE_WINDOW.from && state.day <= STOCKADE_WINDOW.to;
}

/** A man at a camp or in Fields Town in December cannot pretend not to know. */
function withinReach(state: GameState): boolean {
  return isCamp(state.location) || state.location === 'fields-town';
}

/**
 * The daily tick of the agitation, run at the end of every day wherever the
 * player is. Raises the meeting and the stockade as pending encounters, and
 * settles them off-stage when the player was nowhere near.
 */
export function agitationTick(state: GameState, log: Log): void {
  if (state.day >= AGITATION_FROM_DAY && !state.stockadeDone) {
    bumpAgitation(state, AGITATION_PER_DAY);
  }

  // --- the monster meeting -------------------------------------------
  if (!state.meetingDone && meetingWindow(state) && isCamp(state.location) && !state.pending) {
    state.pending = { kind: 'meeting', data: { camp: state.location } };
    return;
  }
  if (!state.meetingDone && state.day > MEETING_WINDOW.to) {
    state.meetingDone = true;
    log.say('meeting.missed', undefined, 'neutral');
  }

  // --- the stockade ---------------------------------------------------
  if (!state.stockadeDone && stockadeWindow(state) && withinReach(state) && !state.pending) {
    state.pending = { kind: 'stockade' };
    return;
  }
  // A question already put to the player is not settled behind his back.
  if (!state.stockadeDone && state.day > STOCKADE_WINDOW.to && state.pending?.kind !== 'stockade') {
    resolveStockadeOffstage(state, log);
  }

  // --- the aftermath ---------------------------------------------------
  if (!state.aftermathNoted && inAftermath(state)) {
    if (!state.stockadeDone) resolveStockadeOffstage(state, log);
    state.aftermathNoted = true;
    log.say('aftermath.notice', undefined, 'good');
    addJournal(state, 'The licence is dead. A miner\'s right, one pound the year, in its place.', 'good');
  }
}

/** Reading a licence story in the Angus stokes the fire a little (§20). */
export function agitationFromStory(state: GameState): void {
  if (state.stockadeDone) return;
  bumpAgitation(state, AGITATION_PER_STORY);
}

/** Being stopped by the troopers makes a man angrier than the fee ever did. */
export function agitationFromHunt(state: GameState): void {
  if (state.stockadeDone) return;
  bumpAgitation(state, AGITATION_PER_HUNT);
}

// ---------------------------------------------------------------------------
// The monster meeting
// ---------------------------------------------------------------------------

export function resolveMeeting(state: GameState, rng: RNG, log: Log, attend: boolean): void {
  state.meetingDone = true;
  state.pending = null;
  if (!attend) {
    log.say('meeting.keep', undefined, 'neutral');
    return;
  }
  state.meetingAttended = true;
  addStanding(state, MEETING_STANDING);
  bumpAgitation(state, MEETING_AGITATION);
  log.say('meeting.attend', undefined, 'good');
  addJournal(state, 'Stood in the crowd at the monster meeting and heard the licence damned.', 'good');
  if (state.legal !== 'honest' && rng.chance(MEETING_ARREST_CHANCE)) {
    log.say('meeting.arrest', undefined, 'bad');
    const held = rng.int(3, 9);
    state.day += held;
    state.location = 'fields-town';
    state.journey = null;
    state.provisionDays = Math.max(0, state.provisionDays - held);
    damage(state, rng.int(2, 8), 'a night in the lock-up');
    state.stats.timesArrested += 1;
    checkYearEnd(state);
  }
}

// ---------------------------------------------------------------------------
// The stockade
// ---------------------------------------------------------------------------

function closeStockade(state: GameState, role: StockadeRole): void {
  state.stockadeDone = true;
  state.stockadeDay = state.day;
  state.stockadeRole = role;
  state.pending = null;
}

function resolveStockadeOffstage(state: GameState, log: Log): void {
  closeStockade(state, 'away');
  log.say('stockade.offstage', { camp: CAMP_DEFS[STOCKADE_CAMP].name }, 'grave');
  addJournal(state, `The diggers rose at ${CAMP_DEFS[STOCKADE_CAMP].name}, and it was put down.`, 'bad');
}

export type StockadeChoice = 'join' | 'keepClear' | 'sellSupplies';

/** Whether there is anything to sell to both sides (§20). */
export function canSellSupplies(state: GameState): boolean {
  return state.provisionDays >= 14 || !!state.company;
}

export function resolveStockade(
  state: GameState,
  rng: RNG,
  log: Log,
  choice: StockadeChoice,
): void {
  if (choice === 'keepClear') {
    closeStockade(state, 'kept clear');
    log.say('stockade.keepclear', undefined, 'neutral');
    addJournal(state, 'Kept to my tent the night the stockade went up.', 'neutral');
    return;
  }

  if (choice === 'sellSupplies') {
    if (!canSellSupplies(state)) {
      log.raw('You have nothing either side would pay for.', 'bad');
      return;
    }
    closeStockade(state, 'sold supplies');
    const profit = rng.int(STOCKADE_SELL_PROFIT.lo, STOCKADE_SELL_PROFIT.hi);
    if (state.company) {
      state.company.treasury += profit;
    } else {
      state.moneyPence += profit;
      state.provisionDays = Math.max(0, state.provisionDays - 14);
    }
    addStanding(state, -STOCKADE_SELL_STANDING);
    log.say('stockade.sell', { amount: formatMoney(profit) }, 'neutral');
    addJournal(state, `Sold to both sides at the stockade and made ${formatMoney(profit)} of it.`, 'bad');
    return;
  }

  // --- in behind the slabs ---------------------------------------------
  closeStockade(state, 'joined');
  log.say('stockade.join', { camp: CAMP_DEFS[STOCKADE_CAMP].name }, 'grave');
  if (state.company) shakeSharePrice(state, JOIN_PRICE_FACTOR);

  if (rng.chance(STOCKADE_JOIN.killed)) {
    log.say('stockade.killed', undefined, 'grave');
    addJournal(state, 'Fell at the stockade, under the flag, before daylight.', 'grave');
    damage(state, 999, 'the fight at the stockade');
    return;
  }

  addStanding(state, STOCKADE_JOIN_STANDING);
  if (rng.chance(STOCKADE_JOIN.wounded)) {
    log.say('stockade.wounded', undefined, 'bad');
    damage(state, rng.int(18, 40), 'a wound taken at the stockade');
    if (!state.gameOver) contract(state, rng, log, 'injury', 2);
    if (state.gameOver) return;
  }
  if (rng.chance(STOCKADE_JOIN.arrested)) {
    log.say('stockade.arrested', undefined, 'bad');
    const held = rng.int(8, 24);
    state.day += held;
    state.location = 'fields-town';
    state.journey = null;
    state.provisionDays = Math.max(0, state.provisionDays - held);
    state.stats.timesArrested += 1;
    damage(state, Math.round(held * 0.4), 'the lock-up at Fields Town');
    checkYearEnd(state);
    if (!state.gameOver) log.say('stockade.acquitted', undefined, 'good');
  }
  if (!state.gameOver) {
    log.say('stockade.survived', undefined, 'good');
    addJournal(state, 'Stood behind the slabs at the stockade, and came out of it alive.', 'good');
  }
}

// ---------------------------------------------------------------------------
// The epilogue — worth × stockade × company × law × alive
// ---------------------------------------------------------------------------

export function worthTier(worth: number): 'ruin' | 'modest' | 'comfort' | 'rich' | 'nabob' {
  if (worth < 2400) return 'ruin'; // under £10
  if (worth < 24000) return 'modest'; // under £100
  if (worth < 120000) return 'comfort'; // under £500
  if (worth < 480000) return 'rich'; // under £2000
  return 'nabob';
}

function roleKey(role: StockadeRole): string {
  switch (role) {
    case 'joined':
      return 'joined';
    case 'sold supplies':
      return 'sold';
    case 'kept clear':
      return 'clear';
    default:
      return 'away';
  }
}

/**
 * The closing paragraph of the year, chosen from what the man is worth, what he
 * did in December, whether he still holds his company, how the law regards him,
 * and whether he lived to read it.
 */
export function epilogueFor(state: GameState): string[] {
  const salt = (state.seed ^ (state.day * 2654435761)) >>> 0;
  const dead = state.gameOver === 'dead';
  const tier = worthTier(netWorth(state));
  const out: string[] = [];

  out.push(sayFixed(dead ? `epilogue.dead.${tier}` : `epilogue.worth.${tier}`, salt, {
    name: state.company?.name ?? state.soldOut?.name ?? 'the company',
  }));

  // Precedence when more than one ladder was climbed (§28.2): the company
  // sold out of outranks the bench, and the bench outranks a company still
  // held. A notable's paragraph is about the town, not the pile.
  const notable = state.estate.jpSince !== null;
  if (state.soldOut) {
    out.push(
      sayFixed('epilogue.company.soldout', salt + 2, {
        name: state.soldOut.name,
        amount: formatMoney(state.soldOut.amount),
      }),
    );
  } else if (notable) {
    out.push(sayFixed('epilogue.notable.bench', salt + 8));
  } else if (state.company) {
    out.push(
      sayFixed('epilogue.company.chairman', salt + 1, {
        name: state.company.name,
        shares: state.company.sharesOwned,
      }),
    );
  }
  if (state.estate.works.length > 0) out.push(sayFixed('epilogue.notable.town', salt + 9));

  out.push(sayFixed(`epilogue.stockade.${roleKey(state.stockadeRole)}`, salt + 3));

  // The dark ladder writes its own last paragraph, and it outranks the legal
  // one: a man who has been hanged is past caring what the police books say.
  const end = state.outlawEnd ?? (state.outlawed ? 'at large' : null);
  if (end) {
    out.push(sayFixed(`epilogue.outlaw.${end.replace(' ', '')}`, salt + 7));
    return out;
  }

  const rung = legalRung(state.legal);
  if (rung >= 4) out.push(sayFixed('epilogue.legal.wanted', salt + 4));
  else if (rung >= 2) out.push(sayFixed('epilogue.legal.criminal', salt + 5));
  else if (state.standing >= 60 && !notable) out.push(sayFixed('epilogue.legal.known', salt + 6));

  return out;
}
