/**
 * Seeded, serialisable random number generator.
 *
 * The whole simulation is driven through this interface so that any run can be
 * reproduced exactly from its seed — required both for the save/resume ritual
 * and for the strategy-bot balance harness.
 */

export interface RNG {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniform choice from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Weighted choice; weights need not be normalised. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  /** Exponential draw with mean 1 — the heavy tail behind gold yields. */
  exponential(): number;
  /** Current internal state, for serialisation. */
  save(): number;
  /** Restore internal state. */
  restore(s: number): void;
}

/** mulberry32 — small, fast, and good enough for a goldrush. */
export function makeRng(seed: number): RNG {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: RNG = {
    next,
    int(lo, hi) {
      if (hi < lo) [lo, hi] = [hi, lo];
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    chance(p) {
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() from empty array');
      return items[Math.floor(next() * items.length)];
    },
    weighted(items) {
      let total = 0;
      for (const [, w] of items) total += w;
      let r = next() * total;
      for (const [item, w] of items) {
        r -= w;
        if (r <= 0) return item;
      }
      return items[items.length - 1][0];
    },
    exponential() {
      // -ln(U) with U in (0,1]; mean 1, unbounded above.
      const u = 1 - next();
      return -Math.log(u <= 0 ? Number.MIN_VALUE : u);
    },
    save() {
      return s >>> 0;
    },
    restore(v) {
      s = v >>> 0;
    },
  };
  return rng;
}

/** A seed derived from the clock, for "new game" from the UI. */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
