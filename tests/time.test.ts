import { describe, expect, it } from 'vitest';
import {
  DAYS_IN_YEAR,
  calendarYear,
  dayOfMonth,
  dayOfYear,
  formatDate,
  gameYear,
  monthName,
  ordinal,
  season,
  seasonPhrase,
  seasonShort,
} from '../src/engine/time';

describe('the calendar', () => {
  it('starts on 1 January 1854', () => {
    expect(formatDate(1)).toBe('1st January 1854');
    expect(monthName(1)).toBe('January');
    expect(dayOfMonth(1)).toBe(1);
    expect(calendarYear(1)).toBe(1854);
    expect(gameYear(1)).toBe(1);
  });

  it('runs a plain 365-day year', () => {
    expect(DAYS_IN_YEAR).toBe(365);
    expect(formatDate(365)).toBe('31st December 1854');
    expect(formatDate(366)).toBe('1st January 1855');
    expect(gameYear(366)).toBe(2);
    expect(dayOfYear(366)).toBe(1);
  });

  it('names every day of the year without a gap', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 365; d++) seen.add(`${monthName(d)} ${dayOfMonth(d)}`);
    expect(seen.size).toBe(365);
  });

  it('uses southern-hemisphere seasons', () => {
    expect(season(1)).toBe('summer'); // January
    expect(season(60)).toBe('autumn'); // March
    expect(season(160)).toBe('winter'); // June
    expect(season(250)).toBe('spring'); // September
    expect(season(340)).toBe('summer'); // December
  });

  it('says how far into a season a man is, not merely which one', () => {
    // December opens the summer; a man in it should not be told it is high summer.
    expect(seasonPhrase(340)).toBe('early summer'); // December
    expect(seasonPhrase(1)).toBe('high summer'); // January
    expect(seasonPhrase(37)).toBe('the end of summer'); // February
    expect(seasonPhrase(152)).toBe('early winter'); // June
    expect(seasonPhrase(190)).toBe('the depth of winter'); // July
    expect(seasonPhrase(220)).toBe('the end of winter'); // August
  });

  it('has a short season for the status line, which must hold eighty columns', () => {
    for (let d = 1; d <= DAYS_IN_YEAR; d++) {
      expect(seasonShort(d).length).toBeLessThanOrEqual(12);
      expect(seasonShort(d)).toContain(season(d));
    }
  });

  it('ordinals read like a diary', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(21)).toBe('21st');
  });
});
