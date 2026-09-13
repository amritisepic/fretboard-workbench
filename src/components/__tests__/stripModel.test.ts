import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings, type StripSettings } from '../../state/workbench';
import { makeScaleRef, type FretPosition, type ScaleRef } from '../../theory';
import { buildCanvasModel } from '../canvasModel';
import { buildStripView } from '../stripModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0 };
const names: StripSettings = { visible: true, labelMode: 'names' };
const box = (positions: FretPosition[], scale: ScaleRef, scaleMode = false): Box => ({
  ...createBox(scale),
  positions,
  fill: { on: false, mode: scaleMode ? 'scale' : 'inversion' },
});

const C_E_G = [{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 0 }]; // C3 E3 G3
const F_A_C = [{ string: 2, fret: 3 }, { string: 3, fret: 2 }, { string: 4, fret: 1 }]; // F3 A3 C4
const G_B_D_F = [{ string: 0, fret: 3 }, { string: 1, fret: 2 }, { string: 2, fret: 0 }, { string: 2, fret: 3 }]; // G2 B2 D3 F3

const C_IONIAN = makeScaleRef('diatonic', 0, 'C');
const F_LYDIAN = makeScaleRef('diatonic', 3, 'F');

const strip = (from: Box, to: Box, strips: StripSettings = names) => {
  const [a, b] = buildCanvasModel([from, to], settings, C_IONIAN).entries;
  return buildStripView(a, b, strips);
};

describe('voice-leading strip', () => {
  it('C major to F major: C is common, E and G step up, 3 semitones in all', () => {
    const view = strip(box(C_E_G, C_IONIAN), box(F_A_C, F_LYDIAN));
    expect(view.fromTitle).toBe('C');
    expect(view.toTitle).toBe('F');
    expect(view.totalMotion).toBe(3);
    expect(view.commonTones).toBe(1);
    expect(view.voices.map((v) => [v.kind, v.from, v.to, v.interval])).toEqual([
      ['step', 'G', 'A', '+2'],
      ['step', 'E', 'F', '+1'],
      ['common', 'C', 'C', ''],
    ]);
    expect(view.description).toContain('C stays');
  });

  it('labels degrees the way each box counts them: from the key in effect, or from its own scale', () => {
    const degrees = { ...names, labelMode: 'degrees' as const };
    const fromKey = strip(box(C_E_G, C_IONIAN), box(F_A_C, F_LYDIAN), degrees);
    expect(fromKey.voices.map((v) => [v.from, v.to])).toEqual([
      ['5', '6'],
      ['3', '4'],
      ['1', '1'],
    ]);
    const fromScale = (b: Box): Box => ({ ...b, degreeBasis: 'scale' });
    const view = strip(fromScale(box(C_E_G, C_IONIAN)), fromScale(box(F_A_C, F_LYDIAN)), degrees);
    expect(view.voices.map((v) => [v.from, v.to])).toEqual([
      ['5', '3'],
      ['3', '1'],
      ['1', '5'],
    ]);
  });

  it('marks a dropped tone when a 4-note chord moves to a 3-note chord', () => {
    const view = strip(box(G_B_D_F, C_IONIAN), box(C_E_G, C_IONIAN));
    expect(view.voices.filter((v) => v.kind === 'dropped').map((v) => v.from)).toEqual(['D']);
    expect(view.voices.some((v) => v.kind === 'added')).toBe(false);
    expect(view.voices.filter((v) => v.kind === 'step').map((v) => v.interval).sort()).toEqual(['+1', '−1']);
    expect(view.totalMotion).toBe(2);
  });

  it('marks an added tone', () => {
    const view = strip(box(C_E_G, C_IONIAN), box(G_B_D_F, C_IONIAN));
    expect(view.voices.filter((v) => v.kind === 'added').map((v) => v.to)).toEqual(['D']);
  });

  it('compares scales when both boxes are set to fill scale, and chords otherwise', () => {
    const mixed = strip(box(C_E_G, C_IONIAN, true), box(F_A_C, makeScaleRef('diatonic', 0, 'F')));
    expect(mixed.compared).toBe('chords');

    const both = strip(box(C_E_G, C_IONIAN, true), box(F_A_C, makeScaleRef('diatonic', 0, 'F'), true));
    expect(both.compared).toBe('scales');
    expect(both.fromTitle).toBe('C Ionian');
    expect(both.toTitle).toBe('F Ionian');
    expect(both.voices).toHaveLength(7);
    expect(both.commonTones).toBe(6);
    expect(both.voices.filter((v) => v.kind !== 'common').map((v) => [v.from, v.to, v.interval])).toEqual([
      ['B', 'B♭', '−1'],
    ]);
  });

  it('handles boxes with no notes', () => {
    const view = strip(box([], C_IONIAN), box([], C_IONIAN));
    expect(view.voices).toEqual([]);
    expect(view.fromTitle).toBe('No notes');
  });
});
