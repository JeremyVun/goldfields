import { say, type Vars } from '../content/say';
import type { RNG } from './rng';
import type { NarrationEvent, Tone } from './types';

/** Collects the narration a step produces, in order. */
export class Log {
  readonly events: NarrationEvent[] = [];

  constructor(private readonly rng: RNG) {}

  /** Emit one of the period-prose variants registered under `key`. */
  say(key: string, vars?: Vars, tone: Tone = 'neutral'): string {
    const text = say(this.rng, key, vars);
    this.events.push({ id: key, text, tone });
    return text;
  }

  /** Emit a line the engine composed itself (tallies, prices, plain report). */
  raw(text: string, tone: Tone = 'neutral', id = 'engine'): void {
    this.events.push({ id, text, tone });
  }

  /** Merge another log's events in. */
  absorb(other: Log): void {
    for (const e of other.events) this.events.push(e);
  }

  get length(): number {
    return this.events.length;
  }
}
