/** Keys, key regions across a progression of boxes, and roman numerals (spec §6). */

import { chordSpellingHint, type ChordCandidate } from './chords';
import { MAJOR_SCALE_SEMITONES, formatAccidental, mod12, type PcSet } from './pitch';
import { scaleRefContext, scaleRefIntervals, scaleRefName, scaleRefPcSet, type ScaleRef } from './scales';
import { formatSpelled, pcOfSpelled, spellPc, spellScale } from './spelling';

/** "C major", "A minor", otherwise the scale's own name ("A♭ Lydian"). */
export function keyName(key: ScaleRef): string {
  if (key.familyId === 'diatonic' && key.mode === 0) return `${formatSpelled(key.tonic)} major`;
  if (key.familyId === 'diatonic' && key.mode === 5) return `${formatSpelled(key.tonic)} minor`;
  return scaleRefName(key);
}

/**
 * Whether a box's reference scale takes the music out of `key`. Only a different pitch collection
 * does; modes of the key (D Dorian or F Lydian in C major) stay in it.
 */
export function changesKey(key: ScaleRef, scale: ScaleRef): boolean {
  return scaleRefPcSet(key) !== scaleRefPcSet(scale);
}

export interface KeyRegion {
  readonly key: ScaleRef;
  /** First and last box index in the region, inclusive. */
  readonly first: number;
  readonly last: number;
  /** One index per distinct key collection, in order of first appearance; adjacent regions always differ. */
  readonly colorIndex: number;
}

export interface KeyPlan {
  /** The key in effect at each box. */
  readonly keys: readonly ScaleRef[];
  /** Index into `regions` for each box. */
  readonly regionOfBox: readonly number[];
  readonly regions: readonly KeyRegion[];
}

/**
 * Walks the boxes from the preset's key. A box whose scale uses another collection changes the key
 * from there on. Returning to a collection heard before reuses that key, so a later D Dorian box
 * brings back "C major" rather than a "D Dorian" key. A new collection is named by the box's scale.
 */
export function planKeys(globalKey: ScaleRef, scales: readonly ScaleRef[]): KeyPlan {
  const known = new Map<PcSet, ScaleRef>([[scaleRefPcSet(globalKey), globalKey]]);
  const colors = new Map<PcSet, number>();
  const keys: ScaleRef[] = [];
  const regionOfBox: number[] = [];
  const regions: { key: ScaleRef; first: number; last: number; colorIndex: number }[] = [];

  let current = globalKey;
  scales.forEach((scale, i) => {
    const moves = changesKey(current, scale);
    if (moves) {
      const collection = scaleRefPcSet(scale);
      current = known.get(collection) ?? scale;
      known.set(collection, current);
    }
    if (i === 0 || moves) {
      const collection = scaleRefPcSet(current);
      if (!colors.has(collection)) colors.set(collection, colors.size);
      regions.push({ key: current, first: i, last: i, colorIndex: colors.get(collection) ?? 0 });
    } else {
      regions[regions.length - 1].last = i;
    }
    keys.push(current);
    regionOfBox.push(regions.length - 1);
  });

  return { keys, regionOfBox, regions };
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * The chord's roman numeral in `key`. The degree comes from the root's spelling. Accidentals are
 * measured from the key's own degree, so C in A minor is III and B♭ in C major is ♭VII. Keys without
 * that letter (pentatonic, blues) fall back to the major-scale degree. Major-quality chords are upper
 * case and minor lower case, with ° for diminished, ø for half-diminished and + for augmented.
 * Inversion figures and extensions are not shown.
 */
export function romanNumeral(chord: ChordCandidate, key: ScaleRef): string {
  const root = spellPc(chord.root, scaleRefContext(key, chordSpellingHint(chord)));
  const degree = ((root.letter - key.tonic.letter + 7) % 7) + 1;
  const keyNote = spellScale(key.tonic, scaleRefIntervals(key)).find((note) => note.letter === root.letter);
  const reference = keyNote
    ? pcOfSpelled(keyNote)
    : pcOfSpelled(key.tonic) + MAJOR_SCALE_SEMITONES[degree - 1];
  const offset = mod12(pcOfSpelled(root) - reference);
  const accidental = offset > 6 ? offset - 12 : offset;
  const numeral = NUMERALS[(degree - 1) % 7];
  const quality = chord.type.quality;
  const lower = quality === 'minor' || quality === 'diminished' || quality === 'halfDiminished';
  const suffix =
    quality === 'diminished' ? '°' : quality === 'halfDiminished' ? 'ø' : quality === 'augmented' ? '+' : '';
  return formatAccidental(accidental) + (lower ? numeral.toLowerCase() : numeral) + suffix;
}
