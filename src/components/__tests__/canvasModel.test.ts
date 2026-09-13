// Acceptance test 10 (app level): numerals and key regions as the canvas shows them.
import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings } from '../../state/workbench';
import { makeScaleRef, type FretPosition, type ScaleRef } from '../../theory';
import { buildCanvasModel } from '../canvasModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0 };
const box = (positions: FretPosition[], scale: ScaleRef): Box => ({ ...createBox(scale), positions });

// F3 on the D string (fret 3), A3 on the G string (fret 2), C4 on the B string (fret 1).
const F_A_C = [{ string: 2, fret: 3 }, { string: 3, fret: 2 }, { string: 4, fret: 1 }];
// E♭3 on the D string (fret 1), G3 open G string, B♭3 on the G string (fret 3).
const E_FLAT_G_B_FLAT = [{ string: 2, fret: 1 }, { string: 3, fret: 0 }, { string: 3, fret: 3 }];

describe('canvas model', () => {
  it('test 10: F A C is IV in C major; an A♭ Lydian box starts a region that later boxes follow', () => {
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
    expect(model.entries.map((e) => e.numeral)).toEqual(['IV', 'IV', 'V', 'VI']);
    expect(model.entries.map((e) => e.keyName)).toEqual(['C major', 'C major', 'A♭ Lydian', 'A♭ Lydian']);
    expect(model.entries.map((e) => [e.regionStart, e.regionEnd])).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, true],
    ]);
    expect(model.entries.map((e) => e.colorIndex)).toEqual([0, 0, 1, 1]);
  });

  it('gives no numeral to a box without a chord', () => {
    const model = buildCanvasModel([box([], makeScaleRef('diatonic', 0, 'C'))], settings, makeScaleRef('diatonic', 0, 'C'));
    expect(model.entries[0].numeral).toBe('');
    expect(model.entries[0].keyName).toBe('C major');
  });
});
