// Acceptance test 5: chord identification.
import { describe, expect, it } from 'vitest';
import { CHORD_ID_WEIGHTS } from '../../data/chordIdWeights';
import { CHORD_TYPES, chordName, identifyChord, identifyChordPcs } from '../chords';
import { pcSet } from '../pitch';
import { makeScaleRef, scaleRefContext, scaleRefPcSet } from '../scales';

const names = (pitches: number[]) => identifyChord(pitches).map((c) => chordName(c));

describe('chord identification', () => {
  const A3 = 57;
  const C4 = 60;
  const E4 = 64;

  it('A C E offers Am, C6 (no 5) and Fmaj7 (no root)', () => {
    // Test 5's strings are bare names; with A in the bass the displayed form of C6 is "C6/A (no 5)".
    const bare = identifyChord([A3, C4, E4]).map((c) => chordName(c, undefined, { slash: false }));
    expect(bare).toEqual(expect.arrayContaining(['Am', 'C6 (no 5)', 'Fmaj7 (no root)']));
    expect(names([A3, C4, E4])).toEqual(expect.arrayContaining(['Am', 'C6/A (no 5)', 'Fmaj7 (no root)']));
  });

  it('defaults to Am when A is lowest', () => {
    expect(names([A3, C4, E4])[0]).toBe('Am');
  });

  it('ignores doublings across strings', () => {
    const plain = identifyChord([A3, C4, E4]).map((c) => c.key);
    const doubled = identifyChord([45, 48, 52, 57, 64, 69]).map((c) => c.key);
    expect(doubled).toEqual(plain);
    expect(identifyChordPcs(pcSet([9, 0, 4]), 9).map((c) => c.key)).toEqual(plain);
  });

  it('prefers the closest complete triad, named as a slash chord, over a reading with omissions', () => {
    expect(names([48, 52, 57])[0]).toBe('Am/C'); // C E A with C lowest
    expect(names([43, 47, 52])[0]).toBe('Em/G'); // G B E with G lowest
    expect(names([52, 55, 60])[0]).toBe('C/E');
    expect(names([48, 52, 55, 57])[0]).toBe('C6'); // no triad covers all four notes
  });

  it('picks sensible defaults for common chords', () => {
    expect(names([48, 52, 55, 58])[0]).toBe('C7');
    expect(names([48, 51, 54, 58])[0]).toBe('Cm7♭5');
    expect(names([43, 47, 50, 53])[0]).toBe('G7');
    expect(names([40, 47])[0]).toBe('E5');
  });

  it('spells slash basses from the chord', () => {
    expect(names([56, 59, 62, 64])[0]).toBe('E7/G♯');
    const gFlatMajor = scaleRefContext(makeScaleRef('diatonic', 0, 'G♭'));
    const [best] = identifyChord([51, 59, 66]); // D♯ B F♯ sounding
    expect(chordName(best, gFlatMajor)).toBe('C♭/E♭');
  });

  it('spells the root from the box context', () => {
    const gFlatMajor = scaleRefContext(makeScaleRef('diatonic', 0, 'G♭'));
    const [best] = identifyChord([59, 63, 66]); // B D♯ F♯ sounding
    expect(chordName(best, gFlatMajor)).toBe('C♭');
  });

  it('rewards chords whose complete form fits the reference scale', () => {
    const aHarmonicMinor = scaleRefPcSet(makeScaleRef('harmonicMinor', 0, 'A'));
    const set = pcSet([9, 0, 4]);
    const inScale = identifyChordPcs(set, 9, { scale: aHarmonicMinor });
    const plain = identifyChordPcs(set, 9);
    const find = (list: typeof plain, key: string) => list.find((c) => c.key === key);
    expect(find(inScale, '9:min:')?.diatonic).toBe(true);
    expect(find(inScale, '0:6:5')?.diatonic).toBe(false); // C6 needs G, which A harmonic minor lacks
    expect((find(inScale, '9:min:')?.score ?? 0) - (find(plain, '9:min:')?.score ?? 0)).toBe(CHORD_ID_WEIGHTS.diatonic);
  });

  it('returns nothing for fewer than two pitch classes', () => {
    expect(identifyChord([])).toEqual([]);
    expect(identifyChord([48, 60])).toEqual([]);
  });

  it('has no duplicate chord-type ids', () => {
    expect(new Set(CHORD_TYPES.map((t) => t.id)).size).toBe(CHORD_TYPES.length);
  });
});
