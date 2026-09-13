// Acceptance test 10 (engine level), as amended: the key in effect and roman numerals. Also finding the key.
import { describe, expect, it } from 'vitest';
import { identifyChord } from '../chords';
import { changesKey, closestScale, findKey, keyName, planKeys, romanNumeral, type ChordEvidence } from '../keys';
import { pcOf, pcSet } from '../pitch';
import { makeScaleRef, scaleRefName, type ScaleRef } from '../scales';

const C_MAJOR = makeScaleRef('diatonic', 0, 'C');
const C_MINOR = makeScaleRef('diatonic', 5, 'C');
const numeral = (pitches: number[], key = C_MAJOR) => romanNumeral(identifyChord(pitches)[0], key);
const evidence = (pitches: number[]): ChordEvidence => ({ chord: identifyChord(pitches)[0], pcs: pcSet(pitches.map(pcOf)) });

const DM7 = [50, 53, 57, 60];
const G7 = [43, 47, 50, 53];
const CMAJ7 = [48, 52, 55, 59];
const F_SHARP_M7 = [42, 52, 57, 61];
const B7 = [47, 51, 57, 59, 66];
const EMAJ7 = [40, 47, 51, 56, 59, 64];
const AM = [57, 60, 64];
const DM = [50, 53, 57];
const E7 = [52, 56, 59, 62];
const F_SHARP_7_11 = [42, 49, 52, 58, 59, 64];
const G_7_13 = [43, 50, 53, 59, 64];
const C_M7_11 = [48, 58, 63, 65];

describe('roman numerals', () => {
  it('numbers chords by root degree and quality', () => {
    expect(numeral([53, 57, 60])).toBe('IV'); // F A C
    expect(numeral([50, 53, 57])).toBe('ii'); // D F A
    expect(numeral([55, 59, 62, 65])).toBe('V'); // G7
    expect(numeral([47, 50, 53])).toBe('vii°'); // B D F
    expect(numeral([47, 50, 53, 57])).toBe('viiø'); // Bm7♭5
    expect(numeral([48, 52, 56])).toBe('I+'); // C E G♯
    expect(numeral([57, 60, 64], makeScaleRef('diatonic', 5, 'A'))).toBe('i');
  });

  it("counts accidentals from the key's own degrees, so minor and modal keys read naturally", () => {
    const aMinor = makeScaleRef('diatonic', 5, 'A');
    expect(numeral([48, 52, 55], aMinor)).toBe('III'); // C
    expect(numeral([55, 59, 62], aMinor)).toBe('VII'); // G
    expect(numeral([52, 56, 59], aMinor)).toBe('V'); // E major
    expect(numeral([54, 58, 61], aMinor)).toBe('♯VI'); // F♯ major
    expect(numeral([50, 54, 57], makeScaleRef('diatonic', 3, 'A♭'))).toBe('IV'); // D major in A♭ Lydian
    // C major pentatonic has no F, so an F chord falls back to the major-scale degree.
    expect(numeral([53, 57, 60], makeScaleRef('pentatonic', 0, 'C'))).toBe('IV');
  });

  it('marks chromatic roots with the accidental from their spelling', () => {
    expect(numeral([46, 50, 53])).toBe('♭VII'); // B♭
    expect(numeral([51, 55, 58])).toBe('♭III'); // E♭
    expect(numeral([54, 58, 61])).toBe('♯IV'); // F♯
  });
});

