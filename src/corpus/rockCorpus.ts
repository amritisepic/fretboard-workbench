/**
 * The de Clercq–Temperley rock corpus (RS200) harmonic analyses (.har). An analysis is a set of rules
 * ("Vr: $BP*4", "S: [F] $In $Vr $Ch") expanded from S. Keys are tonic names in brackets ("[Eb]") with
 * no mode; chords are Roman numerals relative to the major scale of that tonic, with suffixes:
 * 6 and 64 invert a triad; 7, 65, 43 and 42 are sevenths (major with a capital numeral, minor with a
 * lower-case one); d makes a dominant seventh, h half-diminished, x fully diminished; o is diminished,
 * a augmented, s4 suspended. "." continues a chord, "R" is a rest, and "*n" repeats.
 */

import { mod12 } from '../theory';
import { chordFromDegrees, collapseRepeats, noteNamePc } from './chords';
import type { CorpusChord, CorpusKey, CorpusPiece } from './types';

const NUMERALS: Readonly<Record<string, number>> = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
const NUMERAL = '(VII|vii|III|iii|IV|iv|VI|vi|II|ii|V|v|I|i)';
const TOKEN = new RegExp(`^([b#]*)${NUMERAL}([^/]*)(?:/([b#]*)${NUMERAL})?$`);

const accidentalOf = (text: string) => [...text].reduce((sum, ch) => sum + (ch === '#' ? 1 : ch === 'b' ? -1 : 0), 0);

/** Chord member in the bass for each inversion figure. */
const INVERSION_BASS: Readonly<Record<string, string>> = { '6': '3', '64': '5', '65': '3', '43': '5', '42': '7' };

/** "V7/IV", "bVII", "ih7", "Vd42", "IV64" in a key on `tonic`. Null for anything that isn't a chord. */
export function parseRockNumeral(token: string, tonic: number): Pick<CorpusChord, 'evidence' | 'target'> | null {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const [, accidental, numeral, suffix, targetAccidental, targetNumeral] = match;
  const upper = numeral === numeral.toUpperCase();
  const targetRoot = targetNumeral
    ? mod12(tonic + NUMERALS[targetNumeral.toLowerCase()] + accidentalOf(targetAccidental ?? ''))
    : tonic;
  const root = mod12(targetRoot + NUMERALS[numeral.toLowerCase()] + accidentalOf(accidental));

  const figure = /(64|65|43|42|6|7|9|11|13)/.exec(suffix)?.[1] ?? '';
  const seventh = ['7', '65', '43', '42'].includes(figure);
  const third = upper ? '3' : 'b3';
  let degrees: string[];
  if (suffix.includes('s4')) degrees = seventh ? ['1', '4', '5', 'b7'] : ['1', '4', '5'];
  else if (suffix.includes('x')) degrees = ['1', 'b3', 'b5', 'bb7'];
  else if (suffix.includes('h')) degrees = ['1', 'b3', 'b5', 'b7'];
  else if (suffix.includes('d')) degrees = ['1', '3', '5', 'b7', ...(figure === '9' ? ['9'] : [])];
  else if (suffix.includes('o')) degrees = seventh ? ['1', 'b3', 'b5', 'bb7'] : ['1', 'b3', 'b5'];
  else if (suffix.includes('a')) degrees = ['1', '3', '#5'];
  // The corpus documents "V7" as a major seventh like "IV7", but its analysts write V7 and V43/ii for
  // dominant sevenths, so a seventh on V is read as one.
  else if (seventh) degrees = ['1', third, '5', upper && numeral !== 'V' ? '7' : 'b7'];
  else degrees = ['1', third, '5'];
  if (suffix.includes('b9')) degrees.push('b9');
  else if (figure === '9' && !suffix.includes('d')) degrees.push('9');

  const evidence = chordFromDegrees(root, degrees, INVERSION_BASS[figure] ?? '1');
  if (!evidence) return null;
  const target: CorpusKey | null = targetNumeral
    ? { tonic: targetRoot, mode: targetNumeral === targetNumeral.toUpperCase() ? 'major' : 'minor' }
    : null;
  return { evidence, target };
}

/** One analysis file. */
export function parseRockAnalysis(source: string, id: string, analyst: string): CorpusPiece {
  const rules = new Map<string, string>();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/%.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon > 0) rules.set(line.slice(0, colon).trim(), line.slice(colon + 1));
  }

  const chords: CorpusChord[] = [];
  let key: CorpusKey | null = null;
  let measure: CorpusChord[] = [];
  let lastMeasure: CorpusChord[] = [];
  let previous: CorpusChord | null = null;

  const expand = (name: string, depth: number) => {
    const body = rules.get(name);
    if (body === undefined || depth > 40) return;
    for (const token of body.replace(/\|/g, ' | ').split(/\s+/).filter(Boolean)) {
      const reference = /^\$([A-Za-z0-9_']+)(?:\*(\d+))?$/.exec(token);
      if (reference) {
        for (let r = 0; r < Number(reference[2] ?? 1); r++) expand(reference[1], depth + 1);
        continue;
      }
      const repeat = /^\*(\d+)$/.exec(token);
      if (repeat) {
        for (let r = 1; r < Number(repeat[1]); r++) chords.push(...lastMeasure);
        continue;
      }
      if (token === '|') {
        lastMeasure = measure;
        measure = [];
        continue;
      }
      const bracket = /^\[([^\]]+)\]$/.exec(token);
      if (bracket) {
        const pc = noteNamePc(bracket[1]);
        if (pc !== null) key = { tonic: pc, mode: null };
        continue;
      }
      if (token === '.') {
        if (previous) measure.push(previous);
        continue;
      }
      if (token === 'R' || !key) {
        previous = null;
        continue;
      }
      const parsed = parseRockNumeral(token, key.tonic);
      if (!parsed) continue;
      previous = { ...parsed, key, label: token };
      chords.push(previous);
      measure.push(previous);
    }
  };
  expand('S', 0);
  return { corpus: 'rs200', id, analyst, chords: collapseRepeats(chords) };
}
