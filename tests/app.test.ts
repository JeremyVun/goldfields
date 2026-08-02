// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/ui/app';
import { MenuController } from '../src/ui/menu';
import { paragraphsOf } from '../src/ui/narration';

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

function mount(): { app: App; root: HTMLElement } {
  document.body.innerHTML = '<div id="screen" role="application" tabindex="0"></div>';
  const root = document.getElementById('screen') as HTMLElement;
  const app = new App(root);
  apps.push(app);
  app.start();
  return { app, root };
}

afterEach(() => {
  for (const app of apps.splice(0)) app.destroy();
  storage.clear();
  document.body.innerHTML = '';
});

describe('browser application', () => {
  it('renders the title as native, focusable menu buttons', () => {
    const { root } = mount();
    expect(root.querySelector('.gf-title')?.textContent).toBe('GOLDRUSH');
    const button = root.querySelector('.gf-menu-item');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button?.getAttribute('tabindex')).toBe('0');
    expect(button?.getAttribute('aria-current')).toBe('true');
  });

  it.each(['0', 'Escape'])('closes the game-menu dialog with %s without leaving the current screen', (key) => {
    const { root } = mount();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const overlay = root.querySelector('.gf-overlay-layer') as HTMLElement;
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect((root.querySelector('.gf-frame') as HTMLElement).inert).toBe(true);

    root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(overlay.getAttribute('role')).toBeNull();
    expect((root.querySelector('.gf-frame') as HTMLElement).inert).toBe(false);
    expect(root.querySelector('.gf-title')?.textContent).toBe('GOLDRUSH');
    expect(document.activeElement).toBe(root);
  });

  it('makes the pointer return row a UI close command, preserving the current screen', () => {
    const { root } = mount();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const overlay = root.querySelector('.gf-overlay-layer') as HTMLElement;
    const returnButton = [...overlay.querySelectorAll<HTMLButtonElement>('.gf-menu-item')]
      .find((button) => /return to/i.test(button.textContent ?? ''));
    expect(returnButton).toBeDefined();
    returnButton?.click();
    expect(root.querySelector('.gf-overlay-layer')?.getAttribute('role')).toBeNull();
    expect(root.querySelector('.gf-title')?.textContent).toBe('GOLDRUSH');
  });

  it('still renders when access to browser storage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    const { root } = mount();
    expect(root.querySelector('.gf-title')?.textContent).toBe('GOLDRUSH');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  });

  it('budgets a long menu from its pane when the ledger is stacked above it', () => {
    const { app, root } = mount();
    const content = root.querySelector('.gf-content') as HTMLElement;
    const main = root.querySelector('.gf-main') as HTMLElement;
    const body = root.querySelector('.gf-body') as HTMLElement;
    const menu = root.querySelector('.gf-menu') as HTMLElement;
    Object.defineProperties(content, { clientHeight: { configurable: true, value: 300 } });
    Object.defineProperties(main, { clientHeight: { configurable: true, value: 800 } });
    Object.defineProperties(body, { scrollHeight: { configurable: true, value: 100 } });
    Object.defineProperties(menu, { scrollHeight: { configurable: true, value: 500 } });

    (app as unknown as { fitMenu(): void }).fitMenu();

    expect(menu.style.maxHeight).toBe('190px');
  });
});

/**
 * A narration event is one unit for paging, but its author may have set a
 * blank line in the middle of it. Given one <p> for the whole event the
 * browser collapses that break and prints a wall of text.
 */
describe('narration paragraphs', () => {
  it('breaks a passage on its blank lines and trims the seams', () => {
    expect(paragraphsOf('First.\n\nSecond.\n\nThird.')).toEqual(['First.', 'Second.', 'Third.']);
    expect(paragraphsOf('First.  \n \n  Second.')).toEqual(['First.', 'Second.']);
  });

  it('leaves a single paragraph, blank line or none, exactly as it stands', () => {
    expect(paragraphsOf('One line only.')).toEqual(['One line only.']);
    expect(paragraphsOf('A line\nwrapped by hand.')).toEqual(['A line\nwrapped by hand.']);
    expect(paragraphsOf(' ')).toEqual([' ']);
  });

  it('sets the arrival passage as several paragraphs on the glass', () => {
    const { root } = mount();
    (root.querySelector('.gf-menu-item') as HTMLButtonElement).click();
    const paras = [...root.querySelectorAll<HTMLElement>('.gf-body .gf-para')];
    expect(paras.length).toBeGreaterThan(1);
    for (const para of paras) {
      expect(para.textContent).not.toMatch(/\n/);
      expect(para.className).toContain('gf-tone-');
    }
  });
});

