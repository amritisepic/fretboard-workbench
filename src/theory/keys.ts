/** Keys, roman numerals (spec §6), and the scale closest to a key. The key bar and Find key are in keyPlan.ts. */

import type { ChordQuality } from '../data/chords';
import { chordRootSpelling, chordSpellingHint, type ChordCandidate } from './chords';
import {
  MAJOR_SCALE_SEMITONES,
  difference,
  formatAccidental,
  intersect,
  mod12,
  setSize,
  type PcSet,
  type PitchClass,
} from './pitch';
import { rankScales } from './ranking';
import { scaleRefContext, scaleRefIntervals, scaleRefName, scaleRefPcSet, type ScaleRef } from './scales';
import { pcOfSpelled, spellPc, spellScale, type ChordSpellingHint } from './spelling';
import { compareKeys } from './util';

/** "C major", "A minor", "A♭ Lydian": a key is named like its scale. */
export function keyName(key: ScaleRef): string {
  return scaleRefName(key);
}

/** Whether a scale uses another pitch collection than `key`. Modes of the key (D Dorian in C major) don't. */
export function changesKey(key: ScaleRef, scale: ScaleRef): boolean {
  return scaleRefPcSet(key) !== scaleRefPcSet(scale);
}

export interface ChordEvidence {
  /** The chord's name in use. */
  readonly chord: ChordCandidate;
  /** The pitch classes that sound. */
  readonly pcs: PcSet;
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** How a numeral shows a chord's quality: upper or lower case, and °, ø or +. */
export type NumeralQuality = 'major' | 'minor' | 'diminished' | 'halfDiminished' | 'augmented';

export function numeralQuality(quality: ChordQuality): NumeralQuality {
  switch (quality) {
    case 'minor':
    case 'diminished':
    case 'halfDiminished':
    case 'augmented':
      return quality;
    default:
      return 'major';
  }
}

/**
 * The roman numeral for a chord on `root` in `key`. The degree comes from the root's spelling in the
 * key (with `hint`, the chord's letters break ties). Accidentals are measured from the key's own
 * degree, so C in A minor is III and B♭ in C major is ♭VII. Keys without that letter (pentatonic,
 * blues) fall back to the major-scale degree.
 */
export function degreeNumeral(root: PitchClass, key: ScaleRef, quality: NumeralQuality, hint?: ChordSpellingHint): string {
  const spelled = spellPc(root, scaleRefContext(key, hint));
  const degree = ((spelled.letter - key.tonic.letter + 7) % 7) + 1;
  const keyNote = spellScale(key.tonic, scaleRefIntervals(key)).find((note) => note.letter === spelled.letter);
  const reference = keyNote ? pcOfSpelled(keyNote) : pcOfSpelled(key.tonic) + MAJOR_SCALE_SEMITONES[degree - 1];
  const offset = mod12(pcOfSpelled(spelled) - reference);
  const accidental = offset > 6 ? offset - 12 : offset;
  const numeral = NUMERALS[(degree - 1) % 7];
  const lower = quality === 'minor' || quality === 'diminished' || quality === 'halfDiminished';
  const suffix = quality === 'diminished' ? '°' : quality === 'halfDiminished' ? 'ø' : quality === 'augmented' ? '+' : '';
  return formatAccidental(accidental) + (lower ? numeral.toLowerCase() : numeral) + suffix;
}

/**
 * The chord's roman numeral in `key`: major-quality chords upper case and minor lower case, with °
 * for diminished, ø for half-diminished and + for augmented. Inversion figures and extensions are
 * not shown.
 */
export function romanNumeral(chord: ChordCandidate, key: ScaleRef): string {
  return degreeNumeral(chord.root, key, numeralQuality(chord.type.quality), chordSpellingHint(chord));
}

/**
 * The reference scale for a chord that strays least from `key`. The candidates are the ranking's
 * rows for the chord in its best tier, normally every scale on the chord root that holds all the
 * sounding chord tones. Fewest notes outside the key wins, then most notes shared with it, then the
 * ranking's own order. A chord that fits the key gets the key's own mode (Dm7 in C major: D Dorian);
 * G7(13) in C minor gets G Mixolydian ♭2, keeping the key's A♭ beside the chord's B and E.
 */
export function closestScale(chordPcs: PcSet, chord: ChordCandidate, key: ScaleRef): ScaleRef {
  const keyPcs = scaleRefPcSet(key);
  const { rows } = rankScales(chordPcs, chord, { key, rootSpelling: chordRootSpelling(chord, scaleRefContext(key)) });
  const tier = Math.min(...rows.map((row) => row.tier));
  const [closest] = rows
    .filter((row) => row.tier === tier)
    .map((row, order) => ({
      row,
      sortKey: [setSize(difference(row.pcs, keyPcs)), -setSize(intersect(row.pcs, keyPcs)), order],
    }))
    .sort((a, b) => compareKeys(a.sortKey, b.sortKey));
  return closest.row.ref;
}
