import { describe, expect, it } from 'vitest';
import { TUNING_PRESETS } from '../../data/tunings';
import {
  MAX_STRINGS,
  MIN_STRINGS,
  clampFretCount,
  formatTuning,
  parsePitchName,
  pcAt,
  pcSetAt,
  pitchAt,
  pitchName,
  positionsInSet,
  limitChordPositions,
  resizeTuning,
  shiftStrings,
  toggleChordPosition,
  transposePositions,
} from '../fretboard';
import { hasPc, pcSet } from '../pitch';

const STANDARD_GUITAR = [40, 45, 50, 55, 59, 64];
const B_STANDARD_7 = [35, 40, 45, 50, 55, 59, 64];

describe('fretboard', () => {
  it('derives pitch from tuning + fret', () => {
    expect(pitchAt(STANDARD_GUITAR, 0, 0)).toBe(40);
    expect(pitchAt(STANDARD_GUITAR, 5, 5)).toBe(69);
    expect(pcAt(B_STANDARD_7, 0, 1)).toBe(0);
    expect(() => pitchAt(STANDARD_GUITAR, 6, 0)).toThrow(RangeError);
  });

  it('fills every position of a pitch-class set, open string through the last fret', () => {
    const cMajorTriad = pcSet([0, 4, 7]);
    const positions = positionsInSet(STANDARD_GUITAR, 24, cMajorTriad);
    for (const p of positions) expect(hasPc(cMajorTriad, pcAt(STANDARD_GUITAR, p.string, p.fret))).toBe(true);
    // 25 frets per string (0–24), three pitch classes: 6 or 7 hits per string.
    expect(positions.length).toBeGreaterThanOrEqual(6 * 6);
    expect(positions.some((p) => p.fret === 24)).toBe(true);
  });

  it('collapses doubled positions to pitch classes', () => {
    expect(pcSetAt(STANDARD_GUITAR, [{ string: 0, fret: 0 }, { string: 1, fret: 7 }, { string: 5, fret: 0 }])).toBe(
      pcSet([4]),
    );
  });

  it('moves a shape rigidly, wrapping by an octave when it would leave the board', () => {
    const shape = [{ string: 0, fret: 0 }, { string: 1, fret: 2 }, { string: 2, fret: 2 }];
    expect(transposePositions(shape, 1, 24)).toEqual([{ string: 0, fret: 1 }, { string: 1, fret: 3 }, { string: 2, fret: 3 }]);
    expect(transposePositions(shape, -1, 24)).toEqual([{ string: 0, fret: 11 }, { string: 1, fret: 13 }, { string: 2, fret: 13 }]);
    const high = [{ string: 3, fret: 23 }, { string: 4, fret: 24 }];
    expect(transposePositions(high, 1, 24)).toEqual([{ string: 3, fret: 12 }, { string: 4, fret: 13 }]);
  });

  it('keeps a moved shape at or above the capo, dropping notes with no room', () => {
    const shape = [{ string: 0, fret: 2 }, { string: 1, fret: 4 }];
    expect(transposePositions(shape, -1, 24, 2)).toEqual([{ string: 0, fret: 13 }, { string: 1, fret: 15 }]);
    expect(transposePositions([{ string: 0, fret: 11 }, { string: 1, fret: 12 }], 3, 12, 11)).toEqual([]);
  });

  it('keeps one clicked note per string and six at most', () => {
    const six = [0, 1, 2, 3, 4, 5].map((string) => ({ string, fret: 2 }));
    expect(toggleChordPosition(six, { string: 6, fret: 2 })).toBeNull();
    expect(toggleChordPosition(six, { string: 2, fret: 5 })).toEqual([...six.filter((p) => p.string !== 2), { string: 2, fret: 5 }]);
    expect(toggleChordPosition(six, { string: 2, fret: 2 })).toEqual(six.filter((p) => p.string !== 2));
    const old = [{ string: 0, fret: 1 }, { string: 0, fret: 3 }, ...[1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 2 }))];
    expect(limitChordPositions(old)).toEqual([1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 2 })));
    expect(limitChordPositions([{ string: 2, fret: 1 }, { string: 1, fret: 1 }, { string: 2, fret: 3 }])).toEqual([
      { string: 1, fret: 1 },
      { string: 2, fret: 3 },
    ]);
  });
});

describe('tunings', () => {
  it('names and parses scientific pitch', () => {
    expect(pitchName(40)).toBe('E2');
    expect(pitchName(30)).toBe('F♯1');
    expect(parsePitchName('F♯1')).toBe(30);
    expect(parsePitchName('Bb0')).toBe(22);
    expect(parsePitchName('B♯3')).toBe(60);
    expect(formatTuning(STANDARD_GUITAR)).toBe('E2 A2 D3 G3 B3 E4');
  });

  it('adds strings a 4th below the lowest and removes from the low end, keeping existing pitches', () => {
    expect(formatTuning(resizeTuning(STANDARD_GUITAR, 7))).toBe('B1 E2 A2 D3 G3 B3 E4');
    expect(formatTuning(resizeTuning(STANDARD_GUITAR, 8))).toBe('F♯1 B1 E2 A2 D3 G3 B3 E4');
    expect(formatTuning(resizeTuning(STANDARD_GUITAR, 4))).toBe('D3 G3 B3 E4');
    expect(resizeTuning(STANDARD_GUITAR, 20)).toHaveLength(MAX_STRINGS);
    expect(resizeTuning(STANDARD_GUITAR, 1)).toHaveLength(MIN_STRINGS);
  });

  it('re-indexes clicked positions when strings change at the low end', () => {
    const positions = [{ string: 0, fret: 3 }, { string: 5, fret: 1 }];
    expect(shiftStrings(positions, 1, 7)).toEqual([{ string: 1, fret: 3 }, { string: 6, fret: 1 }]);
    expect(shiftStrings(positions, -1, 5)).toEqual([{ string: 4, fret: 1 }]);
  });

  it('clamps fret counts to 12–30', () => {
    expect(clampFretCount(40)).toBe(30);
    expect(clampFretCount(3)).toBe(12);
    expect(clampFretCount(22)).toBe(22);
  });

  it('ships every preset from the spec with 4–9 strings', () => {
    const byName = Object.fromEntries(TUNING_PRESETS.map((p) => [p.name, formatTuning(p.tuning)]));
    expect(byName).toEqual({
      Standard: 'E2 A2 D3 G3 B3 E4',
      'Drop D': 'D2 A2 D3 G3 B3 E4',
      'Drop C': 'C2 G2 C3 F3 A3 D4',
      '7-string B standard': 'B1 E2 A2 D3 G3 B3 E4',
      '8-string F♯ standard': 'F♯1 B1 E2 A2 D3 G3 B3 E4',
      '4-string bass': 'E1 A1 D2 G2',
      '5-string bass': 'B0 E1 A1 D2 G2',
      '6-string bass': 'B0 E1 A1 D2 G2 C3',
      DADGAD: 'D2 A2 D3 G3 A3 D4',
      'Open G': 'D2 G2 D3 G3 B3 D4',
      'Open D': 'D2 A2 D3 F♯3 A3 D4',
    });
  });
});
