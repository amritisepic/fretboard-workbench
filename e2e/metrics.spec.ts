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
  /** Elements in the document for the 31-chord progression. Plan item 6 should cut this by ~85%. */
  readonly domNodesOnLong: number;
  /** Controls under the WCAG 2.2 minimum of 24 CSS px. Plan item 7 takes this to zero. */
  readonly targetsUnder24: number;
  /** The smallest tap target, in CSS px. A floor: 24 is the minimum, 44 the touch guideline. */
  readonly smallestTarget: number;
  /** Fret wires a board draws. A chord chart shows a window, not the whole neck. */
  readonly fretsDrawn: number;
  /** The smallest fretboard position, in CSS px. A floor: WCAG 2.2 asks for 24. */
  readonly smallestBoardTarget: number;
  /** How far apart the boards in a row start, in pixels. Zero since the analysis left the header. */
  readonly nutSpread: number;
};

/**
 * Measured on 2026-09-17, then rounded outward by a hair so antialiasing cannot make a run flaky.
 *
 * Reading them: on every width 27–29% of the screen goes on chrome before the first chord; about
 * three quarters of an ordinary fretboard is empty grid, and 95% of one holding a jazz voicing; the
 * phone toolbar is nearly four screens wide with no scrollbar; and the 31-chord standard puts 11.4k
 * elements on the page to show one chord on a phone and three on a laptop.
 */
// `boardWasteOnLong` was loosened from 0.87 to 0.89 on purpose. Every chart now keeps the same head —
// the string names and the open-string run — whether it shows the nut or a window up the neck, so
// that a row mixing the two starts its shapes at the same height. A board up the neck used to start
// its grid 48px higher than an open-position board beside it, and `nutSpread` could not see it
// because it only measured the first row and, on those, the wire a fret below the head. On the jazz
// standard, where most boards are up the neck, that head is 48px of the board with no notes in it.
const BUDGETS: Readonly<Record<string, Budget>> = {
  phone: {
    chromeFraction: 0.275,
    // Loosened from 3.9 when the Board switch was added. A control added to a toolbar that already
    // does not fit makes the overflow worse — at 4.4 roughly three quarters of the controls are off
    // the side of a phone, with no scrollbar to say so. The switch is the point of this phase, so
    // the toolbar is what has to give: plan item 14 moves the display switches into one popover and
    // takes every width back to 1. Until then this records the cost rather than hiding it.
    toolbarOverflow: 4.45,
    boardWaste: 0.37,
    boardWasteOnLong: 0.89,
    chordsVisibleOnLong: 1,
    domNodesOnLong: 4_700,
    targetsUnder24: 20,
    smallestTarget: 16.5,
    fretsDrawn: 7,
    smallestBoardTarget: 24,
    nutSpread: 1,
  },
  tablet: {
    chromeFraction: 0.295,
    // The toolbar is allowed to wrap above 760px, so it fits — at the cost of the extra row that
    // shows up in chromeFraction.
    toolbarOverflow: 1,
    boardWaste: 0.37,
    boardWasteOnLong: 0.89,
    chordsVisibleOnLong: 3,
    domNodesOnLong: 4_700,
    targetsUnder24: 20,
    smallestTarget: 16.5,
    fretsDrawn: 7,
    smallestBoardTarget: 24,
    nutSpread: 1,
  },
  desktop: {
    chromeFraction: 0.285,
    toolbarOverflow: 1,
    boardWaste: 0.37,
    boardWasteOnLong: 0.89,
    chordsVisibleOnLong: 6,
    domNodesOnLong: 4_700,
    targetsUnder24: 20,
    smallestTarget: 16.5,
    fretsDrawn: 7,
    smallestBoardTarget: 24,
    nutSpread: 1,
  },
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

  test('controls are big enough to hit', async ({ page }, testInfo) => {
    const budget = BUDGETS[testInfo.project.name];
    await goTo(page, STATES.short);
    const m = await measure(page);
    record('short progression', m);

    expect(m.targetsUnder24, 'controls under 24 CSS px').toBeLessThanOrEqual(budget.targetsUnder24);
    expect(m.smallestTarget, 'the smallest control on screen').toBeGreaterThanOrEqual(budget.smallestTarget);
  });
});
