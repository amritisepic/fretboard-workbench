import { usePreferences, type ThemeChoice } from './preferences';

/**
 * The color the browser paints its own toolbar in, for each theme: the page's color, as `--paper`
 * declares it. `index.html` carries the same two values in its theme-color tags for the first paint;
 * a test holds all three places to one another.
 */
export const THEME_COLOR = { light: '#faf9f7', dark: '#1b1a18' } as const;

/**
 * Puts a theme choice on the page. The stylesheet does the rest: `data-theme` on `<html>` overrides
 * the system's setting, and no attribute follows it.
 *
 * The browser's toolbar color comes from the theme-color tags, one per system setting, and a manual
 * choice has to override those too, or a dark page would sit under a light toolbar. So each tag is
 * given the chosen theme's color, or its own again when the choice goes back to the system.
 */
export function applyTheme(choice: ThemeChoice, doc: Document = document): void {
  const root = doc.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = (meta.getAttribute('media') ?? '').includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLOR[choice === 'system' ? own : choice];
  }
}

/**
 * Applies the stored theme now, and again whenever it changes. `index.html` has already set the
 * attribute before the first paint; this takes over from it, and adds the toolbar color, which does
 * not affect the page and so can wait for the app. Returns the unsubscribe.
 */
export function followThemePreference(doc: Document = document): () => void {
  applyTheme(usePreferences.getState().theme, doc);
  return usePreferences.subscribe((state, previous) => {
    if (state.theme !== previous.theme) applyTheme(state.theme, doc);
  });
}
