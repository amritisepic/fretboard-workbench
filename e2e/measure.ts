import type { Page } from '@playwright/test';

export interface Measurements {
  /** Pixels of app chrome above the first chord card: top bar, toolbar and the bands. */
  readonly chromeAboveFirstChord: number;
  readonly viewportHeight: number;
  /** How much of the screen height is spent before any content, 0–1. */
  readonly chromeFraction: number;
  /** The canvas toolbar's content width over the width it is given: 1 means it fits. */
  readonly toolbarOverflow: number;
  /** Height of one fretboard, and the span its clicked notes actually occupy. */
  readonly boardHeight: number;
  readonly notesSpan: number;
  /** How much of a board is empty grid, 0–1. */
  readonly boardWaste: number;
  /** Chord cards whose box is at least half inside the viewport. */
  readonly chordsVisible: number;
  readonly chordsTotal: number;
  /** Every element in the document, and the share of them inside fretboards. */
  readonly domNodes: number;
  readonly fretboardNodes: number;
  /** Controls whose smaller side is under the WCAG 2.2 minimum of 24 CSS px. */
  readonly targetsUnder24: number;
  readonly targetsTotal: number;
  /** The smallest tap target on screen, so the worst case is visible and not just the count. */
  readonly smallestTarget: number;
  /**
   * The smallest fretboard position. Kept apart from `smallestTarget` because the two are different
   * pieces of work: the board is what the chord-chart window fixed, while the controls that are
   * still small — the strip switches, the function chip, the key-bar choices — belong to the phases
   * that rebuild the key bar and the control vocabulary.
   */
  readonly smallestBoardTarget: number;
  /** Fret wires a board draws. A chord chart shows a window of four or five, not the whole neck. */
  readonly fretsDrawn: number;
  /**
   * How far apart the nuts of the boards in the top row sit along the axis the frets run down, in
   * pixels. Comparing shapes across a progression is what the app is for, so the boards in a row
   * have to start at the same place: anything above a pixel or two means a card above one board is
   * taller than the card above another.
   */
  readonly nutSpread: number;
}

/**
 * Reads the layout as a user meets it. Everything here is a number the design plan is meant to
 * move, so a run before and after a change says plainly whether it worked.
 */
export async function measure(page: Page): Promise<Measurements> {
  return page.evaluate(() => {
    const height = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
    const viewportHeight = window.innerHeight;

    const firstBox = document.querySelector('.box');
    const chromeAboveFirstChord = firstBox ? Math.max(0, firstBox.getBoundingClientRect().top) : height('.topbar') + height('.canvas-toolbar');

    const toolbar = document.querySelector('.canvas-toolbar');
    const toolbarOverflow = toolbar && toolbar.clientWidth > 0 ? toolbar.scrollWidth / toolbar.clientWidth : 1;

    const board = document.querySelector('.fretboard');
    const boardBox = board?.getBoundingClientRect();
    const clicked = board ? [...board.querySelectorAll('.is-clicked')].map((n) => n.getBoundingClientRect()) : [];
    const boardHeight = boardBox?.height ?? 0;
    const notesSpan =
      clicked.length > 0 ? Math.max(...clicked.map((c) => c.bottom)) - Math.min(...clicked.map((c) => c.top)) : 0;

    const cards = [...document.querySelectorAll('.box')];
    const chordsVisible = cards.filter((card) => {
      const r = card.getBoundingClientRect();
      const shown = Math.min(r.bottom, viewportHeight) - Math.max(r.top, 0);
      return r.width > 0 && shown > r.height / 2 && r.left < window.innerWidth && r.right > 0;
    }).length;

    // Anything a pointer is meant to hit, fretboard positions included: clicking them is the app's
    // main interaction. `.position` rather than the circle inside it — a position with nothing drawn
    // on it is a single rect now, and those are exactly the cells you click to add a note, so
    // counting only the drawn notes would measure the easy half and call it a pass.
    const controls = [
      ...document.querySelectorAll<HTMLElement | SVGElement>(
        'button, select, input, [role="switch"], [role="radio"], [role="menuitem"], .fretboard .position',
      ),
    ];
    const sizes = controls
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => Math.min(r.width, r.height));

    // Boards in the first row: the ones whose top edge matches the topmost board.
    const boards = [...document.querySelectorAll('.fretboard')];
    const tops = boards.map((b) => b.getBoundingClientRect().top);
    const rowTop = tops.length > 0 ? Math.min(...tops) : 0;
    const firstRow = boards.filter((_, i) => Math.abs(tops[i] - rowTop) < 200);
    // A nut is only drawn when the window includes the open strings; a board showing a window up
    // the neck has none, and then the neck's own start is what has to line up.
    const startOf = (board: Element) => {
      const nut = board.querySelector('.nut') ?? board.querySelector('.wire');
      return nut ? nut.getBoundingClientRect().top : board.getBoundingClientRect().top;
    };
    const starts = firstRow.map(startOf);

    const positionSides = [...document.querySelectorAll('.fretboard .position')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => Math.min(r.width, r.height));

    return {
      smallestBoardTarget: positionSides.length > 0 ? Number(Math.min(...positionSides).toFixed(1)) : 0,
      fretsDrawn: board ? board.querySelectorAll('.wire').length : 0,
      nutSpread: starts.length > 1 ? Math.round(Math.max(...starts) - Math.min(...starts)) : 0,
      chromeAboveFirstChord: Math.round(chromeAboveFirstChord),
      viewportHeight,
      chromeFraction: Number((chromeAboveFirstChord / viewportHeight).toFixed(3)),
      toolbarOverflow: Number(toolbarOverflow.toFixed(2)),
      boardHeight: Math.round(boardHeight),
      notesSpan: Math.round(notesSpan),
      boardWaste: boardHeight > 0 ? Number((1 - notesSpan / boardHeight).toFixed(3)) : 0,
      chordsVisible,
      chordsTotal: cards.length,
      domNodes: document.querySelectorAll('*').length,
      fretboardNodes: document.querySelectorAll('.fretboard *').length,
      targetsUnder24: sizes.filter((size) => size < 24).length,
      targetsTotal: sizes.length,
      smallestTarget: sizes.length > 0 ? Number(Math.min(...sizes).toFixed(1)) : 0,
    };
  });
}
