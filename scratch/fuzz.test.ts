import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { getView } from '../src/engine/menus';
import { begin, describe as desc, dispatch, invariants, newPlayer, view } from './driver';

describe('menu fuzz', () => {
  it('random menu walking never breaks an invariant or softlocks', () => {
    const problems = new Map<string, string>();
    const screensSeen = new Map<string, number>();
    let endReached = 0;
    let deaths = 0;
    let stalls = 0;

    for (let seed = 1; seed <= 400; seed++) {
      const p = newPlayer(seed);
      const chooser = makeRng(seed * 7919 + 13); // independent of the engine's stream
      begin(p, seed);
      let steps = 0;
      while (steps++ < 4000) {
        const v = view(p);
        screensSeen.set(v.screen, (screensSeen.get(v.screen) ?? 0) + 1);
        const bad = invariants(p, `seed ${seed} step ${steps}`);
        for (const b of bad) {
          const k = b.replace(/seed \d+ step \d+/, '');
          if (!problems.has(k)) problems.set(k, `${b} @ ${desc(p)}\n     trace=${p.trace.slice(-8).join(' > ')}`);
        }
        if (p.state.gameOver === 'dead') { deaths++; break; }
        if (p.state.screen === 'end') { endReached++; break; }
        const choices = v.menu.filter(
          (m) => !m.disabled && m.action.type !== 'finish' && m.action.type !== 'quitToTitle' && m.action.type !== 'newGame',
        );
        if (choices.length === 0) {
          problems.set(`no-choice-${v.screen}`, `seed ${seed}: no live choice on ${v.screen} — ${desc(p)}`);
          break;
        }
        const pick = choices[Math.floor(chooser.next() * choices.length)];
        p.trace.push(`${v.screen}:${pick.key}`);
        try {
          dispatch(p, pick.action);
        } catch (err) {
          problems.set(`throw-${v.screen}-${pick.key}`, `seed ${seed}: ${v.screen}/${pick.label} threw ${String(err)}\n  ${(err as Error).stack}`);
          break;
        }
      }
      if (steps >= 4000) { stalls++; problems.set(`slow-${seed}`, `seed ${seed} still going after 4000 presses (day ${p.state.day}, screen ${p.state.screen})`); }
    }

    console.log('screens visited:', [...screensSeen.entries()].sort().map(([k, n]) => `${k}=${n}`).join(' '));
    console.log(`year completed: ${endReached}, deaths: ${deaths}, stalls: ${stalls}`);
    if (problems.size) {
      console.log('--- PROBLEMS ---');
      for (const v of problems.values()) console.log(v);
    } else console.log('no invariant problems');
  });

  it('audits which menu options are ever offered and ever enabled', () => {
    const everSeen = new Map<string, { seen: number; enabled: number }>();
    for (let seed = 1; seed <= 400; seed++) {
      const p = newPlayer(seed);
      const chooser = makeRng(seed * 104729 + 7);
      begin(p, seed);
      for (let steps = 0; steps < 3000; steps++) {
        const v = getView(p.state);
        for (const m of v.menu) {
          const k = `${v.screen} | ${m.label.replace(/[£\d][\d£sd. ]*/g, '#')}`;
          const rec = everSeen.get(k) ?? { seen: 0, enabled: 0 };
          rec.seen++;
          if (!m.disabled) rec.enabled++;
          everSeen.set(k, rec);
        }
        if (p.state.gameOver || p.state.screen === 'end') break;
        const choices = v.menu.filter(
          (m) => !m.disabled && m.action.type !== 'finish' && m.action.type !== 'quitToTitle' && m.action.type !== 'newGame',
        );
        if (!choices.length) break;
        dispatch(p, choices[Math.floor(chooser.next() * choices.length)].action);
      }
    }
    const never = [...everSeen.entries()].filter(([, r]) => r.enabled === 0);
    console.log(`distinct menu labels seen: ${everSeen.size}`);
    console.log('--- NEVER ENABLED ---');
    for (const [k, r] of never) console.log(`${k}  (offered ${r.seen}x, never enabled)`);
    console.log('--- ALL LABELS ---');
    for (const [k, r] of [...everSeen.entries()].sort()) console.log(`${r.enabled}/${r.seen}  ${k}`);
  });
});
