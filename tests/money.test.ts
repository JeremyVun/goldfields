import { describe, expect, it } from 'vitest';
import {
  PENCE_PER_POUND,
  formatGold,
  formatMoney,
  formatMoneyWords,
  goldValue,
  lsd,
  oz,
  parseMoney,
  pence,
  pounds,
  shillings,
  splitMoney,
} from '../src/engine/money';

describe('pre-decimal currency', () => {
  it('builds totals from pounds, shillings and pence', () => {
    expect(pounds(1)).toBe(240);
    expect(shillings(1)).toBe(12);
    expect(pence(1)).toBe(1);
    expect(lsd(3, 12, 6)).toBe(3 * 240 + 12 * 12 + 6);
    expect(PENCE_PER_POUND).toBe(240);
  });

  it('splits pence back into £ s d', () => {
    expect(splitMoney(lsd(3, 12, 6))).toEqual({
      pounds: 3,
      shillings: 12,
      pence: 6,
      negative: false,
    });
    expect(splitMoney(-12)).toEqual({ pounds: 0, shillings: 1, pence: 0, negative: true });
  });

  it('renders money omitting zero parts', () => {
    expect(formatMoney(lsd(3, 12, 6))).toBe('£3 12s 6d');
    expect(formatMoney(pounds(5))).toBe('£5');
    expect(formatMoney(shillings(15))).toBe('15s');
    expect(formatMoney(8)).toBe('8d');
    expect(formatMoney(lsd(1, 0, 1))).toBe('£1 1d');
    expect(formatMoney(0)).toBe('nothing');
    expect(formatMoney(-shillings(3))).toBe('-3s');
  });

  it('renders money in words for prose', () => {
    expect(formatMoneyWords(0)).toBe('not a penny');
    expect(formatMoneyWords(pounds(1))).toBe('1 pound');
    expect(formatMoneyWords(lsd(2, 1, 0))).toBe('2 pounds and 1 shilling');
  });

  it('parses period money strings', () => {
    expect(parseMoney('£3 12s 6d')).toBe(lsd(3, 12, 6));
    expect(parseMoney('15s')).toBe(shillings(15));
    expect(parseMoney('8d')).toBe(8);
    expect(parseMoney('3')).toBe(pounds(3));
    expect(parseMoney('  ')).toBeNull();
    expect(parseMoney('gold')).toBeNull();
  });

  it('round-trips every value up to five pounds', () => {
    for (let p = 0; p <= 1200; p++) {
      const { pounds: L, shillings: S, pence: D } = splitMoney(p);
      expect(lsd(L, S, D)).toBe(p);
      expect(S).toBeLessThan(20);
      expect(D).toBeLessThan(12);
    }
  });

  it('never renders 20s or 12d', () => {
    for (let p = 0; p <= 2000; p++) {
      const text = formatMoney(p);
      expect(text).not.toMatch(/\b(2[0-9]|[3-9][0-9])s\b/);
      expect(text).not.toMatch(/\b(1[2-9]|[2-9][0-9])d\b/);
    }
  });
});

describe('gold', () => {
  it('stores hundredths of an ounce', () => {
    expect(oz(1)).toBe(100);
    expect(oz(0.42)).toBe(42);
    expect(formatGold(120)).toBe('1.20 oz');
    expect(formatGold(0)).toBe('0.00 oz');
  });

  it('values gold at a rate per ounce', () => {
    // An ounce at £3 17s 10d
    expect(goldValue(100, lsd(3, 17, 10))).toBe(lsd(3, 17, 10));
    expect(goldValue(50, lsd(3, 0, 0))).toBe(lsd(1, 10, 0));
    expect(goldValue(0, 900)).toBe(0);
  });

  it('never returns fractional pence', () => {
    for (let c = 0; c < 500; c += 7) {
      const v = goldValue(c, 871);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
