// Acceptance test 2: enharmonic spelling.
import { describe, expect, it } from 'vitest';
import { SCALE_FAMILIES } from '../../data/scales';
import { getChordType } from '../chords';
import { mod12 } from '../pitch';
import { modeIntervals } from '../scales';
import {
  chooseTonicSpelling,
  formatScaleDegree,
  formatSpelled,
  parseSpelled,
  pcOfSpelled,
  spell,
  spellScale,
  type ScaleContext,
  type SpelledPc,
} from '../spelling';

const IONIAN = modeIntervals('diatonic', 0);
const AEOLIAN = modeIntervals('diatonic', 5);
const HARMONIC_MINOR = modeIntervals('harmonicMinor', 0);
const HUNGARIAN_MINOR = modeIntervals('doubleHarmonic', 3);
const MAJOR_PENTATONIC = modeIntervals('pentatonic', 0);

const names = (tonic: string, intervals: readonly number[]) =>
  spellScale(parseSpelled(tonic), intervals).map((s) => formatSpelled(s));

const context = (tonic: string, intervals: readonly number[]): ScaleContext => ({
  tonic: parseSpelled(tonic),
  intervals,
});

/** Adds a chord (root pc + chord-type id) to a scale context. */
const withChord = (ctx: ScaleContext, rootPc: number, typeId: string): ScaleContext => ({
  ...ctx,
  chord: { root: rootPc, tones: getChordType(typeId).tones },
});

describe('rule 1: 7-note scales', () => {
  it('F♯ harmonic minor spells its 7th as E♯, not F', () => {
    expect(names('F♯', HARMONIC_MINOR)).toEqual(['F♯', 'G♯', 'A', 'B', 'C♯', 'D', 'E♯']);
  });

  it('F♯ natural minor spells its 7th as E (spec correction: E♯ belongs to harmonic/melodic minor)', () => {
    expect(names('F♯', AEOLIAN)).toEqual(['F♯', 'G♯', 'A', 'B', 'C♯', 'D', 'E']);
  });

  it('G♭ major spells its 4th as C♭, not B', () => {
    expect(names('G♭', IONIAN)).toEqual(['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']);
  });

  it('C harmonic minor spells B♮, not C♭', () => {
    const spelled = names('C', HARMONIC_MINOR);
    expect(spelled[6]).toBe('B');
    expect(spelled).not.toContain('C♭');
  });
});

