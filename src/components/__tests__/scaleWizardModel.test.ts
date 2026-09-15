import { describe, expect, it } from 'vitest';
import { TUNING_PRESETS } from '../../data/tunings';
import { makeScaleRef } from '../../theory';
import { scaleBoardDots } from '../scaleWizardModel';

const standard = { tuning: TUNING_PRESETS[0].tuning, fretCount: 12, capo: 0 };

describe('scale wizard fretboard', () => {
  it('marks every scale position, the tonic strongest, from the capo to the last fret', () => {
    const dots = scaleBoardDots(makeScaleRef('pentatonic', 4, 'A'), standard, 'names');
    expect(dots).toHaveLength(6 * 13);
    const lowE = dots.filter((d) => d.string === 0 && d.kind !== 'empty');
    expect(lowE.map((d) => `${d.fret}${d.label}`)).toEqual(['0E', '3G', '5A', '8C', '10D', '12E']);
    expect(lowE.filter((d) => d.kind === 'strong').map((d) => d.fret)).toEqual([5]);

    const capoed = scaleBoardDots(makeScaleRef('pentatonic', 4, 'A'), { ...standard, capo: 2 }, 'degrees');
    expect(capoed).toHaveLength(6 * 11);
    expect(capoed.filter((d) => d.string === 0 && d.kind !== 'empty').map((d) => d.label)).toEqual(['♭7', 'R', '♭3', '4', '5']);
  });
});
