import type { NarrationEvent } from '../engine/types';

/**
 * Group a step's narration events into pages of at most `maxPerPage`
 * paragraphs. A `grave` event (a death, faithfully) or a `title` event (an
 * occasion worth dwelling on, such as a save number) always gets a page to
 * itself.
 */
export function pageEvents(events: NarrationEvent[], maxPerPage = 5): NarrationEvent[][] {
  const pages: NarrationEvent[][] = [];
  let current: NarrationEvent[] = [];

  const flush = () => {
    if (current.length) {
      pages.push(current);
      current = [];
    }
  };

  for (const ev of events) {
    if (ev.tone === 'grave' || ev.tone === 'title') {
      flush();
      pages.push([ev]);
      continue;
    }
    current.push(ev);
    if (current.length >= maxPerPage) flush();
  }
  flush();
  return pages;
}
