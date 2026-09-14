/**
 * Harmonic analysis (docs/harmonic-analysis-plan.md, docs/harmonic-patterns.md): what each chord
 * does, the keys a progression moves through, and the relations between neighbouring chords.
 *
 * In every home key (each diatonic mode but Locrian, on every tonic) a chord gets its possible
 * readings: diatonic, borrowed from a parallel mode, chromatic, a secondary dominant or leading-tone
 * chord, the related ii of a secondary dominant, a tritone substitute, or a passing or common-tone
 * diminished chord. A reading names the local key the key bar shows: the home key, or the key a
 * secondary chord tonicizes. Its cost (data/analysisWeights.ts) weighs how well the chord fits,
 * whether it moves as the reading expects, and evidence for the tonic. Cadences between neighbours
 * in one home key (data/harmonyRules.ts) lower the cost, and changing the home key raises it.
 *
 * The cheapest path through the whole progression is the analysis. Every other reading whose own
 * cheapest path costs nearly as much is kept as an alternative, so an ambiguous chord shows its
 * possibilities instead of a silent choice.
 */

import { ANALYSIS_WEIGHTS } from '../data/analysisWeights';
import {
  BORROW_SOURCES,
  CADENCE_RULES,
  KEY_MODE_INDEX,
  KEY_MODES,
  type CadenceId,
  type ChordPattern,
  type FunctionQuality,
  type KeyMode,
} from '../data/harmonyRules';
import { RANKING_WEIGHTS } from '../data/rankingWeights';
import { SCALE_FAMILIES } from '../data/scales';
import type { ChordCandidate } from './chords';
import type { ChordEvidence } from './keys';
import {
  difference,
  hasPc,
  intersect,
  isSubset,
  mod12,
  pcSetFromIntervals,
  setSize,
  withPc,
  type PcSet,
  type PitchClass,
} from './pitch';
import { findPatterns, type PatternSpan } from './patterns';
import { toneRole } from './ranking';
import { distinctModes, makeScaleRef, modeIntervals, scaleRefPcSet, type ScaleRef } from './scales';
import { pcOfSpelled } from './spelling';

export type { FunctionQuality, KeyMode } from '../data/harmonyRules';

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Chords as harmonic function sees them
// ---------------------------------------------------------------------------

export type ChordShape = 'triad' | 'sixth' | 'seventh' | 'majorSeventh';

export interface ChordFacts {
  readonly chord: ChordCandidate;
  /** Sounding pitch classes. */
  readonly pcs: PcSet;
  readonly root: PitchClass;
  readonly bass: PitchClass | null;
  readonly quality: FunctionQuality;
  readonly shape: ChordShape;
  /** The chord member in the bass: 0 root, 1 third, 2 fifth, 3 seventh; null for another tone or no bass. */
  readonly inversion: number | null;
}

/** Dominant for a major 3rd with a ♭7 (7♭5 and 7♯5 included), diminished7 for a ♭♭7, and so on. */
export function functionQuality(chord: ChordCandidate): FunctionQuality {
  if (chord.type.quality === 'power') return 'power';
  const tone = (degree: number) => chord.type.tones.find((t) => t.degree === degree);
  const third = tone(3);
  const fifth = tone(5);
  const seventh = tone(7);
  if (third?.interval === 4) {
    if (seventh?.interval === 10) return 'dominant';
    return fifth?.interval === 8 ? 'augmented' : 'major';
  }
  if (third?.interval === 3) {
    if (fifth?.interval !== 6) return 'minor';
    return seventh?.interval === 9 ? 'diminished7' : seventh?.interval === 10 ? 'halfDiminished' : 'diminished';
  }
  return seventh?.interval === 10 ? 'suspendedDominant' : 'suspended';
}

function inversionOf(chord: ChordCandidate): number | null {
  if (chord.bass === null) return null;
  const tone = chord.type.tones.find((t) => mod12(chord.root + t.interval) === chord.bass);
  switch (tone?.degree) {
    case 1:
      return 0;
    case 2:
    case 3:
    case 4:
      return 1;
    case 5:
      return 2;
    case 6:
    case 7:
      return 3;
    default:
      return null;
  }
}

export function chordFacts({ chord, pcs }: ChordEvidence): ChordFacts {
  const seventh = chord.type.tones.find((t) => t.degree === 7);
  const shape: ChordShape = seventh
    ? seventh.interval === 11
      ? 'majorSeventh'
      : 'seventh'
    : chord.type.tones.some((t) => t.degree === 6)
      ? 'sixth'
      : 'triad';
  return {
    chord,
    pcs,
    root: chord.root,
    bass: chord.bass,
    quality: functionQuality(chord),
    shape,
    inversion: inversionOf(chord),
  };
}

const MAJOR_LIKE: readonly FunctionQuality[] = ['major', 'dominant', 'augmented', 'suspended', 'suspendedDominant', 'power'];
const MINOR_LIKE: readonly FunctionQuality[] = ['minor', 'diminished', 'diminished7', 'halfDiminished', 'suspended', 'power'];
const MAJOR_TONIC: readonly FunctionQuality[] = ['major', 'dominant', 'suspended', 'suspendedDominant', 'power'];
const MINOR_TONIC: readonly FunctionQuality[] = ['minor', 'suspended', 'power'];

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** A key a progression can be in, or a key a chord tonicizes. */
export interface HomeKey {
  /** Position in the list of keys, for lookups. */
  readonly index: number;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly pcs: PcSet;
  /** The scale's pitch classes from the tonic up. */
  readonly steps: readonly PitchClass[];
  readonly ref: ScaleRef;
  readonly majorThird: boolean;
}

let homeKeyList: readonly HomeKey[] | null = null;

