/** Hearth & kin — courtship, dated pulls, home and letters (§32). */

import {
  BALL_NOTICE_DAYS,
  BALL_STANDING,
  BALL_TICKET,
  CALL_GAP_DAYS,
  CALL_WINDOW_DAYS,
  CALLS_BEFORE_BANNS,
  CONSIGN_FREIGHT,
  COTTAGE_PRICE_LARGE,
  COTTAGE_PRICE_SMALL,
  COURTSHIP_BURN_DAYS,
  GIFT_LAVISH_COST,
  GIFT_LAVISH_GAP_DAYS,
  GIFT_LAVISH_STANDING,
  GIFT_SMALL_MAX,
  HEARTH_HEAL_NURSE_BONUS,
  HEARTH_HEAL_PER_DAY,
  MISSED_RUN_ESTRANGED,
  WEDDING_COST,
  WEDDING_STANDING,
} from './constants';
import { salvageValue } from './events';
import { formatGold, formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, addStanding, legalRung } from './state';
import { calendarYear, dayOfYear, formatDate } from './time';
import type {
  GameState,
  HearthEventKind,
  Intended,
  IntendedTrade,
  MeetingPlace,
  Tone,
} from './types';

const NAMES = ['Mary Doyle', 'Ellen Ward', 'Catherine Bell', 'Anne Fraser', 'Bridget Hayes', 'Eliza Scally'];
const TRADES: IntendedTrade[] = ['storekeeper', 'nurse', 'boarding-house'];
const MANNERS = ['dry wit', 'bookish', 'devout', 'plain speaking', 'quiet good sense'];

function addLetter(state: GameState, text: string, tone: Tone = 'neutral'): void {
  state.hearth.letters.push({ day: state.day, text, tone, read: false });
  if (state.hearth.letters.length > 40) state.hearth.letters.shift();
}

function eventName(kind: HearthEventKind): string {
  switch (kind) {
    case 'call': return 'an evening call';
    case 'banns': return 'the reading of the banns';
    case 'wedding': return 'the wedding';
    case 'christmas': return 'Christmas at home';
    case 'birth': return 'the birth';
    case 'sickbed': return 'the sickbed';
  }
}

function schedule(state: GameState, kind: HearthEventKind, openDay: number): void {
  const h = state.hearth;
  h.nextEvent = { kind, openDay, closeDay: openDay + CALL_WINDOW_DAYS - 1, announced: true };
  const name = h.intended?.name ?? 'Your people';
  addLetter(
    state,
    `${name} asks you to be at Port Gannet for ${eventName(kind)}, between ${formatDate(openDay)} and ${formatDate(openDay + CALL_WINDOW_DAYS - 1)}.`,
  );
}

function markKept(state: GameState): void {
  state.hearth.eventsKept += 1;
  state.hearth.missedRun = 0;
  state.hearth.nextEvent = null;
}

function estrange(state: GameState, herDecision: boolean, reason: string): void {
  const h = state.hearth;
  h.rung = 'estranged';
  h.herDecision = herDecision;
  h.nextEvent = null;
  h.courtshipBurnedOn = state.day;
  addLetter(state, reason, 'bad');
  addJournal(state, `${h.intended?.name ?? 'She'} ended the understanding by letter.`, 'bad');
}

