import { expect, test } from '@playwright/test';
import { measure, type Measurements } from './measure';
import { STATES, goTo } from './states';

/**
 * The numbers the design work has to move, measured in a real browser.
 *
 * Every budget below is the value measured today, so nothing can get worse without the build saying
 * so. They are ceilings and floors, not targets: the target for each is in the plan, and a phase
 * that lands should tighten the budget here in the same change. A budget that has to be loosened is
 * a regression, and the reason for it belongs in the commit message.
 */

type Budget = {
  /** Share of the screen spent on chrome before the first chord. */
  readonly chromeFraction: number;
  /** Toolbar content width over available width. Anything above 1 is hidden off-screen. */
  readonly toolbarOverflow: number;
  /** Share of a fretboard that is empty grid, on a four-chord progression. */
  readonly boardWaste: number;
  /** The same on the 31-chord standard, whose tight jazz voicings are the worst case. */
  readonly boardWasteOnLong: number;
  /** Chords of Autumn Leaves (31 of them) on screen at once. A floor: it should go up. */
  readonly chordsVisibleOnLong: number;
  /**
   * Elements in the document for the 31-chord progression. The plan's target of 2,000 is out of reach
   * since every fretboard position became a real control with its own name and tab stop.
   */
  readonly domNodesOnLong: number;
  /** Controls under the WCAG 2.2 minimum of 24 CSS px, on every fixture. Zero, and it stays zero. */
  readonly targetsUnder24: number;
  /** The smallest tap target, in CSS px. A floor: 24 is the minimum, 44 the touch guideline. */
  readonly smallestTarget: number;
  /** Fret wires a board draws. A chord chart shows a window, not the whole neck. */
  readonly fretsDrawn: number;
  /** The smallest fretboard position, in CSS px. A floor: WCAG 2.2 asks for 24. */
  readonly smallestBoardTarget: number;
  /** How far apart the boards in a row start, in pixels, for the worst row on the page. */
  readonly nutSpread: number;
};

/**
 * Measured on 2026-09-23, after every phase of the design plan, then rounded outward by a hair so
 * antialiasing cannot make a run flaky. Ceilings and floors, not targets: a change that improves one
 * tightens it here in the same commit.
 *
 * Reading them against where they started (2026-09-17): chrome before the first chord is 16–22% of
 * the screen, down from 27–29%; the phone toolbar fits, down from nearly four screens wide; an
 * ordinary fretboard is 35% empty grid, down from 73%; the 31-chord standard shows 2 / 4 / 9 chords
 * at once, up from 1 / 2 / 3, with 4.2k elements, down from 11.4k; and nothing a pointer aims at is
 * under 24px, down from 316 of 366 controls.
 *
 * `boardWasteOnLong` is the one that went the other way in the last phase, from 0.856 to 0.883, and on
 * purpose: every chart keeps the same head — the string names and the open-string run — whether it
 * shows the nut or a window up the neck, so that a row mixing the two starts its shapes at one
 * height. On the jazz standard, where most boards are up the neck, that head holds no notes.
 */
const EVERY_WIDTH = {
  toolbarOverflow: 1,
  boardWaste: 0.36,
  boardWasteOnLong: 0.89,
  domNodesOnLong: 4_300,
  targetsUnder24: 0,
  smallestTarget: 24,
  fretsDrawn: 6,
  smallestBoardTarget: 26,
  nutSpread: 1,
} as const;

const BUDGETS: Readonly<Record<string, Budget>> = {
  phone: { ...EVERY_WIDTH, chromeFraction: 0.225, chordsVisibleOnLong: 2 },
  tablet: { ...EVERY_WIDTH, chromeFraction: 0.165, chordsVisibleOnLong: 4 },
  desktop: { ...EVERY_WIDTH, chromeFraction: 0.19, chordsVisibleOnLong: 9 },
};

/** Puts the reading in the report, so a run is a record and not only a pass or a fail. */
function record(title: string, measurements: Measurements): void {
  test.info().annotations.push({ type: 'measured', description: `${title} — ${JSON.stringify(measurements)}` });
}

