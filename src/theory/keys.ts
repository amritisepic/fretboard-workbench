/** Keys, key regions across a progression of boxes, roman numerals (spec §6), and finding the key. */

import type { ChordQuality } from '../data/chords';
import { KEY_FINDING_WEIGHTS } from '../data/keyFindingWeights';
import { RANKING_WEIGHTS } from '../data/rankingWeights';
import { chordRootSpelling, chordSpellingHint, type ChordCandidate } from './chords';
import {
  MAJOR_SCALE_SEMITONES,
  difference,
  formatAccidental,
  hasPc,
  intersect,
  mod12,
  pcSetFromIntervals,
  setSize,
  type PcSet,
  type PitchClass,
} from './pitch';
import { rankScales, toneRole } from './ranking';
import {
  makeScaleRef,
  modeIntervals,
  scaleRefContext,
  scaleRefIntervals,
  scaleRefName,
  scaleRefPcSet,
  type ScaleRef,
} from './scales';
import { formatSpelled, pcOfSpelled, spellPc, spellScale } from './spelling';
import { compareKeys } from './util';

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

// ---------------------------------------------------------------------------
// Finding the key
// ---------------------------------------------------------------------------

export interface ChordEvidence {
  /** The chord's name in use. */
  readonly chord: ChordCandidate;
  /** The pitch classes that sound. */
  readonly pcs: PcSet;
}

const MAJOR_TONIC_QUALITIES: readonly ChordQuality[] = ['major', 'dominant', 'suspended', 'power'];
const MINOR_TONIC_QUALITIES: readonly ChordQuality[] = ['minor', 'suspended', 'power'];
const DOMINANT_QUALITIES: readonly ChordQuality[] = ['major', 'dominant', 'suspended'];

/**
 * The share of a chord's sounding tones that lie in a key, each weighted by its role as in scale
 * ranking. A minor key also accepts its raised 7th in chords on its 5th or 7th degree, where
 * harmonic minor supplies it: G B D F in C minor fits completely.
 */
function keyFit({ chord, pcs }: ChordEvidence, keyPcs: PcSet, minorTonic: PitchClass | null): number {
  let total = 0;
  let inKey = 0;
  for (const tone of chord.type.tones) {
    const pc = mod12(chord.root + tone.interval);
    if (!hasPc(pcs, pc)) continue;
    const weight = RANKING_WEIGHTS.missingTone[toneRole(tone)];
    const leadingTone =
      minorTonic !== null && pc === mod12(minorTonic + 11) && [7, 11].includes(mod12(chord.root - minorTonic));
    total += weight;
    if (hasPc(keyPcs, pc) || leadingTone) inKey += weight;
  }
  return total === 0 ? 0 : inKey / total;
}

/**
 * The major or minor key that best explains a progression, or null without chords. Each key scores
 * how well every chord's tones fit it, plus bonuses for tonic chords (more at the start, most at the
 * end) and for dominants that resolve to the tonic. Exact ties go to the major key.
 */
export function findKey(progression: readonly ChordEvidence[]): ScaleRef | null {
  const w = KEY_FINDING_WEIGHTS;
  let best: ScaleRef | null = null;
  let bestScore = -Infinity;
  for (const mode of [0, 5]) {
    const minor = mode === 5;
    const tonicQualities = minor ? MINOR_TONIC_QUALITIES : MAJOR_TONIC_QUALITIES;
    for (let tonic = 0; tonic < 12; tonic++) {
      const keyPcs = pcSetFromIntervals(modeIntervals('diatonic', mode), tonic);
      const isTonic = (chord: ChordCandidate) =>
        mod12(chord.root) === tonic && tonicQualities.includes(chord.type.quality);
      const isDominant = (chord: ChordCandidate) =>
        mod12(chord.root - tonic) === 7 && DOMINANT_QUALITIES.includes(chord.type.quality);

      let score = 0;
      progression.forEach((evidence, i) => {
        score += w.fit * keyFit(evidence, keyPcs, minor ? tonic : null);
        if (!isTonic(evidence.chord)) return;
        score += w.tonicChord;
        if (i === 0) score += w.firstChord;
        if (i === progression.length - 1) score += w.lastChord;
        if (i > 0 && isDominant(progression[i - 1].chord)) score += w.cadence;
      });
      if (progression.length > 0 && score > bestScore + 1e-9) {
        best = makeScaleRef('diatonic', mode, tonic);
        bestScore = score;
      }
    }
  }
  return best;
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
