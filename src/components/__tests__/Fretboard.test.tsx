// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axeRuleIds } from '../../test/axe';
import { C_MAJOR_POSITIONS, boxWithPositions, resetStores, testSettings } from '../../test/fixtures';
import { getBoxView } from '../boardModel';
import { Fretboard, type FretboardProps } from '../Fretboard';

/**
 * One SVG node per rendered element. The board draws every playable position whether or not a note
 * sits there, so this number is dominated by empty positions: 6 strings × 13 frets, each a group
 * holding a circle and a label.
 *
 * Measured today: 291 nodes for 78 positions. This is a ceiling, not a target. Plan item 6
 * (Phase 1) replaces the empty positions with per-string hit zones and should bring one board
 * under 40 nodes; until then this keeps it from growing.
 */
const BOARD_NODE_BUDGET = 300;

const box = boxWithPositions(C_MAJOR_POSITIONS);

const props = (overrides: Partial<FretboardProps> = {}): FretboardProps => ({
  tuning: testSettings.tuning,
  fretCount: testSettings.fretCount,
  capo: testSettings.capo,
  orientation: 'vertical',
  fretMarkers: testSettings.fretMarkers,
  dots: getBoxView(box, testSettings).dots,
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
  return { svg, dots: p.dots, onToggle: p.onToggle };
};

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
    // Positions are found by their index among the `.position` groups: the order of `dots`.
    const index = dots.findIndex((d) => d.string === 2 && d.fret === 5);
    const group = svg.querySelectorAll('.position')[index];
    fireEvent.click(group.querySelector('circle') as Element);
    expect(onToggle).toHaveBeenCalledExactlyOnceWith({ string: 2, fret: 5 });
  });

  it('ignores clicks in view mode', () => {
    const { svg, onToggle } = renderBoard({ interactive: false });
    expect(svg.classList.contains('is-static')).toBe(true);
    for (const circle of svg.querySelectorAll('.position circle')) fireEvent.click(circle);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws the inlays only while fret markers are on', () => {
    expect(renderBoard().svg.querySelectorAll('.inlay').length).toBeGreaterThan(0);
    expect(renderBoard({ fretMarkers: false }).svg.querySelectorAll('.inlay')).toHaveLength(0);
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
    const { svg } = renderBoard();
    expect(svg.querySelectorAll('*').length).toBeLessThanOrEqual(BOARD_NODE_BUDGET);
  });

  it('has no axe violations', async () => {
    expect(await axeRuleIds(renderBoard().svg)).toEqual([]);
  });

  it('names every position for a screen reader, saying where it is and what is there', () => {
    const { svg, dots } = renderBoard();
    const positions = [...svg.querySelectorAll('.position')];
    expect(positions.every((p) => p.getAttribute('role') === 'button')).toBe(true);
    expect(positions.every((p) => (p.getAttribute('aria-label') ?? '').length > 0)).toBe(true);

    // Strings are numbered as players number them: 1 is the highest-sounding, the reverse of the
    // index the board draws from.
    const open = dots.findIndex((d) => d.string === 5 && d.fret === 0);
    expect(positions[open].getAttribute('aria-label')).toBe('String 1, open, E, not on the map');
    const clicked = dots.findIndex((d) => d.string === 1 && d.fret === 3);
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
      const index = dots.findIndex((d) => d.string === 2 && d.fret === 5);
      fireEvent.keyDown(svg.querySelectorAll('.position')[index], { key });
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
      const at = (p: { string: number; fret: number }) => dots.findIndex((d) => d.string === p.string && d.fret === p.fret);
      const groups = svg.querySelectorAll('.position');
      fireEvent.keyDown(groups[at(from)], { key });
      expect(document.activeElement, `${orientation} ${key}`).toBe(groups[at(to)]);
    }
  });

  it('stays on the board when an arrow key would run off the edge', () => {
    const { svg, dots } = renderBoard();
    const groups = svg.querySelectorAll('.position');
    const corner = dots.findIndex((d) => d.string === 0 && d.fret === 0);
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
      const index = dots.findIndex((d) => d.string === 2 && d.fret === 5);
      const group = svg.querySelectorAll('.position')[index];
      for (const key of ['ArrowDown', ' ', 'Enter', 'Home', 'End', 'PageDown']) {
        fireEvent.keyDown(group, { key });
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
});