describe('menu controller', () => {
  it('exposes disabled state and moves the roving tab stop', () => {
    const host = document.createElement('nav');
    const selected: string[] = [];
    const menu = new MenuController([
      { key: '1', label: 'First', onSelect: () => selected.push('first') },
      { key: '2', label: 'Unavailable', disabled: true, onSelect: () => selected.push('bad') },
      { key: '3', label: 'Third', onSelect: () => selected.push('third') },
    ]);
    menu.render(host);
    const rows = host.querySelectorAll<HTMLButtonElement>('button');
    expect(rows[1].disabled).toBe(true);
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');
    menu.handleKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(rows[2].getAttribute('tabindex')).toBe('0');
    menu.handleKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(selected).toEqual(['third']);
  });

  /** A menu of four, overflowing whatever budget it is given. */
  function overflowingMenu(width: number): { host: HTMLElement; menu: MenuController } {
    const host = document.createElement('nav');
    const menu = new MenuController([
      { key: '1', label: 'First', note: 'A touch row carries this description.', onSelect: () => {} },
      { key: '2', label: 'Second', onSelect: () => {} },
      { key: '3', label: 'Third', onSelect: () => {} },
      { key: '0', label: 'Back', onSelect: () => {} },
    ]);
    menu.render(host);
    Object.defineProperty(host, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: width });
    return { host, menu };
  }

  /** Stand in for the stylesheet's answer on how many columns this width bears. */
  function withStyleColumns<T>(columns: string, run: () => T): T {
    const original = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: () => ({ getPropertyValue: () => columns }) as unknown as CSSStyleDeclaration,
    });
    try {
      return run();
    } finally {
      Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: original });
    }
  }

  it('deals an overflowing menu into two boxes inside its vertical scroll budget', () => {
    const { host, menu } = overflowingMenu(900);

    withStyleColumns('2', () => menu.fitColumns(100));

    expect(host.classList.contains('gf-menu--dense')).toBe(true);
    expect(host.style.maxHeight).toBe('100px');
    // Two boxes of their own, each keeping its rows' heights — not one grid,
    // whose shared rows are squeezed flat by the cap and print over each other.
    const columns = [...host.querySelectorAll('.gf-menu-col')];
    expect(columns).toHaveLength(2);
    const labels = columns.map((c) =>
      [...c.querySelectorAll('.gf-menu-label')].map((l) => l.textContent),
    );
    expect(labels).toEqual([['First', 'Second'], ['Third', 'Back']]);
  });

  it('keeps one column where the stylesheet says the glass is too narrow', () => {
    const { host, menu } = overflowingMenu(900);

    withStyleColumns('1', () => menu.fitColumns(100));

    expect(host.classList.contains('gf-menu--dense')).toBe(false);
    expect(host.querySelectorAll('.gf-menu-col')).toHaveLength(0);
    // Still bounded, so what will not fit is scrolled to rather than shouldering
    // the prose off the top of the pane.
    expect(host.style.maxHeight).toBe('100px');
  });

  it('keeps one column where the box itself is narrow, wide glass or no', () => {
    // A ledger standing beside the counter takes a third of the frame with it:
    // the stylesheet may allow two columns while this box cannot hold them.
    const { host, menu } = overflowingMenu(420);

    withStyleColumns('2', () => menu.fitColumns(100));

    expect(host.classList.contains('gf-menu--dense')).toBe(false);
  });

  it('lays the columns back into one when the glass grows and the menu fits', () => {
    const { host, menu } = overflowingMenu(900);
    withStyleColumns('2', () => menu.fitColumns(100));
    expect(host.classList.contains('gf-menu--dense')).toBe(true);

    // The window is dragged wider: the menu now fits in one honest column, and
    // nothing of the two-column layout may be left behind.
    withStyleColumns('2', () => menu.fitColumns(600));

    expect(host.classList.contains('gf-menu--dense')).toBe(false);
    expect(host.querySelectorAll('.gf-menu-col')).toHaveLength(0);
    expect(host.style.maxHeight).toBe('');
    expect([...host.querySelectorAll('.gf-menu-label')].map((l) => l.textContent)).toEqual([
      'First',
      'Second',
      'Third',
      'Back',
    ]);
  });
});
