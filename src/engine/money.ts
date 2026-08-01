/**
 * Pre-decimal currency: £1 = 20 shillings, 1 shilling = 12 pence.
 * Everything is stored internally as an integer number of pence.
 *
 * Gold is stored as an integer number of 1/100 ounce ("centi-ounces").
 */

export const PENCE_PER_SHILLING = 12;
export const SHILLINGS_PER_POUND = 20;
export const PENCE_PER_POUND = PENCE_PER_SHILLING * SHILLINGS_PER_POUND; // 240

/** Build a pence total from pounds/shillings/pence. */
export function lsd(pounds = 0, shillings = 0, pence = 0): number {
  return Math.round(pounds * PENCE_PER_POUND + shillings * PENCE_PER_SHILLING + pence);
}

export const pounds = (n: number): number => lsd(n, 0, 0);
export const shillings = (n: number): number => lsd(0, n, 0);
export const pence = (n: number): number => lsd(0, 0, n);

export interface Lsd {
  pounds: number;
  shillings: number;
  pence: number;
  negative: boolean;
}

export function splitMoney(total: number): Lsd {
  const negative = total < 0;
  let t = Math.abs(Math.round(total));
  const p = Math.floor(t / PENCE_PER_POUND);
  t -= p * PENCE_PER_POUND;
  const s = Math.floor(t / PENCE_PER_SHILLING);
  const d = t - s * PENCE_PER_SHILLING;
  return { pounds: p, shillings: s, pence: d, negative };
}

/**
 * Render pence as period currency, omitting zero parts:
 *   240 -> "£1"; 252 -> "£1 1s"; 8 -> "8d"; 0 -> "nothing".
 */
export function formatMoney(total: number): string {
  const t = Math.round(total);
  if (t === 0) return 'nothing';
  const { pounds: p, shillings: s, pence: d, negative } = splitMoney(t);
  const parts: string[] = [];
  if (p) parts.push(`£${p}`);
  if (s) parts.push(`${s}s`);
  if (d) parts.push(`${d}d`);
  return (negative ? '-' : '') + parts.join(' ');
}

/** Same as formatMoney but always shows something for zero. */
export function formatMoneyTerse(total: number): string {
  return Math.round(total) === 0 ? '0d' : formatMoney(total);
}

/** Long-hand for prose: "three pounds twelve shillings and sixpence" is a step too far; keep it plain. */
export function formatMoneyWords(total: number): string {
  const t = Math.round(total);
  if (t === 0) return 'not a penny';
  const { pounds: p, shillings: s, pence: d } = splitMoney(t);
  const parts: string[] = [];
  if (p) parts.push(`${p} pound${p === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} shilling${s === 1 ? '' : 's'}`);
  if (d) parts.push(`${d} pence`);
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

/** Parse "£3 12s 6d", "15s", "8d", "3" (pounds) into pence. Returns null if unparseable. */
export function parseMoney(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) return pounds(parseInt(text, 10));
  const re = /£\s*(\d+)|(\d+)\s*(£|l|s|d)/g;
  let total = 0;
  let end = 0;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (text.slice(end, m.index).trim()) return null;
    const unit = m[1] === undefined ? (m[3] === 'l' ? '£' : m[3]) : '£';
    if (seen.has(unit)) return null;
    seen.add(unit);
    const n = parseInt(m[1] ?? m[2], 10);
    if ((unit === 's' && n >= 20) || (unit === 'd' && n >= 12)) return null;
    if (unit === '£') total += pounds(n);
    else if (unit === 's') total += shillings(n);
    else total += n;
    end = re.lastIndex;
  }
  return seen.size > 0 && !text.slice(end).trim() ? total : null;
}

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

/** Centi-ounces from ounces. */
export const oz = (n: number): number => Math.round(n * 100);

/** "1.20 oz" */
export function formatGold(centiOz: number): string {
  return `${(centiOz / 100).toFixed(2)} oz`;
}

export function formatGoldWords(centiOz: number): string {
  if (centiOz <= 0) return 'not a speck';
  if (centiOz < 10) return `a few specks (${formatGold(centiOz)})`;
  return formatGold(centiOz);
}

/** Value in pence of a quantity of gold at a given rate (pence per ounce). */
export function goldValue(centiOz: number, ratePerOz: number): number {
  return Math.floor((centiOz * ratePerOz) / 100);
}
