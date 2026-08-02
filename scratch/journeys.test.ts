import { describe, it } from 'vitest';
import { formatMoney, formatGold } from '../src/engine/money';
import { inAftermath, isLicensed, statusLine } from '../src/engine/state';
import { menuView, getView } from '../src/engine/menus';
import { serialise, deserialise } from '../src/engine/save';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import type { GameState } from '../src/engine/types';
import { begin, dispatch, has, newPlayer, press, pressLabel, view, invariants } from './driver';

function snap(p: { state: GameState }): string {
  const s = p.state;
  return `day ${s.day} ${s.location}/${s.screen} cash ${formatMoney(s.moneyPence)} bank ${formatMoney(s.bankPence)} gold ${formatGold(s.goldCentiOz)} hp ${s.health} prov ${s.provisionDays} water ${s.waterDays} ${s.legal} lic->${s.licenceUntilDay}`;
}
function stake(p: { state: GameState }, pence: number) {
  p.state = { ...p.state, moneyPence: p.state.moneyPence + pence };
}
/** Back out to the root screen for wherever we are standing. */
function home(p: { state: GameState }) {
  for (let i = 0; i < 6; i++) {
    const v = view(p);
    if (v.screen === 'suze' || v.screen === 'ftown' || v.screen === 'camp' || v.screen === 'encounter' || v.screen === 'end' || v.screen === 'obituary') return;
    const back = v.menu.find((m) => m.key === '0' && !m.disabled);
    if (!back) return;
    dispatch(p, back.action);
  }
}
function buy(p: { state: GameState }, label: string): boolean {
  const m = has(p, label);
  if (!m || m.disabled) return false;
  pressLabel(p, label);
  return true;
}
/** Answer whatever the road or the night has raised, the way the bots do. */
function answer(p: { state: GameState }): boolean {
  const kind = p.state.pending?.kind;
  if (!kind || view(p).screen !== 'encounter') return false;
  if (kind === 'trooper') dispatch(p, { type: p.state.moneyPence >= 1200 ? 'bribe' : 'submit' });
  else if (kind === 'meeting') dispatch(p, { type: 'attendMeeting', attend: false });
  else if (kind === 'stockade') dispatch(p, { type: 'keepClear' });
  else dispatch(p, { type: 'submit' });
  return true;
}
function clearEncounters(p: { state: GameState }) {
  for (let i = 0; i < 6 && answer(p); i++);
}
/** The licence wants renewing — unless the stockade has killed the licence. */
function wantsLicence(s: GameState, margin: number): boolean {
  if (!isLicensed(s)) return true;
  return !inAftermath(s) && s.licenceUntilDay < s.day + margin;
}

