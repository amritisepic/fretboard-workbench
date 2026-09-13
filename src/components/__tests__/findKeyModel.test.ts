import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings } from '../../state/workbench';
import { keyName, scaleRefName, type FretPosition } from '../../theory';
import { buildBoxView } from '../boardModel';
import { planFoundKey } from '../findKeyModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0 };
const box = (positions: FretPosition[]): Box => ({ ...createBox(), positions });
/** One fret per string, lowest string first; null leaves the string out. */
const shape = (...frets: (number | null)[]) =>
  box(frets.flatMap((fret, string) => (fret === null ? [] : [{ string, fret }])));

// The progression from the bug report.
const F_SHARP_7_11 = shape(2, 4, 2, 3, 0, 0); // F♯2 C♯3 E3 A♯3 B3 E4
const G_7_13 = shape(3, 5, 3, 4, 0, 0); // G2 D3 F3 B3 B3 E4
const C_M7_11 = shape(8, null, 8, 8, 6, null); // C3 B♭3 E♭4 F4

describe('find key', () => {
  it('names the chords of the progression', () => {
    expect([F_SHARP_7_11, G_7_13, C_M7_11].map((b) => buildBoxView(b, settings).title)).toEqual([
      'F♯7(11)',
      'G7(13)',
      'Cm7(11)',
    ]);
  });

  it('finds C minor, then gives each chord the scale closest to it', () => {
    const found = planFoundKey([F_SHARP_7_11, G_7_13, C_M7_11], settings);
    expect(found && keyName(found.key)).toBe('C minor');
    expect(found?.boxes.map((b) => scaleRefName(b.scale))).toEqual(['F♯ Mixolydian', 'G Mixolydian ♭2', 'C Aeolian']);
    expect(found?.boxes.map((b) => b.chordOverride)).toEqual([null, null, null]);
  });

  it('keeps a chord picked in the sidebar and ranks scales for it', () => {
    const found = planFoundKey([{ ...C_M7_11, chordOverride: '5:7sus4:' }], settings);
    expect(found?.boxes[0].chordOverride).toBe('5:7sus4:');
    expect(found && scaleRefName(found.boxes[0].scale).startsWith('F ')).toBe(true);
  });

  it('gives a box without a chord the key, and finds nothing without chords', () => {
    const found = planFoundKey([C_M7_11, shape(3)], settings);
    expect(found?.boxes[1].scale).toEqual(found?.key);
    expect(planFoundKey([shape(3), box([])], settings)).toBeNull();
  });
});
