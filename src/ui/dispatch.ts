import { step } from '../engine/reduce';
import type { RNG } from '../engine/rng';
import type { Action, GameState, NarrationEvent, StepResult } from '../engine/types';

import { pageEvents } from './narration';

/**
 * What the frame is told when the state on show is replaced: the state as it
 * stood, and the state that takes its place. The frame keeps a little of its
 * own bookkeeping by the screen (the number field, the open book), and this is
 * where it hears that the screen has changed under it.
 */
export type SettleHook = (prev: GameState, next: GameState) => void;

/**
 * The world as the frame knows it, and whatever tale is still being told over
 * the top of it.
 *
 * A tale takes a while to read, and the state it produced — a whole spell of
 * digging, say — is not set down until the last page is turned. But the menu
 * opens at any time, narration or no, and a player may act from it in the
 * middle of the telling. So the state a tale produced must be committed before
 * any further action is applied, or the digging is thrown away and the action
 * lands on the world as it stood before it.
 *
 * That is not a rule callers are asked to remember. It is the shape of this
 * class: everything that moves the world on or puts fresh words on the glass
 * goes through `act`, `show` or `remark`, and each of those sets down the
 * pending state first. There is no door that skips it, because the state to
 * step from is never handed out — `step` is called here and nowhere else.
 */
export class Session {
  /** The state the frame is drawn from: while a tale is told, the one behind it. */
  private world: GameState;

  /** The state the tale on the glass will leave behind, once it is read out. */
  private pending: GameState | null = null;

  private pages: NarrationEvent[][] | null = null;
  private index = 0;

  private readonly onSettle: SettleHook | undefined;

  constructor(initial: GameState, onSettle?: SettleHook) {
    this.world = initial;
    this.onSettle = onSettle;
  }

  /** The state the frame is presently drawn from — the backdrop behind a tale. */
  get shown(): GameState {
    return this.world;
  }

  /** The freshest state there is — including one still being narrated. */
  get live(): GameState {
    return this.pending ?? this.world;
  }

  /** Whether a tale is part-told, and so owns the keys and the glass. */
  get telling(): boolean {
    return this.pages !== null;
  }

  /** The page of the tale presently on the glass, if any. */
  get page(): NarrationEvent[] | null {
    return this.pages?.[this.index] ?? null;
  }

  /**
   * Apply an action to the world and hand back what the engine made of it,
   * without yet putting it on show.
   *
   * Whatever a part-told tale had already produced is set down first, so the
   * action lands on the freshest world there is. The engine is stepped exactly
   * once: it carries the dice in the state itself, and a second call for the
   * one action would spend the world twice over.
   */
  act(action: Action, rng: RNG): StepResult {
    this.commit();
    return step(this.world, action, rng);
  }

  /**
   * Put the engine's answer on the glass: where it had something to say, as a
   * tale to be paged through with the state held back until the end of it;
   * where it had nothing, as the state itself, at once.
   */
  show(result: StepResult): void {
    this.commit();
    if (result.events.length === 0) {
      this.settle(result.state);
      return;
    }
    this.pending = result.state;
    this.pages = pageEvents(result.events);
    this.index = 0;
  }

  /**
   * A word from the frame rather than the engine — a save that would not
   * write, a step that threw. It is told over the world as it stands and
   * leaves no state of its own behind; what a tale before it had produced is
   * still set down, since the frame's own mishap is no reason to lose a
   * morning's work.
   */
  remark(events: NarrationEvent[]): void {
    this.commit();
    this.pages = pageEvents(events);
    this.index = 0;
  }

  /**
   * Turn to the next page. False when the tale is out — at which point the
   * state it produced is set down, and the frame is due an ordinary redraw.
   */
  advance(): boolean {
    if (!this.pages) return false;
    if (this.index + 1 < this.pages.length) {
      this.index += 1;
      return true;
    }
    this.commit();
    return false;
  }

  /** Set down anything a part-told tale had produced, and drop the pages. */
  private commit(): void {
    if (this.pending) {
      const next = this.pending;
      this.pending = null;
      this.settle(next);
    }
    this.pages = null;
    this.index = 0;
  }

  private settle(next: GameState): void {
    this.onSettle?.(this.world, next);
    this.world = next;
  }
}
