/**
 * Integration agent's empirical loop: the seams BETWEEN Agent A's civic
 * systems and Agent B's town life. Run with:
 *   npx tsx scratch/integration.ts
 * Not committed. Every scenario prints every narration line for reading.
 */
import { makeRng } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { getView } from '../src/engine/menus';
import { endDay } from '../src/engine/daily';
import { Log } from '../src/engine/narrate';
import type { Action, CampId, GameState, NarrationEvent } from '../src/engine/types';
import { pounds } from '../src/engine/money';
import { formatMoney } from '../src/engine/money';

const rng = makeRng(20260801);

function fresh(seed = 7): GameState {
  const s = createInitialState(seed);
  s.day = 30;
  s.location = 'fields-town';
  s.screen = 'ftown';
  s.moneyPence = pounds(600);
  s.standing = 70;
  s.health = 90;
  s.provisionDays = 60;
  s.waterDays = 60;
  return s;
}

let sink: GameState;
function act(s: GameState, action: Action, label?: string): GameState {
  const r = step(s, action, rng);
  if (label) console.log(`>> ${label}`);
  for (const e of r.events) console.log(`   · ${e.text}`);
  return r.state;
}

function press(s: GameState, needle: string): GameState {
  const v = getView(s);
  const m = v.menu.find((x) => x.label.toLowerCase().includes(needle.toLowerCase()));
  if (!m) throw new Error(`no "${needle}" on ${v.screen}: ${v.menu.map((x) => x.label).join(' | ')}`);
  if (m.disabled) throw new Error(`"${m.label}" disabled on ${v.screen} — note: ${m.note}`);
  return act(s, m.action, `${v.screen} [${m.key}] ${m.label}`);
}

function day(s: GameState, n = 1): GameState {
  for (let i = 0; i < n; i++) {
    const log = new Log(rng);
    endDay(s, rng, log);
    for (const e of log.events as NarrationEvent[]) console.log(`   day ${s.day - 1}: ${e.text}`);
  }
  return s;
}

function head(t: string) {
  console.log(`\n\n=========== ${t} ===========`);
}

// ---------------------------------------------------------------------------
// 0. Key collisions on every screen, in several skins of player
// ---------------------------------------------------------------------------
head('0. KEYBINDING COLLISIONS');
{
  const skins: [string, (s: GameState) => void][] = [
    ['new chum', () => {}],
    ['notable', (s) => { s.estate.shamrock = true; s.estate.gazetteShare = true; s.estate.store = { camp: 'damp-camp', policy: 'fair' }; s.estate.jpSince = 200; s.standing = 80; }],
    ['outlaw', (s) => { s.notoriety = 55; s.legal = 'wanted criminal'; s.outlawed = true; s.estate.shanty = 'snakey-gully'; s.goldCentiOz = 400; }],
    ['outlaw-landlord', (s) => { s.notoriety = 45; s.legal = 'wanted criminal'; s.estate.shanty = 'damp-camp'; s.estate.shamrock = true; }],
  ];
  const places: [string, CampId | 'fields-town' | 'suze-port'][] = [
    ['fields-town', 'fields-town'],
    ['suze-port', 'suze-port'],
    ['damp-camp', 'damp-camp'],
    ['snakey-gully', 'snakey-gully'],
  ];
  const screens = [
    'ftown', 'ftown-hotel', 'ftown-gamble', 'ftown-council', 'camp', 'camp-grog',
    'camp-store', 'estate', 'press', 'court', 'bandit', 'suze', 'kitty',
  ];
  let bad = 0;
  for (const [skinName, skin] of skins) {
    for (const [placeName, place] of places) {
      for (const sc of screens) {
        const s = fresh();
        skin(s);
        s.location = place as GameState['location'];
        s.screen = sc as GameState['screen'];
        let v;
        try { v = getView(s); } catch { continue; }
        const seen = new Map<string, string>();
        for (const m of v.menu) {
          const k = m.key.toUpperCase();
          if (seen.has(k)) {
            console.log(`  !! ${skinName} @ ${placeName} [${sc}] key ${k}: "${seen.get(k)}" vs "${m.label}"`);
            bad++;
          }
          seen.set(k, m.label);
        }
      }
    }
  }
  console.log(bad === 0 ? '  no key collisions on any screen in any skin' : `  ${bad} COLLISIONS`);
}

