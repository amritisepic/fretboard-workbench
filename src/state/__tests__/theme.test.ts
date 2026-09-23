// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import css from '../../styles.css?inline';
import { rootColorTokens } from '../../design/contrast';
import { resetStores } from '../../test/fixtures';
import { PREFERENCES_KEY, usePreferences } from '../preferences';
import { THEME_COLOR, applyTheme, followThemePreference } from '../theme';

/** The theme-color tags index.html ships, put into the test document's head. */
const THEME_COLOR_TAGS = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map((match) => match[0]);

/** The script index.html runs before the first paint. */
const PRE_PAINT = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

const metas = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => ({
    media: meta.getAttribute('media'),
    content: meta.content,
  }));

beforeEach(() => {
  resetStores();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = THEME_COLOR_TAGS.join('');
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('the theme before the app has loaded', () => {
  const runPrePaint = () => new Function(PRE_PAINT)();

  it('puts a stored choice on the page', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ screen: 'workbench', theme: 'dark' }));
    runPrePaint();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('leaves the page following the system when nothing is chosen, or nothing usable is stored', () => {
    for (const stored of [
      null,
      JSON.stringify({ screen: 'workbench', deleteWarnings: true, tourSeen: true }),
      JSON.stringify({ theme: 'system' }),
      JSON.stringify({ theme: 'sepia' }),
      'not json',
    ]) {
      localStorage.clear();
      if (stored !== null) localStorage.setItem(PREFERENCES_KEY, stored);
      expect(runPrePaint).not.toThrow();
      expect(document.documentElement.dataset.theme, String(stored)).toBeUndefined();
    }
  });

  it('reads the key the app stores its preferences under', () => {
    // The script cannot import the constant, so it spells it out; this is what keeps the two alike.
    expect(PRE_PAINT).toContain(`'${PREFERENCES_KEY}'`);
  });

  it("gives the browser's toolbar each theme's page color, for the system setting", () => {
    expect(metas()).toEqual([
      { media: '(prefers-color-scheme: light)', content: THEME_COLOR.light },
      { media: '(prefers-color-scheme: dark)', content: THEME_COLOR.dark },
    ]);
    expect(THEME_COLOR.light).toBe(rootColorTokens(css, 'light').paper);
    expect(THEME_COLOR.dark).toBe(rootColorTokens(css, 'dark').paper);
  });
});

describe('the theme once the app is running', () => {
  it('overrides the system with a choice, and hands back to it', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    // A dark page under a light toolbar would give the choice away, so both tags follow it.
    expect(metas().map((meta) => meta.content)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);

    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(metas().map((meta) => meta.content)).toEqual([THEME_COLOR.light, THEME_COLOR.light]);

    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(metas().map((meta) => meta.content)).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
  });

  it('follows the choice in Settings, and keeps it for next time', () => {
    const stop = followThemePreference();
    expect(document.documentElement.dataset.theme).toBeUndefined();

    usePreferences.getState().setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')).toMatchObject({ theme: 'dark' });

    usePreferences.getState().setTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    stop();

    usePreferences.getState().setTheme('light');
    expect(document.documentElement.dataset.theme, 'still following after it was stopped').toBeUndefined();
  });
});
