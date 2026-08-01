/**
 * A small keyboard-and-mouse menu widget, reused for the normal screen menu,
 * the menu overlay, and the journal's chapter list. Every menu item is both
 * pressable by its key and clickable/tappable.
 *
 * A menu that will not fit in one column is laid across two, and the left and
 * right arrows cross between them. Flavour is lifted out of the rows into a
 * single line above, which the caller renders. Warnings are not lifted: a
 * gouging price or a bar on the choice must be read where the choice is made,
 * not hunted for.
 */

import { el, clear } from './dom';
import { isTouch, keyLabel } from './phrasing';

export interface UIMenuItem {
  key: string;
  label: string;
  note?: string;
  alert?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuOptions {
  /** Told the flavour of whatever sits under the marker, or null for none. */
  onHighlight?: (note: string | null) => void;
}

export class MenuController {
  private readonly items: UIMenuItem[];
  private readonly onHighlight?: (note: string | null) => void;
  private highlight: number;
  private rows: HTMLElement[] = [];
  private container: HTMLElement | null = null;

  constructor(items: UIMenuItem[], opts: MenuOptions = {}) {
    this.items = items;
    this.onHighlight = opts.onHighlight;
    const firstEnabled = items.findIndex((i) => !i.disabled);
    this.highlight = firstEnabled >= 0 ? firstEnabled : 0;
  }

  render(container: HTMLElement): void {
    clear(container);
    this.container = container;
    container.classList.remove('gf-menu--dense');
    this.rows = [];
    this.items.forEach((item, i) => {
      const classes = ['gf-menu-item'];
      if (item.disabled) classes.push('is-disabled');
      if (i === this.highlight) classes.push('is-highlight');
      const row = el('button', {
        className: classes.join(' '),
        attrs: {
          type: 'button',
          tabindex: i === this.highlight && !item.disabled ? '0' : '-1',
          ...(item.disabled ? { disabled: 'true', 'aria-disabled': 'true' } : {}),
          ...(i === this.highlight ? { 'aria-current': 'true' } : {}),
        },
      });
      const marker = el('span', { className: 'gf-menu-marker', text: i === this.highlight ? '▸' : ' ' });
      const key = el('span', { className: 'gf-menu-key', text: keyLabel(item.key, isTouch()) });
      const label = el('span', { className: 'gf-menu-label', text: item.label });
      row.append(marker, key, label);
      if (item.alert) row.appendChild(el('span', { className: 'gf-menu-alert', text: item.alert }));
      // Written into every row, and shown by the stylesheet only where the
      // marker cannot be moved without choosing — that is, under a finger.
      if (item.note) row.appendChild(el('span', { className: 'gf-menu-note', text: item.note }));
      row.addEventListener('click', () => this.select(i));
      // The marker follows the mouse, so that the flavour line above always
      // describes the thing the player is actually looking at.
      row.addEventListener('mouseenter', () => {
        if (!item.disabled) this.setHighlight(i, { scroll: false });
      });
      container.appendChild(row);
      this.rows.push(row);
    });
    this.announce();
  }

  /**
   * One column is easier to read and easier to walk, so it is what a menu gets
   * unless it genuinely will not fit. Only then does it go to two — measured
   * against a budget the caller works out, never guessed from the number of
   * items, and never inferred from the box having been squeezed: a long page of
   * prose squeezes a two-item menu just as hard as a store's twenty do.
   */
  fitColumns(budget: number): void {
    const c = this.container;
    if (!c) return;
    c.classList.remove('gf-menu--dense');
    c.style.removeProperty('max-height');
    c.style.removeProperty('--gf-menu-rows');
    if (c.scrollHeight <= budget) return;

    // Bound the scroll box before laying the choices across it. Grid, unlike
    // CSS multi-column flow, can keep two columns inside this height and scroll
    // down to their final rows instead of creating hidden columns to the right.
    c.style.maxHeight = `${budget}px`;
    c.style.setProperty('--gf-menu-rows', String(Math.ceil(this.rows.length / 2)));
    c.classList.add('gf-menu--dense');

    // Below the width at which the stylesheet allows a second column there is
    // nothing for this to do. Ask the glass what it actually gave us rather
    // than repeating its breakpoint here.
    if (getComputedStyle(c).getPropertyValue('--gf-menu-columns').trim() === '1') {
      c.classList.remove('gf-menu--dense');
      c.style.removeProperty('--gf-menu-rows');
      return;
    }
  }

