import type { Page } from '@playwright/test';

/**
 * The six states the visual baselines and the measurements are taken in. They are named once here so
 * both suites cover the same ground and a state can be added in one place.
 */
export const STATES = {
  /** First run, with the tour already seen: what a returning user opens onto. */
  empty: 'empty',
  /** Four chords in one key: the ordinary case. */
  short: 'short-progression',
  /** 31 chords: the longest thing a user is likely to open. */
  long: 'long-progression',
  /** A chord selected, so the sidebar is open over (or beside) the canvas. */
  sidebar: 'sidebar',
  /** The export dialog with its preview drawn. */
  export: 'export-dialog',
  /** View mode: the whole progression scaled to fit. */
  view: 'view-mode',
  /**
   * Analysis tags of differing length, one of which wraps to a second line. The ordinary fixtures
   * all have one-line tags and so never showed that a taller card pushes its board down.
   */
  tags: 'analysis-tags',
} as const;

const EXAMPLES = {
  short: { folder: 'Pop progressions', name: 'I–V–vi–IV' },
  long: { folder: 'Jazz standards', name: 'Autumn Leaves' },
  tags: { folder: 'Jazz standards', name: 'All Blues' },
} as const;

/** localStorage as a returning user has it: the tour seen, so nothing offers itself on load. */
const PREFERENCES = { screen: 'workbench', deleteWarnings: true, tourSeen: true };

/** Opens the app with the first-run prompts already answered. */
export async function open(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, JSON.stringify(value)),
    ['fretboard-workbench:preferences', PREFERENCES] as const,
  );
  await page.goto('/');
  await page.waitForSelector('.app');
}

/** Opens a built-in example from the Presets panel, as a user would. */
export async function openExample(page: Page, which: keyof typeof EXAMPLES): Promise<void> {
  const { folder, name } = EXAMPLES[which];
  await page.locator('[data-tour="presets"]').click();
  await page.getByRole('button', { name: folder, exact: false }).first().click();
  await page.getByText(name, { exact: true }).first().click();
  await page.keyboard.press('Escape');
  await page.locator('.box').first().waitFor();
  await settle(page);
}

/** Waits for fonts and layout to stop moving, so a screenshot is the same every time. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.canvas');
    return !canvas || canvas.getBoundingClientRect().height > 0;
  });
  await page.waitForTimeout(250);
}

/** Puts the app into one of STATES and returns once it has settled. */
export async function goTo(page: Page, state: (typeof STATES)[keyof typeof STATES]): Promise<void> {
  await open(page);
  switch (state) {
    case STATES.empty:
      await settle(page);
      return;
    case STATES.short:
      await openExample(page, 'short');
      return;
    case STATES.long:
      await openExample(page, 'long');
      return;
    case STATES.tags:
      await openExample(page, 'tags');
      return;
    case STATES.sidebar:
      await openExample(page, 'short');
      // By the chord's name, not the middle of the card. The middle of a card is a fretboard cell, and
      // a click there adds a note: the first chord of this fixture was being turned from G into Em/G
      // on its way to the sidebar, and the baseline was a picture of a chord nobody had written.
      await page.locator('.box .box-title').first().click();
      await page.locator('.sidebar').waitFor();
      await settle(page);
      return;
    case STATES.export:
      await openExample(page, 'short');
      await page.locator('[data-tour="export"]').click();
      await page.getByRole('dialog', { name: 'Export preset' }).waitFor();
      // The preview is drawn on a timer after the sheet is laid out.
      await page.locator('.export-preview img').first().waitFor({ timeout: 30_000 });
      await settle(page);
      return;
    case STATES.view:
      await openExample(page, 'long');
      // A real click, at the switch's position. It used to be forced, because the Presets tab covered
      // the Edit/View switch between 761px and 910px and a click there landed on Presets — which made
      // the tablet "view mode" screenshot quietly one of edit mode. The wait is what would have said so.
      await page.getByRole('radio', { name: 'View' }).click();
      await page.locator('.canvas-frame.is-viewing').waitFor();
      await settle(page);
      return;
  }
}
