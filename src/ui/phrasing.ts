/**
 * The game speaks of keys — the SPACE BAR to begin, RETURN to send a number —
 * because the machine it is copied from had nothing else. A phone has no such
 * keys and never will, and an instruction that cannot be followed is worse
 * than none: it tells a player the way in is somewhere they cannot reach.
 *
 * So the frame keeps the engine's words and rewrites only the handful that
 * name a key, and only where there is no keyboard to press. The rewriting is a
 * fixed table, not a guess; `tests/responsive.test.ts` walks the screens that
 * carry these lines and fails if one of them stops being caught.
 */

const TOUCH_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/Press the SPACE BAR to start\./g, 'Touch a line below to start.'],
  [/Press the SPACE BAR to go ashore/g, 'Touch here to go ashore'],
  [/press the SPACE BAR for more/g, 'touch the page for more'],
  [/,? and press RETURN\./g, ', then touch “Take it up”.'],
];

/** Any phrase naming a key that a touch screen has not got. */
export const KEYBOARD_PHRASE = /SPACE BAR|press RETURN/i;

/** The same line, said in a way a player with no keyboard can act on. */
export function forTouch(line: string): string {
  let out = line;
  for (const [pattern, replacement] of TOUCH_PHRASES) out = out.replace(pattern, replacement);
  return out;
}

/** How a menu item's key is written in its column. */
export function keyLabel(key: string, touch: boolean): string {
  if (key !== ' ') return key;
  return touch ? 'TAP' : 'SPACE';
}

/**
 * Whether the player is working by finger rather than by pointer. Asked of the
 * glass rather than of the user agent string, and asked afresh each render, so
 * that a tablet with a keyboard folded on and off it keeps up.
 */
export function isTouch(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: none)').matches;
}

/** Tells `cb` whenever the glass gains or loses a pointer that can hover. */
export function onInputModeChange(cb: () => void): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const mq = window.matchMedia('(hover: none)');
  if (mq.addEventListener) mq.addEventListener('change', cb);
  else mq.addListener(cb); // Safari before 14
}
