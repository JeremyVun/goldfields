/** A seeded year with the estate in play, scanned for doubled or dead lines. */
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { endDay } from '../src/engine/daily';
import { step } from '../src/engine/reduce';
import { Log } from '../src/engine/narrate';
import { pounds } from '../src/engine/money';
import { getView } from '../src/engine/menus';
import type { GameState } from '../src/engine/types';

const problems = new Map<string, number>();
const note = (s: string) => problems.set(s, (problems.get(s) ?? 0) + 1);

for (let seed = 1; seed <= 8; seed++) {
  const s: GameState = createInitialState(seed);
  const rng = makeRng(seed * 31 + 7);
  s.location = 'fields-town';
  s.screen = 'ftown';
  s.moneyPence = pounds(900);
  s.standing = 65;
  s.provisionDays = 400;
  s.waterDays = 400;
  const lines: string[] = [];
  const run = (label: string, fn: (log: Log) => void) => {
    const log = new Log(rng);
    fn(log);
    for (const e of log.events) {
      lines.push(e.text);
      if (/\[[a-z]+\.[a-zA-Z.]+\]/.test(e.text)) note(`missing text key: ${e.text.slice(0, 60)}`);
      if (/undefined|NaN|Infinity|\[object|£-|-£/.test(e.text)) note(`bad interpolation (${label}): ${e.text.slice(0, 80)}`);
    }
  };
  const doAct = (a: Parameters<typeof step>[1]) => {
    const r = step(s, a, rng);
    Object.assign(s, r.state);
    for (const e of r.events) {
      lines.push(e.text);
      if (/\[[a-z]+\.[a-zA-Z.]+\]/.test(e.text)) note(`missing text key: ${e.text.slice(0, 60)}`);
      if (/undefined|NaN|Infinity|\[object/.test(e.text)) note(`bad interpolation: ${e.text.slice(0, 80)}`);
    }
  };
  doAct({ type: 'buyShamrock' });
  doAct({ type: 'buyGazetteShare' });
  for (let d = s.day; d < 360; d++) {
    if (s.gameOver || s.endOfYear) break;
    s.provisionDays = Math.max(20, s.provisionDays);
    s.waterDays = Math.max(20, s.waterDays);
    s.health = Math.max(40, s.health);
    if (d % 40 === 0) {
      s.moneyPence += pounds(60);
      s.screen = 'ftown-hotel';
      doAct({ type: 'shoutBar', spree: d % 80 === 0 });
      s.screen = 'ftown';
    }
    if (d % 60 === 0 && s.estate.storyPlacedOn + 20 < d) {
      doAct({ type: 'placeStory', kind: 'talkUp', camp: 'damp-camp' });
    }
    run('day', (log) => endDay(s, rng, log));
    const v = getView(s);
    if (v.menu.length && v.menu.every((m) => m.disabled) && !v.input) note(`softlock on ${v.screen}`);
  }
  // Consecutive identical lines, and lines fired absurdly often.
  for (let i = 1; i < lines.length; i++) if (lines[i] === lines[i - 1]) note(`doubled line: ${lines[i].slice(0, 70)}`);
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  for (const [l, n] of counts) if (n > 25) note(`line fires ${n}× in a year: ${l.slice(0, 70)}`);
  console.log(`seed ${seed}: day ${s.day}, ${lines.length} lines, standing ${Math.floor(s.standing)}, worth £${Math.floor(s.moneyPence / 240)}, works ${s.estate.works.length}`);
}
console.log('\n--- problems ---');
if (problems.size === 0) console.log('none');
for (const [p, n] of [...problems].sort((a, b) => b[1] - a[1])) console.log(`${n}× ${p}`);
