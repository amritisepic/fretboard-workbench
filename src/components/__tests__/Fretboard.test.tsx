// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axeRuleIds } from '../../test/axe';
import { C_MAJOR_POSITIONS, boxWithPositions, resetStores, testSettings } from '../../test/fixtures';
import type { PitchClass } from '../../theory';
import { fretWindow, getBoxView, type BoardDot } from '../boardModel';
import { Fretboard, type FretboardProps } from '../Fretboard';

/**
 * One SVG node per rendered element, for the two boards that exist: the windowed one a chord card
 * shows, and the whole neck the scale wizard asks for.
 *
 * Measured today: 72 nodes for the 5-fret window (30 positions), and 137 for the whole 12-fret neck
 * (78 positions), down from 291. Both are ceilings, not targets. The saving is per position: one
 * with nothing drawn on it is a single rect, where it used to be a group holding a circle nobody
 * could see and a label with no text in it.
 *
 * An earlier plan asked for a board under 40 nodes. That was written before the positions became
 * real controls, and it is no longer reachable: each one is a toggle button carrying its own label,
 * pressed state and tab stop, so a 6 × 5 window is 30 elements before a single string is drawn.
 */
const WINDOW_NODE_BUDGET = 72;
const BOARD_NODE_BUDGET = 137;

/** A clicked note at `fret`, for asking the model which window a shape of that reach gets. */
const dotAt = (fret: number): BoardDot => ({ string: 0, fret, pc: 0 as PitchClass, kind: 'strong', selected: true, label: '' });

const box = boxWithPositions(C_MAJOR_POSITIONS);
const view = getBoxView(box, testSettings);
/** The same chord on a board with a capo, whose dots start at the capo rather than at fret 0. */
const capoed = getBoxView(boxWithPositions([{ string: 1, fret: 5 }]), { ...testSettings, capo: 3 });

const props = (overrides: Partial<FretboardProps> = {}): FretboardProps => ({
  tuning: testSettings.tuning,
  fretCount: testSettings.fretCount,
  capo: testSettings.capo,
  orientation: 'vertical',
  fretMarkers: testSettings.fretMarkers,
  dots: view.dots,
  color: '#C8372D',
  interactive: true,
  onToggle: vi.fn(),
  ...overrides,
});