function homeKeys(): readonly HomeKey[] {
  homeKeyList ??= KEY_MODES.flatMap((mode, m) =>
    Array.from({ length: 12 }, (_, tonic): HomeKey => {
      const intervals = modeIntervals('diatonic', KEY_MODE_INDEX[mode]);
      return {
        index: m * 12 + tonic,
        tonic,
        mode,
        pcs: pcSetFromIntervals(intervals, tonic),
        steps: intervals.map((iv) => mod12(tonic + iv)),
        ref: makeScaleRef('diatonic', KEY_MODE_INDEX[mode], tonic),
        majorThird: intervals.includes(4),
      };
    }),
  );
  return homeKeyList;
}

export function homeKeyAt(tonic: PitchClass, mode: KeyMode): HomeKey {
  return homeKeys()[KEY_MODES.indexOf(mode) * 12 + mod12(tonic)];
}

/**
 * The home key a scale reference stands for: a diatonic mode as itself (Locrian as minor), and any
 * other scale as major or minor on its tonic, by its 3rd (C Harmonic Minor is C minor).
 */
export function homeKeyOf(ref: ScaleRef): HomeKey {
  const tonic = pcOfSpelled(ref.tonic);
  if (ref.familyId === 'diatonic') {
    const mode = KEY_MODES.find((m) => KEY_MODE_INDEX[m] === ref.mode);
    if (mode) return homeKeyAt(tonic, mode);
  }
  return homeKeyAt(tonic, hasPc(scaleRefPcSet(ref), tonic + 4) ? 'major' : 'minor');
}

export const isModalKey = (key: HomeKey) => key.mode !== 'major' && key.mode !== 'minor';

/**
 * The pitch classes a chord on `root` may use in `key`: the key's collection, plus in a minor key
 * the raised 7th on V and vii (harmonic minor) and on a minor-major seventh tonic.
 */
export function allowedTones(key: HomeKey, root: PitchClass, shape: ChordShape | null = null): PcSet {
  if (key.mode !== 'minor') return key.pcs;
  const degree = mod12(root - key.tonic);
  const leadingTone = degree === 7 || degree === 11 || (degree === 0 && shape === 'majorSeventh');
  return leadingTone ? withPc(key.pcs, key.tonic + 11) : key.pcs;
}

/** The triad the key builds on one of its degrees, or null for a pitch class outside the key. */
function triadOn(key: HomeKey, pc: PitchClass): 'major' | 'minor' | 'diminished' | 'augmented' | null {
  const step = key.steps.indexOf(mod12(pc));
  if (step === -1) return null;
  // A minor key's V is major, from its raised 7th.
  if (key.mode === 'minor' && step === 4) return 'major';
  const third = mod12(key.steps[(step + 2) % 7] - pc);
  const fifth = mod12(key.steps[(step + 4) % 7] - pc);
  if (fifth === 7) return third === 4 ? 'major' : 'minor';
  return fifth === 6 ? 'diminished' : 'augmented';
}

export interface LibraryKey {
  readonly ref: ScaleRef;
  readonly tonic: PitchClass;
  readonly pcs: PcSet;
  /** Major, natural minor, harmonic minor or melodic minor. */
  readonly common: boolean;
}

const COMMON_KEYS: ReadonlySet<string> = new Set(['diatonic:0', 'diatonic:5', 'harmonicMinor:0', 'melodicMinor:0']);
let libraryKeyList: readonly LibraryKey[] | null = null;

