/** Hearth and kin: the understanding, the ball, and the mail (§32). */

import { purse } from '../company';
import {
  BALL_STANDING,
  BALL_TICKET,
  COTTAGE_PRICE_LARGE,
  COTTAGE_PRICE_SMALL,
  GIFT_LAVISH_COST,
  GIFT_SMALL_MAX,
  WEDDING_COST,
} from '../constants';
import {
  ballAnnounced,
  ballTonight,
  canPayAddresses,
  canReconcile,
  eventOpenHere,
  hearthResumeLine,
  hearthVerbsOpen,
  lettersWaiting,
  nextEventLine,
} from '../hearth';
import { formatGold, formatMoney, pounds, shillings } from '../money';
import { formatDate } from '../time';
import type { GameState, MenuItem, ScreenView } from '../types';
import { item, back, homeScreenFor } from './shared';

export function hearthHubItems(state: GameState): MenuItem[] {
  const out: MenuItem[] = [];
  if (ballTonight(state)) {
    out.push(item('U', 'The subscription ball tonight', { type: 'goto', screen: 'ball' }, `ticket ${formatMoney(BALL_TICKET)}; introductions begin at standing ${BALL_STANDING}`, state.standing < BALL_STANDING || state.moneyPence < BALL_TICKET));
  } else if (ballAnnounced(state)) {
    out.push(item('U', `The subscription ball, ${formatDate(state.hearth.nextBallDay)}`, { type: 'goto', screen: 'ball' }, `at the Assembly Room in Slateford; ticket ${formatMoney(BALL_TICKET)}, and introductions begin at standing ${BALL_STANDING}`));
  }
  if (state.hearth.intended) {
    out.push(item('Y', state.hearth.cottage ? 'Your hearth in Port Gannet' : `Your understanding with ${state.hearth.intended.name}`, { type: 'goto', screen: 'hearth' }, nextEventLine(state) ?? hearthResumeLine(state) ?? undefined));
  }
  const waiting = lettersWaiting(state);
  if (waiting > 0) out.push(item('Q', `${waiting} letter${waiting === 1 ? '' : 's'} waiting at the post office`, { type: 'goto', screen: 'letters' }, 'a penny to take up the mail'));
  return out;
}

export function hearthView(state: GameState): ScreenView {
  const h = state.hearth;
  const intended = h.intended;
  const body: string[] = [
    hearthResumeLine(state) ?? 'There is no household in your ledger yet.',
  ];
  if (intended) {
    body.push(`${intended.name} keeps her work as a ${intended.trade}; her manner is one of ${intended.manner}.`);
    if (h.rung === 'courting') body.push(`Calls kept at Port Gannet: ${intended.callsKept}.`);
  }
  const dated = nextEventLine(state);
  if (dated) body.push('', dated);
  if (h.cottage) {
    body.push('', `Under the cottage floor: ${formatMoney(h.homeStashPence)} and ${formatGold(h.homeStashCentiOz)}.`);
  }

  const menu: MenuItem[] = [];
  if (canPayAddresses(state)) {
    menu.push(item('1', `Ask leave to pay addresses to ${intended!.name}`, { type: 'payAddresses' }, 'she names a window for your first call at Port Gannet'));
  }
  if (h.nextEvent) {
    const e = h.nextEvent;
    const open = eventOpenHere(state);
    const label = e.kind === 'call'
      ? `Keep the call with ${intended?.name ?? 'her'}`
      : e.kind === 'banns'
        ? 'Attend the reading of the banns'
        : e.kind === 'wedding'
          ? `Hold the wedding — ${formatMoney(WEDDING_COST)}`
          : e.kind === 'christmas'
            ? 'Keep Christmas at the hearth'
            : e.kind === 'birth'
              ? 'Be at home for the birth'
              : 'Stay through the sickbed and fetch the doctor';
    menu.push(item('2', label, { type: e.kind === 'banns' || e.kind === 'wedding' ? 'holdWedding' : 'callAtThePort' }, open ? 'this is the appointed window' : `at Port Gannet, days ${e.openDay}–${e.closeDay}`, !open || (e.kind === 'wedding' && state.moneyPence < WEDDING_COST)));
  }
  if (h.rung === 'courting') {
    menu.push(
      item('3', `Bring a small useful gift — ${formatMoney(GIFT_SMALL_MAX)}`, { type: 'giveGift', lavish: false }, 'colours the call; it cannot buy consent', state.moneyPence < GIFT_SMALL_MAX),
      item('4', `Offer a lavish gift — ${formatMoney(GIFT_LAVISH_COST)}`, { type: 'giveGift', lavish: true }, 'generosity once; pressed or offered too early, it reads as purchase', state.moneyPence < GIFT_LAVISH_COST),
      item('5', 'Ask whether she will have the banns read', { type: 'proposeBanns' }, `${intended?.callsKept ?? 0} of 3 calls kept; her answer weighs your name and conduct, never gifts`, (intended?.callsKept ?? 0) < 3),
    );
  }
  if (h.rung === 'wed' && !h.cottage && state.location === 'suze-port') {
    menu.push(
      item('6', `Buy a small cottage — ${formatMoney(COTTAGE_PRICE_SMALL)}`, { type: 'buyCottage', size: 'small' }, 'a safe bed and a floorboard vault', purse(state) < COTTAGE_PRICE_SMALL),
      item('7', `Buy a large cottage — ${formatMoney(COTTAGE_PRICE_LARGE)}`, { type: 'buyCottage', size: 'large' }, 'the same verbs and safety; the difference is what you choose to call home', purse(state) < COTTAGE_PRICE_LARGE),
    );
  }
  if (hearthVerbsOpen(state) && state.location === 'suze-port') {
    menu.push(
      item('A', 'Put £10 beneath the floor', { type: 'homeStash', what: 'money', amount: pounds(10) }, 'theft-proof household storage', state.moneyPence < pounds(10)),
      item('B', 'Take £10 from beneath the floor', { type: 'homeUnstash', what: 'money', amount: pounds(10) }, undefined, h.homeStashPence <= 0),
      item('G', 'Put one ounce of gold beneath the floor', { type: 'homeStash', what: 'gold', amount: 100 }, undefined, state.goldCentiOz < 100),
      item('H', 'Take one ounce of gold from beneath the floor', { type: 'homeUnstash', what: 'gold', amount: 100 }, undefined, h.homeStashCentiOz <= 0),
    );
  }
  if (hearthVerbsOpen(state) && state.location === 'fields-town') {
    menu.push(item('C', 'Consign scavenged goods through Bell’s Freight — 2s', { type: 'consignGoods' }, 'sold at Port Gannet without the journey', state.salvage <= 0 || state.moneyPence < shillings(2)));
  }
  if (intended && (state.location === 'suze-port' || state.location === 'fields-town')) {
    menu.push(
      item('R', 'Send £1 home by post-office order', { type: 'sendRemittance', amount: pounds(1) }, 'a pure gift; it changes letters, never consent', purse(state) < pounds(1)),
      item('S', 'Send £5 home by post-office order', { type: 'sendRemittance', amount: pounds(5) }, 'a pure gift; it changes letters, never consent', purse(state) < pounds(5)),
    );
  }
  if (canReconcile(state)) menu.push(item('K', 'Remain in Port Gannet for a month and seek reconciliation', { type: 'seekReconciliation' }, 'one offer in the game; presence, not payment'));
  if (lettersWaiting(state) > 0) menu.push(item('L', 'Take up the waiting letters', { type: 'goto', screen: 'letters' }));
  menu.push(back(homeScreenFor(state)));
  return { screen: 'hearth', title: 'HEARTH & KIN', subtitle: intended?.name, body, menu };
}

