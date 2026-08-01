import { describe, expect, it } from 'vitest';
import { COTTAGE_PRICE_SMALL, WEDDING_COST } from '../src/engine/constants';
import { consentRoll, hearthDay, sleepsAtHearth } from '../src/engine/hearth';
import { getView } from '../src/engine/menus';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
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
    expect(s.hearth.cottagePaid).toBe(COTTAGE_PRICE_SMALL);
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

  it('keeps the cottage vault non-negative and rejects invented quantities', () => {
    let s = acquaintance(16);
    s.location = 'suze-port';
    s.hearth.rung = 'settled';
    s.hearth.cottage = true;
    s.hearth.cottagePaid = pounds(60);
    const before = s.moneyPence;
    s = step(s, { type: 'homeStash', what: 'money', amount: -shillings(5) }, makeRng(16)).state;
    expect(s.moneyPence).toBe(before);
    expect(s.hearth.homeStashPence).toBe(0);
    s = step(s, { type: 'homeUnstash', what: 'money', amount: pounds(50) }, makeRng(17)).state;
    expect(s.hearth.homeStashPence).toBe(0);
  });
});
