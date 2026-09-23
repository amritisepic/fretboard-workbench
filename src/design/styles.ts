/**
 * Every stylesheet in `src/styles/`, as text, in the order the page cascades them: the four that load
 * on first paint (`main.tsx`), then the three that arrive with their chunks. The design tests read the
 * stylesheet through this rather than through any one file, so a rule cannot escape them by living in
 * a sheet that happens to be split out.
 */
const sheets = import.meta.glob<string>('../styles/*.css', { query: '?inline', import: 'default', eager: true });

/** Load order. A sheet in the folder but missing here fails the test beside this module. */
export const SHEET_ORDER = ['base', 'workbench', 'sidebar', 'panels', 'wizard', 'export', 'tour'] as const;

export const sheetNames = (): string[] =>
  Object.keys(sheets).map((path) => path.replace(/^.*\/(.+)\.css$/, '$1'));

/** One sheet's text. */
export const sheet = (name: (typeof SHEET_ORDER)[number]): string => sheets[`../styles/${name}.css`] ?? '';

/** The whole stylesheet, every sheet in cascade order. */
export const css = SHEET_ORDER.map(sheet).join('\n');
