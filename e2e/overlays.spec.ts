import { expect, test } from '@playwright/test';
import { STATES, goTo, open, settle } from './states';

/**
 * What the overlays owe the user, checked in a real browser because jsdom cannot answer these.
 *
 * The modal layers mark the page behind them `inert`, which jsdom does not implement, and focus
 * moves according to rules jsdom does not enforce — it will happily focus a hidden element, where a
 * browser will not. That difference hid a real regression: the guided tour's card is hidden while it
 * is measured against the step's target, so focusing it on mount silently did nothing, focus stayed
 * on the body, and the card's Escape handler — the one thing that ends the tour — never saw the key.
 * Every test here failed to fail in jsdom.
 */

const inertCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelectorAll('[inert]').length);

test.describe('overlays', () => {
  test('Escape ends the guided tour, and leaves nothing inert behind', async ({ page }) => {
    await open(page);
    await settle(page);
    await page.locator('[data-tour="guide"]').click();
    await page.locator('.tour-card').waitFor();
    await page.waitForTimeout(400);

    // The card has to hold focus, or Escape never reaches the handler that ends the tour.
    await expect(page.locator('.tour-card')).toBeFocused();
    expect(await inertCount(page), 'the page behind a modal layer is inert').toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
    expect(await inertCount(page), 'inert is lifted when the layer closes').toBe(0);
  });

  test('Escape ends the tour part-way through, once it has opened panels of its own', async ({ page }) => {
    await open(page);
    await settle(page);
    await page.locator('[data-tour="guide"]').click();
    await page.locator('.tour-card').waitFor();
    await page.waitForTimeout(400);

    for (let step = 0; step < 6; step++) {
      const next = page.locator('.tour-card button').filter({ hasText: /^(Next|Start)/ });
      if ((await next.count()) === 0) break;
      await next.last().click();
      await page.waitForTimeout(250);
    }
    await expect(page.locator('.tour-card'), 'focus follows the card from step to step').toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
    expect(await inertCount(page)).toBe(0);
    // The tour puts the workbench back as it found it.
    await expect(page.locator('.empty-state')).toHaveCount(1);
  });

  test('a confirmation traps Tab, and hands focus back when it closes', async ({ page }) => {
    await goTo(page, STATES.short);
    const remove = page.locator('.box-remove').first();
    await remove.click();
    await page.getByRole('alertdialog').waitFor();

    // Cancel is focused first, so Enter is never the destructive answer.
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
    expect(await inertCount(page)).toBeGreaterThan(0);

    // Tab cannot leave: two stops in the dialog, so two presses come back round.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(await inertCount(page)).toBe(0);
    await expect(page.locator('.box')).toHaveCount(4);
  });

  test('the settings panel stays non-modal, and gives the tab its focus back', async ({ page }) => {
    await goTo(page, STATES.short);
    const tab = page.locator('[data-settings-tab]');
    await tab.click();
    const panel = page.locator('.settings-panel');
    await panel.waitFor();

    // It hangs off a tab with the canvas still live behind it, so it is a popover, not a modal.
    expect(await panel.getAttribute('aria-modal'), 'a non-modal dialog must not claim aria-modal').toBeNull();
    expect(await inertCount(page), 'nothing behind a popover is inert').toBe(0);
    await expect(panel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(tab).toBeFocused();
  });
});