  /** True when the menu is currently laid across columns. */
  private get isDense(): boolean {
    return !!this.container?.classList.contains('gf-menu--dense');
  }

  /**
   * Cross to the nearest row in the column to the left or right, keeping as
   * close to the present height as it can. Geometry, not arithmetic: the
   * browser balances the columns and we do not get to know how.
   */
  private crossColumn(dir: -1 | 1): boolean {
    if (!this.isDense) return false;
    const from = this.rows[this.highlight];
    if (!from) return false;
    const fromLeft = from.offsetLeft;
    const fromTop = from.offsetTop;
    let best = -1;
    let bestDist = Infinity;
    this.rows.forEach((row, i) => {
      if (this.items[i].disabled) return;
      const dx = row.offsetLeft - fromLeft;
      if (dir === 1 ? dx <= 1 : dx >= -1) return;
      const dist = Math.abs(row.offsetTop - fromTop);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best < 0) return false;
    this.setHighlight(best);
    return true;
  }

  handleKey(e: KeyboardEvent): boolean {
    // Consume movement keys wholly, or the browser scrolls the pane at the
    // same time and the marker and the view part company.
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(1);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.move(-1);
      return true;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (this.crossColumn(e.key === 'ArrowRight' ? 1 : -1)) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      this.jump(e.key === 'Home' ? 0 : this.items.length - 1);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.select(this.highlight);
      return true;
    }
    if (e.key.length === 1) {
      const idx = this.items.findIndex(
        (it) => it.key.length === 1 && it.key.toUpperCase() === e.key.toUpperCase(),
      );
      if (idx >= 0) {
        this.select(idx);
        return true;
      }
    }
    return false;
  }

  /** Choose whatever is under the marker — used by the title screen's SPACE BAR. */
  activateHighlighted(): void {
    this.select(this.highlight);
  }

  private select(i: number): void {
    const item = this.items[i];
    if (!item || item.disabled) return;
    this.highlight = i;
    item.onSelect();
  }

  private move(delta: number): void {
    if (!this.items.length) return;
    let i = this.highlight;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + delta + this.items.length) % this.items.length;
      if (!this.items[i].disabled) break;
    }
    this.setHighlight(i);
  }

  /** Land on `i`, or the nearest enabled item after it. */
  private jump(i: number): void {
    if (!this.items.length) return;
    for (let n = 0; n < this.items.length; n++) {
      const idx = (i + n + this.items.length) % this.items.length;
      if (!this.items[idx].disabled) {
        this.setHighlight(idx);
        return;
      }
    }
  }

  private setHighlight(i: number, opts: { scroll?: boolean } = {}): void {
    if (i === this.highlight && this.rows.length) return;
    this.highlight = i;
    this.rows.forEach((row, idx) => {
      row.classList.toggle('is-highlight', idx === this.highlight);
      row.setAttribute('tabindex', idx === this.highlight && !this.items[idx].disabled ? '0' : '-1');
      if (idx === this.highlight) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
      const marker = row.querySelector('.gf-menu-marker');
      if (marker) marker.textContent = idx === this.highlight ? '▸' : ' ';
    });
    if (opts.scroll !== false) {
      this.rows[this.highlight]?.scrollIntoView({ block: 'nearest' });
    }
    this.announce();
  }

  private announce(): void {
    this.onHighlight?.(this.items[this.highlight]?.note ?? null);
  }
}
