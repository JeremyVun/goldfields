import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { getView, menuView } from '../src/engine/menus';
import { formatMoney, pounds, oz } from '../src/engine/money';
import type { Action, GameState } from '../src/engine/types';

function fresh(seed: number, over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(seed), screen: 'suze', ...over };
}
function run(s: GameState, a: Action, seed = 1) {
  const r = step(s, a, makeRng(seed));
  return { state: r.state, text: r.events.map((e) => e.text) };
}
const KIT = { ...createInitialState(1).items, pan: 1, pick: 1, shovel: 1, tent: 1, swag: 1, waterBags: 1 };

describe('edge cases', () => {
  it('EDGE 1: the year ends mid-journey and the player is left on the road', () => {
    const s = fresh(1, { day: 362, location: 'suze-port', screen: 'travel-mode', provisionDays: 60, waterDays: 40, items: KIT, moneyPence: pounds(10) });
    const r = run(s, { type: 'travel', route: 'trickeys', mode: 'walk' }, 3);
    console.log('travel from day 362:', 'day', r.state.day, 'loc', r.state.location, 'screen', r.state.screen, 'endOfYear', r.state.endOfYear, 'journey', JSON.stringify(r.state.journey));
    const n = run(r.state, { type: 'nextYear' }, 4);
    console.log('after nextYear:', 'day', n.state.day, 'loc', n.state.location, 'screen', n.state.screen, 'journey', JSON.stringify(n.state.journey));
    const v = getView(n.state);
    console.log('  view:', v.screen, v.title);
    console.log('  menu:', v.menu.map((m) => m.label).join(' | '));
    console.log('  >>> the player is standing at location "' + n.state.location + '" but shown the ' + v.title + ' screen');
    // Can he act?
    const t = run(n.state, { type: 'travelTo', place: 'damp-camp' }, 5);
    console.log('  travelTo damp-camp from on-road:', t.state.location, 'day', t.state.day);
  });

  it('EDGE 2: acting after death repeats the obituary', () => {
    let s = fresh(1, { health: 2, location: 'damp-camp', screen: 'camp', provisionDays: 0, items: KIT, licenceUntilDay: 900,
      claims: { 'damp-camp': true, 'snakey-gully': false, 'deep-mountains': false, 'secret-mine': false } });
    const r = run(s, { type: 'mine', method: 'pan', days: 3 }, 2);
    console.log('died?', r.state.gameOver, r.state.causeOfDeath, 'screen', r.state.screen);
    const again = run(r.state, { type: 'sellGold', where: 'camp', watch: true }, 3);
    console.log('acting again after death emits:', again.text.length, 'events');
    console.log('  ', again.text.join('\n   ').slice(0, 400));
  });

  it('EDGE 3: hospital days when the player cannot pay in full', () => {
    const s = fresh(1, { location: 'fields-town', screen: 'ftown-hospital', moneyPence: 132, health: 30, provisionDays: 30 }); // 11s: enough for 1 day of 10s
    const r = run(s, { type: 'hospital', days: 7 }, 1);
    console.log('paid for 7 days with 11s:', r.text[0]);
    console.log('  day', s.day, '->', r.state.day, `(${r.state.day - s.day} days gone)`, 'cash', formatMoney(r.state.moneyPence), 'hp', s.health, '->', r.state.health);
    console.log('  >>> charged for 1 day of care but lost', r.state.day - s.day, 'days');
  });

  it('EDGE 4: finishing from the kitty and share dividends', () => {
    const s = fresh(1, { location: 'deep-mountains', screen: 'camp', shares: 3, moneyPence: pounds(2), day: 200, provisionDays: 20 });
    console.log('kitty options:', menuView(s).menu.map((m) => `${m.key}=${m.label}`).join(' | '));
    const r = run(s, { type: 'finish' }, 1);
    console.log('finish: gameOver', r.state.gameOver, 'screen', r.state.screen, 'bank', formatMoney(r.state.bankPence));
    console.log('  narration:', r.text.join(' / ') || '(none)');
    console.log('  >>> three £5 shares simply vanish, no dividend paid');
    const v = getView(r.state);
    console.log('  end menu:', v.menu.map((m) => m.label).join(' | '));
    // compare with the natural year end
    const s2 = fresh(1, { location: 'deep-mountains', screen: 'camp', shares: 3, day: 365, provisionDays: 20, moneyPence: pounds(2) });
    const r2 = run(s2, { type: 'rest', days: 2 }, 1);
    console.log('natural year end: bank', formatMoney(r2.state.bankPence));
    console.log('  ', r2.text.filter((t) => /company|dividend|share/i.test(t)).join(' / '));
  });

  it('EDGE 5: "Move on" from a camp offers the camp you are already standing in', () => {
    const s = fresh(1, { location: 'damp-camp', screen: 'ftown-depart', provisionDays: 20 });
    const v = getView(s);
    console.log('at Reedbank Camp, "Out to the diggings" offers:', v.menu.map((m) => `${m.key}=${m.label}`).join(' | '));
    const r = run(s, { type: 'travelTo', place: 'damp-camp' }, 1);
    console.log('  travelling to Reedbank Camp from Reedbank Camp: day', s.day, '->', r.state.day, 'loc', r.state.location);
    console.log('  >>> a day thrown away going nowhere');
    console.log('menu key numbering (no secret rumour):', v.menu.map((m) => m.key).join(','));
    const s2 = { ...s, secret: { heard: true, genuine: false, chased: false, fromCamp: 'damp-camp' as const, heardOn: 1 } };
    console.log('menu key numbering (with rumour):    ', getView(s2).menu.map((m) => m.key).join(','));
  });

  it('EDGE 6: the secret mine — getting there and getting home', () => {
    const s = fresh(1, { location: 'fields-town', screen: 'ftown', provisionDays: 90, waterDays: 60, moneyPence: pounds(30),
      items: { ...KIT, waterBags: 3 }, licenceUntilDay: 900,
      secret: { heard: true, genuine: true, chased: false, fromCamp: 'deep-mountains', heardOn: 1 } });
    for (const seed of [21, 33, 44]) {
      const r = run(s, { type: 'followRumour' }, seed);
      console.log(`seed ${seed}: day ${s.day}->${r.state.day} loc ${r.state.location} screen ${r.state.screen}`);
      if (r.state.location === 'secret-mine') {
        const camp = getView(r.state);
        console.log('  camp menu:', camp.menu.map((m) => `${m.key}=${m.label}${m.disabled ? '[off]' : ''}`).join(' | '));
        const mine = getView({ ...r.state, screen: 'camp-mine' });
        console.log('  dig menu:', mine.menu.map((m) => `${m.label}${m.disabled ? `[off: ${m.note}]` : ''}`).join(' | '));
        const peg = run(r.state, { type: 'pegClaim' }, 1);
        const dry = run(peg.state, { type: 'mine', method: 'dryblow', days: 10 }, 7);
        console.log('  10 days dryblowing:', 'gold', dry.state.goldCentiOz / 100, 'oz', 'hp', dry.state.health, 'water', dry.state.waterDays, 'day', dry.state.day);
        const back = run(dry.state, { type: 'travelTo', place: 'fields-town' }, 8);
        console.log('  >>> journey home to Slateford took', back.state.day - dry.state.day, 'days (the way out was 5)');
        break;
      }
    }
  });

  it('EDGE 7: gambling and theft cost no days (varying the rng properly)', () => {
    let net = 0, wins = 0;
    for (let i = 0; i < 2000; i++) {
      const base = fresh(1, { location: 'fields-town', screen: 'ftown-gamble', moneyPence: pounds(50), rngState: (i * 2654435761) >>> 0 });
      const r = run(base, { type: 'gamble', game: 'twoup', stake: pounds(1) }, 1);
      const d = r.state.moneyPence - base.moneyPence;
      net += d; if (d > 0) wins++;
    }
    console.log(`two-up × 2000 at £1: wins ${wins} (${(wins / 20).toFixed(1)}%), net ${formatMoney(net)}`);
    let caught = 0, loot = 0;
    for (let i = 0; i < 2000; i++) {
      const base = fresh(1, { location: 'suze-port', screen: 'suze-crime', moneyPence: pounds(1), provisionDays: 30, rngState: (i * 2246822519) >>> 0 });
      const r = run(base, { type: 'steal', target: 'drunk' }, 1);
      if (r.state.stats.timesArrested) caught++; else loot += r.state.moneyPence - base.moneyPence;
    }
    console.log(`theft from drunks × 2000: caught ${caught} (${(caught / 20).toFixed(1)}%), loot when clear ${formatMoney(loot / 2000)} avg`);
    const b = fresh(1, { location: 'suze-port', screen: 'suze-crime', moneyPence: pounds(1), provisionDays: 30 });
    console.log('a theft advances the day by', run(b, { type: 'steal', target: 'drunk' }, 9).state.day - b.day, 'days');
  });

  it('EDGE 8: selling gold you do not have, and other no-ops', () => {
    const s = fresh(1, { location: 'fields-town', screen: 'ftown-bank' });
    for (const a of [
      { type: 'sellGold', where: 'bank', watch: true },
      { type: 'deposit', amount: -1 },
      { type: 'withdraw', amount: -1 },
      { type: 'abandonShaft' },
      { type: 'timberShaft' },
      { type: 'followRumour' },
      { type: 'pegClaim' },
      { type: 'sellSalvage' },
      { type: 'hireMate', days: 7 },
      { type: 'readJournal' },
    ] as Action[]) {
      const r = run(s, a, 1);
      console.log(`${a.type.padEnd(13)} -> "${r.text.join(' / ').slice(0, 90)}" screen=${r.state.screen} money=${formatMoney(r.state.moneyPence)}`);
    }
  });

  it('EDGE 9: overdrawing the bank, and negative money hunting', () => {
    // Fine larger than cash, paid partly from the bank
    const s = fresh(1, { location: 'damp-camp', screen: 'camp', moneyPence: pounds(1), bankPence: pounds(20), day: 40 });
    const r = run(s, { type: 'submit' }, 1);
    console.log('submit with no pending:', r.text.join('/') || '(no-op)');
    // Force the logs directly
    const dodger = fresh(1, { location: 'damp-camp', screen: 'camp', moneyPence: pounds(1), bankPence: pounds(20), day: 40, provisionDays: 10, items: KIT, licenceUntilDay: 0, claims: { 'damp-camp': true, 'snakey-gully': false, 'deep-mountains': false, 'secret-mine': false } });
    for (let seed = 1; seed <= 40; seed++) {
      const m = run(dodger, { type: 'mine', method: 'pan', days: 20 }, seed);
      if (m.state.pending?.kind === 'trooper') {
        const sub = run(m.state, { type: 'submit' }, seed);
        if (sub.state.moneyPence < 0 || sub.state.bankPence < 0) console.log('NEGATIVE after fine!', formatMoney(sub.state.moneyPence), formatMoney(sub.state.bankPence));
      }
    }
    console.log('checked 40 arrest→fine paths for negative balances');
    // Bushrangers taking gold and money
    const rich = fresh(1, { location: 'on-road', screen: 'encounter', pending: { kind: 'bushrangers' }, moneyPence: pounds(30), goldCentiOz: oz(10), provisionDays: 20,
      journey: { route: 'pass', mode: 'walk', daysLeft: 2, daysTravelled: 3, to: 'fields-town', from: 'suze-port', salvage: 0 } });
    const rb = run(rich, { type: 'submit' }, 6);
    console.log('bailed up:', rb.text.join(' / ').slice(0, 260));
    console.log('  after: cash', formatMoney(rb.state.moneyPence), 'gold', rb.state.goldCentiOz / 100, 'loc', rb.state.location, 'screen', rb.state.screen);
  });
});