/** Schedule balls, expire dated pulls, and let legal choices reach the relationship. */
export function hearthDay(state: GameState, _rng: RNG, log: Log): void {
  const h = state.hearth;
  const yearStart = state.day - dayOfYear(state.day) + 1;
  const ballDays = [75, 185, 295].map((d) => yearStart + d - 1);
  if (h.nextBallDay === 0 || h.nextBallDay < state.day) {
    h.nextBallDay = ballDays.find((d) => d >= state.day) ?? yearStart + 365 + 74;
  }

  if (h.nextEvent && state.day > h.nextEvent.closeDay) {
    const missed = h.nextEvent.kind;
    h.nextEvent = null;
    h.eventsMissed += 1;
    h.missedRun += 1;
    addLetter(state, `The days appointed for ${eventName(missed)} passed without you. No account is asked; the absence is account enough.`, 'bad');
    if (h.missedRun >= MISSED_RUN_ESTRANGED) {
      estrange(state, false, `${h.intended?.name ?? 'She'} will not arrange a life around dates you do not keep. She releases you from the understanding.`);
      log.say('hearth.estranged.missed', { name: h.intended?.name ?? 'She' }, 'bad');
    } else if (h.rung === 'courting') {
      schedule(state, 'call', state.day + CALL_GAP_DAYS);
    }
  }

  if (h.rung === 'courting' && legalRung(state.legal) > 1) {
    estrange(state, true, `${h.intended?.name ?? 'She'} has read what the paper says of your legal record. She will not be carried further down that road.`);
    log.say('hearth.estranged.record', { name: h.intended?.name ?? 'She' }, 'bad');
  }

  if ((h.rung === 'wed' || h.rung === 'settled') && !h.nextEvent) {
    const doy = dayOfYear(state.day);
    if (doy >= 345 && doy < 359) schedule(state, 'christmas', state.day - doy + 359);
    else if (calendarYear(state.day) > 1854 && !h.childBorn && doy >= 120 && doy < 150) {
      schedule(state, 'birth', state.day + 5);
    } else if (h.childBorn && !h.sickbedDone && doy >= 220 && doy < 250) {
      schedule(state, 'sickbed', state.day + 4);
    }
  }
}

export function ballTonight(state: GameState): boolean {
  return state.location === 'fields-town' && state.day === state.hearth.nextBallDay;
}

/** The stewards' notice runs in the Times for a fortnight before the night (§32.1). */
export function ballAnnounced(state: GameState): boolean {
  const day = state.hearth.nextBallDay;
  return day >= state.day && day - state.day <= BALL_NOTICE_DAYS;
}

export function canPayAddresses(state: GameState): boolean {
  const h = state.hearth;
  return !!h.intended && h.rung === 'acquainted' &&
    (h.courtshipBurnedOn === 0 || state.day - h.courtshipBurnedOn >= COURTSHIP_BURN_DAYS);
}

export function eventOpenHere(state: GameState): boolean {
  const e = state.hearth.nextEvent;
  return !!e && state.location === 'suze-port' && state.day >= e.openDay && state.day <= e.closeDay;
}

export function hearthVerbsOpen(state: GameState): boolean {
  return state.hearth.cottage && (state.hearth.rung === 'wed' || state.hearth.rung === 'settled');
}

export function lettersWaiting(state: GameState): number {
  return state.hearth.letters.filter((l) => !l.read).length;
}

export function nextEventLine(state: GameState): string | null {
  const e = state.hearth.nextEvent;
  if (!e) return null;
  return `${state.hearth.intended?.name ?? 'Your people'} expect you for ${eventName(e.kind)} by ${formatDate(e.closeDay)}.`;
}

export function hearthResumeLine(state: GameState): string | null {
  const h = state.hearth;
  if (!h.intended) return null;
  if (h.rung === 'estranged') return `Estranged from ${h.intended.name}.`;
  if (h.rung === 'settled') return `At home in Port Gannet with ${h.intended.name}.`;
  if (h.rung === 'wed') return `Married to ${h.intended.name}; no cottage bought yet.`;
  return `${h.rung === 'betrothed' ? 'Betrothed' : h.rung === 'courting' ? 'Courting' : 'Acquainted'}: ${h.intended.name}.`;
}

/** Her answer depends on conduct and calls, never cash or remittances. */
export function consentRoll(state: GameState, rng: RNG): boolean {
  const i = state.hearth.intended;
  if (!i || i.callsKept < CALLS_BEFORE_BANNS) return false;
  const missteps = i.lavishMissteps ?? 0;
  const p = Math.max(0.12, Math.min(0.9, 0.25 + state.standing * 0.006 + i.callsKept * 0.08 - missteps * 0.18));
  return rng.chance(p);
}

