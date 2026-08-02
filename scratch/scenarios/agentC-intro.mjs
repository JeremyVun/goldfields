/**
 * The arrival passage: land on the reckoning screen and press "Begin a new
 * game", which tells intro.arrival — a three-paragraph passage written with
 * blank lines between its paragraphs.
 */
export const seed = 4;
export const screen = 'end';
export const keys = ['2'];

export function setup(d) {
  d.begin();
  d.state.screen = 'end';
  return d.state;
}
