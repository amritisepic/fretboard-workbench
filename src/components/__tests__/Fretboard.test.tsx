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

  // ---- Known gaps -------------------------------------------------------
  // Clicking notes onto the neck is the app's primary interaction and it is pointer-only: the
  // positions are bare <circle onClick>. Plan item 26 (Phase 4) makes them real controls.

  it.fails('lets the keyboard reach a position', () => {
    const { svg } = renderBoard();
    const position = svg.querySelector('.position circle') as SVGElement;
    expect(position.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it.fails('names each position for a screen reader', () => {
    const { svg } = renderBoard();
    const positions = [...svg.querySelectorAll('.position')];
    expect(positions.every((p) => p.getAttribute('aria-label') ?? p.getAttribute('role'))).toBeTruthy();
  });

  it.fails('activates a position with the keyboard', () => {
    const { svg, onToggle } = renderBoard();
    fireEvent.keyDown(svg.querySelector('.position circle') as Element, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalled();
  });
});
