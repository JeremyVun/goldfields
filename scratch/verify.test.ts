import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { getView } from '../src/engine/menus';
import { localTravelDays } from '../src/engine/travel';
import { formatMoney, pounds, oz } from '../src/engine/money';
import type { Action, GameState } from '../src/engine/types';

function fresh(seed: number, over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(seed), screen: 'suze', ...over };
}
const run = (s: GameState, a: Action, seed = 1) => {
  const r = step(s, a, makeRng(seed));
  return { state: r.state, text: r.events.map((e) => e.text) };
};

describe('verify fixes', () => {
  it('secret mine is five days each way', () => {
    const at = fresh(1, { location: 'secret-mine' });
    console.log('from the secret mine to Slateford:', localTravelDays(at, 'fields-town'), 'days');
    console.log('from the secret mine to Reedbank Camp:', localTravelDays(at, 'damp-camp'), 'days');
    const ft = fresh(1, { location: 'fields-town' });
    console.log('from Slateford to the secret mine:', localTravelDays(ft, 'secret-mine'), 'days');
    const s = fresh(1, { location: 'secret-mine', screen: 'camp', provisionDays: 40, waterDays: 40 });
    for (const seed of [2, 5, 9]) {
      const r = run(s, { type: 'travelTo', place: 'fields-town' }, seed);
      console.log(`  seed ${seed}: day 1 -> ${r.state.day}, loc ${r.state.location}, screen ${r.state.screen}`);
    }
  });

  it('travelling to where you already stand costs nothing', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'camp', provisionDays: 20 });
    const r = run(s, { type: 'travelTo', place: 'damp-camp' }, 1);
    console.log('day', s.day, '->', r.state.day, 'loc', r.state.location, ':', r.text.join(' '));
  });

  it('the store now offers both ways of selling gold', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'camp-store', goldCentiOz: oz(4) });
    const v = getView(s);
    console.log('camp store menu keys:', v.menu.map((m) => `${m.key}=${m.label}`).join('\n  '));
    let watched = 0, trusting = 0;
    for (let i = 0; i < 2000; i++) {
      const b = { ...s, rngState: (i * 2654435761) >>> 0 };
      if (run(b, { type: 'sellGold', where: 'camp', watch: true }, 1).text.some((t) => /short|scale|thumb|weight/i.test(t))) watched++;
      if (run(b, { type: 'sellGold', where: 'camp', watch: false }, 1).text.some((t) => /short|scale|thumb|weight/i.test(t))) trusting++;
    }
    console.log(`short-weighted: watching ${(watched / 20).toFixed(1)}%, trusting ${(trusting / 20).toFixed(1)}%`);
    console.log('trusting sample:', run({ ...s, rngState: 12345 }, { type: 'sellGold', where: 'camp', watch: false }, 1).text.join('\n  '));
  });

  it('a gravely ill digger is warned', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'camp', health: 24, provisionDays: 30,
      items: { ...createInitialState(1).items, pan: 1, tent: 1 }, licenceUntilDay: 900,
      claims: { 'damp-camp': true, 'snakey-gully': false, 'deep-mountains': false, 'secret-mine': false } });
    const r = run(s, { type: 'rest', days: 4 }, 3);
    console.log(r.text.join('\n  '));
    console.log('hp', s.health, '->', r.state.health);
  });

  it('the court no longer contradicts itself', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'camp', day: 40, moneyPence: pounds(20), bankPence: pounds(20),
      provisionDays: 20, items: { ...createInitialState(1).items, pan: 1 }, licenceUntilDay: 0,
      claims: { 'damp-camp': true, 'snakey-gully': false, 'deep-mountains': false, 'secret-mine': false } });
    for (let seed = 1; seed <= 60; seed++) {
      const m = run(s, { type: 'mine', method: 'pan', days: 20 }, seed);
      if (m.state.pending?.kind === 'trooper') {
        const sub = run(m.state, { type: 'submit' }, seed);
        const court = sub.text.filter((t) => /fine|magistrate|chain|irons|settle|struck off|clerk writes/i.test(t));
        if (court.length) { console.log(`seed ${seed}:`); for (const c of court) console.log('  ' + c); console.log('  cash', formatMoney(sub.state.moneyPence), 'bank', formatMoney(sub.state.bankPence)); break; }
      }
    }
  });

  it('one-day spells with a trooper interruption resolve cleanly', () => {
    let stuck = 0, checked = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const s = fresh(seed, { location: 'snakey-gully', screen: 'camp', day: 50, moneyPence: pounds(20),
        provisionDays: 20, items: { ...createInitialState(1).items, pan: 1 }, licenceUntilDay: 0,
        claims: { 'damp-camp': false, 'snakey-gully': true, 'deep-mountains': false, 'secret-mine': false } });
      const m = run(s, { type: 'mine', method: 'pan', days: 1 }, seed);
      if (m.state.pending?.kind !== 'trooper') continue;
      checked++;
      for (const choice of ['bribe', 'resist', 'submit'] as const) {
        const r = run(m.state, { type: choice } as Action, seed);
        if (r.state.screen === 'encounter' && !r.state.pending) { stuck++; console.log('STUCK', seed, choice); }
      }
    }
    console.log(`one-day spells interrupted by troopers: ${checked} checked, ${stuck} stranded`);
  });
});