describe('library invariants', () => {
  const tonics: SpelledPc[] = [];
  for (let letter = 0; letter < 7; letter++) {
    for (const accidental of [-1, 0, 1]) tonics.push({ letter, accidental });
  }

  it('every family × mode × 21 tonic spellings: correct pitches, and no repeated letter in 7-note scales', () => {
    for (const family of SCALE_FAMILIES) {
      for (let mode = 0; mode < family.intervals.length; mode++) {
        const intervals = modeIntervals(family.id, mode);
        for (const tonic of tonics) {
          const label = `${formatSpelled(tonic)} ${family.id}[${mode}]`;
          const spelled = spellScale(tonic, intervals);
          expect(spelled.map(pcOfSpelled), label).toEqual(intervals.map((iv) => mod12(pcOfSpelled(tonic) + iv)));
          if (intervals.length === 7) {
            expect(new Set(spelled.map((s) => s.letter)).size, label).toBe(7);
          }
        }
      }
    }
  });

  it('every family × mode × 12 roots with the chosen tonic spelling: at most double accidentals', () => {
    for (const family of SCALE_FAMILIES) {
      for (let mode = 0; mode < family.intervals.length; mode++) {
        const intervals = modeIntervals(family.id, mode);
        for (let pc = 0; pc < 12; pc++) {
          const tonic = chooseTonicSpelling(pc, intervals);
          expect(pcOfSpelled(tonic)).toBe(pc);
          for (const s of spellScale(tonic, intervals)) {
            expect(Math.abs(s.accidental), `${formatSpelled(tonic)} ${family.id}[${mode}]`).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe('rule 2: non-7-note scales use the nearest diatonic parent', () => {
  it('spells pentatonic, blues and octatonic scales', () => {
    expect(names('C', MAJOR_PENTATONIC)).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(names('C', modeIntervals('blues', 0))).toEqual(['C', 'E♭', 'F', 'G♭', 'G', 'B♭']);
    expect(names('A', modeIntervals('blues', 0))).toEqual(['A', 'C', 'D', 'E♭', 'E', 'G']);
    expect(names('C', modeIntervals('octatonic', 0))).toEqual(['C', 'D', 'E♭', 'F', 'G♭', 'A♭', 'A', 'B']);
  });

  it('keeps a perfect 5th on the 5th letter', () => {
    expect(names('F♯', modeIntervals('blues', 0))).toEqual(['F♯', 'A', 'B', 'C', 'C♯', 'E']);
    for (const family of SCALE_FAMILIES) {
      for (let mode = 0; mode < family.intervals.length; mode++) {
        const intervals = modeIntervals(family.id, mode);
        const fifth = intervals.indexOf(7);
        if (fifth === -1) continue;
        for (let pc = 0; pc < 12; pc++) {
          const tonic = chooseTonicSpelling(pc, intervals);
          const spelled = spellScale(tonic, intervals);
          expect(spelled[fifth].letter, `${formatSpelled(tonic)} ${family.id}[${mode}]`).toBe((tonic.letter + 4) % 7);
        }
      }
    }
  });
});

describe('rule 3: notes outside the scale', () => {
  const cMajor = context('C', IONIAN);

  it('uses the scale spelling for scale members', () => {
    const gFlatMajor = context('G♭', IONIAN);
    expect([6, 8, 10, 11, 1, 3, 5].map((pc) => spell(pc, gFlatMajor))).toEqual(['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']);
  });

  it('takes the smallest alteration of a scale letter', () => {
    const hungarian = context('C', HUNGARIAN_MINOR); // C D E♭ F♯ G A♭ B
    expect(spell(4, hungarian)).toBe('E');
    expect(spell(5, hungarian)).toBe('F');
    expect(spell(10, hungarian)).toBe('B♭');
    expect(spell(3, context('F♯', HARMONIC_MINOR))).toBe('D♯');
  });

  it('prefers a letter the scale does not use', () => {
    const pentatonic = context('C', MAJOR_PENTATONIC); // C D E G A
    expect(spell(5, pentatonic)).toBe('F');
    expect(spell(6, pentatonic)).toBe('F♯');
    expect(spell(10, pentatonic)).toBe('B♭');
  });

  it('breaks remaining ties with the ♭2 ♭3 ♯4 ♭6 ♭7 convention when there is no chord', () => {
    expect([1, 3, 6, 8, 10].map((pc) => spell(pc, cMajor))).toEqual(['D♭', 'E♭', 'F♯', 'A♭', 'B♭']);
  });

  it('breaks remaining ties by stacking letters from the chord root', () => {
    expect(spell(8, withChord(cMajor, 4, '7'))).toBe('G♯'); // E7: E G♯ B D
    const aFlat7 = withChord(cMajor, 8, '7'); // A♭7: A♭ C E♭ G♭
    expect([8, 0, 3, 6].map((pc) => spell(pc, aFlat7))).toEqual(['A♭', 'C', 'E♭', 'G♭']);
    const bFlat7s9 = withChord(cMajor, 10, '7s9'); // B♭7♯9: B♭ D F A♭ C♯
    expect(spell(1, bFlat7s9)).toBe('C♯');
  });
});

describe('tonic spelling', () => {
  it('minimises accidentals and follows the preferred direction only on exact ties', () => {
    const pick = (pc: number, intervals: readonly number[], prefer?: 'sharp' | 'flat') =>
      formatSpelled(chooseTonicSpelling(pc, intervals, prefer));
    expect(pick(1, IONIAN)).toBe('D♭');
    expect(pick(1, IONIAN, 'sharp')).toBe('D♭');
    expect(pick(11, IONIAN, 'flat')).toBe('B');
    expect(pick(6, IONIAN)).toBe('G♭');
    expect(pick(6, IONIAN, 'sharp')).toBe('F♯');
    expect(pick(8, AEOLIAN)).toBe('G♯');
    expect(pick(3, AEOLIAN)).toBe('E♭');
    expect(pick(3, AEOLIAN, 'sharp')).toBe('D♯');
  });
});

describe('scale-degree labels', () => {
  it('reads the degree off the spelling', () => {
    const dDorian = context('D', modeIntervals('diatonic', 1));
    expect([2, 5, 11, 0].map((pc) => formatScaleDegree(pc, dDorian))).toEqual(['1', '♭3', '6', '♭7']);
    const cMajor = context('C', IONIAN);
    expect([6, 1, 8].map((pc) => formatScaleDegree(pc, cMajor))).toEqual(['♯4', '♭2', '♭6']);
    expect(formatScaleDegree(11, context('G♭', IONIAN))).toBe('4');
    expect(formatScaleDegree(5, context('F♯', HARMONIC_MINOR))).toBe('7');
    expect(formatScaleDegree(5, context('C', MAJOR_PENTATONIC))).toBe('4');
  });
});
