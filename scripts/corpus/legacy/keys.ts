// The key finder as it was before harmonic analysis (commit 0ce8623), kept only to compare against in the corpus evaluation.
/** Keys, the key in effect across a progression of boxes, roman numerals (spec §6), and finding the key. */

import type { ChordQuality } from '../../../src/data/chords';
import { KEY_PLAN_WEIGHTS } from './keyPlanWeights';
import { RANKING_WEIGHTS } from '../../../src/data/rankingWeights';
import { SCALE_FAMILIES } from '../../../src/data/scales';
import { chordRootSpelling, chordSpellingHint, type ChordCandidate } from '../../../src/theory/chords';
import {
  MAJOR_SCALE_SEMITONES,
  difference,
  formatAccidental,
  hasPc,
  intersect,
  isSubset,
  mod12,
  setSize,
  type PcSet,
  type PitchClass,
} from '../../../src/theory/pitch';
import { rankScales, toneRole } from '../../../src/theory/ranking';
import {
  distinctModes,
  makeScaleRef,
  scaleRefContext,
  scaleRefIntervals,
  scaleRefName,
  scaleRefPcSet,
  type ScaleRef,
} from '../../../src/theory/scales';
import { pcOfSpelled, spellPc, spellScale } from '../../../src/theory/spelling';
import { compareKeys } from '../../../src/theory/util';

/** "C major", "A minor", "A♭ Lydian": a key is named like its scale. */
export function keyName(key: ScaleRef): string {
  return scaleRefName(key);
}

/** Whether a scale uses another pitch collection than `key`. Modes of the key (D Dorian in C major) don't. */
export function changesKey(key: ScaleRef, scale: ScaleRef): boolean {
  return scaleRefPcSet(key) !== scaleRefPcSet(scale);
}

export interface KeyRegion {
  readonly key: ScaleRef;
  /** First and last box index in the region, inclusive. */
  readonly first: number;
  readonly last: number;
  /** One index per distinct key, in order of first appearance; adjacent regions always differ. */
  readonly colorIndex: number;
}

export interface KeyPlan {
  /** The key in effect at each box. */
  readonly keys: readonly ScaleRef[];
  /** Index into `regions` for each box. */
  readonly regionOfBox: readonly number[];
  readonly regions: readonly KeyRegion[];
}

export interface ChordEvidence {
  /** The chord's name in use. */
  readonly chord: ChordCandidate;
  /** The pitch classes that sound. */
  readonly pcs: PcSet;
}

