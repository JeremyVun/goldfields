import { makeRng, randomSeed, type RNG } from '../engine/rng';
import { createInitialState, statusLine } from '../engine/state';
import { step } from '../engine/reduce';
import { getView, menuView, mapView, MENU_LETTERS } from '../engine/menus';
import {
  allocateSaveId,
  defaultStore,
  tryLastGameId,
  tryLoadGame,
  trySaveGame,
} from '../engine/save';
import type { Action, AsidePanel, GameState, NarrationEvent, ViewPanel } from '../engine/types';
import type { JournalSection } from '../content/journal';

import { el, clear } from './dom';
import { MenuController, type UIMenuItem } from './menu';
import { pageEvents } from './narration';
import { forTouch, isTouch, onInputModeChange } from './phrasing';
import { cycleTheme, currentTheme, loadTheme } from './theme';

/**
 * One entry in the quiet legend at the foot of the glass. Where it carries an
 * `act` it is not merely a legend but the control itself — which is the only
 * way the menu and the map can be reached at all on a screen with no keys.
 */
interface LegendPart {
  keys: string;
  what: string;
  act?: () => void;
}

/**
 * The flavour of whatever sits under the marker. The line keeps its height
 * whether or not it has anything to say, so that the menu beneath it does not
 * jump a row every time the player moves the marker.
 */
function setInspectorText(elem: HTMLElement, note: string | null): void {
  elem.textContent = note ?? '';
  elem.classList.toggle('is-empty', !note);
}

type Overlay = 'menu' | 'map' | null;

interface JournalState {
  mode: 'list' | 'read';
  sectionIndex: number;
  pageIndex: number;
}

/** The browser presentation layer for Goldrush. The engine underneath is never mutated by hand. */
export class App {
  private readonly root: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly mainEl: HTMLElement;
  private readonly asideEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly inputEl: HTMLElement;
  private readonly inspectorEl: HTMLElement;
  private readonly menuEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly statusLineEl: HTMLElement;
  private readonly legendEl: HTMLElement;
  private readonly overlayEl: HTMLElement;

  private readonly rng: RNG;
  private state: GameState;

  private pendingState: GameState | null = null;
  private narrationPages: NarrationEvent[][] | null = null;
  private narrationIndex = 0;

  private activeMenu: MenuController | null = null;
  private overlayMenu: MenuController | null = null;
  private overlay: Overlay = null;

  private journalState: JournalState | null = null;
  private journalSections: JournalSection[] | null = null;
  private mapBuilder: typeof import('./map').buildMap | null = null;

  private textInput = false;
  private inputBuffer = '';
  private inputError: string | null = null;