export function ballView(state: GameState): ScreenView {
  const on = ballTonight(state);
  const night = state.hearth.nextBallDay > 0 ? state.hearth.nextBallDay : state.day;
  const received = state.standing < BALL_STANDING
    ? `At ${Math.floor(state.standing)}/100 standing, no one is ready to make the introduction.`
    : 'Your name is known well enough to be received.';
  const body = on
    ? [
        'The Assembly Room is hung with flags and gum leaves. Storekeepers, nurses,',
        'clerks and diggers have put off the dust for one evening, though not their opinions.',
        received,
      ]
    : [
        'The stewards have taken the Assembly Room at Slateford for the night',
        `of ${formatDate(night)}. Tickets are ${formatMoney(BALL_TICKET)} at the door, and a man must be in`,
        `the town on the night; no introduction is made under ${BALL_STANDING}/100 standing.`,
        '',
        received,
      ];
  return {
    screen: 'ball',
    title: 'THE SUBSCRIPTION BALL',
    subtitle: formatDate(night),
    body,
    menu: [
      item(
        '1',
        on ? `Attend — ${formatMoney(BALL_TICKET)}` : `Attend on ${formatDate(night)} — ${formatMoney(BALL_TICKET)}`,
        { type: 'attendBall' },
        !on
          ? 'the doors are not open yet; be in Slateford on the night'
          : state.hearth.intended
            ? 'a social evening; no second prospective partner is rolled'
            : 'an introduction may come of the evening',
        !on || state.standing < BALL_STANDING || state.moneyPence < BALL_TICKET,
      ),
      back(homeScreenFor(state)),
    ],
  };
}

export function lettersView(state: GameState): ScreenView {
  const waiting = lettersWaiting(state);
  const body = waiting > 0
    ? [`${waiting} sealed letter${waiting === 1 ? '' : 's'} wait behind the post-office counter.`]
    : state.hearth.letters.length
      ? state.hearth.letters.slice(-8).flatMap((l) => [`${formatDate(l.day)}`, l.text, ''])
      : ['There is no mail under your name.'];
  return {
    screen: 'letters', title: 'MAIL DAY', body,
    menu: [
      ...(waiting > 0 ? [item('1', 'Pay 1d and take up the letters', { type: 'readLetters' }, undefined, state.moneyPence < 1)] : []),
      back(state.hearth.intended ? 'hearth' : homeScreenFor(state)),
    ],
  };
}
