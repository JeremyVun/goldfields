import { describe, expect, it } from 'vitest';
import { COTTAGE_PRICE_SMALL, COURTSHIP_BURN_DAYS, WEDDING_COST } from '../src/engine/constants';
import { consentRoll, hearthDay, sleepsAtHearth } from '../src/engine/hearth';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { gazetteFor } from '../src/engine/news';
import { formatDate } from '../src/engine/time';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import type { GameState } from '../src/engine/types';

function acquaintance(seed = 1): GameState {
  const s = createInitialState(seed);
  s.location = 'fields-town';
  s.screen = 'ball';
  s.standing = 50;
  s.moneyPence = pounds(300);
  s.hearth.nextBallDay = s.day;
  return step(s, { type: 'attendBall' }, makeRng(seed)).state;
}

describe('Hearth & Kin', () => {
  it('introduces a person at the ball and exposes actual courtship choices', () => {
    const s = acquaintance(11);
    expect(s.hearth.rung).toBe('acquainted');
    expect(s.hearth.intended?.name).toBeTruthy();
    s.screen = 'hearth';
    const labels = getView(s).menu.map((m) => m.label).join(' | ');
    expect(labels).toMatch(/pay addresses/i);
  });

  it('carries a kept courtship through calls, banns, wedding and cottage', () => {
    let s = acquaintance(12);
    const rng = makeRng(12);
    s = step(s, { type: 'payAddresses' }, rng).state;
    expect(s.hearth.rung).toBe('courting');

    for (let call = 0; call < 3; call++) {
      s.location = 'suze-port';
      s.day = s.hearth.nextEvent!.openDay;
      s = step(s, { type: 'callAtThePort' }, rng).state;
    }
    expect(s.hearth.intended?.callsKept).toBe(3);

    const consenting = makeRng(1200);
    consenting.chance = () => true;
    s = step(s, { type: 'proposeBanns' }, consenting).state;
    expect(s.hearth.rung).toBe('betrothed');
    s.day = s.hearth.nextEvent!.openDay;
    s = step(s, { type: 'holdWedding' }, rng).state;
    expect(s.hearth.nextEvent?.kind).toBe('wedding');
    s.day = s.hearth.nextEvent!.openDay;
    const beforeWedding = s.moneyPence;
    s = step(s, { type: 'holdWedding' }, rng).state;
    expect(s.hearth.rung).toBe('wed');
    expect(s.moneyPence).toBeLessThanOrEqual(beforeWedding - WEDDING_COST);

    const beforeCottage = s.moneyPence + s.bankPence;
    s = step(s, { type: 'buyCottage', size: 'small' }, rng).state;
    expect(s.hearth.rung).toBe('settled');
    expect(s.hearth.cottagePaidPence).toBe(COTTAGE_PRICE_SMALL);
    expect(s.moneyPence + s.bankPence).toBe(beforeCottage - COTTAGE_PRICE_SMALL);
    expect(sleepsAtHearth(s)).toBe(true);
  });

  it('keeps consent entirely blind to cash and remittances', () => {
    const base = acquaintance(13);
    base.hearth.rung = 'courting';
    base.hearth.intended!.callsKept = 3;
    const rich = structuredClone(base);
    rich.moneyPence = pounds(10_000);
    rich.bankPence = pounds(10_000);
    rich.hearth.remittedPence = pounds(500);
    const poor = structuredClone(base);
    poor.moneyPence = 0;
    poor.bankPence = 0;
    poor.hearth.remittedPence = 0;
    expect(consentRoll(rich, makeRng(99))).toBe(consentRoll(poor, makeRng(99)));
  });

  it('treats pressed lavishness as conduct, not a purchase price', () => {
    let s = acquaintance(14);
    s = step(s, { type: 'payAddresses' }, makeRng(14)).state;
    s.standing = 10;
    s = step(s, { type: 'giveGift', lavish: true }, makeRng(15)).state;
    expect(s.hearth.intended?.lavishMissteps).toBe(1);
    expect(s.hearth.rung).toBe('courting');
  });

  it('marks missed dates without taking money or health, and estranges after two', () => {
    const s = acquaintance(15);
    s.hearth.rung = 'courting';
    s.hearth.nextEvent = { kind: 'call', openDay: 2, closeDay: 4, announced: true };
    s.day = 5;
    const money = s.moneyPence;
    const health = s.health;
    const rng = makeRng(15);
    const log = new Log(rng);
    hearthDay(s, rng, log);
    expect(s.hearth.eventsMissed).toBe(1);
    expect(s.moneyPence).toBe(money);
    expect(s.health).toBe(health);
    s.day = s.hearth.nextEvent!.closeDay + 1;
    hearthDay(s, rng, log);
    expect(s.hearth.rung).toBe('estranged');
    expect(s.moneyPence).toBe(money);
    expect(s.health).toBe(health);
  });

  it('lets an estranged man be introduced again at a later ball, and never to the same person', () => {
    let s = acquaintance(31);
    const first = s.hearth.intended!.name;
    s.hearth.rung = 'estranged';
    s.hearth.herDecision = true;
    s.hearth.courtshipBurnedOn = s.day;

    // Inside the burn period the ticket buys a social evening only.
    s.location = 'fields-town';
    s.screen = 'ball';
    s.hearth.nextBallDay = s.day;
    s = step(s, { type: 'attendBall' }, makeRng(31)).state;
    expect(s.hearth.rung).toBe('estranged');
    expect(s.hearth.intended?.name).toBe(first);

    // Once it has passed, a new introduction may be made — to somebody else.
    s.day = s.hearth.courtshipBurnedOn + COURTSHIP_BURN_DAYS;
    s.location = 'fields-town';
    s.screen = 'ball';
    s.hearth.nextBallDay = s.day;
    s = step(s, { type: 'attendBall' }, makeRng(32)).state;
    expect(s.hearth.rung).toBe('acquainted');
    expect(s.hearth.intended?.name).toBeTruthy();
    expect(s.hearth.intended?.name).not.toBe(first);
    expect(s.hearth.intended?.callsKept).toBe(0);
    expect(s.hearth.herDecision).toBe(false);
  });

  it('keeps the ball a social evening for a man estranged after his wedding', () => {
    let s = acquaintance(33);
    const name = s.hearth.intended!.name;
    s.hearth.rung = 'estranged';
    s.hearth.weddingDay = 100;
    s.hearth.courtshipBurnedOn = s.day;
    s.day = s.day + COURTSHIP_BURN_DAYS * 2;
    s.location = 'fields-town';
    s.screen = 'ball';
    s.hearth.nextBallDay = s.day;
    s = step(s, { type: 'attendBall' }, makeRng(33)).state;
    expect(s.hearth.rung).toBe('estranged');
    expect(s.hearth.intended?.name).toBe(name);
  });

  it('keeps the cottage vault non-negative and rejects invented quantities', () => {
    let s = acquaintance(16);
    s.location = 'suze-port';
    s.hearth.rung = 'settled';
    s.hearth.cottage = true;
    s.hearth.cottagePaidPence = pounds(60);
    const before = s.moneyPence;
    s = step(s, { type: 'homeStash', what: 'money', amount: -shillings(5) }, makeRng(16)).state;
    expect(s.moneyPence).toBe(before);
    expect(s.hearth.homeStashPence).toBe(0);
    s = step(s, { type: 'homeUnstash', what: 'money', amount: pounds(50) }, makeRng(17)).state;
    expect(s.hearth.homeStashPence).toBe(0);
  });
});

