// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/ui/app';
import { MenuController } from '../src/ui/menu';

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

  it('keeps an overflowing two-column menu inside its vertical scroll budget', () => {
    const host = document.createElement('nav');
    const menu = new MenuController([
      { key: '1', label: 'First', note: 'A touch row carries this description.', onSelect: () => {} },
      { key: '2', label: 'Second', onSelect: () => {} },
      { key: '3', label: 'Third', onSelect: () => {} },
      { key: '0', label: 'Back', onSelect: () => {} },
    ]);
    menu.render(host);
    Object.defineProperty(host, 'scrollHeight', { configurable: true, value: 500 });
    const originalGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: () => ({
        getPropertyValue: () => '2',
      }) as unknown as CSSStyleDeclaration,
    });

    menu.fitColumns(100);

    expect(host.classList.contains('gf-menu--dense')).toBe(true);
    expect(host.style.maxHeight).toBe('100px');
    expect(host.style.getPropertyValue('--gf-menu-rows')).toBe('2');
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: originalGetComputedStyle,
    });
  });
});
