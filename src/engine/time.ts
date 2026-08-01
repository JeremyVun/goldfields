/** Calendar: day 1 = 1 January 1854. A plain 365-day year; year two runs 366-730. */

export type Season = 'summer' | 'autumn' | 'winter' | 'spring';

export const DAYS_IN_YEAR = 365;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dayOfYear(day: number): number {
  return ((day - 1) % DAYS_IN_YEAR) + 1;
}

export function calendarYear(day: number): number {
  return 1854 + Math.floor((day - 1) / DAYS_IN_YEAR);
}

export function gameYear(day: number): number {
  return Math.floor((day - 1) / DAYS_IN_YEAR) + 1;
}

/** 0-indexed month. */
export function monthIndex(day: number): number {
  let d = dayOfYear(day);
  for (let i = 0; i < 12; i++) {
    if (d <= MONTH_LENGTHS[i]) return i;
    d -= MONTH_LENGTHS[i];
  }
  return 11;
}

export function dayOfMonth(day: number): number {
  let d = dayOfYear(day);
  for (let i = 0; i < 12; i++) {
    if (d <= MONTH_LENGTHS[i]) return d;
    d -= MONTH_LENGTHS[i];
  }
  return 31;
}

export function monthName(day: number): string {
  return MONTHS[monthIndex(day)];
}

/** Southern-hemisphere seasons. Dec-Feb summer, Jun-Aug winter. */
export function season(day: number): Season {
  const m = monthIndex(day);
  if (m === 11 || m <= 1) return 'summer';
  if (m <= 4) return 'autumn';
  if (m <= 7) return 'winter';
  return 'spring';
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Tuesday" is beyond our reckoning; "17th March 1854" is quite enough. */
export function formatDate(day: number): string {
  return `${ordinal(dayOfMonth(day))} ${monthName(day)} ${calendarYear(day)}`;
}

/**
 * Which of a season's three months this is: 0 its beginning, 2 its end. A man
 * planning a spell of work wants to know how much winter is left, not merely
 * that it is winter.
 */
export function seasonMonth(day: number): 0 | 1 | 2 {
  // December opens the summer, so it counts as that season's first month.
  const m = (monthIndex(day) + 1) % 12;
  return (m % 3) as 0 | 1 | 2;
}

const SEASON_PHRASES: Record<Season, [string, string, string]> = {
  summer: ['early summer', 'high summer', 'the end of summer'],
  autumn: ['early autumn', 'autumn', 'late autumn'],
  winter: ['early winter', 'the depth of winter', 'the end of winter'],
  spring: ['early spring', 'spring', 'late spring'],
};

/** The season in the game's own voice, for prose and screen subtitles. */
export function seasonPhrase(day: number): string {
  return SEASON_PHRASES[season(day)][seasonMonth(day)];
}

const SEASON_SHORT: Record<Season, [string, string, string]> = {
  summer: ['early summer', 'high summer', 'late summer'],
  autumn: ['early autumn', 'autumn', 'late autumn'],
  winter: ['early winter', 'deep winter', 'late winter'],
  spring: ['early spring', 'spring', 'late spring'],
};

/**
 * The same, cut to fit the status line, which must hold its eighty columns
 * with a licence and a price on a man's head both in it (§3).
 */
export function seasonShort(day: number): string {
  return SEASON_SHORT[season(day)][seasonMonth(day)];
}
