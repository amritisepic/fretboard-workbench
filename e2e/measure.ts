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

    // Anything a pointer is meant to hit. Fretboard positions are counted because clicking them is
    // the app's main interaction, even though they are not real controls yet.
    const controls = [
      ...document.querySelectorAll<HTMLElement | SVGElement>(
        'button, select, input, [role="switch"], [role="radio"], [role="menuitem"], .fretboard .position circle',
      ),
    ];
    const sizes = controls
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => Math.min(r.width, r.height));

    return {
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
