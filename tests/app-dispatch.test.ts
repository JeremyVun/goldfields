// @vitest-environment happy-dom

/**
 * The one rule the frame's dispatch must not be able to break: a tale is read
 * at the player's pace, but the state it produced is the world. The menu opens
 * over the top of a telling, and anything done from it must land on the state
 * the tale had already made — never on the world as it stood before the
 * digging (src/ui/dispatch.ts).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/ui/app';
import { Session } from '../src/ui/dispatch';
import { getView } from '../src/engine/menus';
import { step } from '../src/engine/reduce';
import { makeRng } from '../src/engine/rng';
import { defaultStore, loadGame, saveGame, tryLoadGame } from '../src/engine/save';
import { createInitialState } from '../src/engine/state';
import type { Action, GameState } from '../src/engine/types';

const apps: App[] = [];
const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key); },
  setItem: (key, value) => { values.set(key, String(value)); },
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});

afterEach(() => {
  for (const app of apps.splice(0)) app.destroy();
  storage.clear();
  document.body.innerHTML = '';
});

function mount(): HTMLElement {
  document.body.innerHTML = '<div id="screen" role="application" tabindex="0"></div>';
  const root = document.getElementById('screen') as HTMLElement;
  const app = new App(root);
  apps.push(app);
  app.start();
  return root;
}

/** A licensed digger standing at the shaft, being asked how he means to work. */
function digger(seed = 7): GameState {
  const state = createInitialState(seed);
  state.day = 40;
  state.location = 'damp-camp';
  state.screen = 'camp-mine';
  state.licenceUntilDay = state.day + 20;
  state.items = { ...state.items, pan: 1, shovel: 1, pick: 1, ropeBucket: 1, cradle: 1 };
  return state;
}

function buttons(scope: ParentNode): HTMLButtonElement[] {
  return [...scope.querySelectorAll<HTMLButtonElement>('.gf-menu-item')];
}

