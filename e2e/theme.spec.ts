import { expect, test, type Browser, type Page } from '@playwright/test';
import { openExample, settle } from './states';

/**
 * The dark theme in a real browser: that it follows the system and the choice in Settings, that it
 * is on the page before the app has loaded, and that an export is drawn exactly as the light theme
 * draws it whichever theme is on screen. jsdom resolves neither `light-dark()` nor media queries, and
 * cannot draw an export at all, so none of this can be checked there.
 */

const PREFERENCES_KEY = 'fretboard-workbench:preferences';
const LIGHT_PAPER = 'rgb(250, 249, 247)';
const DARK_PAPER = 'rgb(27, 26, 24)';
const LIGHT_INK = 'rgb(58, 58, 58)';

const pageColor = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toolbarColors = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => meta.content));

/**
 * A page whose system asks for `scheme`, with the preferences a returning user has and `theme` chosen.
 * Not `open` from states.ts, which stores preferences with no theme on every load.
 */
async function openIn(browser: Browser, baseURL: string | undefined, scheme: 'light' | 'dark', theme?: 'light' | 'dark') {
  const context = await browser.newContext({ baseURL, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(
    ([key, value]) => {
      // Only on the first load, so a choice made in the test survives a reload.
      if (window.localStorage.getItem(key as string) === null) window.localStorage.setItem(key as string, value as string);
    },
    [PREFERENCES_KEY, JSON.stringify({ screen: 'workbench', deleteWarnings: true, tourSeen: true, ...(theme ? { theme } : {}) })],
  );
  return { context, page };
}

test.describe('dark theme', () => {
  test('follows the system, and a choice in Settings overrides it either way and is kept', async ({ browser, baseURL }) => {
    const { context, page } = await openIn(browser, baseURL, 'dark');
    await page.goto('/');
    await page.waitForSelector('.app');
    expect(await pageColor(page), 'dark, from the system').toBe(DARK_PAPER);
    expect(await toolbarColors(page)).toEqual(['#faf9f7', '#1b1a18']);

    await page.locator('[data-settings-tab]').click();
    const theme = page.getByRole('radiogroup', { name: 'Theme' });
    await theme.getByRole('radio', { name: 'Light' }).click();
    expect(await pageColor(page), 'light, chosen over the system').toBe(LIGHT_PAPER);
    expect(await toolbarColors(page), 'the toolbar follows the choice').toEqual(['#faf9f7', '#faf9f7']);

    await page.reload();
    await page.waitForSelector('.app');
    expect(await pageColor(page), 'the choice is kept').toBe(LIGHT_PAPER);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.locator('[data-settings-tab]').click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click();
    expect(await pageColor(page), 'dark, chosen over a light system').toBe(DARK_PAPER);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');

    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'System' }).click();
    expect(await pageColor(page), 'back to the system').toBe(LIGHT_PAPER);
    await context.close();
  });

  test('a stored choice is on the page before the app has loaded', async ({ browser, baseURL }) => {
    const { context, page } = await openIn(browser, baseURL, 'light', 'dark');
    // Without the app's scripts, what paints is the HTML, its inline script and the stylesheet.
    await page.route(/\.js$/, (route) => route.abort());
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    expect(await pageColor(page)).toBe(DARK_PAPER);
    await context.close();
  });

  test('an export is drawn the same in either theme, on white, in the light colors', async ({ browser, baseURL }) => {
    const previews: string[][] = [];
    for (const [scheme, theme] of [
      ['light', undefined],
      ['dark', undefined],
      ['light', 'dark'],
    ] as const) {
      const { context, page } = await openIn(browser, baseURL, scheme, theme);
      // As STATES.export does it.
      await page.goto('/');
      await page.waitForSelector('.app');
      await openExample(page, 'short');
      await page.locator('[data-tour="export"]').click();
      await page.getByRole('dialog', { name: 'Export preset' }).waitFor();
      await page.locator('.export-preview img').first().waitFor({ timeout: 30_000 });
      await settle(page);
      const reading = await page.evaluate(() => {
        const sheet = document.querySelector('.export-sheet');
        const style = sheet ? getComputedStyle(sheet) : null;
        return {
          pageColor: getComputedStyle(document.body).backgroundColor,
          sheet: style ? [style.backgroundColor, style.color, style.colorScheme] : null,
          images: [...document.querySelectorAll<HTMLImageElement>('.export-preview img')].map((img) => img.src),
        };
      });
      const label = `${scheme} system${theme ? `, ${theme} chosen` : ''}`;
      expect(reading.pageColor, label).toBe(scheme === 'dark' || theme === 'dark' ? DARK_PAPER : LIGHT_PAPER);
      // The sheet the export is laid out from, off screen, is in the light colors whatever the page is.
      expect(reading.sheet, label).toEqual([LIGHT_PAPER, LIGHT_INK, 'light']);
      expect(reading.images.length, label).toBeGreaterThan(0);
      previews.push(reading.images);
      await context.close();
    }
    // Byte for byte: the same pages, whichever theme the dialog was opened in.
    expect(previews[1], 'dark system').toEqual(previews[0]);
    expect(previews[2], 'dark chosen').toEqual(previews[0]);
  });
});
