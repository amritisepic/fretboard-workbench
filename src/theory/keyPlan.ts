/**
 * The key bar (the key in effect at each box), Find key, and the reference scale a chord's function
 * suggests. All three read the progression with theory/analysis.ts.
 */

import { FUNCTION_SCALES, type ScaleChoice } from '../data/harmonyRules';
import {
  allowedTones,
  analyzeHarmony,
  homeKeyAt,
  homeKeyOf,
  libraryKeys,
  type AnalysisBox,
  type BoxAnalysis,
  type HarmonicAnalysis,
  type HomeKey,
} from './analysis';
import { chordRootSpelling, type ChordCandidate } from './chords';
import { closestScale, type ChordEvidence } from './keys';
import { difference, intersect, isSubset, setSize, union, type PcSet } from './pitch';
import { rankScales } from './ranking';
import { canonicalMode, scaleRefContext, scaleRefPcSet, type ScaleRef } from './scales';
import { pcOfSpelled } from './spelling';
import { compareKeys } from './util';

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
  /** The reading of each box behind its key. */
  readonly analysis: HarmonicAnalysis;
}

/** What the key plan knows about one box. */
export type KeyPlanBox = AnalysisBox;

/**
 * The key a box shows. The reading's local key comes first: the home key, or the key a secondary
 * chord tonicizes (A♭7 → D♭ in A♭ major shows D♭ major). The preset's key keeps its own name while
 * the progression is in it. A pinned key shows as pinned. When the box's scale has notes outside that
 * key, the key becomes the one on the same tonic that holds the scale: the common keys first, then
 * the fewest notes changed (A♭ Lydian in C major shows C minor). A minor key already holds its raised
 * 7th on V and vii, so a Phrygian dominant V keeps "C minor".
 */
function keyShown(result: BoxAnalysis, box: KeyPlanBox, globalKey: ScaleRef, presetHome: HomeKey): ScaleRef {
  const { local, root } = result.reading;
  if (box.keyPin && result.pinned && homeKeyOf(box.keyPin) === local) return box.keyPin;
  const base = local === presetHome ? globalKey : local.ref;
  if (!box.scale) return base;
  const basePcs = scaleRefPcSet(base);
  const scalePcs = scaleRefPcSet(box.scale);
  const allowed = union(basePcs, result.facts ? allowedTones(local, root, result.facts.shape) : local.pcs);
  if (isSubset(scalePcs, allowed)) return base;
  const [adjusted] = libraryKeys()
    .filter((k) => k.tonic === local.tonic && isSubset(scalePcs, k.pcs))
    .map((k, order) => ({ k, sortKey: [k.common ? 0 : 1, setSize(difference(k.pcs, basePcs)), order] }))
    .sort((a, b) => compareKeys(a.sortKey, b.sortKey));
  return adjusted ? adjusted.k.ref : base;
}

/**
 * The key in effect at each box, starting from the preset's key (see analyzeHarmony). A secondary
 * chord shows the key it tonicizes; a borrowed or chromatic chord stays in the key; the home key
 * changes for a modulation. Each box's scale then adjusts the key's collection (see keyShown).
 */
export function planKeys(globalKey: ScaleRef, boxes: readonly KeyPlanBox[]): KeyPlan {
  const analysis = analyzeHarmony(boxes, { home: globalKey });
  const presetHome = homeKeyOf(globalKey);
  const keys = analysis.boxes.map((result, i) => keyShown(result, boxes[i], globalKey, presetHome));

  const colors = new Map<number, number>();
  const regionOfBox: number[] = [];
  const regions: { key: ScaleRef; first: number; last: number; colorIndex: number }[] = [];
  let previous = -1;
  keys.forEach((key, i) => {
    const identity = scaleRefPcSet(key) * 12 + pcOfSpelled(key.tonic);
    if (i === 0 || identity !== previous) {
      if (!colors.has(identity)) colors.set(identity, colors.size);
      regions.push({ key, first: i, last: i, colorIndex: colors.get(identity) ?? 0 });
    } else {
      regions[regions.length - 1].last = i;
    }
    previous = identity;
    regionOfBox.push(regions.length - 1);
  });
  return { keys, regionOfBox, regions, analysis };
}

export interface FoundKeys {
  /** The progression's key: the home key it spends the most boxes in, the earliest on a tie. */
  readonly key: ScaleRef;
  /** The local key at each box, for choosing that box's reference scale. */
  readonly keys: readonly ScaleRef[];
  readonly analysis: HarmonicAnalysis;
}

