import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { oz } from '../src/engine/money';
import type { Action, GameState } from '../src/engine/types';

function fresh(seed: number, over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(seed), screen: 'suze', ...over };
}
const ev = (s: GameState, a: Action) => step(s, a, makeRng(1)).events;

describe('verify 2', () => {
  it('short-weighting measured by event id', () => {
    const base = fresh(1, { location: 'damp-camp', screen: 'camp-store', goldCentiOz: oz(4) });
    let w = 0, t = 0, bank = 0;
    for (let i = 0; i < 4000; i++) {
      const b = { ...base, rngState: (i * 2654435761) >>> 0 };
      if (ev(b, { type: 'sellGold', where: 'camp', watch: true }).some((e) => e.id === 'sell.shortweight')) w++;
      if (ev(b, { type: 'sellGold', where: 'camp', watch: false }).some((e) => e.id === 'sell.shortweight')) t++;
      const bb = { ...b, location: 'fields-town' as const };
      if (ev(bb, { type: 'sellGold', where: 'bank', watch: false }).some((e) => e.id === 'sell.shortweight')) bank++;
    }
    console.log(`short-weighted out of 4000 — watching the scales: ${(w / 40).toFixed(1)}%  taking his word: ${(t / 40).toFixed(1)}%  the bank: ${(bank / 40).toFixed(1)}%`);
    const s = { ...base, rngState: 987654321 };
    console.log('watched  :', ev(s, { type: 'sellGold', where: 'camp', watch: true }).map((e) => `${e.id}`).join(', '));
    console.log('unwatched:', ev(s, { type: 'sellGold', where: 'camp', watch: false }).map((e) => `${e.id}`).join(', '));
  });

  it('the gravely ill are warned every night', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'camp', health: 15, provisionDays: 30,
      items: { ...createInitialState(1).items, tent: 1 } });
    const r = step(s, { type: 'rest', days: 3 }, makeRng(3));
    for (const e of r.events) console.log(`  [${e.id}] ${e.text}`);
    console.log('warned?', r.events.some((e) => e.id === 'health.grave'));
    // and above the line
    const ok = fresh(1, { location: 'damp-camp', screen: 'camp', health: 45, provisionDays: 30, items: { ...createInitialState(1).items, tent: 1 } });
    console.log('at health 45, warned?', step(ok, { type: 'rest', days: 3 }, makeRng(3)).events.some((e) => e.id === 'health.grave'));
  });
});
