import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { begin, dispatch, newPlayer, view } from './driver';

describe('softlock repro', () => {
  it('finds the exact press that strands the player on the encounter screen', () => {
    for (const seed of [34, 179]) {
      const p = newPlayer(seed);
      const chooser = makeRng(seed * 7919 + 13);
      begin(p, seed);
      let stuckAt = -1;
      const history: string[] = [];
      for (let steps = 0; steps < 400; steps++) {
        const v = view(p);
        history.push(`${steps} ${v.screen} pending=${p.state.pending?.kind ?? 'none'} journey=${p.state.journey ? p.state.journey.to + '/' + p.state.journey.daysLeft : 'none'} loc=${p.state.location} day=${p.state.day}`);
        if (v.screen === 'encounter' && p.state.pending === null) { stuckAt = steps; break; }
        if (p.state.gameOver || p.state.screen === 'end') break;
        const choices = v.menu.filter((m) => !m.disabled && m.action.type !== 'finish' && m.action.type !== 'quitToTitle' && m.action.type !== 'newGame');
        if (!choices.length) break;
        const pick = choices[Math.floor(chooser.next() * choices.length)];
        history[history.length - 1] += `  -> [${pick.key}] ${pick.label}`;
        dispatch(p, pick.action);
      }
      console.log(`\n=== seed ${seed}: stuck at step ${stuckAt} ===`);
      console.log(history.slice(Math.max(0, stuckAt - 6)).join('\n'));
      if (stuckAt >= 0) {
        console.log('view now:', JSON.stringify(view(p).title), view(p).menu.map((m) => m.label));
        const before = JSON.stringify(p.state);
        dispatch(p, view(p).menu[0].action);
        console.log('after pressing option 1, state changed?', before !== JSON.stringify(p.state), 'screen', p.state.screen);
      }
    }
  });
});
