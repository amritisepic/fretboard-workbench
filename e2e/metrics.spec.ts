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
const BUDGETS: Readonly<Record<string, Budget>> = {
  phone: {
    chromeFraction: 0.275,
    // Loosened from 3.9 when the Board switch was added. A control added to a toolbar that already
    // does not fit makes the overflow worse — at 4.4 roughly three quarters of the controls are off
    // the side of a phone, with no scrollbar to say so. The switch is the point of this phase, so
    // the toolbar is what has to give: plan item 14 moves the display switches into one popover and
    // takes every width back to 1. Until then this records the cost rather than hiding it.
    toolbarOverflow: 4.45,
    boardWaste: 0.735,
    boardWasteOnLong: 0.95,
    chordsVisibleOnLong: 1,
    domNodesOnLong: 11_500,
    targetsUnder24: 320,
    smallestTarget: 21.5,
    fretsDrawn: 12,
    nutSpread: 1,
  },
  tablet: {
    chromeFraction: 0.295,
    // The toolbar is allowed to wrap above 760px, so it fits — at the cost of the extra row that
    // shows up in chromeFraction.
    toolbarOverflow: 1,
    boardWaste: 0.735,
    boardWasteOnLong: 0.95,
    chordsVisibleOnLong: 2,
    domNodesOnLong: 11_500,
    targetsUnder24: 320,
    smallestTarget: 21.5,
    fretsDrawn: 12,
    nutSpread: 1,
  },
  desktop: {
    chromeFraction: 0.285,
    toolbarOverflow: 1,
    boardWaste: 0.735,
    boardWasteOnLong: 0.95,
    chordsVisibleOnLong: 3,
    domNodesOnLong: 11_500,
    targetsUnder24: 320,
    smallestTarget: 21.5,
    fretsDrawn: 12,
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

  test('every control in the top bar can be clicked', async ({ page }, testInfo) => {
    // Known gap. `.topbar` is a three-column grid whose outer columns are minmax(0, 1fr), so the
    // left column shrinks below its content and spills over the ones beside it. The Presets tab
    // carries z-index: 21 and ends up on top, which between 761px and 910px leaves Save, the preset
    // name field and the Edit/View switch covered: a tap on View opens Presets instead. Phones
    // (760px and below) use a different grid and are fine, as is 920px and up.
    //
    // Plan item 21 (Phase 3) rebuilds the top bar; when it lands this passes on every width and the
    // `test.fail` below comes off.
    test.fail(testInfo.project.name === 'tablet');

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
    // A card above one board being taller than the card above another shifts its neck down, and
    // comparing shapes across a row is what the app is for.
    expect(m.nutSpread, 'pixels between the highest and lowest board start in a row').toBeLessThanOrEqual(
      budget.nutSpread,
    );
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
