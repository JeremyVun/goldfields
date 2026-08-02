/**
 * A menu-driven player. Everything goes through getView()'s menu exactly as a
 * human at the keyboard would, so unreachable options and softlocks show up.
 */
import { makeRng, type RNG } from '../src/engine/rng';
import { createInitialState } from '../src/engine/state';
import { step } from '../src/engine/reduce';
import { getView, menuView } from '../src/engine/menus';
import type { Action, GameState, MenuItem, NarrationEvent } from '../src/engine/types';

export interface Player {
  state: GameState;
  rng: RNG;
  log: string[];
  trace: string[];
  verbose: boolean;
}

export function newPlayer(seed: number, verbose = false): Player {
  return { state: createInitialState(seed), rng: makeRng(seed), log: [], trace: [], verbose };
}

export function view(p: Player) {
  return getView(p.state);
}

export function menuKeys(p: Player): string[] {
  return view(p).menu.filter((m) => !m.disabled).map((m) => m.key);
}

export function describe(p: Player): string {
  const v = view(p);
  return `[${v.screen}] ${v.title} :: ${v.menu.map((m) => `${m.key}${m.disabled ? '*' : ''}=${m.label}`).join(' | ')}`;
}

export function dispatch(p: Player, action: Action): NarrationEvent[] {
  const r = step(p.state, action, p.rng);
  p.state = r.state;
  for (const e of r.events) p.log.push(e.text);
  if (p.verbose) for (const e of r.events) console.log(`    · ${e.text}`);
  return r.events;
}

/** Press a menu key on the current screen. Throws if the key is not offered. */
export function press(p: Player, key: string): NarrationEvent[] {
  const v = view(p);
  const m = v.menu.find((x) => x.key.toUpperCase() === key.toUpperCase());
  if (!m) throw new Error(`key "${key}" not on ${v.screen} (${v.title}); have ${v.menu.map((x) => x.key).join(',')}`);
  if (m.disabled) throw new Error(`key "${key}" (${m.label}) is disabled on ${v.screen}`);
  p.trace.push(`${v.screen}:${key}:${m.label}`);
  if (p.verbose) console.log(`>> ${v.screen} [${key}] ${m.label}`);
  return dispatch(p, m.action);
}

/** Press a key by matching a label substring. */
export function pressLabel(p: Player, needle: string): NarrationEvent[] {
  const v = view(p);
  const m = v.menu.find((x) => x.label.toLowerCase().includes(needle.toLowerCase()));
  if (!m) throw new Error(`no menu item matching "${needle}" on ${v.screen}: ${v.menu.map((x) => x.label).join(' | ')}`);
  if (m.disabled) throw new Error(`"${m.label}" is disabled on ${v.screen} (note: ${m.note})`);
  p.trace.push(`${v.screen}:${m.key}:${m.label}`);
  if (p.verbose) console.log(`>> ${v.screen} [${m.key}] ${m.label}`);
  return dispatch(p, m.action);
}

export function has(p: Player, needle: string): MenuItem | undefined {
  return view(p).menu.find((x) => x.label.toLowerCase().includes(needle.toLowerCase()));
}

export function kittyPress(p: Player, key: string): NarrationEvent[] {
  const v = menuView(p.state);
  const m = v.menu.find((x) => x.key.toUpperCase() === key.toUpperCase());
  if (!m) throw new Error(`kitty has no key ${key}`);
  if (m.disabled) throw new Error(`kitty key ${key} disabled`);
  return dispatch(p, m.action);
}

/** Get to Port Gannet from a cold start. */
export function begin(p: Player, seed?: number): void {
  dispatch(p, { type: 'newGame', seed: seed ?? p.state.seed });
  dispatch(p, { type: 'continue' });
}

export function invariants(p: Player, where: string): string[] {
  const s = p.state;
  const bad: string[] = [];
  if (s.moneyPence < 0) bad.push(`${where}: negative money ${s.moneyPence}`);
  if (s.bankPence < 0) bad.push(`${where}: negative bank ${s.bankPence}`);
  if (s.goldCentiOz < 0) bad.push(`${where}: negative gold ${s.goldCentiOz}`);
  if (s.health < 0 || s.health > 100) bad.push(`${where}: health ${s.health}`);
  if (s.provisionDays < 0) bad.push(`${where}: provisions ${s.provisionDays}`);
  if (s.waterDays < 0) bad.push(`${where}: water ${s.waterDays}`);
  if (s.shares < 0 || s.shares > 3) bad.push(`${where}: shares ${s.shares}`);
  if (s.day < 1) bad.push(`${where}: day ${s.day}`);
  for (const [k, n] of Object.entries(s.items)) if (n < 0) bad.push(`${where}: items.${k}=${n}`);
  if (!s.gameOver && !s.endOfYear) {
    const v = getView(s);
    if (v.menu.length === 0) bad.push(`${where}: screen ${v.screen} has no menu`);
    else if (v.menu.every((m) => m.disabled) && !v.input) bad.push(`${where}: screen ${v.screen} wholly disabled — softlock`);
  }
  for (const line of p.log.slice(-40)) {
    if (/\[[a-z]+\.[a-zA-Z.]+\]/.test(line)) bad.push(`${where}: missing text key in "${line}"`);
    if (/undefined|NaN|Infinity|\[object/.test(line)) bad.push(`${where}: bad interpolation "${line}"`);
  }
  return bad;
}