/** Every 7-note library mode on every tonic: the keys the key bar can name when a scale alters the key. */
export function libraryKeys(): readonly LibraryKey[] {
  libraryKeyList ??= SCALE_FAMILIES.filter((family) => family.intervals.length === 7).flatMap((family) =>
    distinctModes(family.id).flatMap((mode) =>
      Array.from({ length: 12 }, (_, tonic): LibraryKey => {
        const ref = makeScaleRef(family.id, mode, tonic);
        return { ref, tonic, pcs: scaleRefPcSet(ref), common: COMMON_KEYS.has(`${family.id}:${mode}`) };
      }),
    ),
  );
  return libraryKeyList;
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export type ReadingKind =
  /** A box without a chord. */
  | 'none'
  | 'diatonic'
  | 'borrowed'
  | 'chromatic'
  | 'secondaryDominant'
  | 'secondaryLeadingTone'
  | 'relatedTwo'
  | 'tritoneSub'
  /** A chord outside the key that its secondary dominant (or leading-tone chord) has just resolved to. */
  | 'tonicized'
  /** A chord a half step from the next chord, with the same quality. */
  | 'chromaticApproach'
  /** A major or minor chord outside the key, a 3rd from a neighbour of the same quality. */
  | 'chromaticMediant'
  | 'passingDiminished';

const APPLIED_KINDS: ReadonlySet<ReadingKind> = new Set(['secondaryDominant', 'secondaryLeadingTone', 'relatedTwo', 'tritoneSub']);

export interface Reading {
  readonly kind: ReadingKind;
  /** The key the progression is in here; functions are named in it. */
  readonly home: HomeKey;
  /** The key the key bar shows: the home key, or the key a secondary chord tonicizes. */
  readonly local: HomeKey;
  /** The root the reading gives the chord; a diminished seventh's can be any of its notes. */
  readonly root: PitchClass;
  /** A borrowed chord's source: the parallel mode it comes from. */
  readonly source: KeyMode | null;
  /** Cost of the cheapest analysis of the whole progression that reads the chord this way. */
  readonly cost: number;
  /** The reading relative to the chord root, for pinning it; unchanged when the box is transposed. */
  readonly pinId: string;
}

/** The chord a secondary chord or tritone substitute points at, or null for other readings. */
export function readingTarget(reading: Pick<Reading, 'kind' | 'local'>): PitchClass | null {
  return APPLIED_KINDS.has(reading.kind) ? reading.local.tonic : null;
}

export interface AnalysisBox {
  readonly chord: ChordEvidence | null;
  /** The box's reference scale; left out while finding the key. */
  readonly scale?: ScaleRef;
  /** A key the user fixed at this box: only readings in it are considered. */
  readonly keyPin?: ScaleRef | null;
  /** A reading the user chose (Reading.pinId). */
  readonly readingPin?: string | null;
}

export interface AnalysisOptions {
  /** The preset's key, where the progression starts. Without it the progression may start in any key. */
  readonly home?: ScaleRef | null;
}

interface State extends Omit<Reading, 'cost'> {
  readonly emission: number;
  /** Tells readings apart when listing alternatives. */
  readonly id: string;
}

interface Context {
  readonly facts: readonly (ChordFacts | null)[];
  readonly home: HomeKey | null;
  /** Tonics with dominant 7ths on both I and IV somewhere in the progression. */
  readonly bluesTonics: ReadonlySet<PitchClass>;
  /** For each box, the tonics whose tonic or dominant chord has sounded before it. */
  readonly established: readonly PcSet[];
  /** For each box, the roots of minor chords before it. */
  readonly minorRoots: readonly PcSet[];
  /** The first box with a chord, or -1. */
  readonly opening: number;
  /** Roots some dominant (V, V7 or Vsus) resolves to somewhere in the progression. */
  readonly cadenceTargets: PcSet;
}

interface Fit {
  /** Every root, 3rd, 5th and 7th that sounds is allowed. */
  readonly core: boolean;
  /** The weighted share of sounding tones outside. */
  readonly share: number;
}

function fitIn(facts: ChordFacts, allowed: PcSet): Fit {
  const dominantLike = facts.quality === 'dominant' || facts.quality === 'suspendedDominant';
  let total = 0;
  let outside = 0;
  let core = true;
  for (const tone of facts.chord.type.tones) {
    const pc = mod12(facts.chord.root + tone.interval);
    if (!hasPc(facts.pcs, pc)) continue;
    const role = toneRole(tone);
    const weight = RANKING_WEIGHTS.missingTone[role];
    total += weight;
    if (hasPc(allowed, pc)) continue;
    if (role === 'extension') {
      outside += dominantLike ? weight * ANALYSIS_WEIGHTS.alteredTension : weight;
    } else {
      outside += weight;
      core = false;
    }
  }
  return { core, share: total === 0 ? 0 : outside / total };
}

const suitsMode = (quality: FunctionQuality, mode: KeyMode) =>
  (mode === 'minor' ? MINOR_LIKE : MAJOR_LIKE).includes(quality);

/** The modes a secondary chord may tonicize `target` in, with the extra cost of each. */
function targetModes(key: HomeKey, target: PitchClass): readonly { readonly mode: KeyMode; readonly cost: number }[] {
  const w = ANALYSIS_WEIGHTS;
  const triad = triadOn(key, target);
  if (triad === 'major') return [{ mode: 'major', cost: 0 }, { mode: 'minor', cost: w.oppositeTargetMode }];
  if (triad === 'minor') return [{ mode: 'minor', cost: 0 }, { mode: 'major', cost: w.oppositeTargetMode }];
  if (triad === null) return [{ mode: 'major', cost: w.chromaticTarget }, { mode: 'minor', cost: w.chromaticTarget }];
  return [];
}

const LYDIAN_DOMINANT = modeIntervals('melodicMinor', 3);

/** A bass line moving by step in one direction through the middle chord. */
function stepwise(a: PitchClass, b: PitchClass, c: PitchClass): boolean {
  const first = mod12(b - a);
  const second = mod12(c - b);
  return (first === 1 && (second === 1 || second === 2)) || (first === 11 && (second === 11 || second === 10));
}

/** Evidence for `key` from a chord on its tonic. `minorBefore`: a minor chord on the tonic has sounded already. */
function tonicBonus(key: HomeKey, facts: ChordFacts | null, last: boolean, minorBefore: boolean): number {
  if (!facts || facts.root !== key.tonic) return 0;
  const w = ANALYSIS_WEIGHTS;
  // A minor key that has sounded its tonic may end on a major one: the Picardy third.
  if (last && key.mode === 'minor' && facts.quality === 'major') return minorBefore ? w.finalTonic : 0;
  if (!(key.majorThird ? MAJOR_TONIC : MINOR_TONIC).includes(facts.quality)) return 0;
  return w.tonicChord + (last ? w.finalTonic : 0) + (isModalKey(key) ? w.modalTonic : 0);
}

const pinIdOf = (kind: ReadingKind, home: HomeKey, local: HomeKey, root: PitchClass, source: KeyMode | null, from: PitchClass) =>
  [kind, `${mod12(home.tonic - from)}${home.mode}`, `${mod12(local.tonic - from)}${local.mode}`, mod12(root - from), source ?? '-'].join(':');

/** Every reading of box `i` in every home key, with its cost. */
function statesFor(i: number, box: AnalysisBox, ctx: Context): State[] {
  const w = ANALYSIS_WEIGHTS;
  const facts = ctx.facts[i];
  const next = i + 1 < ctx.facts.length ? ctx.facts[i + 1] : null;
  const previous = i > 0 ? ctx.facts[i - 1] : null;
  const last = i === ctx.facts.length - 1;

  const fits = new Map<PcSet, Fit>();
  const fit = (allowed: PcSet): Fit => {
    if (!facts) return { core: true, share: 0 };
    let result = fits.get(allowed);
    if (!result) {
      result = fitIn(facts, allowed);
      fits.set(allowed, result);
    }
    return result;
  };

  // A scale is evidence only when it holds the chord: a new box's default scale says nothing about its chord's key.
  const boxScale = box.scale ? scaleRefPcSet(box.scale) : null;
  const scalePcs = boxScale !== null && (facts === null || isSubset(facts.pcs, boxScale)) ? boxScale : null;
  const scaleTonics =
    scalePcs === null ? null : new Set(libraryKeys().filter((k) => isSubset(scalePcs, k.pcs)).map((k) => k.tonic));
  const scaleCost = (local: HomeKey, root: PitchClass) => {
    if (scalePcs === null || scaleTonics === null) return 0;
    if (isSubset(scalePcs, facts ? allowedTones(local, root, facts.shape) : local.pcs)) return 0;
    if (scaleTonics.has(local.tonic)) return facts ? w.scaleAdjustWithChord : w.scaleAdjust;
    return facts ? w.chromaticScaleWithChord : w.chromaticScale;
  };

  /** Resolution of a chord pointing at `target`: negative when the next chord is the target. */
  const resolution = (target: PitchClass, mode: KeyMode, kind: 'dominant' | 'leadingTone' | 'tritone', natural: boolean) => {
    if (next === null) return w.impliedResolution[kind];
    if (next.root === target) {
      // A chain of dominants resolves to a dominant: the target's quality in the key decides.
      const chained = next.quality === 'dominant' || next.quality === 'suspendedDominant';
      const matches = chained ? natural : suitsMode(next.quality, mode);
      return -(w.resolution + (matches ? w.resolutionQuality : 0));
    }
    if (kind === 'dominant' && natural && next.root === mod12(target + (mode === 'minor' ? 8 : 9))) {
      return w.deceptiveResolution;
    }
    return w.unresolved[kind];
  };

  const states: State[] = [];
  for (const key of homeKeys()) {
    let base = w.modalKey[key.mode] + (ctx.home !== null && key !== ctx.home ? w.awayFromHome : 0) - tonicBonus(key, facts, last, hasPc(ctx.minorRoots[i], key.tonic));
    const opensOnTonic =
      i === ctx.opening && hasPc(ctx.cadenceTargets, key.tonic) && tonicBonus(key, facts, false, false) > 0;
    if (opensOnTonic) base -= w.openingTonic;
    const established = key === ctx.home || hasPc(ctx.established[i], key.tonic);
    const add = (kind: ReadingKind, local: HomeKey, root: PitchClass, source: KeyMode | null, cost: number) => {
      const unestablished = !established && (APPLIED_KINDS.has(kind) || kind === 'tonicized') ? w.unestablished : 0;
      states.push({
        kind,
        home: key,
        local,
        root,
        source,
        pinId: pinIdOf(kind, key, local, root, source, facts ? facts.root : key.tonic),
        emission: base + cost + unestablished + scaleCost(local, root),
        id: `${key.index}|${kind}|${local.index}|${root}|${source ?? '-'}`,
      });
    };

    if (!facts) {
      add('none', key, key.tonic, null, 0);
      continue;
    }
    const { root, quality } = facts;

    // Diatonic, else borrowed from the cheapest parallel mode that holds it, else chromatic.
    const inKey = fit(allowedTones(key, root, facts.shape));
    if (inKey.core) {
      add('diatonic', key, root, null, w.chordMisfit * inKey.share);
    } else {
      const blues =
        key.mode === 'major' &&
        quality === 'dominant' &&
        ctx.bluesTonics.has(key.tonic) &&
        (root === key.tonic || root === mod12(key.tonic + 5));
      let best: { readonly mode: KeyMode; readonly cost: number } | null = null;
      for (const source of BORROW_SOURCES[key.mode]) {
        const sourceFit = fit(allowedTones(homeKeyAt(key.tonic, source.mode), root, facts.shape));
        if (!sourceFit.core) continue;
        const cost = (blues ? w.bluesDominant : source.cost) + w.chordMisfit * sourceFit.share;
        if (best === null || cost < best.cost - EPSILON) best = { mode: source.mode, cost };
      }
      if (best) add('borrowed', key, root, best.mode, best.cost);
      else add('chromatic', key, root, null, w.chromatic + w.chordMisfit * inKey.share);
    }

    // Secondary dominant: V/x, V7/x, or a sus dominant, pointing a 5th down.
    const dominantLike = quality === 'dominant' || quality === 'suspendedDominant';
    const appliedTriad = !inKey.core && facts.shape === 'triad' && (quality === 'major' || quality === 'augmented');
    if (dominantLike || appliedTriad) {
      const target = mod12(root + 5);
      if (target !== key.tonic) {
        for (const { mode, cost } of targetModes(key, target)) {
          const local = homeKeyAt(target, mode);
          const localFit = fit(allowedTones(local, root, facts.shape));
          if (!localFit.core) continue;
          add(
            'secondaryDominant',
            local,
            root,
            null,
            w.secondaryDominant +
              cost +
              (appliedTriad ? w.appliedTriad : 0) +
              (quality === 'suspendedDominant' ? w.suspendedDominant : 0) +
              w.chordMisfit * localFit.share +
              resolution(target, mode, 'dominant', cost === 0),
          );
        }
      }
    }

    // Secondary leading-tone chord, a half step below its target. A diminished 7th may be spelled
    // from any of its four notes.
    if (quality === 'diminished' || quality === 'diminished7' || quality === 'halfDiminished') {
      const roots = quality === 'diminished7' ? [0, 3, 6, 9].map((step) => mod12(root + step)) : [root];
      for (const labelRoot of roots) {
        const target = mod12(labelRoot + 1);
        if (target === key.tonic) continue; // the key's own vii°: diatonic or borrowed
        for (const { mode, cost } of targetModes(key, target)) {
          if (quality === 'halfDiminished' && mode === 'minor') continue;
          const local = homeKeyAt(target, mode);
          let allowed = allowedTones(local, labelRoot, facts.shape);
          // vii°7 of a major chord borrows the ♭6 of its minor.
          if (quality === 'diminished7' && mode === 'major') allowed = withPc(allowed, target + 8);
          const localFit = fit(allowed);
          if (!localFit.core) continue;
          add(
            'secondaryLeadingTone',
            local,
            labelRoot,
            null,
            w.secondaryLeadingTone + cost + w.chordMisfit * localFit.share + resolution(target, mode, 'leadingTone', cost === 0),
          );
        }
      }
    }

    // Related ii: a minor or half-diminished chord before the dominant (or its tritone substitute)
    // of the chord a whole step below it.
    if (
      (quality === 'minor' || quality === 'halfDiminished') &&
      next !== null &&
      (next.quality === 'dominant' || next.quality === 'suspendedDominant') &&
      (next.root === mod12(root + 5) || next.root === mod12(root - 1))
    ) {
      const target = mod12(root - 2);
      if (target !== key.tonic) {
        for (const { mode, cost } of targetModes(key, target)) {
          const local = homeKeyAt(target, mode);
          let allowed = allowedTones(local, root, facts.shape);
          // ii–V of a minor chord often keeps the Dorian 6th: Em7 A7 → Dm.
          if (mode === 'minor' && quality === 'minor') allowed = withPc(allowed, target + 9);
          const localFit = fit(allowed);
          if (!localFit.core) continue;
          const mismatch = (quality === 'minor') === (mode === 'minor');
          add(
            'relatedTwo',
            local,
            root,
            null,
            w.relatedTwo +
              cost +
              (mismatch ? w.oppositeTargetMode : 0) +
              (hasPc(key.pcs, target) ? 0 : w.chromaticTwoFive) +
              w.chordMisfit * localFit.share,
          );
        }
      }
    }

    // Tritone substitute: a dominant a half step above its target.
    if (quality === 'dominant') {
      const subFit = fit(pcSetFromIntervals(LYDIAN_DOMINANT, root));
      const target = mod12(root - 1);
      if (subFit.core && target === key.tonic) {
        if (!isModalKey(key)) {
          add('tritoneSub', key, root, null, w.tritoneSub + w.chordMisfit * subFit.share + resolution(target, key.mode, 'tritone', true));
        }
      } else if (subFit.core) {
        for (const { mode, cost } of targetModes(key, target)) {
          add(
            'tritoneSub',
            homeKeyAt(target, mode),
            root,
            null,
            w.tritoneSub + cost + w.chordMisfit * subFit.share + resolution(target, mode, 'tritone', cost === 0),
          );
        }
      }
    }

    // Passing or common-tone diminished chord.
    if (quality === 'diminished7' || quality === 'diminished') {
      const commonTone = next !== null && hasPc(facts.pcs, next.root);
      const passing =
        previous !== null &&
        next !== null &&
        previous.bass !== null &&
        facts.bass !== null &&
        next.bass !== null &&
        stepwise(previous.bass, facts.bass, next.bass);
      if (commonTone || passing) {
        add(
          'passingDiminished',
          key,
          root,
          null,
          w.passingDiminished - (commonTone ? w.commonTone : 0) - (passing ? w.passingLine : 0),
        );
      }
    }

    // Tonicized: a major or minor chord outside the key, just resolved to by its secondary dominant,
    // tritone substitute or leading-tone chord, shows in its own key.
    if (!inKey.core && previous !== null && (quality === 'major' || quality === 'minor')) {
      const pointed =
        ((previous.quality === 'dominant' || previous.quality === 'suspendedDominant' || previous.quality === 'major') &&
          previous.root === mod12(root + 7)) ||
        (previous.quality === 'dominant' && previous.root === mod12(root + 1)) ||
        ((previous.quality === 'diminished' || previous.quality === 'halfDiminished') && previous.root === mod12(root - 1)) ||
        (previous.quality === 'diminished7' && hasPc(previous.pcs, root - 1));
      if (pointed) {
        const local = homeKeyAt(root, quality === 'minor' ? 'minor' : 'major');
        const localFit = fit(allowedTones(local, root, facts.shape));
        if (localFit.core) add('tonicized', local, root, null, w.tonicized + w.chordMisfit * localFit.share);
      }
    }

    // Chromatic approach: a half step from the next chord, with the same quality.
    if (
      !inKey.core &&
      next !== null &&
      next.quality === quality &&
      (next.root === mod12(root + 1) || next.root === mod12(root - 1))
    ) {
      add('chromaticApproach', key, root, null, w.chromaticApproach);
    }

    // Chromatic mediant: a 3rd from a neighbour of the same quality, sharing a tone with it.
    const mediant = (other: ChordFacts | null) =>
      other !== null &&
      [3, 4, 8, 9].includes(mod12(other.root - root)) &&
      mediantPartners(facts, other) &&
      intersect(other.pcs, facts.pcs) !== 0;
    if (!inKey.core && (quality === 'major' || quality === 'minor') && (mediant(previous) || mediant(next))) {
      add('chromaticMediant', key, root, null, w.chromaticMediant);
    }
  }
  return states;
}

/** Keeps only readings matching the box's pins, when any match. */
function applyPins(states: readonly State[], box: AnalysisBox): { readonly states: readonly State[]; readonly pinned: boolean } {
  let result = states;
  let pinned = false;
  if (box.keyPin) {
    const key = homeKeyOf(box.keyPin);
    const matching = result.filter((s) => s.local === key);
    if (matching.length > 0) {
      result = matching;
      pinned = true;
    }
  }
  if (box.readingPin) {
    const matching = result.filter((s) => s.pinId === box.readingPin);
    if (matching.length > 0) {
      result = matching;
      pinned = true;
    }
  }
  return { states: result, pinned };
}

function prune(states: readonly State[]): State[] {
  const cheapest = Math.min(...states.map((s) => s.emission));
  return states.filter((s) => s.emission <= cheapest + ANALYSIS_WEIGHTS.beam);
}

// ---------------------------------------------------------------------------
// Between neighbours
// ---------------------------------------------------------------------------

let changeCosts: Float64Array | null = null;

/** Cost of moving the home key from one key to another. */
function changeCost(from: HomeKey, to: HomeKey): number {
  if (!changeCosts) {
    const w = ANALYSIS_WEIGHTS;
    const keys = homeKeys();
    changeCosts = new Float64Array(keys.length * keys.length);
    for (const a of keys) {
      for (const b of keys) {
        changeCosts[a.index * keys.length + b.index] =
          a === b
            ? 0
            : a.tonic === b.tonic
              ? w.sameTonicChange + w.modeFlicker
              : w.tonicChange + w.keyDistance * Math.max(0, setSize(difference(b.pcs, a.pcs)) - 1);
      }
    }
  }
  return changeCosts[from.index * homeKeys().length + to.index];
}

function matchesPattern(pattern: ChordPattern, key: HomeKey, facts: ChordFacts): boolean {
  return (
    mod12(facts.root - key.tonic) === pattern.degree &&
    pattern.qualities.includes(facts.quality) &&
    (pattern.inversion === undefined || facts.inversion === pattern.inversion)
  );
}

/** Total bonus of the cadence rules two neighbouring chords match in `key`. */
function cadenceBonus(key: HomeKey, a: ChordFacts | null, b: ChordFacts | null): number {
  if (!a || !b) return 0;
  let bonus = 0;
  for (const rule of CADENCE_RULES) {
    if (rule.keys.includes(key.mode) && matchesPattern(rule.from, key, a) && matchesPattern(rule.to, key, b)) bonus += rule.bonus;
  }
  return bonus;
}

/**
 * Readings that depend on their neighbour's reading, in one home key: a related ii wants its dominant
 * next, and a tonicized chord wants the chord before it read as pointing at it.
 */
function pairCost(from: State, to: State): number {
  const w = ANALYSIS_WEIGHTS;
  let cost = 0;
  if (from.kind === 'relatedTwo') {
    const paired = (to.kind === 'secondaryDominant' || to.kind === 'tritoneSub') && to.local === from.local;
    cost += paired ? -w.relatedTwoFive : w.brokenPair;
  }
  if (to.kind === 'tonicized' && !(APPLIED_KINDS.has(from.kind) && from.local === to.local)) cost += w.unsupportedTonicization;
  return cost;
}

/** The same expectations when the home key changes between the two readings. */
const exitCost = (state: State) => (state.kind === 'relatedTwo' ? ANALYSIS_WEIGHTS.brokenPair : 0);
const entryCost = (state: State) => (state.kind === 'tonicized' ? ANALYSIS_WEIGHTS.unsupportedTonicization : 0);

// ---------------------------------------------------------------------------
// The cheapest path, and the cheapest path through every reading
// ---------------------------------------------------------------------------

interface Layer {
  readonly states: readonly State[];
  /** State indices by home key index. */
  readonly byKey: ReadonlyMap<number, readonly number[]>;
}

function layerOf(states: readonly State[]): Layer {
  const byKey = new Map<number, number[]>();
  states.forEach((state, j) => {
    const list = byKey.get(state.home.index);
    if (list) list.push(j);
    else byKey.set(state.home.index, [j]);
  });
  return { states, byKey };
}

function cheapestPerKey(layer: Layer, costOf: (j: number) => number): Map<number, { cost: number; index: number }> {
  const best = new Map<number, { cost: number; index: number }>();
  for (const [keyIndex, indices] of layer.byKey) {
    let cost = Infinity;
    let index = -1;
    for (const j of indices) {
      const c = costOf(j);
      if (c < cost - EPSILON) {
        cost = c;
        index = j;
      }
    }
    best.set(keyIndex, { cost, index });
  }
  return best;
}

interface Search {
  /** State index at each box along the cheapest path. */
  readonly path: readonly number[];
  /** For each box and state, the cost of the cheapest path through it. */
  readonly totals: readonly Float64Array[];
  readonly best: number;
}

function search(layers: readonly Layer[], facts: readonly (ChordFacts | null)[], home: HomeKey | null): Search {
  const keys = homeKeys();
  const n = layers.length;
  const bonuses = layers.map(() => new Map<number, number>());
  const bonusAt = (i: number, key: HomeKey) => {
    let bonus = bonuses[i].get(key.index);
    if (bonus === undefined) {
      bonus = cadenceBonus(key, facts[i], facts[i + 1]);
      bonuses[i].set(key.index, bonus);
    }
    return bonus;
  };

  const forward: Float64Array[] = [
    Float64Array.from(layers[0].states, (s) => (home === null ? 0 : changeCost(home, s.home)) + s.emission),
  ];
  const origins: Int32Array[] = [new Int32Array(layers[0].states.length).fill(-1)];
  for (let i = 1; i < n; i++) {
    const previous = layers[i - 1];
    const layer = layers[i];
    const before = forward[i - 1];
    const exits = cheapestPerKey(previous, (j) => before[j] + exitCost(previous.states[j]));
    const cost = new Float64Array(layer.states.length);
    const origin = new Int32Array(layer.states.length);
    for (const [keyIndex, indices] of layer.byKey) {
      const key = keys[keyIndex];
      let change = Infinity;
      let changeFrom = -1;
      for (const [fromIndex, exit] of exits) {
        if (fromIndex === keyIndex) continue;
        const c = exit.cost + changeCost(keys[fromIndex], key);
        if (c < change - EPSILON) {
          change = c;
          changeFrom = exit.index;
        }
      }
      const same = previous.byKey.get(keyIndex);
      const bonus = same ? bonusAt(i - 1, key) : 0;
      for (const j of indices) {
        const state = layer.states[j];
        let best = Infinity;
        let from = -1;
        if (same) {
          for (const p of same) {
            const c = before[p] - bonus + pairCost(previous.states[p], state);
            if (c < best - EPSILON) {
              best = c;
              from = p;
            }
          }
        }
        const entering = change + entryCost(state);
        if (entering < best - EPSILON) {
          best = entering;
          from = changeFrom;
        }
        cost[j] = best + state.emission;
        origin[j] = from;
      }
    }
    forward.push(cost);
    origins.push(origin);
  }

  const backward: Float64Array[] = new Array<Float64Array>(n);
  backward[n - 1] = new Float64Array(layers[n - 1].states.length);
  for (let i = n - 2; i >= 0; i--) {
    const layer = layers[i];
    const next = layers[i + 1];
    const after = backward[i + 1];
    const entries = cheapestPerKey(next, (j) => next.states[j].emission + after[j] + entryCost(next.states[j]));
    const cost = new Float64Array(layer.states.length);
    for (const [keyIndex, indices] of layer.byKey) {
      const key = keys[keyIndex];
      let change = Infinity;
      for (const [toIndex, entry] of entries) {
        if (toIndex !== keyIndex) change = Math.min(change, changeCost(key, keys[toIndex]) + entry.cost);
      }
      const same = next.byKey.get(keyIndex);
      const bonus = same ? bonusAt(i, key) : 0;
      for (const j of indices) {
        const state = layer.states[j];
        let best = change + exitCost(state);
        if (same) {
          for (const p of same) {
            best = Math.min(best, -bonus + pairCost(state, next.states[p]) + next.states[p].emission + after[p]);
          }
        }
        cost[j] = best;
      }
    }
    backward[i] = cost;
  }

  const final = forward[n - 1];
  let end = 0;
  final.forEach((c, j) => {
    if (c < final[end] - EPSILON) end = j;
  });
  const path = [end];
  for (let i = n - 1; i > 0; i--) path.unshift(origins[i][path[0]]);
  return { path, totals: forward.map((f, i) => f.map((c, j) => c + backward[i][j])), best: final[end] };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type BoxTag = 'halfCadence' | 'picardyThird' | 'neapolitan' | 'backdoorDominant' | 'bluesDominant';

export interface BoxAnalysis {
  readonly facts: ChordFacts | null;
  /** The pinned reading, or else the cheapest. */
  readonly reading: Reading;
  /** Other readings nearly as cheap, cheapest first. Chromatic readings, which explain nothing, are left out. */
  readonly alternatives: readonly Reading[];
  /** Other readings are nearly as good and nothing is pinned: the reading shown is tentative. */
  readonly ambiguous: boolean;
  /** The user's key or reading pin applies. */
  readonly pinned: boolean;
  readonly tags: readonly BoxTag[];
}

export type RelationId =
  | CadenceId
  | 'secondaryResolution'
  | 'deceptiveResolution'
  | 'leadingToneResolution'
  | 'tritoneResolution'
  | 'relatedTwoFive'
  | 'chromaticMediant'
  | 'commonToneDiminished'
  | 'passingDiminished'
  | 'chromaticApproach'
  | 'modulation';

export type ModulationKind = 'pivot' | 'direct' | 'commonTone' | 'enharmonic';

export interface Relation {
  readonly id: RelationId;
  /** For a modulation: how the new key arrives. */
  readonly modulation?: ModulationKind;
}

export interface HarmonicAnalysis {
  readonly boxes: readonly BoxAnalysis[];
  /** Relations between box i and box i + 1. */
  readonly relations: readonly (readonly Relation[])[];
  /** Named patterns spanning several boxes (theory/patterns.ts). */
  readonly patterns: readonly PatternSpan[];
}

function readingOf(state: State, cost: number): Reading {
  return {
    kind: state.kind,
    home: state.home,
    local: state.local,
    root: state.root,
    source: state.source,
    cost,
    pinId: state.pinId,
  };
}

function alternativesAt(layer: Layer, totals: Float64Array, best: number, chosen: State): Reading[] {
  const w = ANALYSIS_WEIGHTS;
  return layer.states
    .map((state, j) => ({ state, cost: totals[j] }))
    .filter(
      ({ state, cost }) =>
        cost <= best + w.ambiguityMargin + EPSILON &&
        state.id !== chosen.id &&
        state.kind !== 'chromatic' &&
        state.kind !== 'none',
    )
    .sort((a, b) => a.cost - b.cost)
    .slice(0, w.maxAlternatives)
    .map(({ state, cost }) => readingOf(state, cost));
}

function modulationKind(a: ChordFacts | null, b: ChordFacts | null, from: HomeKey, to: HomeKey): ModulationKind {
  const inBoth = (facts: ChordFacts | null) =>
    facts !== null && fitIn(facts, allowedTones(from, facts.root, facts.shape)).core && fitIn(facts, allowedTones(to, facts.root, facts.shape)).core;
  if (inBoth(a) || inBoth(b)) return 'pivot';
  if (a?.quality === 'diminished7') return 'enharmonic';
  const interval = mod12(to.tonic - from.tonic);
  if (a && b && intersect(a.pcs, b.pcs) !== 0 && [3, 4, 8, 9].includes(interval)) return 'commonTone';
  return 'direct';
}

const mediantPartners = (a: ChordFacts, b: ChordFacts) =>
  (a.quality === 'major' || a.quality === 'dominant') === (b.quality === 'major' || b.quality === 'dominant') &&
  [a, b].every((f) => f.quality === 'major' || f.quality === 'dominant' || f.quality === 'minor');

function relationsBetween(a: BoxAnalysis, b: BoxAnalysis): Relation[] {
  const out: Relation[] = [];
  const add = (id: RelationId, modulation?: ModulationKind) => {
    if (!out.some((r) => r.id === id)) out.push(modulation ? { id, modulation } : { id });
  };
  const s = a.reading;
  const t = b.reading;
  if (s.home !== t.home) add('modulation', modulationKind(a.facts, b.facts, s.home, t.home));
  const fa = a.facts;
  const fb = b.facts;
  if (!fa || !fb) return out;

  if (s.kind === 'relatedTwo' && (t.kind === 'secondaryDominant' || t.kind === 'tritoneSub') && t.local === s.local) {
    add('relatedTwoFive');
  }
  if (s.kind === 'secondaryDominant') {
    if (fb.root === s.local.tonic) add('secondaryResolution');
    else if (fb.root === mod12(s.local.tonic + (s.local.mode === 'minor' ? 8 : 9))) add('deceptiveResolution');
  }
  if (s.kind === 'secondaryLeadingTone' && fb.root === s.local.tonic) add('leadingToneResolution');
  if (s.kind === 'tritoneSub' && fb.root === s.local.tonic) add('tritoneResolution');
  if (s.kind === 'passingDiminished') add(hasPc(fa.pcs, fb.root) ? 'commonToneDiminished' : 'passingDiminished');
  if (s.kind === 'chromaticApproach') add('chromaticApproach');
  if (s.home === t.home) {
    for (const rule of CADENCE_RULES) {
      if (rule.shown && rule.keys.includes(s.home.mode) && matchesPattern(rule.from, s.home, fa) && matchesPattern(rule.to, s.home, fb)) {
        add(rule.id);
      }
    }
  }
  const interval = mod12(fb.root - fa.root);
  const outside = (r: Reading) => r.kind !== 'diatonic' && r.kind !== 'none';
  if ([3, 4, 8, 9].includes(interval) && mediantPartners(fa, fb) && (outside(s) || outside(t))) add('chromaticMediant');
  return out;
}

function tagsOf(i: number, reading: Reading, facts: ChordFacts | null, ctx: Context): BoxTag[] {
  if (!facts) return [];
  const tags: BoxTag[] = [];
  const { home } = reading;
  const degree = mod12(facts.root - home.tonic);
  const functional = !isModalKey(home);
  const last = ctx.facts.slice(i + 1).every((f) => f === null);
  if (last && i > 0 && functional && degree === 7 && ['major', 'dominant', 'suspendedDominant'].includes(facts.quality) && !APPLIED_KINDS.has(reading.kind)) {
    tags.push('halfCadence');
  }
  if (last && home.mode === 'minor' && degree === 0 && (facts.quality === 'major' || facts.quality === 'dominant')) {
    tags.push('picardyThird');
  }
  if (functional && degree === 1 && facts.quality === 'major' && (reading.kind === 'borrowed' || reading.kind === 'chromatic')) {
    tags.push('neapolitan');
  }
  if (home.mode === 'major' && degree === 10 && facts.quality === 'dominant' && reading.kind === 'borrowed') {
    tags.push('backdoorDominant');
  }
  if (
    home.mode === 'major' &&
    reading.kind === 'borrowed' &&
    facts.quality === 'dominant' &&
    ctx.bluesTonics.has(home.tonic) &&
    (degree === 0 || degree === 5)
  ) {
    tags.push('bluesDominant');
  }
  return tags;
}

function bluesTonicsOf(facts: readonly (ChordFacts | null)[]): Set<PitchClass> {
  const roots = new Set(facts.flatMap((f) => (f && f.quality === 'dominant' ? [f.root] : [])));
  return new Set([...roots].filter((root) => roots.has(mod12(root + 5))));
}

/**
 * Reads a progression: each box's reading with its alternatives, and the relations between
 * neighbours. With `options.home` the progression starts in that key and leaving it costs; without,
 * it may start in any key (Find key).
 */
export function analyzeHarmony(boxes: readonly AnalysisBox[], options: AnalysisOptions = {}): HarmonicAnalysis {
  if (boxes.length === 0) return { boxes: [], relations: [], patterns: [] };
  const facts = boxes.map((box) => (box.chord ? chordFacts(box.chord) : null));
  const home = options.home ? homeKeyOf(options.home) : null;
  const established: PcSet[] = [];
  const minorRoots: PcSet[] = [];
  let heard: PcSet = 0;
  let minors: PcSet = 0;
  for (const f of facts) {
    established.push(heard);
    minorRoots.push(minors);
    if (!f) continue;
    heard = withPc(heard, f.root);
    if (f.quality === 'dominant' || f.quality === 'suspendedDominant' || f.quality === 'major') heard = withPc(heard, f.root + 5);
    if (f.quality === 'minor') minors = withPc(minors, f.root);
  }
  let cadenceTargets: PcSet = 0;
  facts.forEach((f, i) => {
    const next = i + 1 < facts.length ? facts[i + 1] : null;
    const dominant = f !== null && (f.quality === 'dominant' || f.quality === 'suspendedDominant' || f.quality === 'major');
    if (dominant && next !== null && next.root === mod12(f.root + 5)) cadenceTargets = withPc(cadenceTargets, next.root);
  });
  const ctx: Context = {
    facts,
    home,
    bluesTonics: bluesTonicsOf(facts),
    established,
    minorRoots,
    opening: facts.findIndex((f) => f !== null),
    cadenceTargets,
  };

  // The reading chosen listens to pins and to the boxes' scales. Alternatives come from the chords
  // alone, so the scales Find key gave the boxes can't hide an ambiguity, and pins don't either.
  const all = boxes.map((box, i) => statesFor(i, box, ctx));
  const pins = all.map((states, i) => applyPins(states, boxes[i]));
  const layers = pins.map((p) => layerOf(prune(p.states)));
  const hasScales = boxes.some((box) => box.scale !== undefined);
  const anyPin = pins.some((p) => p.pinned);
  const openLayers =
    hasScales || anyPin
      ? boxes.map((box, i) => layerOf(prune(hasScales ? statesFor(i, { chord: box.chord }, ctx) : all[i])))
      : layers;

  const chosen = search(layers, facts, home);
  const open = openLayers === layers ? chosen : search(openLayers, facts, home);

  const results = boxes.map((_, i): BoxAnalysis => {
    const state = layers[i].states[chosen.path[i]];
    const reading = readingOf(state, chosen.totals[i][chosen.path[i]]);
    const alternatives = alternativesAt(openLayers[i], open.totals[i], open.best, state);
    const pinned = pins[i].pinned;
    return {
      facts: facts[i],
      reading,
      alternatives,
      ambiguous: !pinned && alternatives.length > 0,
      pinned,
      tags: tagsOf(i, reading, facts[i], ctx),
    };
  });
  const relations = results.slice(1).map((b, i) => relationsBetween(results[i], b));
  return { boxes: results, relations, patterns: findPatterns({ boxes: results, relations, patterns: [] }) };
}
