// Acceptance test 10 (app level), as amended: numerals and the key bar as the canvas shows them.
import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings } from '../../state/workbench';
import { makeScaleRef, type FretPosition, type ScaleRef } from '../../theory';
import { buildCanvasModel } from '../canvasModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0, fretMarkers: true, boardView: 'chart' };
const box = (positions: FretPosition[], scale: ScaleRef): Box => ({ ...createBox(scale), positions });
/** One fret per string, lowest string first; null leaves the string out. */
const shape = (...frets: (number | null)[]) => frets.flatMap((fret, string) => (fret === null ? [] : [{ string, fret }]));

// F3 on the D string (fret 3), A3 on the G string (fret 2), C4 on the B string (fret 1).
const F_A_C = [{ string: 2, fret: 3 }, { string: 3, fret: 2 }, { string: 4, fret: 1 }];
// E♭3 on the A string (fret 6), B♭3 on the D string (fret 8), G3 open G string.
const E_FLAT_G_B_FLAT = [{ string: 1, fret: 6 }, { string: 2, fret: 8 }, { string: 3, fret: 0 }];

describe('canvas model', () => {
  it('test 10, amended: F A C is IV in C major; an A♭ Lydian box turns the key to C minor, which the next box keeps', () => {
    const model = buildCanvasModel(
      [
        box(F_A_C, makeScaleRef('diatonic', 0, 'C')),
        box(F_A_C, makeScaleRef('diatonic', 3, 'F')),
        box(E_FLAT_G_B_FLAT, makeScaleRef('diatonic', 3, 'A♭')),
        box(F_A_C, makeScaleRef('diatonic', 0, 'E♭')),
      ],
      settings,
      makeScaleRef('diatonic', 0, 'C'),
    );
    expect(model.entries.map((e) => e.view.title)).toEqual(['F', 'F', 'E♭', 'F']);
    expect(model.entries.map((e) => e.numeral)).toEqual(['IV', 'IV', 'III', 'IV']);
    expect(model.entries.map((e) => e.keyName)).toEqual(['C major', 'C major', 'C minor', 'C minor']);
    expect(model.entries.map((e) => [e.regionStart, e.regionEnd])).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, true],
    ]);
    expect(model.entries.map((e) => e.colorIndex)).toEqual([0, 0, 1, 1]);
  });

  it('numbers chords against the key in effect, not their own scales', () => {
    const model = buildCanvasModel(
      [
        box(shape(2, 4, 2, 3, 0, 0), makeScaleRef('diatonic', 4, 'F♯')), // F♯7(11)
        box(shape(3, 5, 3, 4, 0, 0), makeScaleRef('harmonicMajor', 4, 'G')), // G7(13)
        box(shape(8, null, 8, 8, 6, null), makeScaleRef('diatonic', 5, 'C')), // Cm7(11)
      ],
      settings,
      makeScaleRef('diatonic', 5, 'C'),
    );
    expect(model.entries.map((e) => e.view.scaleName)).toEqual(['F♯ Mixolydian', 'G Mixolydian ♭2', 'C minor']);
    expect(model.entries.map((e) => e.keyName)).toEqual(['C minor', 'C Harmonic Major', 'C minor']);
    expect(model.entries.map((e) => e.numeral)).toEqual(['♯IV', 'V', 'i']);
  });

  it('gives no numeral to a box without a chord', () => {
    const model = buildCanvasModel([box([], makeScaleRef('diatonic', 0, 'C'))], settings, makeScaleRef('diatonic', 0, 'C'));
    expect(model.entries[0].numeral).toBe('');
    expect(model.entries[0].keyName).toBe('C major');
  });
});