export function tradeBonus(trade: IntendedTrade): 'consign' | 'heal' | 'hire' {
  return trade === 'storekeeper' ? 'consign' : trade === 'nurse' ? 'heal' : 'hire';
}

export function sleepsAtHearth(state: GameState): boolean {
  return state.location === 'suze-port' && hearthVerbsOpen(state);
}

export function hearthHealBonus(state: GameState): number {
  if (!sleepsAtHearth(state)) return 0;
  return HEARTH_HEAL_PER_DAY + (state.hearth.intended?.trade === 'nurse' ? HEARTH_HEAL_NURSE_BONUS : 0);
}

export function attendBall(state: GameState, rng: RNG, log: Log): boolean {
  if (!ballTonight(state) || state.standing < BALL_STANDING || state.moneyPence < BALL_TICKET) return false;
  state.moneyPence -= BALL_TICKET;
  if (!state.hearth.intended &&
      (state.hearth.courtshipBurnedOn === 0 || state.day - state.hearth.courtshipBurnedOn >= COURTSHIP_BURN_DAYS)) {
    const intended: Intended = {
      name: rng.pick(NAMES), trade: rng.pick(TRADES), manner: rng.pick(MANNERS),
      metOn: state.day, metAt: 'ball' as MeetingPlace, callsKept: 0,
      lavishGifts: 0, lavishMissteps: 0, lastGiftOn: 0,
    };
    state.hearth.intended = intended;
    state.hearth.rung = 'acquainted';
    log.say('hearth.meet.ball', { name: intended.name, trade: intended.trade }, 'good');
  } else {
    log.say('hearth.ball.social', undefined, 'neutral');
  }
  addStanding(state, 1);
  state.hearth.nextBallDay = 0;
  return true;
}

export function payAddresses(state: GameState, log: Log): boolean {
  if (!canPayAddresses(state)) return false;
  state.hearth.rung = 'courting';
  schedule(state, 'call', state.day + 2);
  log.say('hearth.addresses', { name: state.hearth.intended!.name }, 'neutral');
  return true;
}

export function keepHearthEvent(state: GameState, log: Log): boolean {
  const e = state.hearth.nextEvent;
  if (!e || !eventOpenHere(state)) return false;
  const h = state.hearth;
  if (e.kind === 'call') {
    markKept(state);
    if (h.intended) h.intended.callsKept += 1;
    log.say('hearth.call.kept', { name: h.intended?.name ?? 'her' }, 'good');
    if ((h.intended?.callsKept ?? 0) < CALLS_BEFORE_BANNS) schedule(state, 'call', state.day + CALL_GAP_DAYS);
    return true;
  }
  if (e.kind === 'banns') {
    markKept(state);
    schedule(state, 'wedding', state.day + 2);
    log.say('hearth.banns', { name: h.intended?.name ?? 'her' }, 'good');
    return true;
  }
  if (e.kind === 'wedding') return false;
  markKept(state);
  if (e.kind === 'birth') h.childBorn = true;
  if (e.kind === 'sickbed') h.sickbedDone = true;
  log.say(`hearth.event.${e.kind}`, { name: h.intended?.name ?? 'her' }, 'good');
  return true;
}

export function giveGift(state: GameState, log: Log, lavish: boolean): boolean {
  const i = state.hearth.intended;
  if (!i || !['courting', 'betrothed'].includes(state.hearth.rung)) return false;
  const cost = lavish ? GIFT_LAVISH_COST : GIFT_SMALL_MAX;
  if (state.moneyPence < cost) return false;
  state.moneyPence -= cost;
  if (lavish) {
    i.lavishGifts += 1;
    if (state.standing < GIFT_LAVISH_STANDING || state.day - i.lastGiftOn < GIFT_LAVISH_GAP_DAYS) {
      i.lavishMissteps = (i.lavishMissteps ?? 0) + 1;
      log.say('hearth.gift.pressed', { name: i.name }, 'bad');
    } else log.say('hearth.gift.lavish', { name: i.name }, 'neutral');
  } else log.say('hearth.gift.small', { name: i.name }, 'neutral');
  i.lastGiftOn = state.day;
  return true;
}

