import { describe, expect, it } from 'vitest';
import { TUNING_PRESETS } from '../../data/tunings';
import { identifyChord, parseChordSymbol, pitchesAt, voiceChord, type FretPosition, type VoicingStyle } from '..';

const standard = TUNING_PRESETS[0].tuning;

/** "x32010": low string first, x for a muted string. */
const shape = (positions: readonly FretPosition[]) =>
  standard.map((_, string) => positions.find((p) => p.string === string)?.fret ?? 'x').join('');

const voice = (symbol: string, style: VoicingStyle) => {
  const voicing = voiceChord(parseChordSymbol(symbol), standard, style);
  if (!voicing) throw new Error(`no voicing for ${symbol}`);
  return voicing;
};

describe('chord symbols', () => {
  it('reads lead-sheet spellings into chord types', () => {
    expect(parseChordSymbol('Dø7').type.id).toBe('m7b5');
    expect(parseChordSymbol('G7b9').type.id).toBe('7b9');
    expect(parseChordSymbol('C°7').type.id).toBe('dim7');
    expect(parseChordSymbol('Am(maj7)').type.id).toBe('mMaj7');
    expect(parseChordSymbol('E♭-7').type.id).toBe('m7');
    const slash = parseChordSymbol('G/B');
    expect([slash.type.id, slash.bass]).toEqual(['maj', { letter: 6, accidental: 0 }]);
    expect(() => parseChordSymbol('Cwhatever')).toThrow('Unknown chord suffix');
  });
});

describe('voicings', () => {
  it('finds the familiar open chords', () => {
    expect(['G', 'C', 'D', 'Em', 'Am', 'E', 'A', 'Dm', 'E7'].map((s) => shape(voice(s, 'open').positions))).toEqual([
      '320003', 'x32010', 'xx0232', '022000', 'x02210', '022100', 'x02220', 'xx0231', '020100',
    ]);
    expect(shape(voice('F', 'open').positions)).toBe('133211');
    expect(shape(voice('G/B', 'open').positions).startsWith('x2')).toBe(true);
  });

  it('keeps jazz voicings off open strings and identifies them as written', () => {
    for (const symbol of ['Cmaj7', 'Dm7', 'G7', 'Bm7♭5', 'E7♭9', 'A♭m7', 'C♯°7', 'F13', 'G7♯5', 'Cm6']) {
      const { positions, chordKey } = voice(symbol, 'jazz');
      expect(positions.every((p) => p.fret > 0)).toBe(true);
      expect(positions.length).toBeGreaterThanOrEqual(3);
      expect(identifyChord(pitchesAt(standard, positions)).map((c) => c.key)).toContain(chordKey);
    }
  });
});
