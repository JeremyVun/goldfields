import { describe, expect, it } from 'vitest';
import {
  CAMP_DEFS,
  MATE_WAGE,
  PUDDLER_RENT,
  SHAFT_DEPTH,
} from '../src/engine/constants';
import { pounds, shillings } from '../src/engine/money';
import {
  checkMethod,
  hireMate,
  mineOneDay,
  pegClaim,
  rollYield,
  timberShaft,
} from '../src/engine/mining';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import type { CampId, Claim, GameState, MiningMethod } from '../src/engine/types';

/** Ordinary, unworked ground, so that yields are not confounded by quality. */
export function ordinaryClaim(day = 1): Claim {
  return { quality: 100, workedDays: 0, peggedOn: day, proven: false };
}

function atCamp(camp: CampId, seed = 4): { state: GameState; rng: ReturnType<typeof makeRng>; log: Log } {
  const state = createInitialState(seed);
  state.location = camp;
  state.provisionDays = 100;
  state.waterDays = 100;
  state.licenceUntilDay = 10000;
  state.claims[camp] = ordinaryClaim();
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

function meanYield(camp: CampId, method: MiningMethod, samples = 4000, mutate?: (s: GameState) => void): number {
  const { state, rng } = atCamp(camp, 1234);
  state.items.pan = state.items.cradle = state.items.shovel = state.items.pick = 1;
  state.items.ropeBucket = 1;
  mutate?.(state);
  let total = 0;
  for (let i = 0; i < samples; i++) total += rollYield(state, rng, method);
  return total / samples;
}

describe('claims', () => {
  it('are free, twelve feet square, and one to a camp (faithful)', () => {
    const { state, rng, log } = atCamp('damp-camp');
    state.claims['damp-camp'] = null;
    const before = state.moneyPence;
    expect(pegClaim(state, rng, log, 'damp-camp')).toBe(true);
    expect(state.moneyPence).toBe(before);
    expect(pegClaim(state, rng, log, 'damp-camp')).toBe(false);
  });
});

describe('what each method wants', () => {
  it('fossicking wants nothing at all — the fallback of the destitute', () => {
    const { state } = atCamp('damp-camp');
    expect(checkMethod(state, 'fossick').ok).toBe(true);
  });

  it('panning wants a pan, and water', () => {
    const { state } = atCamp('damp-camp');
    expect(checkMethod(state, 'pan').ok).toBe(false);
    state.items.pan = 1;
    expect(checkMethod(state, 'pan').ok).toBe(true);
    state.location = 'secret-mine';
    expect(checkMethod(state, 'pan').ok).toBe(false); // no water within forty miles
  });

  it('a shaft wants pick, shovel, rope and bucket, and pegged ground', () => {
    const { state } = atCamp('deep-mountains');
    expect(checkMethod(state, 'shaft').ok).toBe(false);
    state.items.pick = state.items.shovel = 1;
    expect(checkMethod(state, 'shaft').ok).toBe(false);
    state.items.ropeBucket = 1;
    expect(checkMethod(state, 'shaft').ok).toBe(true);
    state.claims['deep-mountains'] = null;
    expect(checkMethod(state, 'shaft').ok).toBe(false);
  });

  it('the puddling machine is at Copperhead Gully; dryblowing is for the desert', () => {
    const { state } = atCamp('damp-camp');
    state.items.shovel = 1;
    expect(checkMethod(state, 'puddle').ok).toBe(false);
    state.location = 'snakey-gully';
    expect(checkMethod(state, 'puddle').ok).toBe(true);
    state.items.pick = 1;
    expect(checkMethod(state, 'dryblow').ok).toBe(false);
    state.location = 'secret-mine';
    expect(checkMethod(state, 'dryblow').ok).toBe(true);
  });

  it('company work is only in the Blackcap Ranges', () => {
    const { state } = atCamp('snakey-gully');
    expect(checkMethod(state, 'company').ok).toBe(false);
    state.location = 'deep-mountains';
    expect(checkMethod(state, 'company').ok).toBe(true);
  });
});

describe('yields', () => {
  it('rank fossick < pan < cradle, as the Journal has it', () => {
    const fossick = meanYield('damp-camp', 'fossick');
    const pan = meanYield('damp-camp', 'pan');
    const cradle = meanYield('damp-camp', 'cradle', 4000, (s) => {
      s.mateUntilDay = 10000;
    });
    expect(pan).toBeGreaterThan(fossick * 2);
    expect(cradle).toBeGreaterThan(pan);
  });

  it('a cradle worked single-handed yields about half', () => {
    const withMate = meanYield('damp-camp', 'cradle', 6000, (s) => {
      s.mateUntilDay = 10000;
    });
    const alone = meanYield('damp-camp', 'cradle', 6000);
    expect(alone).toBeLessThan(withMate * 0.65);
    expect(alone).toBeGreaterThan(withMate * 0.35);
  });

  it('alluvial camps beat the mountains for surface work, and the reverse for reef', () => {
    expect(meanYield('damp-camp', 'pan')).toBeGreaterThan(meanYield('deep-mountains', 'pan'));
    expect(meanYield('deep-mountains', 'shaft')).toBeGreaterThan(meanYield('damp-camp', 'shaft'));
    expect(CAMP_DEFS['snakey-gully'].alluvial).toBeGreaterThan(CAMP_DEFS['damp-camp'].alluvial);
  });

  it('creeks dry in summer and run in winter', () => {
    const { state, rng } = atCamp('damp-camp', 88);
    state.items.pan = 1;
    const sample = (day: number) => {
      state.day = day;
      let t = 0;
      for (let i = 0; i < 6000; i++) t += rollYield(state, rng, 'pan');
      return t / 6000;
    };
    expect(sample(15)).toBeLessThan(sample(190)); // January against July
  });

  it('common ground pays little, never runs out, and lifts a little in a rush', () => {
    const pegged = meanYield('damp-camp', 'pan');
    const common = meanYield('damp-camp', 'pan', 6000, (s) => {
      s.claims['damp-camp'] = null;
    });
    const inRush = meanYield('damp-camp', 'pan', 6000, (s) => {
      s.claims['damp-camp'] = null;
      s.rush = { camp: 'damp-camp', untilDay: s.day + 10, factor: 2.2, since: s.day, base: 1 };
    });
    expect(common).toBeLessThan(pegged * 0.7);
    expect(inRush).toBeGreaterThan(common);
  });

  it('a sick man wins less gold', () => {
    const hale = meanYield('damp-camp', 'pan');
    const poorly = meanYield('damp-camp', 'pan', 4000, (s) => {
      s.health = 25;
    });
    expect(poorly).toBeLessThan(hale * 0.8);
  });

  it('are always whole centi-ounces and never negative', () => {
    const { state, rng } = atCamp('snakey-gully', 55);
    state.items.pan = 1;
    for (let i = 0; i < 2000; i++) {
      const y = rollYield(state, rng, 'pan');
      expect(Number.isInteger(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('are heavy-tailed: mostly small days, and the occasional splendid one', () => {
    const { state, rng } = atCamp('damp-camp', 77);
    state.items.pan = 1;
    const draws: number[] = [];
    for (let i = 0; i < 8000; i++) draws.push(rollYield(state, rng, 'pan'));
    draws.sort((a, b) => a - b);
    const median = draws[Math.floor(draws.length / 2)];
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(median).toBeLessThan(mean);
    expect(draws[draws.length - 1]).toBeGreaterThan(mean * 5);
  });
});

describe('shafts', () => {
  it('bottom somewhere between twenty and a hundred feet (faithful)', () => {
    const depths = new Set<number>();
    for (let seed = 0; seed < 120; seed++) {
      const { state, rng, log } = atCamp('deep-mountains', seed);
      state.items.pick = state.items.shovel = state.items.ropeBucket = 1;
      mineOneDay(state, rng, log, 'shaft');
      if (state.shaft) depths.add(state.shaft.bottomAt);
    }
    for (const d of depths) {
      expect(d).toBeGreaterThanOrEqual(SHAFT_DEPTH.lo);
      expect(d).toBeLessThanOrEqual(SHAFT_DEPTH.hi);
    }
    expect(depths.size).toBeGreaterThan(10);
  });

  it('yield nothing at all until bottomed, then either a duffer or payable wash', () => {
    let duffers = 0;
    let payable = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state, rng, log } = atCamp('deep-mountains', seed * 3 + 1);
      state.items.pick = state.items.shovel = state.items.ropeBucket = 1;
      state.items.timber = 5;
      let bottomed = false;
      for (let d = 0; d < 40 && !bottomed; d++) {
        const before = state.goldCentiOz;
        mineOneDay(state, rng, log, 'shaft');
        if (state.shaft?.bottomed) {
          bottomed = true;
          payable += 1;
        } else if (!state.shaft) {
          bottomed = true;
          duffers += 1;
        } else {
          expect(state.goldCentiOz).toBe(before); // nothing until bottomed
        }
        if (state.shaft) state.items.timber = 5;
      }
    }
    expect(duffers).toBeGreaterThan(20);
    expect(payable).toBeGreaterThan(20);
  });

  it('timbering greatly reduces cave-ins', () => {
    const countCaveIns = (timber: boolean) => {
      let caveIns = 0;
      for (let seed = 0; seed < 150; seed++) {
        const { state, rng, log } = atCamp('deep-mountains', seed * 7 + 3);
        state.items.pick = state.items.shovel = state.items.ropeBucket = 1;
        state.items.timber = timber ? 1 : 0;
        state.health = 100;
        for (let d = 0; d < 60; d++) {
          if (state.gameOver) break;
          if (timber) state.items.timber = 1; // a man who always slabs his shaft
          mineOneDay(state, rng, log, 'shaft');
          state.health = 100;
        }
        caveIns += state.stats.caveIns;
      }
      return caveIns;
    };
    const timbered = countCaveIns(true);
    const bare = countCaveIns(false);
    expect(bare).toBeGreaterThan(timbered * 2);
  });

  it('a pump keeps winter water out of the hole', () => {
    const countFloods = (pump: boolean) => {
      let lost = 0;
      for (let seed = 0; seed < 120; seed++) {
        const { state, rng, log } = atCamp('deep-mountains', seed * 5 + 11);
        state.day = 190; // July
        state.items.pick = state.items.shovel = state.items.ropeBucket = 1;
        state.items.timber = 1;
        state.items.pump = pump ? 1 : 0;
        for (let d = 0; d < 25; d++) {
          if (state.gameOver) break;
          const hadShaft = !!state.shaft;
          mineOneDay(state, rng, log, 'shaft');
          if (hadShaft && !state.shaft && !state.gameOver && state.stats.caveIns === 0) lost += 1;
          state.health = 100;
        }
      }
      return lost;
    };
    expect(countFloods(true)).toBeLessThan(countFloods(false));
  });

  it('can be timbered after the fact, at the cost of a set of supports', () => {
    const { state, rng, log } = atCamp('deep-mountains', 12);
    state.items.pick = state.items.shovel = state.items.ropeBucket = 1;
    mineOneDay(state, rng, log, 'shaft');
    expect(state.shaft?.timbered).toBe(false);
    expect(timberShaft(state, log)).toBe(false); // no timber
    state.items.timber = 1;
    expect(timberShaft(state, log)).toBe(true);
    expect(state.shaft?.timbered).toBe(true);
    expect(state.items.timber).toBe(0);
  });
});

describe('mates, machines and companies', () => {
  it('a mate costs two shillings a day, paid up front', () => {
    const { state, log } = atCamp('damp-camp');
    state.moneyPence = pounds(1);
    expect(hireMate(state, log, 7)).toBe(true);
    expect(state.moneyPence).toBe(pounds(1) - MATE_WAGE * 7);
    expect(state.mateUntilDay).toBe(state.day + 6);
  });

  it('the puddling machine takes five shillings a day and skims your dirt', () => {
    expect(PUDDLER_RENT).toBe(shillings(5));
    const { state, rng, log } = atCamp('snakey-gully', 6);
    state.items.shovel = 1;
    state.moneyPence = pounds(2);
    const before = state.moneyPence;
    mineOneDay(state, rng, log, 'puddle');
    expect(state.moneyPence).toBe(before - PUDDLER_RENT);
  });

  it('stops when the machine owner cannot be paid', () => {
    const { state, rng, log } = atCamp('snakey-gully', 6);
    state.items.shovel = 1;
    state.moneyPence = shillings(1);
    const res = mineOneDay(state, rng, log, 'puddle');
    expect(res.stop).toBe('cannotPay');
  });

});

describe('the desert working', () => {
  it('costs health every day, worse in summer', () => {
    const summerLoss = (day: number) => {
      const { state, rng, log } = atCamp('secret-mine', 9);
      state.day = day;
      state.items.pick = state.items.shovel = 1;
      state.health = 100;
      for (let i = 0; i < 20; i++) mineOneDay(state, rng, log, 'dryblow');
      return 100 - state.health;
    };
    expect(summerLoss(15)).toBeGreaterThan(summerLoss(190));
  });
});