function press(root: HTMLElement, key: string): void {
  root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** Is a tale on the glass just now? */
function telling(root: HTMLElement): boolean {
  return !!root.querySelector('.gf-prompt');
}

/** Read a tale out to its end, so the state behind it is set down. */
function readOut(root: HTMLElement): void {
  for (let i = 0; i < 40 && telling(root); i++) press(root, ' ');
  expect(telling(root)).toBe(false);
}

function click(rows: HTMLButtonElement[], match: RegExp): void {
  const row = rows.find((b) => match.test(b.textContent ?? ''));
  if (!row) throw new Error(`no menu row matching ${match} in: ${rows.map((b) => b.textContent).join(' | ')}`);
  row.click();
}

describe('the session, on its own', () => {
  const world = (gold: number): GameState => ({ ...createInitialState(3), goldCentiOz: gold });
  const word = (text: string) => ({ id: text, text, tone: 'neutral' as const });

  it('holds a tale\'s state back until the last page is turned', () => {
    const session = new Session(world(0));
    // A 'title' event takes a page of its own, so this is a two-page tale.
    session.show({ state: world(5), events: [word('a'), { id: 'b', text: 'b', tone: 'title' }] });
    expect(session.shown.goldCentiOz).toBe(0); // the backdrop is the old world
    expect(session.live.goldCentiOz).toBe(5); // the menu sees the fresh one
    expect(session.telling).toBe(true);
    expect(session.advance()).toBe(true);
    expect(session.advance()).toBe(false);
    expect(session.shown.goldCentiOz).toBe(5);
    expect(session.telling).toBe(false);
  });

  it('sets a part-told tale down before it steps the world', () => {
    const session = new Session(world(0));
    session.show({ state: world(5), events: [word('digging')] });
    // Any action at all, taken while the tale is on the glass.
    session.act({ type: 'continue' }, makeRng(1));
    expect(session.shown.goldCentiOz).toBe(5);
    expect(session.telling).toBe(false);
  });

  it('sets a part-told tale down before a fresh one takes the glass', () => {
    const session = new Session(world(0));
    session.show({ state: world(5), events: [word('digging')] });
    session.show({ state: world(9), events: [word('and afterwards')] });
    expect(session.shown.goldCentiOz).toBe(5);
    expect(session.live.goldCentiOz).toBe(9);
  });

  it('sets a part-told tale down before the frame says a word of its own', () => {
    const session = new Session(world(0));
    session.show({ state: world(5), events: [word('digging')] });
    session.remark([word('the game was not saved')]);
    expect(session.shown.goldCentiOz).toBe(5);
    expect(session.live.goldCentiOz).toBe(5);
    expect(session.page?.[0]?.text).toBe('the game was not saved');
  });

  it('tells the frame what screen it is coming from and going to', () => {
    const seen: string[] = [];
    const session = new Session(world(0), (prev, next) => seen.push(`${prev.screen}>${next.screen}`));
    session.show({ state: { ...world(1), screen: 'journal' }, events: [] });
    session.show({ state: { ...world(1), screen: 'camp' }, events: [] });
    expect(seen).toEqual(['title>journal', 'journal>camp']);
  });
});

describe('the frame\'s dispatch (mid-narration commits)', () => {
  it('applies an action taken mid-tale to the state the tale produced', () => {
    // A saved digger to take up, and the very same year worked out by hand, so
    // that what the frame does can be held against what the engine would do.
    const id = saveGame(digger(), defaultStore());
    const onDisk = loadGame(id, defaultStore()) as GameState;
    const resumed = step(onDisk, { type: 'resume', state: onDisk }, makeRng(1)).state;

    const method = getView(resumed).menu.find((m) => m.action.type === 'mine' && !m.disabled);
    expect(method, 'the digger must be offered some way of working').toBeTruthy();
    const worked = step(resumed, method!.action, makeRng(1)).state;
    // The spell must be worth something, or the invariant has nothing to lose,
    // and it must not end on an encounter, which would swallow the save.
    expect(worked.goldCentiOz).toBeGreaterThan(resumed.goldCentiOz);
    expect(worked.pending).toBeNull();

    const root = mount();
    click(buttons(root), /Continue last game/);
    readOut(root);

    // The spell of digging, and its tale left part-told on the glass.
    click(buttons(root), new RegExp(method!.label));
    expect(telling(root)).toBe(true);

    // The menu, opened over the telling, and the game saved from it.
    press(root, 'Escape');
    const overlay = root.querySelector('.gf-overlay-layer') as HTMLElement;
    click(buttons(overlay), /Save the game/);
    readOut(root);

    // What was written down is the digger with his gold, not the man he was
    // before he picked up the shovel.
    const persisted = tryLoadGame(id, defaultStore());
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.goldCentiOz).toBe(worked.goldCentiOz);
    expect(persisted.value.day).toBe(worked.day);
  });

  it('steps the engine once for one action, dice and all', () => {
    // Twice-stepping would advance the world twice over: the engine carries its
    // own dice in the state. One action, one day's worth of change.
    const id = saveGame(digger(11), defaultStore());
    const onDisk = loadGame(id, defaultStore()) as GameState;
    const resumed = step(onDisk, { type: 'resume', state: onDisk }, makeRng(1)).state;
    const method = getView(resumed).menu.find((m) => m.action.type === 'mine' && !m.disabled);
    const worked = step(resumed, method!.action as Action, makeRng(1)).state;

    const root = mount();
    click(buttons(root), /Continue last game/);
    readOut(root);
    click(buttons(root), new RegExp(method!.label));
    readOut(root);

    press(root, 'Escape');
    const overlay = root.querySelector('.gf-overlay-layer') as HTMLElement;
    click(buttons(overlay), /Save the game/);
    readOut(root);

    const persisted = tryLoadGame(id, defaultStore());
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.day).toBe(worked.day);
    expect(persisted.value.rngState).toBe(worked.rngState);
  });

  it('keeps a part-told tale\'s state when the frame itself cannot save', () => {
    // The storage failure is the frame's own mishap, not the engine's, and it
    // must not cost a morning's work either.
    const id = saveGame(digger(), defaultStore());
    const onDisk = loadGame(id, defaultStore()) as GameState;
    const resumed = step(onDisk, { type: 'resume', state: onDisk }, makeRng(1)).state;
    const method = getView(resumed).menu.find((m) => m.action.type === 'mine' && !m.disabled);
    const worked = step(resumed, method!.action, makeRng(1)).state;

    const root = mount();
    click(buttons(root), /Continue last game/);
    readOut(root);
    click(buttons(root), new RegExp(method!.label));
    expect(telling(root)).toBe(true);

    // The shelf gives way just as the menu is opened over the telling.
    const setItem = storage.setItem;
    storage.setItem = () => { throw new Error('the shelf is full'); };
    press(root, 'Escape');
    const overlay = root.querySelector('.gf-overlay-layer') as HTMLElement;
    click(buttons(overlay), /Save the game/);
    expect(root.querySelector('.gf-body')?.textContent).toMatch(/was not saved/i);
    storage.setItem = setItem;
    readOut(root);

    // The gold is still the digger's, and the game carries on from it.
    press(root, 'Escape');
    const menu = root.querySelector('.gf-overlay-layer') as HTMLElement;
    click(buttons(menu), /Save the game/);
    readOut(root);
    const persisted = tryLoadGame(id, defaultStore());
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.goldCentiOz).toBe(worked.goldCentiOz);
  });
});
