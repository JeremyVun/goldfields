import { makeRng, randomSeed, type RNG } from '../engine/rng';
import { createInitialState, statusLine } from '../engine/state';
import { step } from '../engine/reduce';
import { getView, kittyView, mapView, MENU_LETTERS } from '../engine/menus';
import { saveGame, loadGame, lastGameId, defaultStore } from '../engine/save';
import { JOURNAL_SECTIONS } from '../content/library';
import type { Action, AsidePanel, GameState, NarrationEvent } from '../engine/types';

import { el, clear } from './dom';
import { MenuController, type UIMenuItem } from './menu';
import { pageEvents } from './narration';
import { buildMap } from './map';
import { forTouch, isTouch, onInputModeChange } from './phrasing';
import { cycleTheme, currentTheme, loadTheme } from './theme';

/**
 * One entry in the quiet legend at the foot of the glass. Where it carries an
 * `act` it is not merely a legend but the control itself — which is the only
 * way the kitty and the map can be reached at all on a screen with no keys.
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

type Overlay = 'kitty' | 'map' | null;

interface JournalState {
  mode: 'list' | 'read';
  sectionIndex: number;
  pageIndex: number;
}

/** The browser presentation layer for Goldfields. The engine underneath is never mutated by hand. */
export class App {
  private readonly root: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly mainEl: HTMLElement;
  private readonly asideEl: HTMLElement;
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

  private textInput = false;
  private inputBuffer = '';
  private inputError: string | null = null;

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
    const content = el('div', { className: 'gf-content' }, [
      this.bodyEl,
      this.inputEl,
      this.inspectorEl,
      this.menuEl,
    ]);
    this.mainEl = el('div', { className: 'gf-main' }, [this.asideEl, content]);

    this.frame = el('div', { className: 'gf-frame' }, [header, this.mainEl]);
    this.statusLineEl = el('span', { className: 'gf-status-line' });
    this.legendEl = el('span', { className: 'gf-legend' });
    this.statusEl = el('div', { className: 'gf-status' }, [this.statusLineEl, this.legendEl]);
    this.overlayEl = el('div', { className: 'gf-overlay-layer', attrs: { style: 'display:none' } });

    this.root.append(this.frame, this.statusEl, this.overlayEl);

