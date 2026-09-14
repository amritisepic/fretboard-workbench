import { describe, expect, it } from 'vitest';
import { chordName } from '../../theory';
import { parseBillboard, parseHarte } from '../billboard';
import { parseRockAnalysis } from '../rockCorpus';
import { parseRomanText } from '../romanText';
import type { CorpusPiece } from '../types';

const names = (piece: CorpusPiece) => piece.chords.map((c) => chordName(c.evidence.chord));
const keys = (piece: CorpusPiece) => piece.chords.map((c) => `${c.key.tonic}${c.key.mode ? c.key.mode[1] : ''}`);

describe('McGill Billboard', () => {
  it('reads Harte chord labels', () => {
    expect(parseHarte('G:maj/3')).toEqual({ root: 7, degrees: ['1', '3', '5'], bass: '3' });
    expect(parseHarte('F:sus4(b7,9)')).toEqual({ root: 5, degrees: ['1', '4', '5', 'b7', '9'], bass: '1' });
    expect(parseHarte('N')).toBeNull();
  });

  it('reads a song: tonic headers, bars, continuation dots and repeats', () => {
    const piece = parseBillboard(
      [
        '# title: Test',
        '# tonic: C',
        '0.0\tsilence',
        '4.5\tA, intro, | C:5 | x4',
        '15.3\tA, verse, | C:maj | G:maj/3 | F:maj/3 . . G:maj/3 | C:min7 |',
        '# tonic: D',
        '30.5\t| D:7(#9) | N |',
      ].join('\n'),
      '0001',
    );
    expect(names(piece)).toEqual(['C5', 'C', 'G/B', 'F/A', 'G/B', 'Cm7', 'D7♯9']);
    expect(keys(piece)).toEqual(['0', '0', '0', '0', '0', '0', '2']);
  });
});

describe('RS200 rock corpus', () => {
  it('expands rules from S, with keys, continuation and applied chords', () => {
    const piece = parseRockAnalysis(
      ['% Test', 'P: I64 V | I . IV V7/IV |', 'Q: vi IVd7 | bVII Vh7 |', 'S: [F] $P*2 [G] $Q'].join('\n'),
      'test',
      'dt',
    );
    // A capital numeral with 7 is a major seventh in this corpus (IV7), except on V, and d7 is a dominant seventh.
    expect(names(piece)).toEqual([
      'F/C', 'C', 'F', 'B♭', 'F7', 'F/C', 'C', 'F', 'B♭', 'F7', 'Em', 'C7', 'F', 'Dm7♭5',
    ]);
    expect(names(parseRockAnalysis('S: [C] IV7 | V7 |', 'sevenths', 'dt'))).toEqual(['Fmaj7', 'G7']);
    expect(piece.chords[4].target).toEqual({ tonic: 10, mode: 'major' });
    expect(piece.chords.at(-1)?.key).toEqual({ tonic: 7, mode: null });
  });
});

describe('RomanText', () => {
  it('reads keys, figures, applied chords, cadential 6/4s, pivots and repeats', () => {
    const piece = parseRomanText(
      [
        'Composer: Test',
        'Time Signature: 4/4',
        'm1 F: I b2 viio6 b3 I6',
        'm2 IV b2 V7/V b3 V',
        'm3 d: i b3 Cad64 b4 V7',
        'm4 i || F: vi',
        'm5 d: VI b2 viio7 b3 Ger65',
        'm6-7 = m1-2',
      ].join('\n'),
      'test',
    );
    expect(names(piece)).toEqual([
      'F', 'Edim/G', 'F/A', 'B♭', 'G7', 'C', 'Dm', 'Dm/A', 'A7', 'Dm', 'B♭', 'D♭dim7', 'B♭7',
      'F', 'Edim/G', 'F/A', 'B♭', 'G7', 'C',
    ]);
    expect(piece.chords[4].target).toEqual({ tonic: 0, mode: 'major' });
    expect(piece.chords[6].key).toEqual({ tonic: 2, mode: 'minor' });
    expect(piece.chords[9].pivot).toEqual({ tonic: 5, mode: 'major' });
    expect(piece.chords[10].key).toEqual({ tonic: 2, mode: 'minor' });
    expect(piece.chords[13].key).toEqual({ tonic: 5, mode: 'major' });
  });
});