describe('directed playthroughs', () => {
  it('a new chum walks to the diggings in summer with no water', () => {
    const p = newPlayer(909, false);
    begin(p, 909);
    stake(p, 60000);
    press(p, '2');
    for (const w of ['A pick', 'A shovel', 'Rope and bucket', 'A tent', 'A blanket', 'Water bags', 'A wheelbarrow']) buy(p, w);
    buy(p, "Four weeks' provisions");
    press(p, '0');
    console.log('setting out (water bags bought but NOT filled):', snap(p));
    pressLabel(p, 'Set out'); pressLabel(p, "Mercer's Track");
    console.log('travel-mode warnings:', view(p).body.filter((b) => b.startsWith('—')));
    const evs = pressLabel(p, 'Walk');
    console.log('--- the road ---');
    for (const e of evs) console.log(`  ${e.tone.padEnd(7)} ${e.text}`);
    console.log('arrived:', snap(p));
  });

  it('an honest cradler works a full year at Reedbank Camp', () => {
    const p = newPlayer(4242);
    begin(p, 4242);
    // A new chum must eat before anything else.
    press(p, '2'); buy(p, "A week's provisions"); press(p, '0');
    for (let i = 0; i < 40 && p.state.moneyPence < 1500 && !p.state.gameOver; i++) {
      home(p);
      if (p.state.provisionDays < 8) { press(p, '2'); if (!buy(p, "A week's provisions")) { press(p, '0'); break; } press(p, '0'); continue; }
      press(p, '1'); pressLabel(p, 'wharves'); home(p);
    }
    console.log('after wharf work:', snap(p));
    press(p, '2');
    for (const w of ['A tin pan', 'A cradle', 'A pick', 'A shovel', 'A tent', 'A blanket', 'A wheelbarrow', 'Water bags']) buy(p, w);
    buy(p, "Four weeks' provisions"); buy(p, 'Fill the water bags');
    press(p, '0');
    console.log('kitted out:', snap(p), JSON.stringify(p.state.items));

    pressLabel(p, 'Set out'); pressLabel(p, "Mercer's Track"); pressLabel(p, 'Walk');
    clearEncounters(p);
    console.log('arrived at the fields:', snap(p));

    let guard = 0;
    const diary: string[] = [];
    while (!p.state.gameOver && !p.state.endOfYear && guard++ < 800) {
      const v = view(p);
      if (v.screen === 'encounter') { answer(p); continue; }
      if (v.screen === 'end' || v.screen === 'obituary') break;
      home(p);
      const s = p.state;
      if (s.location === 'fields-town') {
        if (s.goldCentiOz > 0) { press(p, '1'); pressLabel(p, 'Sell all your gold'); if (s.moneyPence > 3000) buy(p, 'Deposit'); press(p, '0'); continue; }
        if (wantsLicence(s, 3) && s.moneyPence >= 360) { press(p, '3'); buy(p, "miner's"); press(p, '0'); continue; }
        // A man who lands here skint must earn his licence money before he can dig.
        if (s.moneyPence < 360 && s.bankPence > 0) { press(p, '1'); pressLabel(p, 'Withdraw'); press(p, '0'); continue; }
        if (s.moneyPence < 360 && s.goldCentiOz === 0) { press(p, '4'); pressLabel(p, 'Lin Wu'); home(p); continue; }
        if (s.provisionDays < 24) { press(p, '2'); if (!buy(p, "Four weeks'")) { press(p, '0'); press(p, '4'); pressLabel(p, 'Lin Wu'); home(p); continue; } buy(p, "Greens from Lin Wu"); press(p, '0'); continue; }
        if (s.health < 55) { pressLabel(p, 'Canvas House'); if (!buy(p, 'Three days under care')) buy(p, 'Rest instead'); press(p, '0'); continue; }
        press(p, '8'); pressLabel(p, 'Reedbank Camp'); continue;
      }
      if (s.location === 'damp-camp') {
        if (s.health < 42) { pressLabel(p, 'Rest a spell'); continue; }
        if (!s.claims['damp-camp']) { pressLabel(p, 'Peg a claim'); continue; }
        if (!isLicensed(s) || s.provisionDays < 8 || s.goldCentiOz > 250) { pressLabel(p, 'Back to Slateford'); continue; }
        if (s.mateUntilDay < s.day && s.moneyPence > 600) { pressLabel(p, 'Hire a mate'); continue; }
        press(p, '1');
        if (!buy(p, 'Work the cradle')) { buy(p, 'Pan the creek') || buy(p, 'Fossick'); }
        continue;
      }
      const first = v.menu.find((m) => !m.disabled)!;
      dispatch(p, first.action);
    }
    console.log('YEAR OUT:', snap(p), `guard=${guard}`);
    console.log('stats:', JSON.stringify(p.state.stats));
    const ev = getView(p.state);
    console.log(`--- ${ev.title} ---`);
    for (const l of ev.body) console.log(l);
    console.log('menu:', ev.menu.map((m) => `${m.key}=${m.label}`).join(' | '));
    console.log('status line:', statusLine(p.state));
    console.log('invariants:', invariants(p, 'cradler'));
    diary.push('');

    // second year
    if (!p.state.gameOver) {
      pressLabel(p, 'Stay on for another year');
      console.log('YEAR TWO begins:', snap(p), 'yearsPlayed', p.state.yearsPlayed, 'endOfYear', p.state.endOfYear);
      console.log('view:', getView(p.state).title, getView(p.state).subtitle);
    }
  });

  it('a licence dodger goes through bribe, logs, magistrate and gaol', () => {
    const p = newPlayer(77);
    begin(p, 77);
    stake(p, 60000);
    press(p, '2');
    for (const w of ['A tin pan', 'A pick', 'A shovel', 'A tent', 'Water bags']) buy(p, w);
    buy(p, "Four weeks' provisions"); buy(p, 'Fill the water bags');
    press(p, '0');
    pressLabel(p, 'Set out'); pressLabel(p, 'Razorback Road'); pressLabel(p, 'Walk');
    clearEncounters(p);
    home(p);
    pressLabel(p, 'Out to the diggings'); pressLabel(p, 'Copperhead Gully');
    clearEncounters(p);

    const outcomes: string[] = [];
    let guard = 0;
    let n = 0;
    while (!p.state.gameOver && !p.state.endOfYear && guard++ < 600 && outcomes.length < 12) {
      const v = view(p);
      if (v.screen === 'encounter' && p.state.pending?.kind === 'trooper') {
        console.log(`  trooper menu: ${v.menu.map((m) => `${m.key}=${m.label}${m.disabled ? '[off]' : ''}`).join(' | ')}`);
        const choice = (['bribe', 'submit', 'resist'] as const)[n++ % 3];
        const before = { day: p.state.day, money: p.state.moneyPence, legal: p.state.legal, hp: p.state.health };
        const evs = dispatch(p, { type: choice } as any);
        outcomes.push(`${choice.padEnd(7)} day ${before.day}->${p.state.day} cash ${formatMoney(before.money)}->${formatMoney(p.state.moneyPence)} hp ${before.hp}->${p.state.health} legal ${before.legal}->${p.state.legal} @${p.state.location}/${p.state.screen}\n      ${evs.map((e) => e.text).join('\n      ')}`);
        continue;
      }
      if (v.screen === 'encounter') { answer(p); continue; }
      home(p);
      const s = p.state;
      if (s.location === 'fields-town') {
        if (s.health < 45) { pressLabel(p, 'Canvas House'); if (!buy(p, 'Seven days')) buy(p, 'Rest instead'); press(p, '0'); continue; }
        if (s.provisionDays < 10) { press(p, '2'); buy(p, "Four weeks'"); press(p, '0'); continue; }
        press(p, '8'); pressLabel(p, 'Copperhead Gully'); continue;
      }
      if (s.location === 'snakey-gully') {
        if (s.health < 42) { pressLabel(p, 'Rest a spell'); continue; }
        if (s.provisionDays < 6) { pressLabel(p, 'Back to Slateford'); continue; }
        if (!s.claims['snakey-gully']) { pressLabel(p, 'Peg a claim'); continue; }
        press(p, '1'); buy(p, 'Pan the creek') || buy(p, 'Fossick');
        continue;
      }
      const first = v.menu.find((m) => !m.disabled)!;
      dispatch(p, first.action);
    }
    console.log('--- licence dodger ---');
    for (const o of outcomes) console.log(o);
    console.log('final:', snap(p), 'arrests', p.state.stats.timesArrested, 'bribes', p.state.stats.bribesPaid);
    console.log('invariants:', invariants(p, 'dodger'));
  });

  it('a shafter at Blackcap Ranges meets cave-ins, timber and water', () => {
    const p = newPlayer(2024);
    begin(p, 2024);
    stake(p, 90000);
    press(p, '2');
    for (const w of ['A pick', 'A shovel', 'Rope and bucket', 'A tent', 'A blanket', 'Water bags', 'A wheelbarrow']) buy(p, w);
    buy(p, "Four weeks' provisions"); buy(p, 'Fill the water bags');
    press(p, '0');
    pressLabel(p, 'Set out'); pressLabel(p, "Mercer's Track"); pressLabel(p, 'Walk');
    clearEncounters(p);
    home(p);
    press(p, '3'); buy(p, "miner's licence"); press(p, '0');
    press(p, '2'); buy(p, 'Timber supports'); buy(p, 'Timber supports'); buy(p, 'A pump'); press(p, '0');
    pressLabel(p, 'Out to the diggings'); pressLabel(p, 'Blackcap Ranges');
    clearEncounters(p);
    console.log('at Blackcap Ranges:', snap(p), 'timber', p.state.items.timber, 'pump', p.state.items.pump);
    pressLabel(p, 'Peg a claim');
    const notes: string[] = [];
    let guard = 0;
    while (!p.state.gameOver && !p.state.endOfYear && guard++ < 900) {
      const v = view(p);
      if (v.screen === 'encounter') { answer(p); continue; }
      if (v.screen === 'end' || v.screen === 'obituary') break;
      home(p);
      const s = p.state;
      if (s.location === 'fields-town') {
        if (s.goldCentiOz > 0) { press(p, '1'); pressLabel(p, 'Sell all'); buy(p, 'Deposit'); press(p, '0'); continue; }
        if (s.health < 55) { pressLabel(p, 'Canvas House'); if (!buy(p, 'Seven days')) buy(p, 'Rest instead'); press(p, '0'); continue; }
        if (wantsLicence(s, 2)) { press(p, '3'); if (!buy(p, "miner's")) { press(p, '0'); press(p, '1'); pressLabel(p, 'Withdraw'); press(p, '0'); continue; } press(p, '0'); continue; }
        if (s.provisionDays < 24 || s.items.timber < 1) {
          press(p, '2');
          if (s.provisionDays < 24 && !buy(p, "Four weeks'")) { press(p, '0'); press(p, '1'); pressLabel(p, 'Withdraw'); press(p, '0'); continue; }
          if (s.items.timber < 1) buy(p, 'Timber supports');
          press(p, '0'); continue;
        }
        press(p, '8'); pressLabel(p, 'Blackcap Ranges'); continue;
      }
      if (s.location === 'deep-mountains') {
        if (s.health < 45) { pressLabel(p, 'Rest a spell'); continue; }
        if (!isLicensed(s) || s.provisionDays < 6 || s.goldCentiOz > 150 || s.items.timber < 1) { pressLabel(p, 'Back to Slateford'); continue; }
        if (!s.claims['deep-mountains']) { pressLabel(p, 'Peg a claim'); continue; }
        if (has(p, 'Timber the shaft')) { notes.push(`d${s.day} timbering at ${s.shaft?.depthFeet}ft`); pressLabel(p, 'Timber the shaft'); continue; }
        press(p, '1');
        if (!buy(p, 'Sink and work a shaft')) { notes.push(`d${s.day} shaft blocked: ${has(p, 'Sink and work')?.note}`); press(p, '0'); pressLabel(p, 'Back to Slateford'); continue; }
        continue;
      }
      const first = v.menu.find((m) => !m.disabled)!;
      dispatch(p, first.action);
    }
    console.log('--- shafter ---');
    for (const n of notes.slice(0, 25)) console.log('  ' + n);
    console.log('final:', snap(p), 'caveIns', p.state.stats.caveIns, 'shafts', p.state.stats.shaftsSunk);
    console.log('shaft/company journal:', p.state.journal.filter((j) => /shaft|company|dividend|Bottom|fell/i.test(j.text)).map((j) => `d${j.day} ${j.text}`).join('\n  '));
    const ev = getView(p.state);
    console.log(`--- ${ev.title} ---`);
    for (const l of ev.body) console.log(l);
    console.log('invariants:', invariants(p, 'shafter'));
  });

  it('save issues an ID and reloading continues the identical RNG stream', () => {
    const p = newPlayer(31337);
    begin(p, 31337);
    press(p, '2'); buy(p, "Four weeks' provisions"); press(p, '0');
    for (let i = 0; i < 3; i++) { home(p); press(p, '1'); pressLabel(p, 'wharves'); }
    home(p);
    const kv = menuView(p.state);
    console.log('kitty menu:', kv.menu.map((m) => `${m.key}=${m.label}${m.disabled ? '[off]' : ''}`).join(' | '));
    console.log('kitty body:'); for (const l of kv.body) console.log('  ' + l);
    const evs = dispatch(p, kv.menu.find((m) => m.action.type === 'save')!.action);
    console.log('save narration:', evs.map((e) => e.text).join(' '));
    console.log('gameId:', p.state.gameId);

    const saved = serialise(p.state);
    const restored = deserialise(saved)!;
    console.log('round-trip identical?', JSON.stringify(p.state) === JSON.stringify(restored));

    const rngA = makeRng(1), rngB = makeRng(2);
    let a: GameState = p.state, b: GameState = restored;
    const trailA: string[] = [], trailB: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ra = step(a, { type: 'work', job: 'wharf', days: 7 }, rngA); a = ra.state;
      const rb = step(b, { type: 'work', job: 'wharf', days: 7 }, rngB); b = rb.state;
      trailA.push(ra.events.map((e) => e.text).join('|'));
      trailB.push(rb.events.map((e) => e.text).join('|'));
    }
    console.log('states identical after 10 further steps?', JSON.stringify(a) === JSON.stringify(b));
    console.log('narration identical?', trailA.join('##') === trailB.join('##'));
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      for (const k of Object.keys(a) as (keyof GameState)[]) {
        if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log('  differs:', k, JSON.stringify(a[k]), JSON.stringify(b[k]));
      }
    }
  });
});