/** A man standing in Slateford a few days before the first ball of the year. */
function beforeTheBall(day = 70): GameState {
  const s = createInitialState(21);
  s.location = 'fields-town';
  s.day = day;
  hearthDay(s, makeRng(21), new Log(makeRng(21)));
  return s;
}

describe('the subscription ball is announced before the night (§32.1)', () => {
  it('runs the stewards’ notice in the Times, with the date of the ball', () => {
    const s = beforeTheBall();
    expect(s.hearth.nextBallDay).toBe(75);
    const paper = gazetteFor(s).join('\n');
    expect(paper).toMatch(/SUBSCRIPTION BALL/);
    expect(paper).toContain(formatDate(75));
    expect(paper).toMatch(/Assembly Room/);
  });

  it('keeps the notice out of the paper when no ball is near', () => {
    const s = beforeTheBall(120);
    expect(s.hearth.nextBallDay).toBe(185);
    expect(gazetteFor(s).join('\n')).not.toMatch(/SUBSCRIPTION BALL/);
  });

  it('dates the ball in the Slateford hub before the night, and calls it tonight on the night', () => {
    const s = beforeTheBall();
    s.screen = 'ftown';
    const upcoming = getView(s).menu.find((m) => m.key === 'U')!;
    expect(upcoming.label).toBe(`The subscription ball, ${formatDate(75)}`);
    expect(upcoming.action).toEqual({ type: 'goto', screen: 'ball' });
    expect(upcoming.disabled).toBeFalsy();

    s.day = 75;
    const tonight = getView(s).menu.find((m) => m.key === 'U')!;
    expect(tonight.label).toMatch(/tonight/);
  });

  it('shows the ball screen ahead of the night, with the date and the door kept shut', () => {
    const s = beforeTheBall();
    s.screen = 'ball';
    const view = getView(s);
    const body = view.body.join('\n');
    expect(view.subtitle).toBe(formatDate(75));
    expect(body).toContain(formatDate(75));
    expect(body).toMatch(/Assembly Room/);
    expect(body).toMatch(/standing/);
    expect(view.menu[0].action).toEqual({ type: 'attendBall' });
    expect(view.menu[0].disabled).toBe(true);

    s.day = 75;
    s.standing = 50;
    s.moneyPence = pounds(5);
    expect(getView(s).menu[0].disabled).toBe(false);
  });
});

describe('the road to a house of one’s own is signposted (§32.1)', () => {
  const trail = /cottage at Port Gannet|cottage a married man buys/;

  it('names the cottage and the balls on the property screen', () => {
    const s = createInitialState(22);
    s.location = 'fields-town';
    s.screen = 'estate';
    const body = getView(s).body.join(' ');
    expect(body).toMatch(trail);
    expect(body).toMatch(/subscription\s+balls/);
  });

  it('names it at both sets of lodgings, where a man goes looking for a bed', () => {
    const s = createInitialState(23);
    s.location = 'suze-port';
    s.screen = 'suze-lodgings';
    expect(getView(s).body.join(' ')).toMatch(trail);

    s.location = 'fields-town';
    s.screen = 'ftown-lodgings';
    expect(getView(s).body.join(' ')).toMatch(trail);
  });
});
