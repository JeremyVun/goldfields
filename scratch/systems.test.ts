import { describe, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { getView, menuView } from '../src/engine/menus';
import { formatMoney, formatGold, pounds, shillings, oz } from '../src/engine/money';
import { rateAt, storeRate } from '../src/engine/market';
import { season, formatDate } from '../src/engine/time';
import type { Action, GameState } from '../src/engine/types';

function fresh(seed: number, over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(seed), screen: 'suze', ...over };
}
function run(s: GameState, a: Action, seed = 1): { state: GameState; text: string[] } {
  const rng = makeRng(seed);
  const r = step(s, a, rng);
  return { state: r.state, text: r.events.map((e) => e.text) };
}

describe('systems audit', () => {
  it('secret-mine rumour: genuine and hoax, and at most one genuine per year', () => {
    // Hoax
    let s = fresh(5, { location: 'fields-town', screen: 'ftown', provisionDays: 60, waterDays: 40, moneyPence: pounds(20),
      secret: { heard: true, genuine: false, chased: false, fromCamp: 'snakey-gully', heardOn: 1 } });
    let r = run(s, { type: 'followRumour' }, 11);
    console.log('HOAX:', r.text.join('\n  '));
    console.log('  after:', r.state.day, r.state.location, 'secret', r.state.secret);

    // Genuine
    s = fresh(5, { location: 'fields-town', screen: 'ftown', provisionDays: 60, waterDays: 40, moneyPence: pounds(20),
      items: { ...createInitialState(1).items, pick: 1, shovel: 1, tent: 1, waterBags: 2 },
      secret: { heard: true, genuine: true, chased: false, fromCamp: 'snakey-gully', heardOn: 1 } });
    r = run(s, { type: 'followRumour' }, 12);
    console.log('GENUINE:', r.text.slice(0, 4).join('\n  '), '...');
    console.log('  after:', r.state.day, r.state.location, 'secretGenuineUsed', r.state.secretGenuineUsed);
    const v = getView(r.state);
    console.log('  screen:', v.screen, v.title);
    console.log('  menu:', v.menu.map((m) => `${m.key}=${m.label}${m.disabled ? '[off]' : ''}`).join(' | '));
    if (r.state.location === 'secret-mine') {
      const mv = getView({ ...r.state, screen: 'camp-mine' });
      console.log('  mining options:', mv.menu.map((m) => `${m.label}${m.disabled ? `[off: ${m.note}]` : ''}`).join(' | '));
      const dry = run(r.state, { type: 'mine', method: 'dryblow', days: 5 }, 13);
      console.log('  DRYBLOW:', dry.text.join('\n    '));
      console.log('  after dryblow: day', dry.state.day, 'gold', formatGold(dry.state.goldCentiOz), 'hp', dry.state.health, 'water', dry.state.waterDays);
      // can he get home?
      const home = getView(dry.state);
      console.log('  from the secret mine, menu:', home.menu.map((m) => m.label).join(' | '));
    }
  });

  it('storekeeper scales cheat and the bank does not', () => {
    const base = fresh(9, { location: 'damp-camp', screen: 'camp', goldCentiOz: oz(5) });
    let cheats = 0, watchedCheats = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const a = run(base, { type: 'sellGold', where: 'camp', watch: false }, seed);
      if (a.text.some((t) => /short|scale|weight|thumb/i.test(t))) cheats++;
      const b = run(base, { type: 'sellGold', where: 'camp', watch: true }, seed);
      if (b.text.some((t) => /short|scale|weight|thumb/i.test(t))) watchedCheats++;
    }
    console.log(`camp storekeeper short-weights: unwatched ${cheats}/400, watched ${watchedCheats}/400`);
    let bankCheats = 0;
    const bankBase = fresh(9, { location: 'fields-town', screen: 'ftown', goldCentiOz: oz(5) });
    for (let seed = 1; seed <= 200; seed++) {
      const b = run(bankBase, { type: 'sellGold', where: 'bank', watch: true }, seed);
      if (b.text.some((t) => /short|scale/i.test(t))) bankCheats++;
    }
    console.log(`bank short-weights: ${bankCheats}/200`);
    const s0 = fresh(9, { day: 100, location: 'damp-camp', screen: 'camp', goldCentiOz: oz(5) });
    console.log('rates on day 100 — bank', formatMoney(s0.bankRatePencePerOz), 'Briggs store', formatMoney(storeRate(s0)),
      'damp camp', formatMoney(rateAt(s0, 'damp-camp')), 'snakey', formatMoney(rateAt(s0, 'snakey-gully')),
      'deep', formatMoney(rateAt(s0, 'deep-mountains')), 'suze', formatMoney(rateAt(s0, 'suze-port')));
    console.log('sample sale at camp:', run(s0, { type: 'sellGold', where: 'camp', watch: true }, 3).text.join(' / '));
    console.log('IS THERE A MENU CHOICE ABOUT WATCHING THE WEIGHING?');
    for (const scr of ['camp-store', 'ftown-bank'] as const) {
      const v = getView({ ...s0, screen: scr, location: scr === 'ftown-bank' ? 'fields-town' : 'damp-camp' });
      console.log(`  ${scr}:`, v.menu.filter((m) => m.action.type === 'sellGold').map((m) => `${m.label} (watch=${(m.action as any).watch}) note=${m.note}`).join(' | '));
    }
    console.log('  kitty:', menuView(s0).menu.filter((m) => m.action.type === 'sellGold').map((m) => `${m.label} watch=${(m.action as any).watch}`).join(' | '));
  });

  it('claim jumping takes ground and the shaft with it', () => {
    let jumped = 0, deterred = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const s = fresh(seed, { location: 'snakey-gully', screen: 'camp', claims: { 'damp-camp': false, 'snakey-gully': true, 'deep-mountains': false, 'secret-mine': false },
        provisionDays: 30, items: { ...createInitialState(1).items, pan: 1 }, licenceUntilDay: 400 });
      const r = run(s, { type: 'mine', method: 'pan', days: 20 }, seed);
      if (r.text.some((t) => /jump|stakes.*pulled|took the ground|another man/i.test(t))) {
        if (/deterr|thought better|off the ground/i.test(r.text.join(' '))) deterred++; else jumped++;
      }
    }
    console.log(`claim jumps over 2000×20 digging days: taken ${jumped}, deterred ${deterred}`);
    const s = fresh(4, { location: 'snakey-gully', screen: 'camp', claims: { 'damp-camp': false, 'snakey-gully': true, 'deep-mountains': false, 'secret-mine': false } });
    console.log('claim-jump text sample:', ['mine.claimjump', 'mine.claimjump.deterred'].join(', '));
    void s;
  });

  it('travel: both routes, both seasons, all three modes', () => {
    const kit = { ...createInitialState(1).items, tent: 1, swag: 1, pan: 1, waterBags: 2 };
    for (const day of [10, 190]) {
      for (const route of ['trickeys', 'pass'] as const) {
        for (const mode of ['walk', 'wagon', 'horse'] as const) {
          const s = fresh(1, { day, location: 'suze-port', screen: 'travel-mode', provisionDays: 60, waterDays: 40,
            moneyPence: pounds(30), items: kit, horse: mode === 'horse' ? 'brumby' : 'none' });
          const r = run(s, { type: 'travel', route, mode }, day * 7 + route.length + mode.length);
          console.log(`${season(day).padEnd(6)} ${route.padEnd(8)} ${mode.padEnd(5)}: day ${day}->${r.state.day} (${r.state.day - day}d) hp ${r.state.health} loc ${r.state.location} screen ${r.state.screen} cash ${formatMoney(r.state.moneyPence)} salvage ${r.state.salvage}`);
        }
      }
    }
    // Cobb & Co
    const s = fresh(1, { day: 100, location: 'fields-town', screen: 'ftown', moneyPence: pounds(5), provisionDays: 30 });
    const r = run(s, { type: 'coach' }, 5);
    console.log('Cobb & Co:', `day ${r.state.day}`, r.state.location, formatMoney(r.state.moneyPence), r.text.slice(0, 2).join(' / '));
  });

  it('illness deteriorates to automatic Calico House hospitalisation', () => {
    const s = fresh(3, { location: 'damp-camp', screen: 'camp', health: 25, provisionDays: 40, moneyPence: pounds(10),
      illness: { id: 'dysentery', severity: 3, since: 1 }, items: { ...createInitialState(1).items, pan: 1, tent: 1 }, licenceUntilDay: 400,
      claims: { 'damp-camp': true, 'snakey-gully': false, 'deep-mountains': false, 'secret-mine': false } });
    const r = run(s, { type: 'mine', method: 'pan', days: 12 }, 8);
    console.log('sick digger:', r.text.join('\n  '));
    console.log('after:', `day ${r.state.day}`, r.state.location, 'hp', r.state.health, 'cash', formatMoney(r.state.moneyPence), 'illness', r.state.illness, 'screen', r.state.screen);
    console.log('view now:', getView(r.state).title);
  });

  it('gambling, drinking and theft', () => {
    let net = 0;
    const base = fresh(1, { location: 'fields-town', screen: 'ftown-gamble', moneyPence: pounds(50), provisionDays: 30 });
    for (let seed = 1; seed <= 500; seed++) {
      const r = run(base, { type: 'gamble', game: 'twoup', stake: pounds(1) }, seed);
      net += r.state.moneyPence - base.moneyPence;
    }
    console.log(`two-up at £1 × 500: net ${formatMoney(net)} (expected house edge ~-6%: ${formatMoney(-0.06 * 500 * 240)})`);
    net = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const r = run(base, { type: 'gamble', game: 'cards', stake: pounds(1) }, seed);
      net += r.state.moneyPence - base.moneyPence;
    }
    console.log(`cards at £1 × 500: net ${formatMoney(net)}`);
    console.log('gambling takes NO days:', run(base, { type: 'gamble', game: 'twoup', stake: pounds(1) }, 1).state.day, 'vs', base.day);

    const drinkBase = fresh(1, { location: 'fields-town', screen: 'ftown-hotel', moneyPence: pounds(5), provisionDays: 30 });
    const d = run(drinkBase, { type: 'drink' }, 4);
    console.log('drink:', `day ${drinkBase.day}->${d.state.day}`, formatMoney(drinkBase.moneyPence), '->', formatMoney(d.state.moneyPence), d.text.join(' / ').slice(0, 200));

    const stealBase = fresh(1, { location: 'suze-port', screen: 'suze-crime', provisionDays: 30, moneyPence: shillings(10) });
    let caught = 0, took = 0, days = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = run(stealBase, { type: 'steal', target: 'drunk' }, seed);
      if (r.state.legal !== 'honest') took++;
      if (r.state.stats.timesArrested) caught++;
      days += r.state.day - stealBase.day;
    }
    console.log(`theft from a drunk × 300: caught ${caught}, ladder advanced ${took}, average days spent ${(days / 300).toFixed(2)}`);
  });

  it('licence arithmetic: 30s buys exactly 30 days', () => {
    let s = fresh(1, { location: 'fields-town', screen: 'ftown-council', day: 1, moneyPence: pounds(10) });
    let r = run(s, { type: 'buyLicence' }, 1);
    console.log('bought on day 1:', r.text[0]);
    console.log('  licenceUntilDay', r.state.licenceUntilDay, '=> valid days 1..' + r.state.licenceUntilDay, `(${r.state.licenceUntilDay - 1 + 1} days)`);
    for (const d of [1, 30, 31]) {
      const t = { ...r.state, day: d };
      console.log(`  on day ${d}: licensed=${t.licenceUntilDay >= t.day}`);
    }
    // renew before expiry — should extend, not overlap
    const mid = { ...r.state, day: 20, moneyPence: pounds(10) };
    const r2 = run(mid, { type: 'buyLicence' }, 2);
    console.log('renewed on day 20 (old expires 30):', r2.state.licenceUntilDay, '=> total days from 20:', r2.state.licenceUntilDay - 20 + 1);
    // renew after expiry
    const late = { ...r.state, day: 50, moneyPence: pounds(10) };
    const r3 = run(late, { type: 'buyLicence' }, 3);
    console.log('renewed on day 50 (old expired 30):', r3.state.licenceUntilDay, '=> days from 50:', r3.state.licenceUntilDay - 50 + 1);
  });

  it('calendar, seasons and the 365-day year', () => {
    for (const d of [1, 31, 32, 59, 60, 90, 152, 244, 335, 365, 366, 400, 730]) {
      console.log(`day ${String(d).padStart(3)}: ${formatDate(d).padEnd(22)} ${season(d)}`);
    }
    const s = fresh(1, { day: 365, location: 'suze-port', screen: 'suze', provisionDays: 30, moneyPence: pounds(5) });
    const r = run(s, { type: 'rest', days: 3 }, 1);
    console.log('resting past day 365:', 'day', r.state.day, 'endOfYear', r.state.endOfYear, 'screen', r.state.screen);
    const nx = run(r.state, { type: 'nextYear' }, 1);
    console.log('after nextYear:', 'day', nx.state.day, 'yearsPlayed', nx.state.yearsPlayed, 'endOfYear', nx.state.endOfYear, 'screen', nx.state.screen, 'loc', nx.state.location);
    const s2 = { ...nx.state, day: 730 };
    const r2 = run(s2, { type: 'rest', days: 3 }, 1);
    console.log('resting past day 730 in year two:', 'day', r2.state.day, 'endOfYear', r2.state.endOfYear, 'screen', r2.state.screen);
  });

  it('£sd formatting', () => {
    for (const v of [0, 1, 11, 12, 13, 239, 240, 241, 252, 253, 4200, -240, 9070]) {
      console.log(`${String(v).padStart(6)}d -> ${formatMoney(v)}`);
    }
    for (const g of [0, 1, 5, 100, 12345]) console.log(`${g} centi-oz -> ${formatGold(g)}`);
  });
});
