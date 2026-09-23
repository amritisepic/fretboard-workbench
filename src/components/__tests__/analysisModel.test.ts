import { describe, expect, it } from 'vitest';
import { analyzeHarmony, chordName, makeScaleRef, mod12, type HarmonicAnalysis } from '../../theory';
import { progression } from '../../theory/__tests__/chordSymbols';
import { explainReading, figuresText, functionLabel, numeralLabel, patternsAcross, relationViews } from '../analysisModel';

function analyze(symbols: string, tonic: string, mode = 0) {
  const chords = progression(symbols);
  const analysis = analyzeHarmony(
    chords.map((chord) => ({ chord })),
    { home: makeScaleRef('diatonic', mode, tonic) },
  );
  return { chords, analysis };
}

const labels = (analysis: HarmonicAnalysis, notation: 'jazz' | 'classical') =>
  analysis.boxes.map((box) => functionLabel(box, box.reading, notation).text);

describe('function labels', () => {
  it('names the user’s progression in jazz notation', () => {
    const { analysis } = analyze('B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7', 'A♭');
    const names = labels(analysis, 'jazz');
    expect(names.slice(0, 5)).toEqual(['ii7', 'iii7', 'IVmaj7', 'V7', 'V7/IV']);
    expect(['V7/ii', 'V7/II']).toContain(names[5]);
  });

  it('writes inversions as figured bass in classical notation', () => {
    expect(labels(analyze('C/G G7 C', 'C').analysis, 'classical')).toEqual(['I⁶₄', 'V⁷', 'I']);
    expect(labels(analyze('C G7/B C', 'C').analysis, 'classical')).toEqual(['I', 'V⁶₅', 'I']);
    expect(labels(analyze('C A7/C♯ Dm', 'C').analysis, 'classical')).toEqual(['I', 'V⁶₅/ii', 'ii']);
    expect(figuresText(['4', '2'])).toBe('⁴₂');
  });

  it('dresses a bare numeral as a label, for a card whose analysis is switched off', () => {
    // The card draws one chip through one component, so the numeral on its own has to arrive in the
    // same shape a full reading does.
    expect(numeralLabel('♭VII')).toEqual({ numeral: '♭VII', suffix: '', figures: [], target: '', note: '', text: '♭VII' });
  });

  it('writes a tritone substitute as subV7 or ♭II⁷, and notes borrowing in each notation', () => {
    const tritone = analyze('Dm7 D♭7 Cmaj7', 'C').analysis;
    expect(functionLabel(tritone.boxes[1], tritone.boxes[1].reading, 'jazz').text).toBe('subV7');
    expect(functionLabel(tritone.boxes[1], tritone.boxes[1].reading, 'classical')).toMatchObject({ text: '♭II⁷', note: 'tritone sub' });
    const plagal = analyze('C F Fm C', 'C').analysis;
    expect(functionLabel(plagal.boxes[2], plagal.boxes[2].reading, 'jazz')).toMatchObject({ text: 'iv', note: 'borrowed from C minor' });
    expect(functionLabel(plagal.boxes[2], plagal.boxes[2].reading, 'classical').note).toBe('mixture (C minor)');
  });
});

describe('augmented sixth chords', () => {
  it('names a tritone substitute of V by its augmented sixth in classical notation', () => {
    const ger = analyze('Dm7 A♭7 G7 C', 'C').analysis;
    expect(ger.boxes[1].reading.kind).toBe('tritoneSub');
    expect(functionLabel(ger.boxes[1], ger.boxes[1].reading, 'classical')).toMatchObject({
      text: 'Ger⁶₅',
      note: 'augmented sixth chord',
    });
    expect(functionLabel(ger.boxes[1], ger.boxes[1].reading, 'jazz').text).toBe('subV7/V');
    const fr = analyze('Dm7 A♭7♭5 G7 C', 'C').analysis;
    expect(functionLabel(fr.boxes[1], fr.boxes[1].reading, 'classical').text).toBe('Fr⁴₃');
  });
});

describe('explanations', () => {
  it('explains a secondary dominant by the chord it points at', () => {
    const { chords, analysis } = analyze('B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7', 'A♭');
    const box = analysis.boxes[4];
    const text = explainReading(box, box.reading, {
      title: chordName(chords[4].chord),
      previousTitle: 'E♭7',
      nextTitle: 'F7',
      nextRoot: mod12(chords[5].chord.root),
      notation: 'jazz',
    });
    expect(text).toBe('A♭7 is V7 of D♭: it borrows the dominant of the IV chord, so the key bar shows D♭ major. It moves to F7 instead.');
  });

  it('gives every alternative of an ambiguous chord its own sentence', () => {
    const { analysis } = analyze('B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7', 'A♭');
    const box = analysis.boxes[5];
    const sentences = [box.reading, ...box.alternatives].map((reading) =>
      explainReading(box, reading, { title: 'F7', previousTitle: 'A♭7', nextTitle: null, nextRoot: null, notation: 'jazz' }),
    );
    expect(sentences.some((s) => s.startsWith('F7 is V7 of B♭m:'))).toBe(true);
    expect(sentences.some((s) => s.startsWith('F7 is V7 of B♭:'))).toBe(true);
  });
});

describe('strip lane', () => {
  it('brackets ii–V and draws the resolution in jazz notation, and names cadences in classical', () => {
    const { analysis } = analyze('Dm7 G7 Cmaj7', 'C');
    expect(relationViews(analysis.relations[0], 'jazz', 'C major')).toEqual([
      { id: 'twoFive', label: 'ii–V', arrow: null, bracket: true },
    ]);
    expect(relationViews(analysis.relations[1], 'jazz', 'C major')).toEqual([
      { id: 'authenticCadence', label: 'V–I', arrow: 'solid', bracket: false },
    ]);
    expect(relationViews(analysis.relations[1], 'classical', 'C major')).toEqual([
      { id: 'authenticCadence', label: 'authentic cadence', arrow: null, bracket: false },
    ]);
  });

  it('dashes a tritone substitute’s resolution', () => {
    const { analysis } = analyze('Dm7 D♭7 Cmaj7', 'C');
    expect(relationViews(analysis.relations[1], 'jazz', 'C major')).toEqual([
      { id: 'tritoneResolution', label: 'sub resolves', arrow: 'dashed', bracket: false },
    ]);
  });

  it('names a pattern on each strip it spans', () => {
    const { analysis } = analyze('Am G F E', 'A', 5);
    expect(analysis.patterns).toContainEqual({ id: 'andalusian', first: 0, last: 3 });
    expect(patternsAcross(analysis.patterns, 1)).toEqual([{ name: 'Andalusian cadence', starts: true }]);
    expect(patternsAcross(analysis.patterns, 3)).toEqual([{ name: 'Andalusian cadence', starts: false }]);
    expect(patternsAcross(analysis.patterns, 4)).toEqual([]);
  });
});
