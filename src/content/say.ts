import type { RNG } from '../engine/rng';
import { TEXT } from './text';

export type Vars = Record<string, string | number>;

function substitute(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * Pick one of the period-prose variants for a narration key.
 * Missing keys fall back to a legible placeholder rather than throwing, so that
 * a content gap never takes the game down mid-year.
 */
export function say(rng: RNG, key: string, vars?: Vars): string {
  const variants = TEXT[key];
  if (!variants || variants.length === 0) {
    return substitute(`[${key}]`, vars);
  }
  return substitute(rng.pick(variants), vars);
}

/**
 * The same choice every time for a given salt: for prose shown on a screen the
 * player may look at twice, which must not flicker between renders.
 */
export function sayFixed(key: string, salt: number, vars?: Vars): string {
  const variants = TEXT[key];
  if (!variants || variants.length === 0) return substitute(`[${key}]`, vars);
  let h = (salt * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return substitute(variants[(h >>> 8) % variants.length], vars);
}

/** Every variant of a key — used by tests to audit the content tables. */
export function variantsOf(key: string): string[] {
  return TEXT[key] ?? [];
}

export function hasKey(key: string): boolean {
  return Array.isArray(TEXT[key]) && TEXT[key].length > 0;
}

export function allKeys(): string[] {
  return Object.keys(TEXT);
}
