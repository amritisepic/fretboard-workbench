import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: screenshot baselines and the layout measurements the design work has to move.
 * Run with `npm run test:e2e`; `npm run test:e2e -- --update-snapshots` takes new baselines.
 *
 * These are deliberately not part of `npm test`, which the deploy workflow runs: they need a build
 * and a browser, and their screenshots are platform-specific.
 *
 * Playwright names each screenshot after the platform it was taken on, so a baseline taken on Linux
 * (this repo's CI) does not fail a run on Windows; that run reports a missing snapshot and writes
 * its own. Only the Linux baselines are committed.
 */

/** Set when the browser is somewhere other than where Playwright expects it, as in a container. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  expect: {
    // A little antialiasing drift between runs is not a design regression.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },

  use: {
    baseURL: 'http://localhost:4173',
    // The offline notice appears on its own timer once the worker registers, which would make every
    // screenshot a race. Nothing under test needs the worker.
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },

  // One project per width, so each keeps its own baselines and the measurements are reported per
  // screen size. The widths match the stylesheet's breakpoints: phones at 760px and below, tablets
  // at 1024px and below.
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