describe('the key in effect', () => {
  it('names major and minor keys plainly and other keys by scale', () => {
    expect(keyName(C_MAJOR)).toBe('C major');
    expect(keyName(makeScaleRef('diatonic', 5, 'F♯'))).toBe('F♯ minor');
    expect(keyName(makeScaleRef('diatonic', 3, 'A♭'))).toBe('A♭ Lydian');
  });

  it('tells a mode of the key from another collection', () => {
    expect(changesKey(C_MAJOR, makeScaleRef('diatonic', 1, 'D'))).toBe(false);
    expect(changesKey(C_MAJOR, makeScaleRef('diatonic', 5, 'A'))).toBe(false);
    expect(changesKey(C_MAJOR, makeScaleRef('diatonic', 3, 'A♭'))).toBe(true);
    expect(changesKey(C_MAJOR, makeScaleRef('harmonicMinor', 0, 'A'))).toBe(true);
  });

  it('test 10, amended: a scale that alters the key changes it but keeps the tonic', () => {
    const scales = [
      makeScaleRef('diatonic', 0, 'C'),
      makeScaleRef('diatonic', 3, 'F'), // F Lydian: still C major
      makeScaleRef('diatonic', 3, 'A♭'), // C minor's notes
      makeScaleRef('diatonic', 0, 'E♭'), // still C minor's notes
      makeScaleRef('diatonic', 1, 'D'), // back to C major's notes
    ];
    const plan = planKeys(C_MAJOR, scales.map((scale) => ({ scale, chord: null })));
    expect(plan.keys.map(keyName)).toEqual(['C major', 'C major', 'C minor', 'C minor', 'C major']);
    expect(plan.regions.map((r) => [keyName(r.key), r.first, r.last, r.colorIndex])).toEqual([
      ['C major', 0, 1, 0],
      ['C minor', 2, 3, 1],
      ['C major', 4, 4, 0],
    ]);
    expect(plan.regionOfBox).toEqual([0, 0, 1, 1, 2]);
    expect(plan.keys[0]).toBe(C_MAJOR);

    const fMajor = identifyChord([53, 57, 60])[0];
    const eFlatMajor = identifyChord([51, 55, 58])[0];
    expect(romanNumeral(fMajor, plan.keys[1])).toBe('IV');
    expect(romanNumeral(eFlatMajor, plan.keys[2])).toBe('III');
    expect(romanNumeral(fMajor, plan.keys[3])).toBe('IV');
    expect(planKeys(C_MAJOR, [{ scale: makeScaleRef('diatonic', 0, 'G'), chord: null }]).keys.map(keyName)).toEqual([
      'C Lydian',
    ]);
    expect(planKeys(C_MAJOR, []).regions).toEqual([]);
  });

  it('keeps the tonic through a passing chord whose scale lacks it', () => {
    const plan = planKeys(C_MINOR, [
      { scale: makeScaleRef('diatonic', 4, 'F♯'), chord: evidence(F_SHARP_7_11) },
      { scale: makeScaleRef('harmonicMajor', 4, 'G'), chord: evidence(G_7_13) },
      { scale: C_MINOR, chord: evidence(C_M7_11) },
    ]);
    expect(plan.keys.map(keyName)).toEqual(['C minor', 'C Harmonic Major', 'C minor']);
    expect([F_SHARP_7_11, G_7_13, C_M7_11].map((pitches, i) => numeral(pitches, plan.keys[i]))).toEqual([
      '♯IV',
      'V',
      'i',
    ]);
  });

  it('changes the tonic for a run of chords outside it, but not for two in the middle', () => {
    const progression: [ScaleRef, number[]][] = [
      [makeScaleRef('diatonic', 1, 'D'), DM7],
      [makeScaleRef('diatonic', 4, 'G'), G7],
      [C_MAJOR, CMAJ7],
      [makeScaleRef('diatonic', 1, 'F♯'), F_SHARP_M7],
      [makeScaleRef('diatonic', 4, 'B'), B7],
      [makeScaleRef('diatonic', 0, 'E'), EMAJ7],
    ];
    const plan = (boxes: [ScaleRef, number[]][]) =>
      planKeys(C_MAJOR, boxes.map(([scale, pitches]) => ({ scale, chord: evidence(pitches) }))).keys.map(keyName);
    expect(plan(progression)).toEqual(['C major', 'C major', 'C major', 'E major', 'E major', 'E major']);
    const [dm7, g7, cmaj7, fSharpM7, b7] = progression;
    expect(plan([dm7, g7, fSharpM7, b7, cmaj7])).toEqual(['C major', 'C major', 'C major', 'C major', 'C major']);
  });
});

describe('finding the key', () => {
  const found = (...progression: number[][]) => {
    const result = findKey(progression.map(evidence));
    return result ? keyName(result.key) : null;
  };

  it('finds major keys from diatonic fit and the tonic', () => {
    expect(found(DM7, G7, CMAJ7)).toBe('C major');
    expect(found([48, 52, 55], AM, [53, 57, 60], [43, 47, 50])).toBe('C major'); // C Am F G
  });

  it('accepts the raised 7th of a minor key on its dominant', () => {
    expect(found(AM, DM, E7, AM)).toBe('A minor');
    expect(found(F_SHARP_7_11, G_7_13, C_M7_11)).toBe('C minor');
  });

  it('hears a blues that starts and ends on its tonic in that key', () => {
    const A7 = [45, 49, 52, 55];
    const D7 = [50, 54, 57, 60];
    expect(found(A7, D7, A7, E7, D7, A7)).toBe('A major');
  });

  it('follows a modulation and names the progression by its first key on a tie', () => {
    const result = findKey([DM7, G7, CMAJ7, F_SHARP_M7, B7, EMAJ7].map(evidence));
    expect(result && keyName(result.key)).toBe('C major');
    expect(result?.keys.map(keyName)).toEqual(['C major', 'C major', 'C major', 'E major', 'E major', 'E major']);
  });

  it('finds nothing without chords', () => {
    expect(findKey([])).toBeNull();
    expect(findKey([null, null])).toBeNull();
  });
});

describe('closest scale to the key', () => {
  const closest = (pitches: number[], key: ScaleRef) => {
    const { chord, pcs } = evidence(pitches);
    return scaleRefName(closestScale(pcs, chord, key));
  };

  it('uses the mode of the key when the chord fits it', () => {
    expect(closest(DM7, C_MAJOR)).toBe('D Dorian');
    expect(closest(G7, C_MAJOR)).toBe('G Mixolydian');
  });

  it('otherwise changes as few of the key’s notes as it can', () => {
    expect(closest([45, 49, 52, 55], C_MAJOR)).toBe('A Mixolydian ♭6'); // A7 in C major: only C♯ is new
    expect(closest(E7, makeScaleRef('diatonic', 5, 'A'))).toBe('E Phrygian Dominant');
    expect(closest(G_7_13, C_MINOR)).toBe('G Mixolydian ♭2');
  });
});