/** What the key plan knows about one box. */
export interface KeyPlanBox {
  /** The box's reference scale; left out while finding the key, before any scale is chosen. */
  readonly scale?: ScaleRef;
  /** The box's chord, or null without one. */
  readonly chord: ChordEvidence | null;
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
// Keys across a progression
// ---------------------------------------------------------------------------

interface KeyState {
  readonly ref: ScaleRef;
  readonly pcs: PcSet;
  readonly tonic: PitchClass;
  /** Not major, minor, harmonic minor or melodic minor, nor the preset's own key. */
  readonly modal: boolean;
  readonly majorThird: boolean;
  /** A minor key, whose raised 7th counts on V and vii while finding the key. */
  readonly aeolian: boolean;
}

/** Keys musicians name without a mode: major, and natural, harmonic and melodic minor. */
const COMMON_KEYS: ReadonlySet<string> = new Set(['diatonic:0', 'diatonic:5', 'harmonicMinor:0', 'melodicMinor:0']);

function keyState(ref: ScaleRef, home = false): KeyState {
  const pcs = scaleRefPcSet(ref);
  const tonic = pcOfSpelled(ref.tonic);
  const aeolian = ref.familyId === 'diatonic' && ref.mode === 5;
  const common = COMMON_KEYS.has(`${ref.familyId}:${ref.mode}`);
  return { ref, pcs, tonic, modal: !home && !common, majorThird: hasPc(pcs, tonic + 4), aeolian };
}

let libraryKeys: readonly KeyState[] | null = null;

/** Every 7-note library mode on every tonic: the keys a progression can move through. */
function keyStates(): readonly KeyState[] {
  libraryKeys ??= SCALE_FAMILIES.filter((family) => family.intervals.length === 7).flatMap((family) =>
    distinctModes(family.id).flatMap((mode) =>
      Array.from({ length: 12 }, (_, tonic) => keyState(makeScaleRef(family.id, mode, tonic))),
    ),
  );
  return libraryKeys;
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

/** The bonus a box's chord gives a key: a tonic chord, more at either end or when a dominant leads into it. */
function tonicEvidence(boxes: readonly KeyPlanBox[], i: number, key: KeyState): number {
  const w = KEY_PLAN_WEIGHTS;
  const chord = boxes[i].chord?.chord;
  const qualities = key.majorThird ? MAJOR_TONIC_QUALITIES : MINOR_TONIC_QUALITIES;
  if (!chord || mod12(chord.root) !== key.tonic || !qualities.includes(chord.type.quality)) return 0;
  const previous = i > 0 ? boxes[i - 1].chord?.chord : undefined;
  const cadence =
    previous !== undefined &&
    mod12(previous.root - key.tonic) === 7 &&
    DOMINANT_QUALITIES.includes(previous.type.quality);
  return (
    w.tonicChord +
    (i === 0 ? w.firstChord : 0) +
    (i === boxes.length - 1 ? w.lastChord : 0) +
    (cadence ? w.cadence : 0)
  );
}

const EPSILON = 1e-9;

/**
 * Index into `keys` for each box along the cheapest sequence of keys (weights in
 * data/keyPlanWeights.ts). With a `home`, the progression starts from that key; otherwise anywhere.
 * On equal costs a box stays in the key before it, and earlier keys in `keys` win.
 */
function cheapestKeys(boxes: readonly KeyPlanBox[], keys: readonly KeyState[], home: number | null): number[] {
  if (boxes.length === 0) return [];
  const w = KEY_PLAN_WEIGHTS;
  const scales = boxes.map((box) => (box.scale ? scaleRefPcSet(box.scale) : null));
  const emission = (i: number, k: number) => {
    const key = keys[k];
    const { chord } = boxes[i];
    const scale = scales[i];
    let cost = (key.modal ? w.modalKey : 0) + (home !== null && k !== home ? w.awayFromHome : 0);
    if (scale !== null) {
      if (!isSubset(scale, key.pcs)) cost += w.chromaticScale;
    } else if (chord) {
      cost += w.chordMisfit * (1 - keyFit(chord, key.pcs, key.aeolian ? key.tonic : null));
    }
    return cost - tonicEvidence(boxes, i, key);
  };
  const change = (from: number, to: number) =>
    from === to ? 0 : keys[from].tonic === keys[to].tonic ? w.sameTonicChange : w.tonicChange;

  let costs = keys.map((_, k) => (home === null ? 0 : change(home, k)) + emission(0, k));
  const origins: number[][] = [];
  for (let i = 1; i < boxes.length; i++) {
    const previous = costs;
    let cheapest = 0;
    const cheapestOnTonic = new Array<number>(12).fill(-1);
    previous.forEach((cost, k) => {
      if (cost < previous[cheapest] - EPSILON) cheapest = k;
      const best = cheapestOnTonic[keys[k].tonic];
      if (best === -1 || cost < previous[best] - EPSILON) cheapestOnTonic[keys[k].tonic] = k;
    });
    const from: number[] = [];
    costs = keys.map((key, k) => {
      let origin = k;
      let cost = previous[k];
      const sameTonic = cheapestOnTonic[key.tonic];
      if (previous[sameTonic] + w.sameTonicChange < cost - EPSILON) {
        origin = sameTonic;
        cost = previous[sameTonic] + w.sameTonicChange;
      }
      if (previous[cheapest] + w.tonicChange < cost - EPSILON) {
        origin = cheapest;
        cost = previous[cheapest] + w.tonicChange;
      }
      from.push(origin);
      return cost + emission(i, k);
    });
    origins.push(from);
  }

  let last = 0;
  costs.forEach((cost, k) => {
    if (cost < costs[last] - EPSILON) last = k;
  });
  const path = [last];
  for (let i = origins.length - 1; i >= 0; i--) path.unshift(origins[i][path[0]]);
  return path;
}

/**
 * The key in effect at each box, starting from the preset's key and changing as rarely as possible.
 * A key can be any 7-note library mode on any tonic, and the cheapest sequence wins:
 *
 * - A box whose reference scale has notes outside the key is a chromatic chord there. That costs
 *   more than moving to a key on the same tonic and back, so a scale that alters the key changes it
 *   but keeps the tonic: G Mixolydian ♭2 in C minor gives C Harmonic Major, and an A♭ Lydian box in
 *   C major gives C minor. It costs less than two changes of tonic, so a passing chord whose scale
 *   lacks the tonic (F♯7 in C minor) stays in the key. The tonic moves only for a run of such chords.
 * - Tonic chords, especially at the start or end or after their dominant, count for a key.
 * - Keys other than major and the three minors (C Lydian, C Harmonic Major) cost a little more, and
 *   each box away from the preset's key costs a little, which settles ties.
 */
export function planKeys(globalKey: ScaleRef, boxes: readonly KeyPlanBox[]): KeyPlan {
  const home = keyState(globalKey, true);
  const candidates = [home, ...keyStates().filter((k) => k.pcs !== home.pcs || k.tonic !== home.tonic)];
  const path = cheapestKeys(boxes, candidates, 0);

  const colors = new Map<number, number>();
  const keys: ScaleRef[] = [];
  const regionOfBox: number[] = [];
  const regions: { key: ScaleRef; first: number; last: number; colorIndex: number }[] = [];
  path.forEach((k, i) => {
    const { ref, pcs, tonic } = candidates[k];
    if (i === 0 || k !== path[i - 1]) {
      const identity = pcs * 12 + tonic;
      if (!colors.has(identity)) colors.set(identity, colors.size);
      regions.push({ key: ref, first: i, last: i, colorIndex: colors.get(identity) ?? 0 });
    } else {
      regions[regions.length - 1].last = i;
    }
    keys.push(ref);
    regionOfBox.push(regions.length - 1);
  });
  return { keys, regionOfBox, regions };
}

export interface FoundKeys {
  /** The progression's key: the one it spends the most boxes in, the earliest on a tie. */
  readonly key: ScaleRef;
  /** The key at each box, for choosing that box's reference scale. */
  readonly keys: readonly ScaleRef[];
}

let commonKeys: readonly KeyState[] | null = null;

/**
 * The keys a progression moves through, judged from its chords alone; null without chords. The same
 * costs as planKeys apply, except that the boxes' scales aren't known yet: each chord instead costs
 * the weighted share of its tones outside the key, and the progression may start in any key.
 *
 * Only major and the three minors are candidates. Rarer keys (C Harmonic Major, C Lydian ♯2 ♯6) name
 * the alterations a chosen scale makes in the key bar; one chord alone is no reason to pick one, and
 * doing so would pull that chord's scale toward the rare key.
 */
export function findKey(progression: readonly (ChordEvidence | null)[]): FoundKeys | null {
  if (!progression.some((chord) => chord !== null)) return null;
  commonKeys ??= keyStates().filter((key) => !key.modal);
  const keys = commonKeys;
  const path = cheapestKeys(
    progression.map((chord) => ({ chord })),
    keys,
    null,
  );
  const boxesIn = new Map<number, number>();
  for (const k of path) boxesIn.set(k, (boxesIn.get(k) ?? 0) + 1);
  const home = path.reduce((best, k) => ((boxesIn.get(k) ?? 0) > (boxesIn.get(best) ?? 0) ? k : best), path[0]);
  return { key: keys[home].ref, keys: path.map((k) => keys[k].ref) };
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
