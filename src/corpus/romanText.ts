/**
 * RomanText analyses (When in Rome): "m3 d: i b3 Cad64 b4 V7", key changes as "C:" (major) or "a:"
 * (minor), applied chords as "V7/V", pivots as "I || f: III", and repeats as "m5-6 = m3-4". Numerals
 * are read as music21 reads them: in a minor key lower-case vi and vii are raised, upper-case VI and
 * VII are not, and a seventh without a quality sign is the one the key's scale gives.
 */

import { mod12 } from '../theory';
import { chordFromDegrees, collapseRepeats, noteNamePc } from './chords';
import type { CorpusChord, CorpusKey, CorpusPiece } from './types';

type Key = CorpusKey & { readonly mode: 'major' | 'minor' };

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DEGREES = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const NUMERAL = 'VII|vii|III|iii|IV|iv|VI|vi|II|ii|V|v|I|i';

const accidentalOf = (text: string) => [...text].reduce((sum, ch) => sum + (ch === '#' ? 1 : ch === 'b' || ch === '-' ? -1 : 0), 0);

/** The root of a numeral and its step in the key's scale. */
function degreeIn(key: Key, numeral: string, accidental: string): { readonly root: number; readonly step: number } {
  const step = DEGREES.indexOf(numeral.toLowerCase());
  const scale = key.mode === 'minor' ? MINOR : MAJOR;
  let offset = scale[step] + accidentalOf(accidental);
  if (key.mode === 'minor' && accidental === '' && step >= 5 && numeral === numeral.toLowerCase()) offset += 1;
  return { root: mod12(key.tonic + offset), step };
}

/** The key a chain of applied targets ("/V", "/V/V") points at, from the innermost. */
function targetKey(key: Key, chain: string): Key | null {
  const targets = chain.split('/').filter(Boolean);
  let current: Key | null = null;
  for (let i = targets.length - 1; i >= 0; i--) {
    const match = new RegExp(`^([#b-]*)(${NUMERAL})$`).exec(targets[i]);
    if (!match) return null;
    const within: Key = current ?? key;
    const { root } = degreeIn(within, match[2], match[1]);
    current = { tonic: root, mode: match[2] === match[2].toUpperCase() ? 'major' : 'minor' };
  }
  return current;
}

const INVERSION_BASS: Readonly<Record<string, string>> = { '6': '3', '64': '5', '65': '3', '43': '5', '42': '7', '2': '7' };
const SEVENTH_FIGURES = new Set(['7', '65', '43', '42', '2']);

/** One chord token in `key`, or null for anything that isn't one. */
export function parseRomanChord(token: string, key: Key): Pick<CorpusChord, 'evidence' | 'target'> | null {
  let text = token.replace(/\[[^\]]*\]/g, '');
  while (/(\d)\/(\d)/.test(text)) text = text.replace(/(\d)\/(\d)/, '$1$2');
  text = text.replace(new RegExp(`^([#b-]*(?:${NUMERAL}))/o`), '$1ø').replace('maj7', 'M7');

  const special = /^(Cad64|It|Fr|Ger)(\d*)((?:\/[#b-]*(?:VII|vii|III|iii|IV|iv|VI|vi|II|ii|V|v|I|i))*)$/.exec(text);
  if (special) {
    const target = special[3] ? targetKey(key, special[3]) : null;
    const within = target ?? key;
    let evidence;
    if (special[1] === 'Cad64') {
      evidence = chordFromDegrees(within.tonic, ['1', within.mode === 'minor' ? 'b3' : '3', '5'], '5');
    } else {
      const degrees = special[1] === 'It' ? ['1', '3', 'b7'] : special[1] === 'Fr' ? ['1', '3', 'b5', 'b7'] : ['1', '3', '5', 'b7'];
      evidence = chordFromDegrees(mod12(within.tonic + 8), degrees);
    }
    return evidence ? { evidence, target } : null;
  }

  const match = new RegExp(`^([#b-]*)(${NUMERAL})(o|ø|\\+|M)?(\\d*)((?:/[#b-]*(?:${NUMERAL}))*)$`).exec(text);
  if (!match) return null;
  const [, accidental, numeral, quality = '', figure, chain] = match;
  const target = chain ? targetKey(key, chain) : null;
  const within = target ?? key;
  const { root, step } = degreeIn(within, numeral, accidental);
  const upper = numeral === numeral.toUpperCase();
  const seventh = SEVENTH_FIGURES.has(figure) || quality === 'ø';

  const third = quality === 'o' || quality === 'ø' ? 'b3' : quality === '+' ? '3' : upper ? '3' : 'b3';
  const fifth = quality === 'o' || quality === 'ø' ? 'b5' : quality === '+' ? '#5' : '5';
  const degrees = ['1', third, fifth];
  if (seventh) {
    if (quality === 'o') degrees.push('bb7');
    else if (quality === 'ø') degrees.push('b7');
    else if (quality === 'M') degrees.push('7');
    else {
      const scale = within.mode === 'minor' ? MINOR : MAJOR;
      const interval = mod12(within.tonic + scale[(step + 6) % 7] - root);
      degrees.push(interval === 11 ? '7' : interval === 9 ? 'bb7' : 'b7');
    }
  }
  const evidence = chordFromDegrees(root, degrees, INVERSION_BASS[figure] ?? '1');
  return evidence ? { evidence, target } : null;
}

/** One analysis file. Chords before the first key are skipped. */
export function parseRomanText(source: string, id: string, analyst?: string): CorpusPiece {
  const byMeasure = new Map<number, CorpusChord[]>();
  const chords: CorpusChord[] = [];
  let key: Key | null = null;
  let pivotPending = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const repeat = /^m(\d+)[a-z]?(?:-(\d+)[a-z]?)?\s*=\s*m(\d+)[a-z]?(?:-(\d+)[a-z]?)?/.exec(line);
    if (repeat) {
      const [from, to] = [Number(repeat[3]), Number(repeat[4] ?? repeat[3])];
      const copied: CorpusChord[] = [];
      for (let m = from; m <= to; m++) copied.push(...(byMeasure.get(m) ?? []));
      chords.push(...copied);
      byMeasure.set(Number(repeat[1]), copied);
      continue;
    }
    const measure = /^m(\d+)[a-z]?\s+(.*)$/.exec(line);
    if (!measure) continue;
    const inMeasure: CorpusChord[] = [];
    for (const token of measure[2].split(/\s+/)) {
      if (token === '' || /^b\d/.test(token) || token === ':||' || token === '||:') continue;
      if (token === '||') {
        pivotPending = true;
        continue;
      }
      const keyToken = /^([A-Ga-g][#b-]*):$/.exec(token);
      if (keyToken) {
        const tonic = noteNamePc(keyToken[1]);
        if (tonic !== null) key = { tonic, mode: keyToken[1][0] === keyToken[1][0].toLowerCase() ? 'minor' : 'major' };
        continue;
      }
      if (!key) continue;
      const parsed = parseRomanChord(token, key);
      if (!parsed) continue;
      if (pivotPending && chords.length > 0) {
        const last = chords[chords.length - 1];
        chords[chords.length - 1] = { ...last, pivot: key };
        pivotPending = false;
        continue;
      }
      pivotPending = false;
      const chord: CorpusChord = { ...parsed, key, label: token };
      chords.push(chord);
      inMeasure.push(chord);
    }
    byMeasure.set(Number(measure[1]), inMeasure);
  }
  return { corpus: 'when-in-rome', id, analyst, chords: collapseRepeats(chords) };
}