export function proposeBanns(state: GameState, rng: RNG, log: Log): boolean {
  const h = state.hearth;
  if (h.rung !== 'courting' || (h.intended?.callsKept ?? 0) < CALLS_BEFORE_BANNS) return false;
  if (legalRung(state.legal) > 1) {
    log.say('hearth.banns.refused.record', { name: h.intended?.name ?? 'Her' }, 'bad');
    return false;
  }
  if (!consentRoll(state, rng)) {
    estrange(state, true, `${h.intended?.name ?? 'She'} has considered the life you offer and declines it. Her answer is final, and it is her own.`);
    log.say('hearth.consent.no', { name: h.intended?.name ?? 'She' }, 'bad');
    return true;
  }
  h.rung = 'betrothed';
  schedule(state, 'banns', state.day + 2);
  log.say('hearth.consent.yes', { name: h.intended?.name ?? 'She' }, 'good');
  return true;
}

export function holdWedding(state: GameState, log: Log): boolean {
  const h = state.hearth;
  if (h.nextEvent?.kind === 'banns') return keepHearthEvent(state, log);
  if (h.rung !== 'betrothed' || h.nextEvent?.kind !== 'wedding' || !eventOpenHere(state)) return false;
  if (state.moneyPence < WEDDING_COST) return false;
  state.moneyPence -= WEDDING_COST;
  markKept(state);
  h.rung = h.cottage ? 'settled' : 'wed';
  h.weddingDay = state.day;
  addStanding(state, WEDDING_STANDING);
  addJournal(state, `Married ${h.intended?.name ?? 'at Port Gannet'} on ${formatDate(state.day)}.`, 'good');
  log.say('hearth.wedding', { name: h.intended?.name ?? 'her', amount: formatMoney(WEDDING_COST) }, 'good');
  return true;
}

function drawFrom(state: GameState, amount: number): boolean {
  if (state.moneyPence + state.bankPence < amount) return false;
  const cash = Math.min(amount, state.moneyPence);
  state.moneyPence -= cash;
  state.bankPence -= amount - cash;
  return true;
}

export function buyCottage(state: GameState, log: Log, size: 'small' | 'large'): boolean {
  const h = state.hearth;
  const cost = size === 'small' ? COTTAGE_PRICE_SMALL : COTTAGE_PRICE_LARGE;
  if (state.location !== 'suze-port' || h.cottage || !['wed', 'settled'].includes(h.rung) || !drawFrom(state, cost)) return false;
  h.cottage = true;
  h.cottagePaidPence = cost;
  h.rung = 'settled';
  addJournal(state, `Bought a ${size} cottage in Port Gannet for ${formatMoney(cost)}.`, 'good');
  log.say('hearth.cottage', { amount: formatMoney(cost) }, 'good');
  return true;
}

export function homeStash(state: GameState, log: Log, what: 'money' | 'gold', amount: number): boolean {
  if (!hearthVerbsOpen(state) || state.location !== 'suze-port' || !Number.isFinite(amount) || amount <= 0) return false;
  const n = Math.floor(amount);
  if (what === 'money') {
    if (state.moneyPence < n) return false;
    state.moneyPence -= n; state.hearth.homeStashPence += n;
  } else {
    if (state.goldCentiOz < n) return false;
    state.goldCentiOz -= n; state.hearth.homeStashCentiOz += n;
  }
  log.raw(`Put ${what === 'money' ? formatMoney(n) : formatGold(n)} beneath the cottage floor.`, 'neutral');
  return true;
}

