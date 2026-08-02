import type { NarrationEvent } from '../engine/types';

/**
 * Break one event's text where its author left a blank line. The event remains
 * a single unit for paging; it is only set as several paragraphs.
 */
export function paragraphsOf(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0);
  return paragraphs.length ? paragraphs : [text];
}

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