    this.root.addEventListener('keydown', (e) => this.handleKeyDown(e));
    // How many columns a menu needs depends on the room there is for it.
    window.addEventListener('resize', () => this.fitMenu());
    window.addEventListener('orientationchange', () => this.fitMenu());
    // A soft keypad rising over the glass shortens it without a resize event
    // of the ordinary kind.
    window.visualViewport?.addEventListener('resize', () => this.fitMenu());
    // A keyboard folded on or off a tablet changes how the frame must speak:
    // whether the flavour belongs in the rows, and whether the kitty and the
    // map need buttons of their own.
    onInputModeChange(() => this.render());
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.closeOverlay();
    });
  }

  start(): void {
    this.render();
  }

  // -------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------

  private dispatch(action: Action, opts?: { fromOverlay?: boolean }): void {
    this.savedScroll = { screen: this.state.screen, top: this.bodyEl.scrollTop };
    if (opts?.fromOverlay) this.closeOverlay();

    // The kitty opens at any time, narration or no. If the player acts from it
    // while a tale is still being told, the state that tale produced must be
    // committed first — otherwise a whole spell of digging is thrown away and
    // the action is applied to the state as it stood before it.
    this.flushNarration();

    // A fresh game must get a fresh seed, or "begin again" would replay the
    // very same year, move for move.
    const normalised: Action =
      action.type === 'newGame' ? { type: 'newGame', seed: randomSeed() } : action;

    try {
      const result = step(this.state, normalised, this.rng);

      if (normalised.type === 'save') {
        saveGame(result.state, defaultStore());
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
      console.error('goldfields: step failed', err);
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
    if (this.overlay === 'kitty') {
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
      this.openOverlay('kitty');
      return;
    }
    // Keep the original key as a quiet compatibility alias.
    if (e.key === '@') {
      e.preventDefault();
      this.openOverlay('kitty');
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
    const loaded = loadGame(id, defaultStore());
    if (loaded) {
      this.inputBuffer = '';
      this.inputError = null;
      this.dispatch({ type: 'resume', state: loaded });
    } else {
      this.inputError = 'No such game.';
      this.render();
      if (wasTyping) this.focusInputField();
    }
  }

  private focusInputField(): void {
    const field = this.inputEl.querySelector('.gf-input-field');
    if (field instanceof HTMLInputElement) field.focus({ preventScroll: true });
  }

  // -------------------------------------------------------------------
  // Overlays: the kitty and the map
  // -------------------------------------------------------------------

  private openOverlay(kind: 'kitty' | 'map'): void {
    this.overlay = kind;
    this.renderOverlay();
  }

  private closeOverlay(): void {
    if (!this.overlay) return;
    this.overlay = null;
    this.overlayMenu = null;
    clear(this.overlayEl);
    this.overlayEl.style.display = 'none';
    this.root.focus({ preventScroll: true });
  }

  private renderOverlay(): void {
    clear(this.overlayEl);
    if (!this.overlay) {
      this.overlayEl.style.display = 'none';
      return;
    }
    this.overlayEl.style.display = '';
    if (this.overlay === 'kitty') this.renderKittyOverlay();
    else this.renderMapOverlay();
    this.root.focus({ preventScroll: true });
  }

  /** The freshest state there is — including one still being narrated. */
  private get liveState(): GameState {
    return this.pendingState ?? this.state;
  }

  /**
   * The head of an overlay: its title, its rule, and — where there is no ESC
   * to press — a way out that stays in sight. The kitty is a long page on a
   * phone, and a way out that must be scrolled to is no way out at all, so the
   * head is pinned to the top of the panel as it scrolls beneath.
   */
  private overlayHead(title: string): HTMLElement {
    const row = el('div', { className: 'gf-overlay-titlerow' }, [
      el('h2', { className: 'gf-overlay-title', text: title }),
    ]);
    if (isTouch()) {
      const close = el('span', {
        className: 'gf-overlay-close',
        attrs: { role: 'button', tabindex: '-1', 'aria-label': 'close' },
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
   * The line at the foot of an overlay saying how to be rid of it — and, on a
   * screen with no ESC to press, the thing that is pressed instead.
   */
  private closeControl(text: string): HTMLElement {
    const hint = el('p', {
      className: 'gf-overlay-hint',
      attrs: { role: 'button', tabindex: '-1' },
      text,
    });
    hint.addEventListener('click', () => this.closeOverlay());
    return hint;
  }

  private renderKittyOverlay(): void {
    const view = kittyView(this.liveState);
    const panel = el('div', { className: 'gf-overlay-panel' });
    panel.appendChild(this.overlayHead(view.title));

    const body = el('div', { className: 'gf-overlay-body' });
    for (const line of view.body) {
      body.appendChild(el('p', {
          className: line ? 'gf-para gf-para--line' : 'gf-para gf-para--blank',
          text: this.say(line) || ' ',
        }));
    }
    panel.appendChild(body);

    const menuEl = el('nav', { className: 'gf-menu' });
    const items: UIMenuItem[] = view.menu.map((m) => ({
      key: m.key,
      label: m.label,
      note: m.note,
      disabled: m.disabled,
      alert: m.alert,
      onSelect: () => this.dispatch(m.action, { fromOverlay: true }),
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

    panel.appendChild(this.closeControl(isTouch() ? 'Touch here to close the kitty.' : 'Press ESC or 0 to close the kitty.'));
    this.overlayEl.appendChild(panel);
  }

  private renderMapOverlay(): void {
    const { lines, markerRow, markerCol } = buildMap(this.liveState);
    const panel = el('div', { className: 'gf-overlay-panel gf-overlay-panel--map' });
    panel.appendChild(this.overlayHead('A MAP OF THE GOLDFIELDS'));

    const pre = el('pre', { className: 'gf-map' });
    const frag = document.createDocumentFragment();
    lines.forEach((line, r) => {
      if (r === markerRow && markerCol >= 0 && markerCol < line.length) {
        const before = line.slice(0, markerCol);
        const markChar = line[markerCol] || '*';
        const after = line.slice(markerCol + 1);
        frag.appendChild(document.createTextNode(before));
        frag.appendChild(el('span', { className: 'gf-map-marker gf-blink', text: markChar }));
        frag.appendChild(document.createTextNode(after + '\n'));
      } else {
        frag.appendChild(document.createTextNode(line + '\n'));
      }
    });
    pre.appendChild(frag);
    panel.appendChild(pre);

    const body = el('div', { className: 'gf-overlay-body' });
    const mv = mapView(this.liveState);
    for (const line of mv.body) {
      body.appendChild(el('p', { className: 'gf-para', text: line || ' ' }));
    }
    panel.appendChild(body);
    panel.appendChild(
      this.closeControl(
        isTouch()
          ? 'Drag the map to see the whole of it. Touch here to close it.'
          : 'Press any key, or click, to close the map.',
      ),
    );
    // Everywhere but the drawing itself: a finger dragging the map sideways to
    // see the far side of it is not asking for the map to be put away.
    panel.addEventListener('click', (e) => {
      if (e.target instanceof Node && pre.contains(e.target)) return;
      this.closeOverlay();
    });
    this.overlayEl.appendChild(panel);

    // A hundred and sixteen columns will not fit on a phone, and the half of
    // the field a player wants first is the half he is standing in. Once the
    // drawing is in the document, wind it along to put him in the middle of it.
    if (pre.scrollWidth > pre.clientWidth) {
      // Say so where it can be seen — under the drawing, not at the foot of a
      // page the player would have to scroll to reach.
      pre.after(
        el('p', { className: 'gf-map-hint', text: 'The field runs on past the edge — drag the map sideways.' }),
      );
      const marker = pre.querySelector('.gf-map-marker');
      if (marker instanceof HTMLElement) {
        pre.scrollLeft = marker.offsetLeft - pre.clientWidth / 2;
      }
    }
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
      const id = lastGameId(defaultStore());
      if (id) {
        const loaded = loadGame(id, defaultStore());
        if (loaded) {
          items.push({
            key: 'C',
            label: `Continue last game — No. ${id}`,
            note: 'take up where you left off',
            onSelect: () => this.dispatch({ type: 'resume', state: loaded }),
          });
        }
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
        'span',
        {
          className: 'gf-legend-act',
          attrs: { role: 'button', tabindex: '-1', 'aria-label': part.what },
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
    // No kitty and no map before a man has set foot on the field, or after the
    // reckoning has closed the books on him.
    const afoot = !['title', 'resume', 'intro', 'end'].includes(this.state.screen);
    if (afoot) {
      parts.push(
        { keys: 'Esc', what: 'kitty', act: () => this.openOverlay('kitty') },
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
    const MIN_PROSE = 110;
    const reserve = Math.min(this.bodyEl.scrollHeight + 10, MIN_PROSE);
    const budget =
      this.mainEl.clientHeight -
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

    this.bodyEl.scrollTop = 0;
    this.inputEl.style.display = 'none';
    clear(this.inputEl);
    this.textInput = false;
    this.renderAside(undefined);

    if (js.mode === 'list') {
      this.titleEl.textContent = 'A GOLDFIELDS JOURNAL';
      this.subtitleEl.textContent = 'Nicholas Jacob Rowe, lately returned from the Gold Rushes';
      this.subtitleEl.style.display = '';

      clear(this.bodyEl);
      this.bodyEl.appendChild(el('p', { className: 'gf-para', text: 'Choose a chapter.' }));

      const items: UIMenuItem[] = JOURNAL_SECTIONS.map((sec, i) => ({
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
      const sec = JOURNAL_SECTIONS[js.sectionIndex];
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
    const sec = JOURNAL_SECTIONS[js.sectionIndex];
    if (js.pageIndex + 1 < sec.body.length) {
      this.journalState = { ...js, pageIndex: js.pageIndex + 1 };
    } else {
      this.journalState = { ...js, mode: 'list' };
    }
    this.render();
  }
}
