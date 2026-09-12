// Acceptance tests 3 (mode slider) and 4 (root box).
import { describe, expect, it } from 'vitest';
import { SCALE_FAMILIES } from '../../data/scales';
import { positionsInSet, positionKey } from '../fretboard';
import { transpose } from '../pitch';
import {
  canonicalMode,
  distinctModes,
  makeScaleRef,
  modeIntervals,
  modeName,
  sameScale,
  scaleRefIntervals,
  scaleRefName,
  scaleRefPcSet,
  transposeScaleRef,
  withFamilyMode,
  withMode,
  withTonic,
} from '../scales';
import { formatSpelled, pcOfSpelled } from '../spelling';

const STANDARD_GUITAR = [40, 45, 50, 55, 59, 64];

describe('mode slider', () => {
  it('C Ionian at slider position 2 is D Dorian with the same pitch classes', () => {
    const cIonian = makeScaleRef('diatonic', 0, 'C');
    const dDorian = withMode(cIonian, 1);
    expect(scaleRefPcSet(dDorian)).toBe(scaleRefPcSet(cIonian));
    expect(scaleRefName(dDorian)).toBe('D Dorian');
    expect(formatSpelled(dDorian.tonic)).toBe('D');
    expect(pcOfSpelled(dDorian.tonic)).toBe(2);
  });

  it('keeps the pitch collection for every family, mode, target stop and root', () => {
    for (const family of SCALE_FAMILIES) {
      const n = family.intervals.length;
      for (let mode = 0; mode < n; mode++) {
        for (let pc = 0; pc < 12; pc++) {
          const ref = makeScaleRef(family.id, mode, pc);
          for (let to = 0; to < n; to++) {
            const moved = withMode(ref, to);
            expect(scaleRefPcSet(moved), `${scaleRefName(ref)} → stop ${to + 1}`).toBe(scaleRefPcSet(ref));
            expect(moved.mode).toBe(to);
          }
        }
      }
    }
  });

  it('gives every rotation of every 7-note scale a readable name', () => {
    for (const family of SCALE_FAMILIES.filter((f) => f.intervals.length === 7)) {
      for (let mode = 0; mode < 7; mode++) {
        const name = modeName(family.id, mode);
        expect(name, `${family.id}[${mode}]`).toMatch(/^[A-Z][A-Za-z-]*( [A-Za-z♭♯♮0-9-]+)*$/);
        expect(name).not.toMatch(/\bmode\b|\bof\b/i);
      }
    }
  });

  it('never gives one name to two different interval structures', () => {
    const seen = new Map<string, string>();
    for (const family of SCALE_FAMILIES) {
      for (let mode = 0; mode < family.intervals.length; mode++) {
        const name = modeName(family.id, mode);
        const signature = modeIntervals(family.id, mode).join(',');
        expect(seen.get(name) ?? signature, name).toBe(signature);
        seen.set(name, signature);
      }
    }
  });

  it('uses established names where they exist', () => {
    const names = (id: string) => [0, 1, 2, 3, 4, 5, 6].map((m) => modeName(id, m));
    expect(names('melodicMinor')).toEqual([
      'Melodic Minor', 'Dorian ♭2', 'Lydian Augmented', 'Lydian Dominant', 'Mixolydian ♭6', 'Locrian ♮2', 'Altered',
    ]);
    expect(names('harmonicMinor')).toEqual([
      'Harmonic Minor', 'Locrian ♮6', 'Ionian ♯5', 'Dorian ♯4', 'Phrygian Dominant', 'Lydian ♯2', 'Altered ♭♭7',
    ]);
    expect(modeName('doubleHarmonic', 3)).toBe('Hungarian Minor');
    expect(modeIntervals('doubleHarmonic', 3)).toEqual([0, 2, 3, 6, 7, 8, 11]);
  });

  it('generates altered-mode names for unnamed rotations', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((m) => modeName('harmonicMajor', m))).toEqual([
      'Harmonic Major', 'Dorian ♭5', 'Phrygian ♭4', 'Lydian ♭3', 'Mixolydian ♭2', 'Lydian ♯2 ♯5', 'Locrian ♭♭7',
    ]);
    expect([1, 2, 4, 5, 6].map((m) => modeName('doubleHarmonic', m))).toEqual([
      'Lydian ♯2 ♯6', 'Phrygian ♭4 ♭♭7', 'Mixolydian ♭2 ♭5', 'Ionian ♯2 ♯5', 'Locrian ♭♭3 ♭♭7',
    ]);
  });

  it('names the unnamed blues rotations by the degree used as the root', () => {
    expect([0, 1, 2, 3, 4, 5].map((m) => modeName('blues', m))).toEqual([
      'Blues', 'Major Blues', 'Blues mode 3', 'Blues mode 4', 'Blues mode 5', 'Blues mode 6',
    ]);
  });

  it('prefers keeping the 3rd when two base modes need equally many alterations', () => {
    // Neapolitan major mode 4 is 1 2 3 ♯4 5 ♭6 ♭7, which has a major 3rd, so it is not "Aeolian ♮3 ♯4".
    expect(modeName('neapolitanMajor', 3)).toBe('Mixolydian ♯4 ♭6');
    expect(modeName('neapolitanMajor', 4)).toBe('Mixolydian ♭5 ♭6');
  });
});