/**
 * The keys a progression moves through, judged from its chords alone (see analyzeHarmony), starting
 * in any key. Null without chords. Pins, when given, are respected.
 */
export function findKey(
  progression: readonly (ChordEvidence | null)[],
  pins: readonly Pick<AnalysisBox, 'keyPin' | 'readingPin'>[] = [],
): FoundKeys | null {
  if (!progression.some((chord) => chord !== null)) return null;
  const analysis = analyzeHarmony(
    progression.map((chord, i) => ({ chord, keyPin: pins[i]?.keyPin ?? null, readingPin: pins[i]?.readingPin ?? null })),
    { home: null },
  );
  const boxesIn = new Map<HomeKey, number>();
  for (const { reading } of analysis.boxes) boxesIn.set(reading.home, (boxesIn.get(reading.home) ?? 0) + 1);
  let home = analysis.boxes[0].reading.home;
  for (const { reading } of analysis.boxes) {
    if ((boxesIn.get(reading.home) ?? 0) > (boxesIn.get(home) ?? 0)) home = reading.home;
  }
  return { key: home.ref, keys: analysis.boxes.map((b) => b.reading.local.ref), analysis };
}

/** Preferred scales for a reading, or none when the scale closest to its key is the right one. */
function scaleChoices(result: BoxAnalysis): readonly ScaleChoice[] {
  const { reading, facts } = result;
  if (!facts) return [];
  if (facts.quality === 'diminished7') return FUNCTION_SCALES.diminishedSeventh;
  switch (reading.kind) {
    case 'secondaryDominant':
      return reading.local.mode === 'minor' ? FUNCTION_SCALES.secondaryDominantMinor : FUNCTION_SCALES.secondaryDominantMajor;
    case 'secondaryLeadingTone':
      return facts.quality === 'halfDiminished' ? FUNCTION_SCALES.leadingToneHalfDiminished : [];
    case 'relatedTwo':
      return facts.quality === 'halfDiminished' ? FUNCTION_SCALES.relatedTwoHalfDiminished : FUNCTION_SCALES.relatedTwoMinor;
    case 'tritoneSub':
      return FUNCTION_SCALES.tritoneSub;
    case 'passingDiminished':
      return FUNCTION_SCALES.diminishedSeventh;
    case 'chromaticMediant':
      return facts.quality === 'minor' ? FUNCTION_SCALES.chromaticMediantMinor : FUNCTION_SCALES.chromaticMediantMajor;
    case 'borrowed':
    case 'chromatic':
      return result.tags.includes('neapolitan') ? FUNCTION_SCALES.neapolitan : [];
    default:
      return [];
  }
}

/**
 * The reference scale a chord's reading suggests, rooted on the chord (data/harmonyRules.ts
 * FUNCTION_SCALES): Mixolydian for a secondary dominant of a major chord, the diminished scale for a
 * diminished 7th, Lydian dominant for a tritone substitute, and so on. The first preferred scale that
 * holds every chord tone wins, the one closest to the key on a tie. Otherwise, and for diatonic
 * chords, the scale closest to the key (closestScale): a borrowed chord's key is its source.
 */
export function functionScale(chordPcs: PcSet, chord: ChordCandidate, result: BoxAnalysis): ScaleRef {
  const { reading } = result;
  const key =
    reading.kind === 'borrowed' && reading.source !== null ? homeKeyAt(reading.home.tonic, reading.source).ref : reading.local.ref;
  const choices = scaleChoices(result);
  if (choices.length > 0) {
    const keyPcs = scaleRefPcSet(key);
    const { rows } = rankScales(chordPcs, chord, { key, rootSpelling: chordRootSpelling(chord, scaleRefContext(key)) });
    const [preferred] = rows
      .map((row, order) => ({ row, order }))
      .filter(
        ({ row }) =>
          row.tier === 0 &&
          choices.some((c) => c.familyId === row.ref.familyId && canonicalMode(c.familyId, c.mode) === row.ref.mode),
      )
      .map(({ row, order }) => ({
        row,
        sortKey: [
          choices.findIndex((c) => c.familyId === row.ref.familyId && canonicalMode(c.familyId, c.mode) === row.ref.mode),
          setSize(difference(row.pcs, keyPcs)),
          -setSize(intersect(row.pcs, keyPcs)),
          order,
        ],
      }))
      .sort((a, b) => compareKeys(a.sortKey, b.sortKey));
    if (preferred) return preferred.row.ref;
  }
  return closestScale(chordPcs, chord, key);
}