// ---------------------------------------------------------------------------
// 1. Buy the Shamrock at the bar, then spree in it
// ---------------------------------------------------------------------------
head('1. THE HOUSE, AND A SPREE IN IT (§26 x §30.2)');
{
  let s = fresh();
  s.day = 28; // a Sunday is day % 7 === 0
  s = press(s, 'Shamrock Hotel');
  console.log('  --- the hotel screen ---');
  for (const l of getView(s).body) console.log(`   | ${l}`);
  for (const m of getView(s).menu) console.log(`   | [${m.key}] ${m.label}${m.disabled ? ' (disabled)' : ''}${m.note ? ` — ${m.note}` : ''}`);
  s = press(s, 'wants for the house');
  console.log(`  owns=${s.estate.shamrock} money=${formatMoney(s.moneyPence)} day=${s.day}`);
  console.log('  --- the hotel screen, his own ---');
  s.screen = 'ftown-hotel';
  for (const m of getView(s).menu) console.log(`   | [${m.key}] ${m.label}${m.disabled ? ' (disabled)' : ''}${m.note ? ` — ${m.note}` : ''}`);

  const before = s.moneyPence;
  s = press(s, 'The spree');
  console.log(`  spent ${formatMoney(before - s.moneyPence)}; flushUntil=${s.estate.flushUntilDay} day=${s.day} shoutedOn=${s.estate.shoutedOn}`);

  // Walk to the Sunday and read the takings.
  for (let i = 0; i < 10; i++) {
    const m0 = s.moneyPence;
    const flush = s.day <= s.estate.flushUntilDay;
    const d = s.day;
    s = day(s);
    if (d % 7 === 0) console.log(`   >>> Sunday day ${d}: flush=${flush} takings delta ${formatMoney(s.moneyPence - m0)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. The shanty: own it, shout it, and see the one warning
// ---------------------------------------------------------------------------
head('2. THE SHANTY: LOYALTY AND ONE WARNING (§28.3 x §30.2)');
{
  let s = fresh();
  s.location = 'snakey-gully';
  s.screen = 'camp';
  s.notoriety = 45;
  s.legal = 'wanted criminal';
  s.gang = [
    { name: 'Long Tom', loyalty: 0.5, skill: 0.5, joinedOn: 10 },
    { name: 'Micky the Fly', loyalty: 0.4, skill: 0.6, joinedOn: 12 },
  ] as GameState['gang'];
  s.screen = 'camp-grog';
  console.log('  --- the grog tent, before he owns it ---');
  for (const l of getView(s).body) console.log(`   | ${l}`);
  s.screen = 'bandit';
  s = press(s, 'Buy the sly-grog shanty');
  s.screen = 'camp-grog';
  console.log('  --- his own shanty ---');
  for (const l of getView(s).body) console.log(`   | ${l}`);
  for (const m of getView(s).menu) console.log(`   | [${m.key}] ${m.label}${m.disabled ? ' (disabled)' : ''}${m.note ? ` — ${m.note}` : ''}`);
  const st0 = s.standing;
  s = press(s, 'Shout the room');
  console.log(`  loyalty now: ${s.gang.map((g) => `${g.name} ${g.loyalty.toFixed(2)}`).join(', ')}`);
  console.log(`  standing ${st0} -> ${s.standing} (must not move); warnedUntil=${s.estate.warnedUntilDay} day=${s.day}`);

  // A week of days: the Sunday grant should keep the word standing.
  for (let i = 0; i < 9; i++) {
    s = day(s);
    console.log(`   day ${s.day}: warnedUntil=${s.estate.warnedUntilDay} warnedOn=${s.warnedOn} heat.camps=${s.heat.camps.toFixed(1)}`);
  }
}

// ---------------------------------------------------------------------------
// 3. A story in the paper: the owner's lead against the room's talk
// ---------------------------------------------------------------------------
head('3. THE LEAD (§26 press x §30.1 house news)');
{
  let s = fresh();
  s.day = 100;
  s.estate.shamrock = true;
  s.estate.gazetteShare = true;
  s.freshness['deep-mountains'] = 0.95;
  s.screen = 'press';
  console.log('  --- the press room ---');
  for (const m of getView(s).menu) console.log(`   | [${m.key}] ${m.label}${m.disabled ? ' (disabled)' : ''}${m.note ? ` — ${m.note}` : ''}`);
  s = press(s, 'Blackcap Ranges');
  const called = s.rush;
  console.log(`  rush: ${called ? `${called.camp} since=${called.since} until=${called.untilDay} factor=${called.factor}` : 'none'} (day ${s.day})`);
  for (let i = 0; i < 6; i++) {
    console.log(`  --- day ${s.day} (rush since ${s.rush?.since ?? '-'}) ---`);
    // What the paper says, what the room says, what his own bar says.
    const { gazetteFor, campTalk } = await import('../src/engine/news');
    console.log(`   GAZETTE: ${gazetteFor(s).filter((l) => l.includes('RUSH')).join(' / ') || '(no rush printed)'}`);
    console.log(`   ROOM   : ${campTalk(s)}`);
    const { houseNews } = await import('../src/engine/shamrock');
    console.log(`   HOUSE  : ${houseNews(s, rng)}`);
    s = day(s);
  }
}

// ---------------------------------------------------------------------------
// 4. A hard bench, and the quiet after it
// ---------------------------------------------------------------------------
head('4. THE BENCH (§28.1)');
{
  let s = fresh();
  s.day = 355;
  s.estate.shamrock = true;
  s.estate.jpSince = 350;
  s.estate.nextCourtDay = 355;
  s.screen = 'court';
  console.log('  --- the court ---');
  for (const l of getView(s).body) console.log(`   | ${l}`);
  for (const m of getView(s).menu) console.log(`   | [${m.key}] ${m.label}${m.disabled ? ' (disabled)' : ''}`);
  s = press(s, 'full weight');
  const { courtCalmFactor } = await import('../src/engine/estate');
  console.log(`  severityUntilDay=${s.estate.severityUntilDay} day=${s.day} calmFactor=${courtCalmFactor(s)}`);
  s.day = s.estate.severityUntilDay + 1;
  console.log(`  a day past it: calmFactor=${courtCalmFactor(s)} (must be 1)`);
}

// ---------------------------------------------------------------------------
// 5. An outlaw who killed a notice, drinking at his own shanty
// ---------------------------------------------------------------------------
head('5. THE OUTLAW AT HIS OWN COUNTER (§26 kill-notice x §30.1 informer)');
{
  let s = fresh();
  s.day = 200;
  s.location = 'damp-camp';
  s.screen = 'camp-grog';
  s.notoriety = 60;
  s.legal = 'wanted criminal';
  s.outlawed = false;
  s.estate.shanty = 'damp-camp';
  s.estate.gazetteShare = true;
  s.heat = { trickeys: 70, pass: 60, town: 65, camps: 55 };
  s.diggersRobbed = 0;
  console.log('  --- his own shanty, a wanted man ---');
  for (const l of getView(s).body) console.log(`   | ${l}`);
  for (let i = 0; i < 4; i++) s = press(s, 'nobbler');
  const h0 = { ...s.heat };
  s.screen = 'press';
  const v = getView(s);
  for (const m of v.menu) console.log(`   | press [${m.key}] ${m.label}${m.disabled ? ` (disabled: ${m.note})` : ''}`);
  const kill = v.menu.find((m) => m.label.toLowerCase().includes('notice'));
  if (kill && !kill.disabled) s = act(s, kill.action, 'kill the notice');
  console.log(`  noticeKillUntil=${s.estate.noticeKillUntilDay}`);
  for (let i = 0; i < 3; i++) s = day(s);
  console.log(`  heat trickeys ${h0.trickeys} -> ${s.heat.trickeys.toFixed(1)} over 3 days (plain decay would be 4.5)`);
  console.log(`  informerUntil=${s.estate.informerUntilDay} warnedUntil=${s.estate.warnedUntilDay}`);
}

// ---------------------------------------------------------------------------
// 6. Controlled checks: takings factor, and the owner's word on a natural rush
// ---------------------------------------------------------------------------
head('6. CONTROLLED CHECKS');
{
  const { estateWeek, estateDay } = await import('../src/engine/estate');
  // Same seed, flush and not flush: the takings must differ by 1.25.
  const runTakings = (flush: boolean): number => {
    const s = fresh();
    s.day = 140;
    s.estate.shamrock = true;
    if (flush) s.estate.flushUntilDay = s.day + 3;
    const r = makeRng(4242);
    const log = new Log(r);
    const before = s.moneyPence;
    estateWeek(s, r, log);
    for (const e of log.events) console.log(`   ${flush ? 'flush ' : 'plain '}· ${e.text}`);
    return s.moneyPence - before;
  };
  const plain = runTakings(false);
  const flush = runTakings(true);
  console.log(`  takings plain=${formatMoney(plain)} flush=${formatMoney(flush)} ratio=${(flush / plain).toFixed(3)} (want 1.25)`);

  // A natural rush: the owner is told once, and only he.
  for (const owner of [true, false]) {
    const s = fresh();
    s.day = 150;
    s.estate.shamrock = owner;
    s.rush = { camp: 'damp-camp', since: 152, untilDay: 162, factor: 1.4, base: 0.9 };
    let said = 0;
    for (let d = 150; d <= 156; d++) {
      s.day = d;
      const log = new Log(rng);
      estateDay(s, log);
      for (const e of log.events) {
        said++;
        console.log(`   ${owner ? 'owner' : 'other'} day ${d} · ${e.text}`);
      }
    }
    console.log(`  ${owner ? 'owner' : 'non-owner'}: ${said} early word${said === 1 ? '' : 's'} (owner wants exactly 1, other 0)`);
  }
}

// ---------------------------------------------------------------------------
// 7. Where the spree was held (§30.2)
// ---------------------------------------------------------------------------
head('7. THE SPREE, AND WHOSE ROOF IT WAS UNDER');
{
  const { gazetteFor } = await import('../src/engine/news');
  const { estateWeek } = await import('../src/engine/estate');
  for (const where of ['fields-town', 'snakey-gully'] as const) {
    let s = fresh();
    s.day = 140;
    s.estate.shamrock = true;
    s.location = where;
    s.screen = where === 'fields-town' ? 'ftown-hotel' : 'camp-grog';
    s = press(s, 'The spree');
    console.log(`  spree at ${where}: flushUntil=${s.estate.flushUntilDay} houseSpreeOn=${s.estate.houseSpreeOn}`);
    console.log(`   PAPER: ${gazetteFor(s).filter((l) => l.startsWith('TOWN TALK')).join(' ') || '(nothing)'}`);
    const r = makeRng(4242);
    const log = new Log(r);
    const before = s.moneyPence;
    s.day = 147;
    estateWeek(s, r, log);
    console.log(`   Sunday takings: ${formatMoney(s.moneyPence - before)} (plain week on this seed is £4 3s 9d)`);
  }
}

sink = fresh();
void sink;
console.log('\ndone.');