export function homeUnstash(state: GameState, log: Log, what: 'money' | 'gold', amount: number): boolean {
  if (!hearthVerbsOpen(state) || state.location !== 'suze-port' || !Number.isFinite(amount) || amount <= 0) return false;
  const held = what === 'money' ? state.hearth.homeStashPence : state.hearth.homeStashCentiOz;
  const n = Math.min(Math.floor(amount), held);
  if (n <= 0) return false;
  if (what === 'money') { state.hearth.homeStashPence -= n; state.moneyPence += n; }
  else { state.hearth.homeStashCentiOz -= n; state.goldCentiOz += n; }
  log.raw(`Took up ${what === 'money' ? formatMoney(n) : formatGold(n)} from beneath the floor.`, 'neutral');
  return true;
}

export function consignGoods(state: GameState, rng: RNG, log: Log): boolean {
  if (!hearthVerbsOpen(state) || state.location !== 'fields-town' || state.salvage <= 0 || state.moneyPence < CONSIGN_FREIGHT) return false;
  state.moneyPence -= CONSIGN_FREIGHT;
  let proceeds = salvageValue(state, rng);
  if (state.hearth.intended?.trade === 'storekeeper') proceeds = Math.round(proceeds * 1.1);
  const count = state.salvage;
  state.salvage = 0;
  state.moneyPence += proceeds;
  log.say('hearth.consign', { n: count, amount: formatMoney(proceeds) }, 'good');
  return true;
}

export function sendRemittance(state: GameState, log: Log, amount: number): boolean {
  if (!['suze-port', 'fields-town'].includes(state.location) || !state.hearth.intended || !Number.isFinite(amount) || amount <= 0) return false;
  const n = Math.floor(amount);
  if (!drawFrom(state, n)) return false;
  state.hearth.remittedPence += n;
  addJournal(state, `Sent ${formatMoney(n)} home by post-office order.`, 'neutral');
  addLetter(state, `Your post-office order for ${formatMoney(n)} came safely. It was not required; it was understood.`, 'good');
  log.say('hearth.remit', { amount: formatMoney(n) }, 'neutral');
  return true;
}

export function readLetters(state: GameState, log: Log): boolean {
  if (!['suze-port', 'fields-town'].includes(state.location) || lettersWaiting(state) === 0) return false;
  if (state.moneyPence < 1) return false;
  state.moneyPence -= 1;
  for (const letter of state.hearth.letters) letter.read = true;
  log.say('hearth.letters.read', { name: state.hearth.intended?.name ?? 'home' }, 'neutral');
  return true;
}

export function canReconcile(state: GameState): boolean {
  const h = state.hearth;
  return h.rung === 'estranged' && !h.herDecision && !h.reconciliationUsed && state.location === 'suze-port';
}

export function reconcile(state: GameState, log: Log): boolean {
  if (!canReconcile(state)) return false;
  const h = state.hearth;
  h.reconciliationUsed = true;
  h.eventsKept = 0;
  h.eventsMissed = 0;
  h.missedRun = 0;
  h.rung = h.weddingDay > 0 ? (h.cottage ? 'settled' : 'wed') : 'courting';
  log.say('hearth.reconciled', { name: h.intended?.name ?? 'her' }, 'good');
  return true;
}

export interface HearthReckoning {
  rung: GameState['hearth']['rung']; intendedName: string | null;
  eventsKept: number; eventsMissed: number; remittedPence: number;
  cottage: boolean; childBorn: boolean; finalLetterKey: string;
}

export function hearthReckoning(state: GameState): HearthReckoning {
  const h = state.hearth;
  return {
    rung: h.rung, intendedName: h.intended?.name ?? null,
    eventsKept: h.eventsKept, eventsMissed: h.eventsMissed,
    remittedPence: h.remittedPence, cottage: h.cottage, childBorn: h.childBorn,
    finalLetterKey: h.rung === 'estranged' ? 'hearth.final.estranged' : h.rung === 'settled' ? 'hearth.final.settled' : h.intended ? 'hearth.final.intended' : 'hearth.final.none',
  };
}

export const HEARTH_EVENT_KINDS: HearthEventKind[] = ['call', 'banns', 'wedding', 'christmas', 'birth', 'sickbed'];
