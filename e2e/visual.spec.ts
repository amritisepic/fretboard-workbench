import { expect, test } from '@playwright/test';
import { STATES, goTo } from './states';

/**
 * Screenshot baselines for the six states, at each of the three widths in playwright.config.ts.
 *
 * They exist to make a layout change visible in review rather than to say a layout is good: most of
 * what they cover today is what the plan sets out to change, and a deliberate change is accepted by
 * rerunning with `--update-snapshots` so the new picture lands in the diff.
 */
test.describe('layout', () => {
  for (const state of Object.values(STATES)) {
    test(state, async ({ page }) => {
      await goTo(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`);
    });
  }
});
