import { beforeEach, describe, expect, it } from 'vitest';
import { formatTuning } from '../../theory';
import { useWorkbench } from '../workbench';

const initial = useWorkbench.getState();
const state = () => useWorkbench.getState();
const firstBox = () => state().boxes[0];

describe('workbench store', () => {
  beforeEach(() => {
    useWorkbench.setState(initial, true);
  });

  it('starts empty with standard tuning and 24 frets', () => {
    expect(state().boxes).toEqual([]);
    expect(formatTuning(state().settings.tuning)).toBe('E2 A2 D3 G3 B3 E4');
    expect(state().settings.fretCount).toBe(24);
  });

  it('adds and selects a box with a red, unfilled, C Ionian default', () => {
    const id = state().addBox();
    expect(state().selectedBoxId).toBe(id);
    expect(firstBox()).toMatchObject({ color: '#C8372D', labelMode: 'names', fill: { on: false, mode: 'inversion' } });
    state().selectBox(null);
    expect(state().selectedBoxId).toBeNull();
  });

  it('toggles clicked positions with no limit, including several on one string', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 0, fret: 3 });
    state().togglePosition(id, { string: 0, fret: 5 });
    state().togglePosition(id, { string: 0, fret: 7 });
    expect(firstBox().positions).toHaveLength(3);
    state().togglePosition(id, { string: 0, fret: 5 });
    expect(firstBox().positions).toEqual([{ string: 0, fret: 3 }, { string: 0, fret: 7 }]);
  });

  it('moves the fill switch, turns the fill on when a mode is chosen, and toggles', () => {
    const id = state().addBox();
    state().setFillMode(id, 'scale');
    expect(firstBox().fill).toEqual({ on: true, mode: 'scale' });
    state().toggleFill(id);
    expect(firstBox().fill).toEqual({ on: false, mode: 'scale' });
    state().setFillOn(id, true);
    expect(firstBox().fill.on).toBe(true);
  });

  it('adds strings at the low end and keeps clicked notes on their strings', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 0, fret: 3 });
    state().setStringCount(7);
    expect(formatTuning(state().settings.tuning)).toBe('B1 E2 A2 D3 G3 B3 E4');
    expect(firstBox().positions).toEqual([{ string: 1, fret: 3 }]);
    state().setStringCount(5);
    expect(formatTuning(state().settings.tuning)).toBe('A2 D3 G3 B3 E4');
    expect(firstBox().positions).toEqual([]);
  });

  it('applies tuning presets aligned at the high string', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 5, fret: 0 });
    state().applyTuning([35, 40, 45, 50, 55, 59, 64]);
    expect(firstBox().positions).toEqual([{ string: 6, fret: 0 }]);
  });

  it('edits one string pitch', () => {
    state().setStringPitch(0, 38);
    expect(formatTuning(state().settings.tuning)).toBe('D2 A2 D3 G3 B3 E4');
  });

  it('clamps the fret count and drops notes above the last fret', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 2, fret: 15 });
    state().togglePosition(id, { string: 2, fret: 4 });
    state().setFretCount(40);
    expect(state().settings.fretCount).toBe(30);
    state().setFretCount(12);
    expect(state().settings.fretCount).toBe(12);
    expect(firstBox().positions).toEqual([{ string: 2, fret: 4 }]);
  });

  it('removes the selected box and clears the selection', () => {
    const id = state().addBox();
    state().removeBox(id);
    expect(state().boxes).toEqual([]);
    expect(state().selectedBoxId).toBeNull();
  });
});
