/**
 * A throwaway looking-glass: renders the map, the reckoning and a bail-up so a
 * human can read them at 80 columns. Not an assertion suite.
 */
import { it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { buildMap } from '../src/ui/map';
import { endView, getView, menuView, mapView } from '../src/engine/menus';
import { statusLine } from '../src/engine/state';
import type { GameState, OutlawEnd } from '../src/engine/types';
import { makeRng } from '../src/engine/rng';
import { lurk, resolveBailUp } from '../src/engine/bandit';
import { Log } from '../src/engine/narrate';
import { illnessVars } from '../src/engine/health';

function rule(s: string) {
  console.log('\n' + '='.repeat(80) + '\n' + s + '\n' + '='.repeat(80));
}

function outlaw(over: Partial<GameState> = {}): GameState {
  const s = createInitialState(4242);
  s.day = 318;
  s.location = 'hideout';
  s.moneyPence = 12_437;
  s.bankPence = 0;
  s.goldCentiOz = 940;
  s.notoriety = 72;
  s.outlawed = true;
  s.legal = 'wanted criminal';
  s.heat = { trickeys: 64, pass: 31, town: 48, camps: 22 };
  s.hideout = { stashPence: 128_400, stashCentiOz: 3120, discovered: false, madeOn: 190 };
  s.gang = [
    { name: 'Long Bill Foy', joined: 214, loyaltyFrac: 0.8 },
    { name: 'Mick the Cobbler', joined: 256, loyaltyFrac: 0.4 },
  ];
  s.diggersRobbed = 0;
  s.bigJobsDone = 2;
  s.stats.bailUps = 14;
  s.stats.bigJobs = 3;
  s.stats.takings = 240_000;
  s.stats.goldWon = 1200;
  s.stats.daysDug = 40;
  s.stats.daysWorked = 12;
  s.skill.bush = 95;
  s.health = 64;
  s.intel = { kind: 'traveller', learnedOn: 316, untilDay: 321, route: 'pass' };
  s.worthHistory = Array.from({ length: 45 }, (_, i) => 500 + i * i * 40);
  Object.assign(s, over);
  return s;
}

function widths(lines: string[], label: string) {
  const over = lines.filter((l) => l.length > 80);
  console.log(`— ${label}: ${lines.length} lines, widest ${Math.max(...lines.map((l) => l.length))}` +
    (over.length ? ` — ${over.length} OVER 80` : ''));
  for (const l of over) console.log(`   !! ${l.length}: ${l}`);
}

it('looks', () => {
  const s = outlaw();
  rule('MAP — hideout, wanted, intel on the Pass Road');
  console.log(buildMap(s).words.join(' | '));
  console.log(mapView(s).body.join('\n'));

  rule('MAP — before he has a hideout, no reward');
  const clean = createInitialState(7);
  clean.day = 40;
  clean.claims['damp-camp'] = { camp: 'damp-camp', richnessPct: 90, workedDays: 2, pegged: 10, proven: false } as never;
  console.log(buildMap(clean).words.join(' | '));

  rule('STATUS LINES');
  for (const st of [clean, s, outlaw({ location: 'damp-camp', notoriety: 100, moneyPence: 960_239, goldCentiOz: 12_345, health: 15 })]) {
    const line = statusLine(st);
    console.log(`${String(line.length).padStart(3)}  ${line}`);
  }

  rule('KITTY');
  const k = menuView(s);
  console.log(k.body.join('\n'));
  widths(k.body, 'kitty');

  for (const end of ['hanged', 'hulks', 'california', 'pardoned', 'at large'] as OutlawEnd[]) {
    rule(`THE RECKONING — ${end}`);
    const st = outlaw({ outlawEnd: end, gameOver: end === 'hanged' ? 'dead' : 'finished' });
    if (end === 'hanged') st.causeOfDeath = 'hanged at the Fields Town assizes';
    if (end === 'pardoned') {
      st.outlawed = false;
      st.hideout = { ...st.hideout!, stashPence: 0, stashCentiOz: 0 };
    }
    const v = endView(st);
    console.log(v.body.join('\n'));
    widths(v.body, 'end');
  }

  rule('OBITUARY — hanged with a stash left behind');
  const dead = outlaw({ outlawEnd: 'hanged', gameOver: 'dead', screen: 'obituary' });
  dead.causeOfDeath = 'hanged at the Fields Town assizes';
  console.log(getView(dead).body.join('\n'));

  rule('ILLNESS LINES (the article bug)');
  {
    const rng2 = makeRng(3);
    const ids = ['dysentery', 'sandyBlight', 'fever', 'injury', 'snakebite', 'exhaustion'] as const;
    for (const id of ids) {
      const log = new Log(rng2);
      log.say('ill.recover', illnessVars(id), 'good');
      log.say('ill.worse', illnessVars(id), 'bad');
      log.say('ill.persists', illnessVars(id), 'bad');
      for (const e of log.events) console.log(`  ${e.text}`);
    }
  }

  for (const scr of ['bandit', 'bandit-roads', 'hideout', 'stash', 'gang'] as const) {
    rule(`SCREEN — ${scr}`);
    const v = getView({ ...s, screen: scr as never });
    console.log(v.title + (v.subtitle ? ` | ${v.subtitle}` : ''));
    console.log(v.body.join('\n'));
    console.log(v.menu.map((m) => `  ${m.key}.${m.disabled ? '*' : ''} ${m.label}${m.note ? ' — ' + m.note : ''}`).join('\n'));
  }

  rule('A BAIL-UP');
  const rng = makeRng(99);
  const b = outlaw({ location: 'on-road' });
  for (let i = 0; i < 10; i++) {
    const log = new Log(rng);
    const out = lurk(b, rng, log, 'trickeys');
    console.log(`\n--- a day above Trickey's Track: ${out} ---`);
    for (const e of log.events) console.log(e.text);
    if (out === 'victim') {
      const enc = getView({ ...b, screen: 'encounter' });
      console.log('\n' + enc.title);
      console.log(enc.body.join('\n'));
      console.log(enc.menu.map((m) => `  ${m.key}. ${m.label}${m.note ? ' — ' + m.note : ''}`).join('\n'));
      const after = new Log(rng);
      const st = { ...b };
      resolveBailUp(st, rng, after, 'take');
      console.log('\n> deliver');
      for (const e of after.events) console.log(e.text);
    }
    b.pending = null;
  }
});