test.describe('layout budgets', () => {
  test('chrome leaves room for the music', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.short);
    const m = await measure(page);
    record('short progression', m);

    expect(m.chromeFraction, 'share of the screen spent before the first chord').toBeLessThanOrEqual(
      budget.chromeFraction,
    );
  });

  test('the toolbar fits the screen it is on', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.short);
    const m = await measure(page);
    record('short progression', m);

    // Above 1 the toolbar scrolls sideways with no scrollbar (scrollbar-width: none), so the
    // controls past the edge cannot be found. Plan item 14 takes every width to 1.
    expect(m.toolbarOverflow, 'toolbar content width over the width available').toBeLessThanOrEqual(
      budget.toolbarOverflow,
    );
  });

  test('a fretboard spends its space on the notes', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.short);
    const m = await measure(page);
    record('short progression', m);

    expect(m.notesSpan, 'the notes were not found on the board').toBeGreaterThan(0);
    expect(m.boardWaste, 'share of the board that is empty grid').toBeLessThanOrEqual(budget.boardWaste);
  });

  test('a long progression can be read and is not ruinous to render', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.long);
    const m = await measure(page);
    record('Autumn Leaves', m);

    expect(m.chordsTotal, 'the fixture is the 31-chord standard').toBe(31);
    expect(m.chordsVisible, 'chords on screen at once').toBeGreaterThanOrEqual(budget.chordsVisibleOnLong);
    expect(m.domNodes, 'elements in the document').toBeLessThanOrEqual(budget.domNodesOnLong);
    expect(m.boardWaste, 'share of a board that is empty grid').toBeLessThanOrEqual(budget.boardWasteOnLong);
  });

  test('every control in the top bar can be clicked', async ({ page }) => {
    await goTo(page, STATES.short);
    const covered = await page.evaluate(() =>
      [...document.querySelectorAll('.topbar button, .topbar [role="radio"], .topbar input')]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit !== el && !el.contains(hit);
        })
        .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim()),
    );
    expect(covered, 'top-bar controls covered by another element').toEqual([]);
  });

  test('a board draws a window, and the boards in a row start together', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.tags);
    const m = await measure(page);
    record('All Blues', m);

    // The whole neck for a shape that spans three frets is the thing this phase is about.
    expect(m.fretsDrawn, 'fret wires drawn on one board').toBeLessThanOrEqual(budget.fretsDrawn);
    // Every place a note can go is now at least the WCAG minimum; the controls still under it are
    // the strip switches, the function chip and the key-bar choices, which later phases rebuild.
    expect(m.smallestBoardTarget, 'the smallest place a note can be put').toBeGreaterThanOrEqual(
      budget.smallestBoardTarget,
    );
    // A card above one board being taller than the card above another shifts its neck down, and
    // comparing shapes across a row is what the app is for.
    expect(m.nutSpread, 'pixels between the highest and lowest board start in a row').toBeLessThanOrEqual(
      budget.nutSpread,
    );
  });

  test('view mode stays readable, scrolling rather than shrinking past the floor', async ({ page }) => {
    await goTo(page, STATES.view);
    const reading = await page.evaluate(() => {
      const frame = document.querySelector('.canvas-frame.is-viewing');
      const canvas = frame?.querySelector(':scope > .canvas');
      if (!frame || !canvas) return null;
      const scale = new DOMMatrix(getComputedStyle(canvas).transform).a;
      // The chord names and the fret numbers: the largest and the smallest text a board carries, as
      // they land on the screen once the canvas is scaled.
      const sizes = [...canvas.querySelectorAll('.box-title, .fret-number')].map(
        (el) => parseFloat(getComputedStyle(el).fontSize) * scale,
      );
      const boxes = [...canvas.querySelectorAll('.box')];
      const last = boxes[boxes.length - 1].getBoundingClientRect();
      const top = frame.getBoundingClientRect().top;
      return {
        scale: Number(scale.toFixed(3)),
        smallestText: Number(Math.min(...sizes).toFixed(2)),
        scrollHeight: frame.scrollHeight,
        lastCardBottom: Math.floor(last.bottom - top + frame.scrollTop),
      };
    });
    test.info().annotations.push({ type: 'measured', description: `view mode, Autumn Leaves — ${JSON.stringify(reading)}` });

    expect(reading, 'view mode did not render a scaled canvas').not.toBeNull();
    // Eight CSS pixels is six points, the export's print floor: one answer to "can the smallest label
    // be read" on paper and on screen. Fitting 31 chords to a laptop used to put it near three.
    expect(reading?.smallestText, 'the smallest text on screen, in CSS px').toBeGreaterThanOrEqual(7.95);
    // Past the floor the frame scrolls, and it has to scroll far enough to reach the last chord.
    expect(reading?.scrollHeight, 'how far the frame scrolls').toBeGreaterThanOrEqual(reading?.lastCardBottom ?? Infinity);
  });

  test('the default export prints every label at the print floor or above', async ({ page }) => {
    // Plan item 33: the dialog's default used to print the fret numbers at 4.7 pt. The summary line
    // under the preview says when the smallest text lands under six points; on the default path, for
    // the longest fixture, it must never say so.
    await goTo(page, STATES.long);
    await page.locator('[data-tour="export"]').click();
    const summary = page.locator('.export-summary');
    await summary.waitFor({ timeout: 30_000 });
    await expect(summary).toContainText('pages');
    await expect(summary).not.toContainText('under 6 pt');
  });

  test('controls are big enough to hit', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    // The long fixtures as well as the short one: their key bars carry the rival-reading buttons the
    // ordinary progression never shows, and those were the last controls under the floor.
    for (const [state, title] of [
      [STATES.short, 'short progression'],
      [STATES.long, 'Autumn Leaves'],
      [STATES.tags, 'All Blues'],
    ] as const) {
      await goTo(page, state);
      const m = await measure(page);
      record(title, m);

      expect(m.targetsUnder24, `controls under 24 CSS px, ${title}`).toBeLessThanOrEqual(budget.targetsUnder24);
      expect(m.smallestTarget, `the smallest control on screen, ${title}`).toBeGreaterThanOrEqual(budget.smallestTarget);
    }
  });
});
