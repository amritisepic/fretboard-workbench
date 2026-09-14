/** Turning a corpus chord (root, chord degrees, bass) into the evidence the analyzer reads. */

import {
  CHORD_TYPES,
  chordCandidateKey,
  identifyChord,
  mod12,
  parseDegree,
  pcOf,
  pcSet,
  pcSetFromIntervals,
  type ChordEvidence,
  type ChordType,
  type PitchClass,
} from '../theory';
import type { CorpusChord, CorpusKey } from './types';

const typesByMask = new Map<number, ChordType>();
for (const type of CHORD_TYPES) if (!typesByMask.has(type.mask)) typesByMask.set(type.mask, type);

/**
 * The chord on `root` with these degrees ("1", "b3", "5", "b7", "9"), voiced with `bass` lowest.
 * `bass` is a degree ("b3") or a chord member number ("3" is whichever 3rd the chord has). Extensions
 * the app has no chord type for are dropped, 13ths first. Null when no chord of two or more notes is left.
 */
export function chordFromDegrees(root: PitchClass, degrees: readonly string[], bass = '1'): ChordEvidence | null {
  const tones = degrees.map((label) => ({ ...parseDegree(label), label }));
  let type: ChordType | undefined;
  let kept = tones;
  for (const drop of [0, 13, 11, 9, 6, 7]) {
    kept = drop === 0 ? tones : kept.filter((t) => t.degree !== drop);
    type = typesByMask.get(pcSetFromIntervals(kept.map((t) => t.semitones)));
    if (type) break;
  }
  if (!type) return null;

  const parsedBass = parseDegree(bass);
  const member = /^\d+$/.test(bass) ? tones.find((t) => t.degree === parsedBass.degree) : undefined;
  const bassInterval = member ? member.semitones : parsedBass.semitones;
  const bassPc = mod12(root + bassInterval);
  const intervals = type.intervals.includes(bassInterval) ? type.intervals : [bassInterval, ...type.intervals];
  const bassMidi = 40 + mod12(bassPc - 4);
  const rootMidi = bassMidi + mod12(root - bassPc);
  const pitches = [
    ...new Set([bassMidi, ...intervals.map((iv) => rootMidi + iv + (rootMidi + iv <= bassMidi ? 12 : 0))]),
  ];
  const candidates = identifyChord(pitches);
  if (candidates.length === 0) return null;
  const wanted = chordCandidateKey(root, type.id, []);
  const chord = candidates.find((c) => c.key === wanted) ?? candidates[0];
  return { chord, pcs: pcSet(pitches.map(pcOf)) };
}

const sameKey = (a: CorpusKey | null | undefined, b: CorpusKey | null | undefined) =>
  (a ?? null) === (b ?? null) || (!!a && !!b && a.tonic === b.tonic && a.mode === b.mode);

/** Consecutive repeats of the same chord in the same key become one chord, as one box would hold it. */
export function collapseRepeats(chords: readonly CorpusChord[]): CorpusChord[] {
  const out: CorpusChord[] = [];
  for (const chord of chords) {
    const last = out[out.length - 1];
    const repeat =
      last &&
      last.evidence.chord.key === chord.evidence.chord.key &&
      last.evidence.chord.bass === chord.evidence.chord.bass &&
      last.evidence.pcs === chord.evidence.pcs &&
      sameKey(last.key, chord.key) &&
      sameKey(last.target, chord.target);
    if (!repeat) out.push(chord);
  }
  return out;
}

/** The pitch class of a note name: "C", "F#", "Bb", "B-" (music21's flat), "Ebb". */
export function noteNamePc(name: string): PitchClass | null {
  const match = /^([A-Ga-g])([#b♯♭-]*)$/.exec(name.trim());
  if (!match) return null;
  const base = [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(match[1].toUpperCase())];
  let accidental = 0;
  for (const ch of match[2]) accidental += ch === '#' || ch === '♯' ? 1 : -1;
  return mod12(base + accidental);
}
