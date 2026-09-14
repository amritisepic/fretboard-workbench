/**
 * McGill Billboard SALAMI chord files: "# tonic: C" headers (tonic only, no mode) and timed lines of
 * bars in Harte chord syntax ("| C:maj | G:maj/3 | F:maj/3 . . G:maj/3 |").
 */

import { chordFromDegrees, collapseRepeats, noteNamePc } from './chords';
import type { CorpusChord, CorpusKey, CorpusPiece } from './types';

/** Harte shorthands as chord degrees. */
const SHORTHANDS: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  min: ['1', 'b3', '5'],
  dim: ['1', 'b3', 'b5'],
  aug: ['1', '3', '#5'],
  maj7: ['1', '3', '5', '7'],
  min7: ['1', 'b3', '5', 'b7'],
  '7': ['1', '3', '5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
  hdim7: ['1', 'b3', 'b5', 'b7'],
  minmaj7: ['1', 'b3', '5', '7'],
  maj6: ['1', '3', '5', '6'],
  min6: ['1', 'b3', '5', '6'],
  '9': ['1', '3', '5', 'b7', '9'],
  maj9: ['1', '3', '5', '7', '9'],
  min9: ['1', 'b3', '5', 'b7', '9'],
  '11': ['1', '3', '5', 'b7', '9', '11'],
  min11: ['1', 'b3', '5', 'b7', '9', '11'],
  '13': ['1', '3', '5', 'b7', '9', '13'],
  maj13: ['1', '3', '5', '7', '9', '13'],
  min13: ['1', 'b3', '5', 'b7', '9', '13'],
  sus2: ['1', '2', '5'],
  sus4: ['1', '4', '5'],
  '5': ['1', '5'],
  '1': ['1'],
};

/** "G:maj/3", "A:min(11)", "F:sus4(b7,9)", "C/5", "D:(1,b3,5)". Null for anything else ("N", "X"). */
export function parseHarte(label: string): { root: number; degrees: string[]; bass: string } | null {
  const match = /^([A-G][#b]*)(?::([a-z0-9]*)(?:\(([^)]*)\))?)?(?:\/([#b]*\d+))?$/.exec(label);
  if (!match) return null;
  const root = noteNamePc(match[1]);
  if (root === null) return null;
  const shorthand = match[2] ?? '';
  const base = shorthand === '' ? (match[3] ? [] : SHORTHANDS.maj) : SHORTHANDS[shorthand];
  if (!base) return null;
  const degrees = [...base];
  for (const item of (match[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (item.startsWith('*')) {
      const removed = degrees.indexOf(item.slice(1));
      if (removed !== -1) degrees.splice(removed, 1);
    } else if (!degrees.includes(item)) {
      degrees.push(item);
    }
  }
  return { root, degrees, bass: match[4] ?? '1' };
}

/** One song. The key at each chord is the tonic in force; mode is unknown. */
export function parseBillboard(source: string, id: string): CorpusPiece {
  let key: CorpusKey | null = null;
  const chords: CorpusChord[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const tonic = /^#\s*tonic:\s*([A-G][#b]*)/.exec(line);
    if (tonic) {
      const pc = noteNamePc(tonic[1]);
      if (pc !== null) key = { tonic: pc, mode: null };
      continue;
    }
    if (line.startsWith('#') || !key) continue;
    const content = line.split('\t').slice(1).join(' ');
    const lineChords: CorpusChord[] = [];
    let repeat = 1;
    let previous: CorpusChord | null = null;
    for (const token of content.split(/\s+/)) {
      const times = /^x(\d+)$/.exec(token);
      if (times) {
        repeat = Number(times[1]);
        continue;
      }
      if (token === '.') {
        if (previous) lineChords.push(previous);
        continue;
      }
      // Chords always carry a colon ("A:maj"); a bare "A," is a section label.
      const parsed = token.includes(':') ? parseHarte(token) : null;
      if (!parsed) continue;
      const evidence = chordFromDegrees(parsed.root, parsed.degrees, parsed.bass);
      if (!evidence) continue;
      previous = { evidence, label: token, key, target: null };
      lineChords.push(previous);
    }
    for (let r = 0; r < repeat; r++) chords.push(...lineChords);
  }
  return { corpus: 'billboard', id, chords: collapseRepeats(chords) };
}
