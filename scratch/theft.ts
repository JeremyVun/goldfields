import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { nightAtCamp } from '../src/engine/events';
import { Log } from '../src/engine/narrate';
import { pounds } from '../src/engine/money';
import type { GameState } from '../src/engine/types';

function trial(mod: (s: GameState) => void, n = 4000): number {
  let robbed = 0;
  for (let i = 0; i < n; i++) {
    const s = createInitialState(i + 1);
    s.day = 100;
    s.location = 'snakey-gully';
    s.moneyPence = pounds(50);
    s.items.tent = 1;
    s.items.gun = 0;
    mod(s);
    const r = makeRng(i * 977 + 5);
    const log = new Log(r);
    nightAtCamp(s, r, log);
    if (s.stats.timesRobbed > 0) robbed++;
  }
  return robbed / n;
}
const base = trial(() => {});
const flush = trial((s) => { s.estate.flushUntilDay = s.day + 3; });
const calm = trial((s) => { s.estate.severityUntilDay = s.day + 10; });
const fair = trial((s) => { s.estate.store = { camp: 'snakey-gully', policy: 'fair' }; });
const gouge = trial((s) => { s.estate.store = { camp: 'snakey-gully', policy: 'gouge' }; });
const all = trial((s) => { s.estate.flushUntilDay = s.day + 3; s.estate.severityUntilDay = s.day + 10; s.estate.store = { camp: 'snakey-gully', policy: 'gouge' }; });
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
console.log(`base   ${pct(base)}`);
console.log(`flush  ${pct(flush)}  ratio ${(flush / base).toFixed(2)} (want ~1.25)`);
console.log(`bench  ${pct(calm)}  ratio ${(calm / base).toFixed(2)} (want ~0.9)`);
console.log(`fair   ${pct(fair)}  ratio ${(fair / base).toFixed(2)} (want ~0.5)`);
console.log(`gouge  ${pct(gouge)}  ratio ${(gouge / base).toFixed(2)} (want ~1.25)`);
console.log(`all 3  ${pct(all)}  ratio ${(all / base).toFixed(2)} (want ~1.25*0.9*1.25 = 1.41)`);