const renderBoard = (overrides: Partial<FretboardProps> = {}) => {
  const p = props(overrides);
  const { container } = render(<Fretboard {...p} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no board rendered');
  const shown = p.window
    ? p.dots.filter((d) => d.fret >= p.window!.first && d.fret <= p.window!.last)
    : p.dots;
  return { svg, dots: shown, onToggle: p.onToggle };
};

/** The index of a position among the `.position` elements, which are rendered in `dots` order. */
const at = (dots: readonly { string: number; fret: number }[], string: number, fret: number) =>
  dots.findIndex((d) => d.string === string && d.fret === fret);

describe('Fretboard', () => {
  beforeEach(resetStores);

  it('draws a position for every string and playable fret, open strings included', () => {
    const { svg, dots } = renderBoard();
    const stringCount = testSettings.tuning.length;
    const perString = testSettings.fretCount + 1;
    expect(dots).toHaveLength(stringCount * perString);
    expect(svg.querySelectorAll('.position')).toHaveLength(stringCount * perString);
  });

  it('marks the clicked notes and leaves the rest of the map empty', () => {
    const { svg, dots } = renderBoard();
    expect(svg.querySelectorAll('.is-clicked')).toHaveLength(C_MAJOR_POSITIONS.length);
    expect(dots.filter((d) => d.selected)).toHaveLength(C_MAJOR_POSITIONS.length);
  });

  it('reports the string and fret of the position that was clicked', () => {
    const { svg, dots, onToggle } = renderBoard();
    // Positions are found by their index among the `.position` elements: the order of `dots`.
    fireEvent.click(svg.querySelectorAll('.position')[at(dots, 2, 5)]);
    expect(onToggle).toHaveBeenCalledExactlyOnceWith({ string: 2, fret: 5 });
  });

  it('ignores clicks in view mode', () => {
    const { svg, onToggle } = renderBoard({ interactive: false });
    expect(svg.classList.contains('is-static')).toBe(true);
    for (const position of svg.querySelectorAll('.position')) fireEvent.click(position);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws the inlays only while fret markers are on', () => {
    expect(renderBoard().svg.querySelectorAll('.inlay').length).toBeGreaterThan(0);
    expect(renderBoard({ fretMarkers: false }).svg.querySelectorAll('.inlay')).toHaveLength(0);
  });

  it('puts the octave fret’s pair of inlays between the strings, not on them', () => {
    // A neck with an odd number of strings is what catches this, and the app ships two: the
    // 7-string and the 5-string bass. A whole string gap either side of the centre puts both
    // inlays exactly on a string there.
    for (const stringCount of [4, 5, 6, 7, 8]) {
      const tuning = testSettings.tuning.slice(0, 1).concat(
        Array.from({ length: stringCount - 1 }, (_, i) => testSettings.tuning[0] + 5 * (i + 1)),
      );
      const { svg } = renderBoard({ tuning, dots: view.dots.filter((d) => d.string < stringCount) });
      const octave = [...svg.querySelectorAll('.inlay')].slice(-2).map((n) => Number(n.getAttribute('cx')));
      const strings = [...svg.querySelectorAll('.string')].map((n) => Number(n.getAttribute('x1')));
      expect(octave, `${stringCount} strings`).toHaveLength(2);
      for (const x of octave) expect(strings, `${stringCount} strings, inlay at ${x}`).not.toContain(x);

      // Straddling the centre of the neck, and roughly a quarter and three quarters across it.
      const span = strings[strings.length - 1] - strings[0];
      const across = octave.map((x) => (x - strings[0]) / span);
      expect(across[0] + across[1], `${stringCount} strings`).toBeCloseTo(1);
      expect(across[0], `${stringCount} strings`).toBeGreaterThanOrEqual(0.15);
      expect(across[0], `${stringCount} strings`).toBeLessThanOrEqual(0.4);
    }
  });

  it('shades the frets a capo covers', () => {
    expect(renderBoard().svg.querySelectorAll('.capo')).toHaveLength(0);
    expect(renderBoard({ capo: 3 }).svg.querySelectorAll('.capo')).toHaveLength(1);
  });

  it('names itself for a screen reader, with the capo when there is one', () => {
    expect(renderBoard().svg.getAttribute('aria-label')).toBe('Fretboard, 6 strings, 12 frets');
    expect(renderBoard({ capo: 3 }).svg.getAttribute('aria-label')).toBe('Fretboard, 6 strings, 12 frets, capo at fret 3');
  });

  it('stays within its DOM budget for one board', () => {
    expect(renderBoard({ window: view.window }).svg.querySelectorAll('*').length).toBeLessThanOrEqual(
      WINDOW_NODE_BUDGET,
    );
    expect(renderBoard().svg.querySelectorAll('*').length).toBeLessThanOrEqual(BOARD_NODE_BUDGET);
  });

  it('draws a position with nothing on it as one element, and still as a control', () => {
    const { svg, dots } = renderBoard();
    const empties = [...svg.querySelectorAll('.position-empty')];
    expect(empties).toHaveLength(dots.filter((d) => d.kind === 'empty').length);
    expect(empties.every((n) => n.children.length === 0)).toBe(true);
    expect(empties.every((n) => n.getAttribute('role') === 'button')).toBe(true);
    expect(empties.every((n) => n.hasAttribute('aria-label') && n.hasAttribute('aria-pressed'))).toBe(true);
    expect(empties.every((n) => n.hasAttribute('data-position') && n.hasAttribute('tabindex'))).toBe(true);
  });

  it('has no axe violations', async () => {
    expect(await axeRuleIds(renderBoard().svg)).toEqual([]);
    expect(await axeRuleIds(renderBoard({ window: { first: 5, last: 9 } }).svg)).toEqual([]);
  });

  it('names every position for a screen reader, saying where it is and what is there', () => {
    const { svg, dots } = renderBoard();
    const positions = [...svg.querySelectorAll('.position')];
    expect(positions.every((p) => p.getAttribute('role') === 'button')).toBe(true);
    expect(positions.every((p) => (p.getAttribute('aria-label') ?? '').length > 0)).toBe(true);

    // Strings are numbered as players number them: 1 is the highest-sounding, the reverse of the
    // index the board draws from.
    expect(positions[at(dots, 5, 0)].getAttribute('aria-label')).toBe('String 1, open, E, not on the map');
    const clicked = at(dots, 1, 3);
    expect(positions[clicked].getAttribute('aria-label')).toBe('String 5, fret 3, C, in chord');
    expect(positions[clicked].getAttribute('aria-pressed')).toBe('true');
  });

  it('is a single tab stop, landing on the first note of the chord', () => {
    const { svg, dots } = renderBoard();
    const stops = [...svg.querySelectorAll('.position')].filter((p) => Number(p.getAttribute('tabindex')) >= 0);
    expect(stops).toHaveLength(1);
    const first = dots.findIndex((d) => d.selected);
    expect(stops[0]).toBe(svg.querySelectorAll('.position')[first]);
  });

  it('activates the position under the cursor with Enter and with Space', () => {
    for (const key of ['Enter', ' ']) {
      const { svg, dots, onToggle } = renderBoard();
      fireEvent.keyDown(svg.querySelectorAll('.position')[at(dots, 2, 5)], { key });
      expect(onToggle, key).toHaveBeenCalledExactlyOnceWith({ string: 2, fret: 5 });
    }
  });

  it('walks the grid with the arrow keys as the board is drawn, in both orientations', () => {
    // A vertical board runs the frets down the page with the lowest string on the left, so Down
    // goes towards the bridge and Right crosses to a higher-sounding string. A horizontal board is
    // the quarter turn of that: Right goes towards the bridge and Up climbs a string.
    const cases = [
      { orientation: 'vertical' as const, key: 'ArrowDown', from: { string: 2, fret: 5 }, to: { string: 2, fret: 6 } },
      { orientation: 'vertical' as const, key: 'ArrowRight', from: { string: 2, fret: 5 }, to: { string: 3, fret: 5 } },
      { orientation: 'horizontal' as const, key: 'ArrowRight', from: { string: 2, fret: 5 }, to: { string: 2, fret: 6 } },
      { orientation: 'horizontal' as const, key: 'ArrowUp', from: { string: 2, fret: 5 }, to: { string: 3, fret: 5 } },
    ];
    for (const { orientation, key, from, to } of cases) {
      const { svg, dots } = renderBoard({ orientation });
      const groups = svg.querySelectorAll('.position');
      fireEvent.keyDown(groups[at(dots, from.string, from.fret)], { key });
      expect(document.activeElement, `${orientation} ${key}`).toBe(groups[at(dots, to.string, to.fret)]);
    }
  });

  it('stays on the board when an arrow key would run off the edge', () => {
    const { svg, dots } = renderBoard();
    const groups = svg.querySelectorAll('.position');
    const corner = at(dots, 0, 0);
    (groups[corner] as SVGElement).focus();
    fireEvent.keyDown(groups[corner], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(groups[corner]);
  });

  // The workbench listens on the window for bare arrow keys (nudge the selected box's root) and for
  // Space (toggle its fill). Inside the board those keys belong to the note under the cursor, so
  // they must not reach the window as well.
  it('keeps the keys it claims away from the app-wide shortcuts', () => {
    const { svg, dots } = renderBoard();
    const seen: string[] = [];
    const listen = (event: KeyboardEvent) => seen.push(event.key);
    window.addEventListener('keydown', listen);
    try {
      const position = svg.querySelectorAll('.position')[at(dots, 2, 5)];
      for (const key of ['ArrowDown', ' ', 'Enter', 'Home', 'End', 'PageDown']) {
        fireEvent.keyDown(position, { key });
      }
    } finally {
      window.removeEventListener('keydown', listen);
    }
    // Only the key the board does not claim gets through.
    expect(seen).toEqual(['PageDown']);
  });

  it('is a drawing and not a control in view mode', () => {
    const { svg } = renderBoard({ interactive: false });
    const positions = [...svg.querySelectorAll('.position')];
    expect(positions.some((p) => p.hasAttribute('role'))).toBe(false);
    expect(positions.some((p) => p.hasAttribute('tabindex'))).toBe(false);
    expect(positions.some((p) => p.hasAttribute('aria-label'))).toBe(false);
  });

  describe('windowed to the frets the shape needs', () => {
    it('draws the frets in the window and nothing outside it', () => {
      const { svg } = renderBoard({ window: { first: 5, last: 9 } });
      const frets = [...svg.querySelectorAll('.position')].map((p) =>
        Number((p.getAttribute('data-position') ?? '').split(':')[1]),
      );
      expect(frets).toHaveLength(testSettings.tuning.length * 5);
      expect(Math.min(...frets)).toBe(5);
      expect(Math.max(...frets)).toBe(9);
    });

    it('draws the nut only while the open strings are in the window, and names the strings on both', () => {
      const open = renderBoard({ window: { first: 0, last: 4 } }).svg;
      expect(open.querySelectorAll('.nut')).toHaveLength(1);
      expect(open.querySelectorAll('.wire.is-head')).toHaveLength(0);
      expect(open.querySelectorAll('.string-name')).toHaveLength(testSettings.tuning.length);

      const high = renderBoard({ window: { first: 5, last: 9 } }).svg;
      expect(high.querySelectorAll('.nut')).toHaveLength(0);
      expect(high.querySelectorAll('.wire.is-head')).toHaveLength(1);
      expect(high.querySelectorAll('.string-name')).toHaveLength(testSettings.tuning.length);
    });

    it('starts a chart up the neck where an open-position chart starts, so their rows line up', () => {
      // A board up the neck used to begin its grid at the top edge, 48px above an open-position
      // board's nut, so any row mixing the two began its shapes at different heights. The windows are
      // the ones the model gives two short shapes.
      const along = (line: Element | null) => Number(line?.getAttribute('y1'));
      const open = renderBoard({ window: fretWindow([dotAt(2)], 0, 12) }).svg;
      const high = renderBoard({ window: fretWindow([dotAt(9)], 0, 12) }).svg;
      expect(along(high.querySelector('.wire.is-head'))).toBe(along(open.querySelector('.nut')));
      // The first wire below the head, which fixes the pitch every row after it follows.
      expect(along(high.querySelector('.wire:not(.is-head)'))).toBe(along(open.querySelector('.wire')));
    });

    it('numbers the first fret of a window that starts up the neck, however it is numbered', () => {
      // 6 is not one of the frets the neck marks, so before the position marker a window starting
      // there carried no number at all.
      const svg = renderBoard({ window: { first: 6, last: 10 } }).svg;
      const marker = svg.querySelector('.fret-number.is-position');
      expect(marker?.textContent).toBe('6');
      // The marker replaces the ordinary number rather than doubling it up.
      const numbers = [...svg.querySelectorAll('.fret-number')].map((n) => n.textContent);
      expect(numbers.filter((n) => n === '6')).toHaveLength(1);
      expect(numbers).toEqual(expect.arrayContaining(['7', '9']));

      // With the nut on show there is nothing to mark a position from, so no marker is drawn.
      expect(renderBoard({ window: { first: 0, last: 4 } }).svg.querySelector('.fret-number.is-position')).toBeNull();
    });

    it('keeps the tab stop and the arrow keys inside the window', () => {
      const fretWindow = { first: 5, last: 9 };
      const { svg, dots } = renderBoard({ window: fretWindow });
      const stops = [...svg.querySelectorAll('.position')].filter((p) => Number(p.getAttribute('tabindex')) >= 0);
      expect(stops).toHaveLength(1);
      // Nothing is clicked inside this window, so the tab stop falls to its first position.
      expect(stops[0].getAttribute('data-position')).toBe('0:5');

      const groups = svg.querySelectorAll('.position');
      const top = groups[at(dots, 2, 5)];
      (top as SVGElement).focus();
      fireEvent.keyDown(top, { key: 'ArrowUp' });
      expect(document.activeElement, 'off the top of the window').toBe(top);
      fireEvent.keyDown(top, { key: 'End' });
      expect(document.activeElement, 'End goes to the last fret in the window').toBe(groups[at(dots, 2, 9)]);
    });

    it('says which frets it is showing, since the rest of the neck is not there to feel for', () => {
      expect(renderBoard({ window: { first: 5, last: 9 } }).svg.getAttribute('aria-label')).toBe(
        'Fretboard, 6 strings, 12 frets, showing frets 5 to 9',
      );
      expect(renderBoard({ window: { first: 0, last: 4 } }).svg.getAttribute('aria-label')).toBe(
        'Fretboard, 6 strings, 12 frets, showing up to fret 4',
      );
    });

    it('keeps the capo drawn as it always was while the open strings are on show', () => {
      // A window that starts at the capo still draws the nut, the frets the capo covers and the
      // capo itself, exactly as an unwindowed board does, so a capo looks the same everywhere in
      // the app. The window crops the far end of the neck; the head of it is the capo's business.
      const svg = renderBoard({ capo: 3, window: { first: 3, last: 7 }, dots: capoed.dots }).svg;
      expect(svg.querySelectorAll('.nut')).toHaveLength(1);
      expect(svg.querySelectorAll('.capo')).toHaveLength(1);
      expect(svg.querySelectorAll('.capo-covered')).toHaveLength(1);
      expect(svg.querySelectorAll('.fret-number.is-position')).toHaveLength(0);
      expect(svg.querySelectorAll('.position')).toHaveLength(testSettings.tuning.length * 5);
      // Still shorter than the whole neck, because the window crops everything past fret 7.
      expect(Number(svg.getAttribute('height'))).toBeLessThan(Number(renderBoard().svg.getAttribute('height')));
    });

    it('is shorter than the whole neck along the frets and no wider across them', () => {
      const whole = renderBoard().svg;
      const windowed = renderBoard({ window: { first: 5, last: 9 } }).svg;
      expect(Number(windowed.getAttribute('height'))).toBeLessThan(Number(whole.getAttribute('height')) / 2);
      expect(windowed.getAttribute('width')).toBe(whole.getAttribute('width'));
    });
  });
});
