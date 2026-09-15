import { describe, expect, it } from 'vitest';
import {
  chromaticOctave,
  classicalText,
  harmonizeScale,
  makeScaleRef,
  maxTopVoice,
  scaleNotes,
  type ScaleRef,
  type TopVoice,
} from '..';

const names = (ref: ScaleRef, top: TopVoice) => harmonizeScale(ref, top).map((c) => c.name);
const jazz = (ref: ScaleRef, top: TopVoice) => harmonizeScale(ref, top).map((c) => c.jazz);
const classical = (ref: ScaleRef, top: TopVoice) => harmonizeScale(ref, top).map((c) => classicalText(c.classical));

const cMajor = makeScaleRef('diatonic', 0, 'C');
const aHarmonicMinor = makeScaleRef('harmonicMinor', 0, 'A');
const cPhrygianDominant = makeScaleRef('harmonicMinor', 4, 'C');

describe('scale notes and degrees', () => {
  it('counts degrees from the major scale, with the tonic as R', () => {
    expect(scaleNotes(cPhrygianDominant).map((n) => `${n.name}:${n.label}`)).toEqual([
      'C:R', 'D♭:♭2', 'E:3', 'F:4', 'G:5', 'A♭:♭6', 'B♭:♭7',
    ]);
    expect(scaleNotes(makeScaleRef('diatonic', 3, 'F')).map((n) => n.label)).toEqual(['R', '2', '3', '♯4', '5', '6', '7']);
    expect(scaleNotes(makeScaleRef('blues', 0, 'C')).map((n) => n.label)).toEqual(['R', '♭3', '4', '♭5', '5', '♭7']);
  });

  it('lays the scale against the chromatic octave, spelling outside notes against the scale', () => {
    const steps = chromaticOctave(cPhrygianDominant);
    expect(steps).toHaveLength(13);
    expect(steps.map((s) => s.name)).toEqual(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B', 'C']);
    expect(steps.map((s) => (s.note ? s.note.label : '-')).join(' ')).toBe('R ♭2 - - 3 4 - 5 ♭6 - ♭7 - R');
  });
});

describe('chords stacked from a scale', () => {
  it('names the diatonic triads, 7ths and 13ths of the major scale', () => {
    expect(names(cMajor, 5)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(names(cMajor, 7)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
    expect(names(cMajor, 9)).toEqual(['Cmaj9', 'Dm9', 'Em7(♭9)', 'Fmaj9', 'G9', 'Am9', 'Bm7♭5(♭9)']);
    expect(names(cMajor, 13)).toEqual([
      'Cmaj13', 'Dm13', 'Em7(♭9,11,♭13)', 'Fmaj13(♯11)', 'G13', 'Am11(♭13)', 'Bm7♭5(♭9,11,♭13)',
    ]);
  });

  it('writes jazz numerals with the chord suffix and classical numerals with a figure', () => {
    expect(jazz(cMajor, 5)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(jazz(cMajor, 7)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
    expect(classical(cMajor, 7)).toEqual(['I⁷', 'ii⁷', 'iii⁷', 'IV⁷', 'V⁷', 'vi⁷', 'viiø⁷']);
    expect(jazz(cMajor, 13)[3]).toBe('IVmaj13(♯11)');
    expect(classical(cMajor, 13)[4]).toBe('V¹³');
  });

  it('counts jazz accidentals from major and classical ones from the scale', () => {
    expect(names(aHarmonicMinor, 7)).toEqual(['Am(maj7)', 'Bm7♭5', 'Cmaj7♯5', 'Dm7', 'E7', 'Fmaj7', 'G♯dim7']);
    expect(jazz(aHarmonicMinor, 7)).toEqual(['imaj7', 'iiø7', '♭III+maj7', 'iv7', 'V7', '♭VImaj7', 'vii°7']);
    expect(classical(aHarmonicMinor, 7)).toEqual(['i⁷', 'iiø⁷', 'III+⁷', 'iv⁷', 'V⁷', 'VI⁷', 'vii°⁷']);
    expect(names(cPhrygianDominant, 7)).toEqual(['C7', 'D♭maj7', 'Edim7', 'Fm(maj7)', 'Gm7♭5', 'A♭maj7♯5', 'B♭m7']);
    expect(jazz(cPhrygianDominant, 7)).toEqual(['I7', '♭IImaj7', 'iii°7', 'ivmaj7', 'vø7', '♭VI+maj7', '♭vii7']);
    expect(classical(cPhrygianDominant, 7)).toEqual(['I⁷', 'II⁷', 'iii°⁷', 'iv⁷', 'vø⁷', 'VI+⁷', 'vii⁷']);
    expect(jazz(aHarmonicMinor, 5)[2]).toBe('♭III+');
    expect(names(cPhrygianDominant, 13)).toEqual([
      'C7(♭9,11,♭13)', 'D♭maj7(♯9,♯11,13)', 'Edim7(♭9,♭11,♭13)', 'Fm(maj11,♭13)', 'Gm7♭5(♭9,11,13)', 'A♭maj13♯5', 'B♭m13(♯11)',
    ]);
    expect(jazz(cPhrygianDominant, 13)[3]).toBe('ivmaj11(♭13)');
  });

  it('stops even-sized scales where every other note comes back to the root', () => {
    expect([5, 6, 7, 8].map(maxTopVoice)).toEqual([9, 5, 13, 7]);
    expect(names(makeScaleRef('wholeTone', 0, 'C'), 13)).toEqual(['Caug', 'Daug', 'Eaug', 'G♭aug', 'A♭aug', 'B♭aug']);
    const diminished = harmonizeScale(makeScaleRef('octatonic', 0, 'C'), 13);
    expect(diminished.map((c) => c.tones.length)).toEqual(Array(8).fill(4));
    expect(diminished[0].name).toBe('Cdim7');
    expect(diminished[0].jazz).toBe('i°7');
  });

  it('names irregular stacks by chord identification, with the degree in the bass', () => {
    const pentatonic = harmonizeScale(makeScaleRef('pentatonic', 0, 'C'), 5);
    expect(pentatonic[0]).toMatchObject({ quality: null, name: 'Am/C', jazz: 'I' });
    const blues = harmonizeScale(makeScaleRef('blues', 0, 'C'), 13);
    expect(blues[0]).toMatchObject({ quality: null, name: 'Csus4' });
    expect(blues[0].tones).toHaveLength(3);
    expect(harmonizeScale(makeScaleRef('pentatonic', 0, 'C'), 13)[0].tones).toHaveLength(5);
  });
});
