/**
 * Colour schemes for the glass. Each theme is a data attribute on <body>;
 * the palette itself lives entirely in styles.css as custom properties.
 */

export interface Theme {
  id: string;
  /** Shown in the picker, in the game's own voice. */
  name: string;
}

export const THEMES: Theme[] = [
  { id: 'paper', name: 'ink on paper' },
  { id: 'noir', name: 'black & white' },
  { id: 'blue', name: 'the deep blue glass' },
];

const THEME_KEY = 'goldrush.theme';
const LEGACY_THEME_KEY = 'goldfields.theme';

export function currentTheme(): Theme {
  const id = document.body.dataset.gfTheme ?? 'paper';
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.body.dataset.gfTheme = theme.id;
  try {
    localStorage.setItem(THEME_KEY, theme.id);
  } catch {
    // A glass with no memory still shows a picture.
  }
}

export function loadTheme(): void {
  let id: string | null = null;
  try {
    id = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
  } catch {
    id = null;
  }
  applyTheme(id ?? 'paper');
}

export function cycleTheme(): Theme {
  const i = THEMES.findIndex((t) => t.id === currentTheme().id);
  applyTheme(THEMES[(i + 1) % THEMES.length].id);
  return currentTheme();
}