  private readonly onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e);
  private readonly onViewportChange = (): void => this.fitMenu();
  private readonly onInputMode = (): void => this.render();
  private readonly onOverlayBackdrop = (e: MouseEvent): void => {
    if (e.target === this.overlayEl) this.closeOverlay();
  };
  private readonly stopInputModeWatch: () => void;

  /** Where the frame stood when the player last acted, so that returning to
   *  the same screen (after a purchase, say) does not throw them to the top. */
  private savedScroll: { screen: string; top: number } | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    const seed = randomSeed();
    this.rng = makeRng(seed);
    this.state = createInitialState(seed);

    loadTheme();
    clear(this.root);

    this.titleEl = el('h1', { className: 'gf-title' });
    this.subtitleEl = el('p', { className: 'gf-subtitle' });
    const rule = el('div', { className: 'gf-rule', attrs: { 'aria-hidden': 'true' } });
    const header = el('header', { className: 'gf-header' }, [this.titleEl, this.subtitleEl, rule]);

    this.bodyEl = el('div', { className: 'gf-body' });
    this.inputEl = el('div', { className: 'gf-input' });
    this.inspectorEl = el('p', {
      className: 'gf-inspector',
      attrs: { 'aria-live': 'polite' },
    });
    this.menuEl = el('nav', { className: 'gf-menu', attrs: { 'aria-label': 'menu' } });
    this.asideEl = el('aside', { className: 'gf-aside' });

    // Only the prose scrolls. The menu is the part a player must reach, so it
    // is never allowed to fall off the bottom of the screen.
    this.contentEl = el('div', { className: 'gf-content' }, [
      this.bodyEl,
      this.inputEl,
      this.inspectorEl,
      this.menuEl,
    ]);
    this.mainEl = el('div', { className: 'gf-main' }, [this.asideEl, this.contentEl]);

    this.frame = el('div', { className: 'gf-frame' }, [header, this.mainEl]);
    this.statusLineEl = el('span', { className: 'gf-status-line' });
    this.legendEl = el('span', { className: 'gf-legend' });
    this.statusEl = el('div', { className: 'gf-status' }, [this.statusLineEl, this.legendEl]);
    this.overlayEl = el('div', { className: 'gf-overlay-layer', attrs: { style: 'display:none' } });

    this.root.append(this.frame, this.statusEl, this.overlayEl);

    this.root.addEventListener('keydown', this.onKeyDown);
    // How many columns a menu needs depends on the room there is for it.
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('orientationchange', this.onViewportChange);
    // A soft keypad rising over the glass shortens it without a resize event
    // of the ordinary kind.
    window.visualViewport?.addEventListener('resize', this.onViewportChange);
    // A keyboard folded on or off a tablet changes how the frame must speak:
    // whether the flavour belongs in the rows, and whether the menu and the
    // map need buttons of their own.
    this.stopInputModeWatch = onInputModeChange(this.onInputMode);
    this.overlayEl.addEventListener('click', this.onOverlayBackdrop);
  }

  start(): void {
    // A door for the screenshot harnesses in scratch/, and only in dev: they
    // need to photograph screens that would take an hour of play to reach.
    if (import.meta.env.DEV) window.__gf = { app: this, createInitialState };
    this.render();
  }

  /** Release the global listeners so an embedded or tested cabinet can be remounted safely. */
  destroy(): void {
    this.root.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('orientationchange', this.onViewportChange);
    window.visualViewport?.removeEventListener('resize', this.onViewportChange);
    this.stopInputModeWatch();
    this.overlayEl.removeEventListener('click', this.onOverlayBackdrop);
    if (window.__gf?.app === this) delete window.__gf;
  }

  // -------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------

  private dispatch(action: Action, opts?: { fromOverlay?: boolean }): void {
    this.savedScroll = { screen: this.state.screen, top: this.bodyEl.scrollTop };
    if (opts?.fromOverlay) this.closeOverlay();

    // The menu opens at any time, narration or no. If the player acts from it
    // while a tale is still being told, the state that tale produced must be
    // committed first — otherwise a whole spell of digging is thrown away and
    // the action is applied to the state as it stood before it.
    this.flushNarration();

    // A fresh game must get a fresh seed, or "begin again" would replay the
    // very same year, move for move.
    let normalised: Action =
      action.type === 'newGame' ? { type: 'newGame', seed: randomSeed() } : action;
    const store = defaultStore();
    if (normalised.type === 'save' && !this.state.gameId) {
      const allocated = allocateSaveId(store);
      if (!allocated.ok) {
        this.showStorageFailure(allocated.error.message);
        return;
      }
      normalised = { type: 'save', id: allocated.value };
    }

    try {
      const result = step(this.state, normalised, this.rng);

      if (normalised.type === 'save') {
        const saved = trySaveGame(result.state, store);
        if (!saved.ok) {
          this.showStorageFailure(saved.error.message);
          return;
        }
      }

      if (result.events.length > 0) {
        this.pendingState = result.state;
        this.narrationPages = pageEvents(result.events);
        this.narrationIndex = 0;
        this.renderNarration();
      } else {
        this.applyState(result.state);
        this.render();
      }
    } catch (err) {
      // Never let an exception blank the screen.
      console.error('goldrush: step failed', err);
      this.pendingState = null;
      this.narrationPages = [
        [
          {
            id: 'mishap',
            text: 'Something has gone amiss in the telling of it. No harm done — you carry on as before.',
            tone: 'bad',
          },
        ],
      ];
      this.narrationIndex = 0;
      this.renderNarration();
    }
  }

  private showStorageFailure(message: string): void {
    this.pendingState = null;
    this.narrationPages = [[{
      id: 'storage-failure',
      text: `The game was not saved. ${message}`,
      tone: 'bad',
    }]];
    this.narrationIndex = 0;
    this.renderNarration();
  }

  /** Commit any narration still being paged through, and drop the pages. */
  private flushNarration(): void {
    if (this.pendingState) {
      this.applyState(this.pendingState);
      this.pendingState = null;
    }
    this.narrationPages = null;
    this.narrationIndex = 0;
  }

  private applyState(newState: GameState): void {
    const wasResume = this.state.screen === 'resume';
    const isResume = newState.screen === 'resume';
    if (isResume && !wasResume) {
      this.inputBuffer = '';
      this.inputError = null;
    }

    const wasJournal = this.state.screen === 'journal';
    const isJournal = newState.screen === 'journal';
    if (!isJournal) {
      this.journalState = null;
    } else if (!wasJournal) {
      this.journalState = { mode: 'list', sectionIndex: 0, pageIndex: 0 };
    }

    this.state = newState;
  }

  // -------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------

  private handleKeyDown(e: KeyboardEvent): void {
    // The number field looks after its own keys. If the frame took them too,
    // every digit typed into it would be set down twice.
    if (e.target instanceof HTMLInputElement) return;

    if (e.key === ' ') e.preventDefault(); // never let space scroll the page

    if (this.overlay === 'map') {
      e.preventDefault();
      this.closeOverlay();
      return;
    }
    if (this.overlay === 'menu') {
      if (e.key === '@' || e.key === '0' || e.key === 'Escape') {
        e.preventDefault();
        this.closeOverlay();
        return;
      }
      this.overlayMenu?.handleKey(e);
      return;
    }

    if (e.key === 'Escape' && !this.textInput) {
      e.preventDefault();
      this.openOverlay('menu');
      return;
    }
    // Keep the original key as a quiet compatibility alias.
    if (e.key === '@') {
      e.preventDefault();
      this.openOverlay('menu');
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && !this.textInput) {
      e.preventDefault();
      this.openOverlay('map');
      return;
    }

    // The prose pane scrolls, so it must be reachable from the keyboard. The
    // menu already owns the arrows and Home/End, which leaves the page keys.
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      this.pageProse(e.key === 'PageDown' ? 1 : -1);
      return;
    }

    if (this.narrationPages) {
      if (e.key === ' ' || e.key === 'Enter') this.advanceNarration();
      return;
    }

    if (this.textInput) {
      this.handleTextInputKey(e);
      return;
    }

    // Faithful to the original: "Press the SPACE BAR to start the program."
    if (e.key === ' ' && this.state.screen === 'title') {
      this.activeMenu?.activateHighlighted();
      return;
    }

    this.activeMenu?.handleKey(e);
  }

  /** A page of prose, less a couple of lines so the eye keeps its place. */
  private pageProse(dir: 1 | -1): void {
    const pane = this.bodyEl;
    const step = Math.max(pane.clientHeight - 48, 60);
    pane.scrollTop += dir * step;
  }

  private handleTextInputKey(e: KeyboardEvent): void {
    if (/^[0-9]$/.test(e.key)) {
      if (this.inputBuffer.length < 6) this.inputBuffer += e.key;
      this.inputError = null;
      this.render();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.inputError = null;
      this.render();
      return;
    }
    if (e.key === 'Enter') {
      this.submitGameId();
      return;
    }
    if (e.key === 'Escape') {
      this.dispatch({ type: 'start' });
      return;
    }
  }

  private submitGameId(): void {
    // A rejected number redraws the screen, which builds a fresh field. If the
    // player was typing into the old one, the keypad must not be taken away
    // along with it.
    const wasTyping = document.activeElement?.classList.contains('gf-input-field') ?? false;
    const id = this.inputBuffer.trim();
    if (!id) {
      this.inputError = 'You must set down a number first.';
      this.render();
      if (wasTyping) this.focusInputField();
      return;
    }
    const loaded = tryLoadGame(id, defaultStore());
    if (loaded.ok) {
      this.inputBuffer = '';
      this.inputError = null;
      this.dispatch({ type: 'resume', state: loaded.value });
    } else {
      this.inputError = loaded.error.message;
      this.render();
      if (wasTyping) this.focusInputField();
    }
  }

  private focusInputField(): void {
    const field = this.inputEl.querySelector('.gf-input-field');
    if (field instanceof HTMLInputElement) field.focus({ preventScroll: true });
  }

  // -------------------------------------------------------------------
  // Overlays: the menu and the map
  // -------------------------------------------------------------------

  private openOverlay(kind: 'menu' | 'map'): void {
    this.overlay = kind;
    this.renderOverlay();
  }

  private closeOverlay(): void {
    if (!this.overlay) return;
    this.overlay = null;
    this.overlayMenu = null;
    this.frame.inert = false;
    this.statusEl.inert = false;
    clear(this.overlayEl);
    this.overlayEl.style.display = 'none';
    this.overlayEl.removeAttribute('role');
    this.overlayEl.removeAttribute('aria-modal');
    this.root.focus({ preventScroll: true });
  }

  private renderOverlay(): void {
    clear(this.overlayEl);
    if (!this.overlay) {
      this.overlayEl.style.display = 'none';
      return;
    }
    this.overlayEl.style.display = '';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', this.overlay === 'menu' ? 'Game menu' : 'Map of the goldfields');
    this.frame.inert = true;
    this.statusEl.inert = true;
    if (this.overlay === 'menu') this.renderMenuOverlay();
    else this.renderMapOverlay();
    const focusTarget = this.overlayEl.querySelector('[tabindex="0"], button');
    if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
  }

  /** The freshest state there is — including one still being narrated. */
  private get liveState(): GameState {
    return this.pendingState ?? this.state;
  }

  /**
   * The head of an overlay: its title, its rule, and — where there is no ESC
   * to press — a way out that stays in sight. The menu is a long page on a
   * phone, and a way out that must be scrolled to is no way out at all, so the
   * head is pinned to the top of the panel as it scrolls beneath.
   */
  private overlayHead(title: string, subtitle?: string): HTMLElement {
    // The day and the place sit on the title's own line where there is room
    // for them: a heading is a whole line spent either way, and the menu can
    // spare none.
    const titleWrap = el('div', { className: 'gf-overlay-titlewrap' }, [
      el('h2', { className: 'gf-overlay-title', text: title }),
    ]);
    if (subtitle) {
      titleWrap.appendChild(el('span', { className: 'gf-overlay-sub', text: this.say(subtitle) }));
    }
    const row = el('div', { className: 'gf-overlay-titlerow' }, [titleWrap]);
    if (isTouch()) {
      const close = el('button', {
        className: 'gf-overlay-close',
        attrs: { type: 'button', 'aria-label': 'close' },
        text: '✕',
      });
      close.addEventListener('click', () => this.closeOverlay());
      row.appendChild(close);
    }
    return el('div', { className: 'gf-overlay-head' }, [
      row,
      el('div', { className: 'gf-rule', attrs: { 'aria-hidden': 'true' } }),
    ]);
  }

  /**
   * A view's panels set side by side: headed blocks of label and value, laid
   * into as many columns as the glass will take. The whole reckoning is meant
   * to be read at one glance, so nothing here is a paragraph — a label in the
   * dim ink, its value after it, and the block flows to the next column rather
   * than down past the bottom of the panel.
   */
  private menuPanelGrid(panels: ViewPanel[]): HTMLElement {
    const grid = el('div', { className: 'gf-panels' });
    for (const p of panels) {
      const block = el('section', { className: 'gf-panel' }, [
        el('h3', { className: 'gf-panel-head', text: p.heading }),
      ]);
      for (const r of p.rows) {
        const line = el('p', { className: 'gf-panel-row' });
        if (r.label) line.appendChild(el('span', { className: 'gf-panel-label', text: `${this.say(r.label)}: ` }));
        line.appendChild(el('span', { className: 'gf-panel-value', text: this.say(r.text) }));
        block.appendChild(line);
      }
      grid.appendChild(block);
    }
    return grid;
  }

  /**
   * The line at the foot of an overlay saying how to be rid of it — and, on a
   * screen with no ESC to press, the thing that is pressed instead.
   */
  private closeControl(text: string): HTMLElement {
    const hint = el('button', {
      className: 'gf-overlay-hint',
      attrs: { type: 'button' },
      text,
    });
    hint.addEventListener('click', () => this.closeOverlay());
    return hint;
  }

  private renderMenuOverlay(): void {
    const view = menuView(this.liveState);
    const panel = el('div', { className: 'gf-overlay-panel gf-overlay-panel--menu' });
    panel.appendChild(this.overlayHead(view.title, view.subtitle));

    panel.appendChild(this.menuPanelGrid(view.panels ?? []));

    const menuEl = el('nav', { className: 'gf-menu' });
    const items: UIMenuItem[] = view.menu.map((m) => ({
      key: m.key,
      label: m.label,
      note: m.note,
      disabled: m.disabled,
      alert: m.alert,
      onSelect: () => {
        if (m.key === '0' && m.action.type === 'continue') this.closeOverlay();
        else this.dispatch(m.action, { fromOverlay: true });
      },
    }));
    items.splice(items.length - 1, 0, this.themeMenuItem('D', () => this.renderOverlay()));
    const inspector = el('p', { className: 'gf-inspector', attrs: { 'aria-live': 'polite' } });
    panel.appendChild(inspector);
    this.overlayMenu = new MenuController(items, {
      onHighlight: (note) => setInspectorText(inspector, note),
    });
    this.overlayMenu.render(menuEl);
    panel.appendChild(menuEl);
    this.overlayMenu.fitColumns(Number.MAX_SAFE_INTEGER);

    panel.appendChild(this.closeControl(isTouch() ? 'Touch here to close the menu.' : 'Press ESC or 0 to close the menu.'));
    this.overlayEl.appendChild(panel);
  }

  /**
   * The map: one drawn sheet, scaled whole to whatever room the glass can
   * spare, with the digger's own notes set beneath it. Head, drawing, notes
   * and the way out share a single page, and none of it is scrolled to.
   */
  private renderMapOverlay(): void {
    const panel = el('div', { className: 'gf-overlay-panel gf-overlay-panel--map' });
    panel.appendChild(this.overlayHead('A MAP OF THE GOLDFIELDS'));

    if (!this.mapBuilder) {
      panel.appendChild(el('p', { className: 'gf-para', text: 'Unfolding the surveyor’s sheet…' }));
      this.overlayEl.appendChild(panel);
      void import('./map').then(({ buildMap }) => {
        this.mapBuilder = buildMap;
        if (this.overlay === 'map') this.renderOverlay();
      });
      return;
    }

    // The chart comes over as markup rather than a tree of nodes; every word
    // printed on it is escaped where it is drawn.
    const holder = el('div');
    holder.innerHTML = this.mapBuilder(this.liveState).svg;
    const chart = holder.firstElementChild;
    if (chart) panel.appendChild(chart);

    const body = el('div', { className: 'gf-overlay-body gf-map-prose' });
    for (const line of mapView(this.liveState).body) {
      body.appendChild(el('p', { className: 'gf-para', text: line || ' ' }));
    }
    panel.appendChild(body);
    panel.appendChild(
      this.closeControl(
        isTouch() ? 'Touch here to put the map away.' : 'Press any key, or click, to close the map.',
      ),
    );
    panel.addEventListener('click', () => this.closeOverlay());
    this.overlayEl.appendChild(panel);
  }

  // -------------------------------------------------------------------
  // Narration paging
  // -------------------------------------------------------------------

  private renderNarration(): void {
    if (!this.narrationPages) return;
    const page = this.narrationPages[this.narrationIndex];

    // Keep the screen the player was just on as a backdrop while the tale unfolds.
    const view = getView(this.state);
    this.titleEl.textContent = view.title;
    if (view.subtitle) {
      this.subtitleEl.textContent = view.subtitle;
      this.subtitleEl.style.display = '';
    } else {
      this.subtitleEl.textContent = '';
      this.subtitleEl.style.display = 'none';
    }

    this.inputEl.style.display = 'none';
    clear(this.inputEl);
    this.renderAside(undefined);
    this.setInspector(null);

    clear(this.bodyEl);
    for (const ev of page) {
      const isSave = page.length === 1 && /saved under the number/i.test(ev.text);
      const classes = ['gf-para', `gf-tone-${ev.tone}`];
      if (isSave) classes.push('gf-para--save');
      this.bodyEl.appendChild(el('p', { className: classes.join(' '), text: ev.text }));
    }
    this.bodyEl.onclick = () => this.advanceNarration();

    clear(this.menuEl);
    const prompt = el('div', {
      className: 'gf-prompt gf-blink',
      text: this.say('— press the SPACE BAR for more —'),
    });
    prompt.addEventListener('click', () => this.advanceNarration());
    this.menuEl.appendChild(prompt);
    this.activeMenu = null;

    this.bodyEl.scrollTop = 0;
    const telling: LegendPart[] = [{ keys: 'Space', what: 'more' }];
    if (this.bodyEl.scrollHeight > this.bodyEl.clientHeight + 1) {
      telling.push({ keys: 'PgUp/PgDn', what: 'read' });
    }
    this.renderLegend(telling);
    this.statusLineEl.textContent = statusLine(this.state);
    this.root.focus({ preventScroll: true });
  }

  private advanceNarration(): void {
    if (!this.narrationPages) return;
    this.narrationIndex += 1;
    if (this.narrationIndex < this.narrationPages.length) {
      this.renderNarration();
      return;
    }
    this.narrationPages = null;
    this.narrationIndex = 0;
    if (this.pendingState) {
      this.applyState(this.pendingState);
      this.pendingState = null;
    }
    this.render();
  }

  // -------------------------------------------------------------------
  // Normal screen rendering
  // -------------------------------------------------------------------

  private render(): void {
    this.bodyEl.onclick = null;
    if (this.state.screen === 'journal') {
      this.renderJournal();
    } else {
      this.renderNormalView();
    }
    this.statusLineEl.textContent = statusLine(this.state);
    this.renderOverlay();
    this.root.focus({ preventScroll: true });
  }

  private renderNormalView(): void {
    const view = getView(this.state);
    this.titleEl.textContent = view.title;
    if (view.subtitle) {
      this.subtitleEl.textContent = view.subtitle;
      this.subtitleEl.style.display = '';
    } else {
      this.subtitleEl.textContent = '';
      this.subtitleEl.style.display = 'none';
    }

    clear(this.bodyEl);
    for (const line of view.body) {
      this.bodyEl.appendChild(el('p', {
          className: line ? 'gf-para gf-para--line' : 'gf-para gf-para--blank',
          text: this.say(line) || ' ',
        }));
    }

    this.textInput = !!view.input;
    clear(this.inputEl);
    if (view.input) {
      this.inputEl.style.display = '';
      this.inputEl.appendChild(this.buildInputRow(view.input.prompt));
      if (this.inputError) this.inputEl.appendChild(el('p', { className: 'gf-input-error', text: this.inputError }));
    } else {
      this.inputEl.style.display = 'none';
    }

    this.renderAside(view.aside);

    const items: UIMenuItem[] = view.menu.map((m) => ({
      key: m.key,
      label: this.say(m.label),
      note: m.note,
      alert: m.alert,
      disabled: m.disabled,
      onSelect: () => this.dispatch(m.action),
    }));

    // A number may be sent from the menu as well as by the RETURN key, which
    // is the only way at all on a glass whose numeric keypad has no return.
    if (view.input?.kind === 'gameId') {
      items.unshift({
        key: '↵',
        label: 'Take it up',
        note: 'open the game whose number you have set down',
        onSelect: () => this.submitGameId(),
      });
    }

    if (view.screen === 'title') {
      const last = tryLastGameId(defaultStore());
      if (last.ok && last.value) {
        const id = last.value;
        const loaded = tryLoadGame(id, defaultStore());
        if (loaded.ok) {
          items.push({
            key: 'C',
            label: `Continue last game — No. ${id}`,
            note: 'take up where you left off',
            onSelect: () => this.dispatch({ type: 'resume', state: loaded.value }),
          });
        }
      } else if (!last.ok) {
        items.push({
          key: 'C',
          label: 'Saved games unavailable in this window',
          note: last.error.message,
          disabled: true,
          onSelect: () => {},
        });
      }
      items.push(this.themeMenuItem('T', () => this.render()));
    }

    clear(this.menuEl);
    this.activeMenu = new MenuController(items, {
      onHighlight: (note) => this.setInspector(note),
    });
    this.activeMenu.render(this.menuEl);
    this.fitMenu();
    this.renderLegend(this.screenLegend());

    if (this.savedScroll && this.savedScroll.screen === view.screen) {
      this.bodyEl.scrollTop = this.savedScroll.top;
    } else {
      this.bodyEl.scrollTop = 0;
    }
  }

  /**
   * The ledger pane. Present only where a screen is worth one — chiefly the
   * stores, where the whole question is whether a man can afford the thing and
   * whether he is already carrying it.
   */
  private renderAside(aside: AsidePanel | undefined): void {
    clear(this.asideEl);
    this.mainEl.classList.toggle('has-aside', !!aside);
    if (!aside) {
      this.asideEl.style.display = 'none';
      return;
    }
    this.asideEl.style.display = '';
    this.asideEl.appendChild(el('h2', { className: 'gf-aside-title', text: aside.title }));
    for (const row of aside.rows) {
      if (row.heading) {
        this.asideEl.appendChild(el('div', { className: 'gf-aside-heading', text: row.label }));
        continue;
      }
      const classes = ['gf-aside-value'];
      if (row.tone) classes.push(`gf-tone-${row.tone}`);
      this.asideEl.appendChild(
        el('div', { className: 'gf-aside-row' }, [
          el('span', { className: 'gf-aside-label', text: row.label }),
          el('span', { className: classes.join(' '), text: row.value }),
        ]),
      );
    }
  }

  private setInspector(note: string | null): void {
    setInspectorText(this.inspectorEl, note);
  }

  /**
   * A line of the game's own words, said in a way the player's device can be
   * acted upon with. On anything with a keyboard this is the engine's text
   * untouched; on a phone the handful of lines that name a key are rewritten.
   */
  private say(line: string): string {
    return isTouch() ? forTouch(line) : line;
  }

  /**
   * The prompt for a game number: the digits and the block cursor drawn as
   * they always were, over a real field that is never seen. The field is there
   * for one purpose — a device with no keys of its own will raise a numeric
   * keypad when it is touched — and everything else about the row is unchanged.
   */
  private buildInputRow(prompt: string): HTMLElement {
    const row = el('div', { className: 'gf-input-row' });
    const field = el('input', {
      className: 'gf-input-field',
      attrs: {
        type: 'text',
        inputmode: 'numeric',
        pattern: '[0-9]*',
        maxlength: '6',
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        'aria-label': prompt,
      },
    });
    field.value = this.inputBuffer;
    field.addEventListener('input', () => {
      const digits = field.value.replace(/\D/g, '').slice(0, 6);
      field.value = digits;
      this.inputBuffer = digits;
      this.inputError = null;
      this.paintInputBuffer();
    });
    // A keypad's own go key, where it has one, and the way back out.
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitGameId();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.dispatch({ type: 'start' });
      }
    });
    row.append(
      field,
      el('span', { className: 'gf-input-prompt', text: `${prompt}: ` }),
      el('span', { className: 'gf-input-buffer', text: this.inputBuffer }),
      el('span', { className: 'gf-input-cursor gf-blink', text: '█' }),
    );
    // Touching anywhere along the row asks for the keypad.
    row.addEventListener('click', () => field.focus());
    if (isTouch()) {
      row.appendChild(el('span', { className: 'gf-input-hint', text: 'touch here to type' }));
    }
    return row;
  }

  /** Repaint the digits under the cursor without rebuilding the field, which
   *  would take the keypad away again mid-word. */
  private paintInputBuffer(): void {
    const buffer = this.inputEl.querySelector('.gf-input-buffer');
    if (buffer) buffer.textContent = this.inputBuffer;
    const error = this.inputEl.querySelector('.gf-input-error');
    if (error) error.remove();
  }

  /**
   * The quiet legend at the foot of the screen. It names only what the key
   * will actually do here — the arrows across the columns when there are
   * columns, the page keys when there is something to page — so that it
   * teaches rather than merely decorating.
   */
  private renderLegend(parts: LegendPart[]): void {
    clear(this.legendEl);
    const touch = isTouch();
    // A legend that teaches keys is worse than nothing to a player who has
    // none; what is left is only what can actually be pressed by hand.
    const shown = touch ? parts.filter((p) => p.act) : parts;
    shown.forEach((part, i) => {
      if (i > 0) this.legendEl.appendChild(el('span', { className: 'gf-legend-sep', text: '\u00b7' }));
      const words = touch
        ? [el('b', { className: 'gf-legend-key', text: `[ ${part.what.toUpperCase()} ]` })]
        : [
            el('b', { className: 'gf-legend-key', text: part.keys }),
            el('span', { className: 'gf-legend-what', text: part.what }),
          ];
      if (!part.act) {
        words.forEach((w) => this.legendEl.appendChild(w));
        return;
      }
      const button = el(
        'button',
        {
          className: 'gf-legend-act',
          attrs: { type: 'button', 'aria-label': part.what },
        },
        words,
      );
      button.addEventListener('click', part.act);
      this.legendEl.appendChild(button);
    });
  }

  /** What the frame's own keys are doing on an ordinary screen, just now. */
  private screenLegend(): LegendPart[] {
    const parts: LegendPart[] = [];
    if (this.textInput) {
      parts.push(
        { keys: '0-9', what: 'type' },
        { keys: '\u21b5', what: 'enter' },
        { keys: 'Esc', what: 'back' },
      );
      return parts;
    }
    parts.push({ keys: '\u2191\u2193', what: 'move' });
    if (this.menuEl.classList.contains('gf-menu--dense')) {
      parts.push({ keys: '\u2190\u2192', what: 'columns' });
    }
    parts.push({ keys: '\u21b5', what: 'choose' });
    if (this.bodyEl.scrollHeight > this.bodyEl.clientHeight + 1) {
      parts.push({ keys: 'PgUp/PgDn', what: 'read' });
    }
    // No menu and no map before a man has set foot on the field, or after the
    // reckoning has closed the books on him.
    const afoot = !['title', 'resume', 'intro', 'end'].includes(this.state.screen);
    if (afoot) {
      parts.push(
        { keys: 'Esc', what: 'menu', act: () => this.openOverlay('menu') },
        { keys: 'M', what: 'map', act: () => this.openOverlay('map') },
      );
    }
    return parts;
  }

  /**
   * The menu may take everything the pane has except the input, the flavour
   * line, and a slice kept back for the prose — or the whole of the prose,
   * where there is little enough of it that the store's shelves may have the
   * rest. The menu never shrinks; the prose gives way and scrolls.
   */
  private fitMenu(): void {
    // On a full-height screen, camp character gets roughly two-fifths of the
    // working pane before a long action list is split into columns. On a short
    // glass the reserve scales down, but never to the near-hidden strip that
    // made the prose unreadable in the Blackcap Ranges.
    // Measure the action column, not the whole main grid: on a narrow screen
    // the ledger is stacked above it and has already spent some of that room.
    const paneHeight = this.contentEl.clientHeight;
    const proseReserve = Math.max(90, Math.min(240, paneHeight * 0.42));
    const reserve = Math.min(this.bodyEl.scrollHeight + 10, proseReserve);
    const budget =
      paneHeight -
      this.inspectorEl.offsetHeight -
      (this.inputEl.style.display === 'none' ? 0 : this.inputEl.offsetHeight) -
      reserve;
    this.activeMenu?.fitColumns(Math.max(budget, 0));
  }

  /** The colour scheme is the player's affair, not the game's — a UI-only item. */
  private themeMenuItem(key: string, rerender: () => void): UIMenuItem {
    return {
      key,
      label: `The colour of the glass — ${currentTheme().name}`,
      note: 'as you please; the diggings are the same in any light',
      onSelect: () => {
        cycleTheme();
        rerender();
      },
    };
  }

  // -------------------------------------------------------------------
  // The Journal reader — handled entirely in the UI.
  // -------------------------------------------------------------------

  private renderJournal(): void {
    const js = this.journalState ?? (this.journalState = { mode: 'list', sectionIndex: 0, pageIndex: 0 });

    if (!this.journalSections) {
      this.titleEl.textContent = "THE NEW CHUM'S COMPANION";
      this.subtitleEl.textContent = 'Opening the book…';
      this.subtitleEl.style.display = '';
      clear(this.bodyEl);
      this.bodyEl.appendChild(el('p', { className: 'gf-para', text: 'The pages are being cut.' }));
      clear(this.menuEl);
      this.activeMenu = null;
      void import('../content/journal').then(({ JOURNAL_SECTIONS }) => {
        this.journalSections = JOURNAL_SECTIONS;
        if (this.state.screen === 'journal') this.render();
      });
      return;
    }
    const sections = this.journalSections;

    this.bodyEl.scrollTop = 0;
    this.inputEl.style.display = 'none';
    clear(this.inputEl);
    this.textInput = false;
    this.renderAside(undefined);

    if (js.mode === 'list') {
      this.titleEl.textContent = "THE NEW CHUM'S COMPANION";
      this.subtitleEl.textContent = 'Nicholas Jacob Rowe, lately returned from the Gold Rushes';
      this.subtitleEl.style.display = '';

      clear(this.bodyEl);
      this.bodyEl.appendChild(el('p', { className: 'gf-para', text: 'Choose a chapter.' }));

      const items: UIMenuItem[] = sections.map((sec, i) => ({
        key: MENU_LETTERS[i] ?? String(i),
        label: sec.title,
        onSelect: () => {
          this.journalState = { mode: 'read', sectionIndex: i, pageIndex: 0 };
          this.render();
        },
      }));
      items.push({
        key: '0',
        label: 'Close the book',
        onSelect: () => {
          this.journalState = null;
          this.dispatch({ type: 'continue' });
        },
      });

      clear(this.menuEl);
      this.activeMenu = new MenuController(items, { onHighlight: (n) => this.setInspector(n) });
      this.activeMenu.render(this.menuEl);
      this.fitMenu();
      this.renderLegend(this.screenLegend());
    } else {
      const sec = sections[js.sectionIndex];
      const isLast = js.pageIndex >= sec.body.length - 1;

      this.titleEl.textContent = sec.title.toUpperCase();
      this.subtitleEl.textContent = '';
      this.subtitleEl.style.display = 'none';

      clear(this.bodyEl);
      this.bodyEl.appendChild(el('p', { className: 'gf-para', text: sec.body[js.pageIndex] }));
      this.bodyEl.onclick = () => this.advanceJournalPage();

      const items: UIMenuItem[] = [
        { key: ' ', label: isLast ? 'Back to the chapters' : 'Read on', onSelect: () => this.advanceJournalPage() },
        {
          key: '0',
          label: 'Back to the chapters',
          onSelect: () => {
            this.journalState = { ...js, mode: 'list' };
            this.render();
          },
        },
      ];
      clear(this.menuEl);
      this.activeMenu = new MenuController(items, { onHighlight: (n) => this.setInspector(n) });
      this.activeMenu.render(this.menuEl);
      this.fitMenu();
      this.renderLegend(this.screenLegend());
    }
  }

  private advanceJournalPage(): void {
    const js = this.journalState;
    if (!js) return;
    const sec = this.journalSections?.[js.sectionIndex];
    if (!sec) return;
    if (js.pageIndex + 1 < sec.body.length) {
      this.journalState = { ...js, pageIndex: js.pageIndex + 1 };
    } else {
      this.journalState = { ...js, mode: 'list' };
    }
    this.render();
  }
}
