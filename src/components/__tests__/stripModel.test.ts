import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings, type StripSettings } from '../../state/workbench';
import { makeScaleRef, type FretPosition, type ScaleRef } from '../../theory';
import { buildCanvasModel } from '../canvasModel';
import { buildStripView } from '../stripModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0, fretMarkers: true };
const names: StripSettings = { commonTones: true, voiceLeading: true, labelMode: 'names', analysis: false, notation: 'jazz' };
const box = (positions: FretPosition[], scale: ScaleRef, scaleMode = false): Box => ({
  ...createBox(scale),
  positions,
  fill: { on: false, mode: scaleMode ? 'scale' : 'inversion' },
});

const C_E_G = [{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 0 }]; // C3 E3 G3
const F_A_C = [{ string: 2, fret: 3 }, { string: 3, fret: 2 }, { string: 4, fret: 1 }]; // F3 A3 C4
const D_F_A = [{ string: 1, fret: 8 }, { string: 2, fret: 0 }, { string: 3, fret: 2 }]; // F3 D3 A3
const G_B_D_F = [{ string: 0, fret: 3 }, { string: 1, fret: 2 }, { string: 2, fret: 0 }, { string: 3, fret: 10 }]; // G2 B2 D3 F4

const C_MAJOR = makeScaleRef('diatonic', 0, 'C');
const F_LYDIAN = makeScaleRef('diatonic', 3, 'F');

const strip = (from: Box, to: Box, strips: StripSettings = names) => {
  const [a, b] = buildCanvasModel([from, to], settings, C_MAJOR).entries;
  return buildStripView(a, b, strips);
};

describe('voice-leading strip', () => {
  it('C major to F major: C is common, E and G step up, 3 semitones in all', () => {
    const view = strip(box(C_E_G, C_MAJOR), box(F_A_C, F_LYDIAN));
    expect(view.fromTitle).toBe('C');
    expect(view.toTitle).toBe('F');
    expect(view.totalMotion).toBe(3);
    expect(view.commonTones).toBe(1);
    expect(view.voices.map((v) => [v.kind, v.from, v.to, v.interval])).toEqual([
      ['step', 'G', 'A', '+2'],
      ['step', 'E', 'F', '+1'],
      ['common', 'C', 'C', ''],
    ]);
    expect(view.summary).toBe('3 semitones · 1 common');
    expect(view.description).toContain('C stays');
  });

  it('draws only the common tones, or only the moving voices, as the strip settings ask', () => {
    const commonOnly = strip(box(C_E_G, C_MAJOR), box(F_A_C, F_LYDIAN), { ...names, voiceLeading: false });
    expect(commonOnly.voices.map((v) => [v.kind, v.from, v.to])).toEqual([['common', 'C', 'C']]);
    expect(commonOnly.summary).toBe('1 common');

    const movingOnly = strip(box(C_E_G, C_MAJOR), box(F_A_C, F_LYDIAN), { ...names, commonTones: false });
    expect(movingOnly.voices.map((v) => v.kind)).toEqual(['step', 'step']);
    expect(movingOnly.summary).toBe('3 semitones');

    const noneShared = strip(box(C_E_G, C_MAJOR), box(D_F_A, C_MAJOR), { ...names, voiceLeading: false });
    expect(noneShared.voices).toEqual([]);
    expect(noneShared.emptyText).toBe('No common tones');
  });

  it('labels degrees the way each box counts them: from the key in effect, or from its own scale', () => {
    const degrees = { ...names, labelMode: 'degrees' as const };
    const fromKey = strip(box(C_E_G, C_MAJOR), box(F_A_C, F_LYDIAN), degrees);
    expect(fromKey.voices.map((v) => [v.from, v.to])).toEqual([
      ['5', '6'],
      ['3', '4'],
      ['1', '1'],
    ]);
    const fromScale = (b: Box): Box => ({ ...b, degreeBasis: 'scale' });
    const view = strip(fromScale(box(C_E_G, C_MAJOR)), fromScale(box(F_A_C, F_LYDIAN)), degrees);
    expect(view.voices.map((v) => [v.from, v.to])).toEqual([
      ['5', '3'],
      ['3', '1'],
      ['1', '5'],
    ]);
  });

  it('marks a dropped tone when a 4-note chord moves to a 3-note chord', () => {
    const view = strip(box(G_B_D_F, C_MAJOR), box(C_E_G, C_MAJOR));
    expect(view.voices.filter((v) => v.kind === 'dropped').map((v) => v.from)).toEqual(['D']);
    expect(view.voices.some((v) => v.kind === 'added')).toBe(false);
    expect(view.voices.filter((v) => v.kind === 'step').map((v) => v.interval).sort()).toEqual(['+1', '−1']);
    expect(view.totalMotion).toBe(2);
  });

  it('marks an added tone', () => {
    const view = strip(box(C_E_G, C_MAJOR), box(G_B_D_F, C_MAJOR));
    expect(view.voices.filter((v) => v.kind === 'added').map((v) => v.to)).toEqual(['D']);
  });

  it('compares scales when both boxes are set to fill scale, and chords otherwise', () => {
    const mixed = strip(box(C_E_G, C_MAJOR, true), box(F_A_C, makeScaleRef('diatonic', 0, 'F')));
    expect(mixed.compared).toBe('chords');

    const both = strip(box(C_E_G, C_MAJOR, true), box(F_A_C, makeScaleRef('diatonic', 0, 'F'), true));
    expect(both.compared).toBe('scales');
    expect(both.fromTitle).toBe('C major');
    expect(both.toTitle).toBe('F major');
    expect(both.voices).toHaveLength(7);
    expect(both.commonTones).toBe(6);
    expect(both.voices.filter((v) => v.kind !== 'common').map((v) => [v.from, v.to, v.interval])).toEqual([
      ['B', 'B♭', '−1'],
    ]);
  });

  it('handles boxes with no notes', () => {
    const view = strip(box([], C_MAJOR), box([], C_MAJOR));
    expect(view.voices).toEqual([]);
    expect(view.fromTitle).toBe('No notes');
    expect(view.emptyText).toBe('No notes to compare');
  });
});