describe('scale selector helpers', () => {
  it('collapses repeated rotations of symmetric scales', () => {
    expect(canonicalMode('wholeTone', 4)).toBe(0);
    expect(canonicalMode('octatonic', 3)).toBe(1);
    expect(canonicalMode('diatonic', 5)).toBe(5);
    expect(distinctModes('wholeTone')).toEqual([0]);
    expect(distinctModes('augmented')).toEqual([0, 1]);
    expect(distinctModes('diatonic')).toHaveLength(7);
  });

  it('changes family or mode on the same tonic pitch and respells it', () => {
    expect(scaleRefName(withFamilyMode(makeScaleRef('diatonic', 5, 'C♯'), 'diatonic', 0))).toBe('D♭ Ionian');
    expect(scaleRefName(withFamilyMode(makeScaleRef('diatonic', 5, 'F♯'), 'diatonic', 0))).toBe('F♯ Ionian');
    expect(scaleRefName(withFamilyMode(makeScaleRef('diatonic', 0, 'D'), 'melodicMinor', 6))).toBe('D Altered');
  });

  it('moves only the tonic', () => {
    expect(scaleRefName(withTonic(makeScaleRef('diatonic', 1, 'D'), 3))).toBe('E♭ Dorian');
    const dDorian = makeScaleRef('diatonic', 1, 'D');
    expect(withTonic(dDorian, 2)).toBe(dDorian);
  });

  it('compares scales by pitch collection and tonic', () => {
    expect(sameScale(makeScaleRef('diatonic', 0, 'C'), makeScaleRef('diatonic', 0, 'B♯'))).toBe(true);
    expect(sameScale(makeScaleRef('diatonic', 0, 'C'), makeScaleRef('diatonic', 5, 'A'))).toBe(false);
    expect(sameScale(makeScaleRef('wholeTone', 0, 'C'), makeScaleRef('wholeTone', 3, 'C'))).toBe(true);
  });
});

describe('root box', () => {
  const cIonian = makeScaleRef('diatonic', 0, 'C');

  it('transposing C Ionian up a semitone gives D♭ Ionian with the same structure', () => {
    const up = transposeScaleRef(cIonian, 1);
    expect(scaleRefName(up)).toBe('D♭ Ionian');
    expect(scaleRefIntervals(up)).toEqual(scaleRefIntervals(cIonian));
    expect(scaleRefPcSet(up)).toBe(transpose(scaleRefPcSet(cIonian), 1));
    expect(scaleRefName(transposeScaleRef(cIonian, -1))).toBe('B Ionian');
  });

  it('shifts the fretboard fill by exactly one fret', () => {
    const frets = 24;
    const before = positionsInSet(STANDARD_GUITAR, frets, scaleRefPcSet(cIonian));
    const after = positionsInSet(STANDARD_GUITAR, frets, scaleRefPcSet(transposeScaleRef(cIonian, 1)));
    const shifted = before.filter((p) => p.fret < frets).map((p) => positionKey({ string: p.string, fret: p.fret + 1 }));
    expect(after.filter((p) => p.fret > 0).map(positionKey)).toEqual(shifted);
  });

  it('wraps at the octave and keeps the mode', () => {
    let ref = makeScaleRef('diatonic', 1, 'D');
    const visited: string[] = [];
    for (let i = 0; i < 12; i++) {
      ref = transposeScaleRef(ref, 1);
      visited.push(scaleRefName(ref));
    }
    expect(visited).toEqual([
      'E♭ Dorian', 'E Dorian', 'F Dorian', 'F♯ Dorian', 'G Dorian', 'G♯ Dorian',
      'A Dorian', 'B♭ Dorian', 'B Dorian', 'C Dorian', 'C♯ Dorian', 'D Dorian',
    ]);
  });
});
