/** Scale library access, mode rotation and naming (spec §4.3), and scale references (§4.4). */

import { SCALE_FAMILIES, type ScaleFamilyDef } from '../data/scales';
import {
  MAJOR_SCALE_SEMITONES,
  formatAccidental,
  mod12,
  pcSetFromIntervals,
  rotateIntervals,
  type PcSet,
  type PitchClass,
} from './pitch';
import {
  chooseTonicSpelling,
  formatSpelled,
  parseSpelled,
  pcOfSpelled,
  spellPc,
  spellScale,
  type ChordSpellingHint,
  type EnharmonicPreference,
  type ScaleContext,
  type SpelledPc,
} from './spelling';
import { compareKeys } from './util';

export interface Scale {
  readonly name: string;
  readonly intervals: readonly number[];
}

const familiesById = new Map<string, ScaleFamilyDef>(SCALE_FAMILIES.map((f) => [f.id, f]));

export function getScaleFamily(id: string): ScaleFamilyDef {
  const family = familiesById.get(id);
  if (!family) throw new Error(`Unknown scale family: "${id}"`);
  return family;
}

export function normalizeMode(familyId: string, mode: number): number {
  const n = getScaleFamily(familyId).intervals.length;
  return ((mode % n) + n) % n;
}

const modeIntervalCache = new Map<string, readonly number[]>();

/** Intervals of the rotation starting on the family's (mode + 1)-th degree. */
export function modeIntervals(familyId: string, mode: number): readonly number[] {
  const m = normalizeMode(familyId, mode);
  const key = `${familyId}:${m}`;
  let intervals = modeIntervalCache.get(key);
  if (!intervals) {
    intervals = Object.freeze(rotateIntervals(getScaleFamily(familyId).intervals, m));
    modeIntervalCache.set(key, intervals);
  }
  return intervals;
}

const modeNameCache = new Map<string, string>();

export function modeName(familyId: string, mode: number): string {
  const m = normalizeMode(familyId, mode);
  const key = `${familyId}:${m}`;
  let name = modeNameCache.get(key);
  if (name === undefined) {
    name = getScaleFamily(familyId).modeNames[m] ?? generateModeName(modeIntervals(familyId, m));
    modeNameCache.set(key, name);
  }
  return name;
}

export function modeScale(familyId: string, mode: number): Scale {
  return { name: modeName(familyId, mode), intervals: modeIntervals(familyId, mode) };
}

const DIATONIC_BASES: readonly Scale[] = [
  { name: 'Ionian', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
];

/**
 * Names a rotation that has no accepted name: the diatonic mode needing the fewest altered degrees,
 * followed by those alterations ("Dorian ♭5", "Locrian ♭♭7"). Degrees come from spelling the
 * rotation on C, so each alteration is labelled with its real scale degree. Scales with other than
 * seven notes also list extra same-letter degrees ("add ♭2") and absent degrees ("(no 3, no 6)").
 */
export function generateModeName(intervals: readonly number[]): string {
  const byDegree: number[][] = [[], [], [], [], [], [], []];
  for (const note of spellScale({ letter: 0, accidental: 0 }, intervals)) {
    byDegree[note.letter].push(note.accidental);
  }
  const missing = byDegree.flatMap((accidentals, d) => (accidentals.length === 0 ? [d + 1] : []));

  let bestName = '';
  let bestKey: number[] | null = null;
  for (let b = 0; b < DIATONIC_BASES.length; b++) {
    const base = DIATONIC_BASES[b];
    const alterations: string[] = [];
    const additions: string[] = [];
    let distance = 0;
    // On a tie, avoid altering the 3rd (it sets major vs minor), then the 7th.
    let salience = 0;
    for (let d = 0; d < 7; d++) {
      const expected = base.intervals[d] - MAJOR_SCALE_SEMITONES[d];
      const accidentals = byDegree[d];
      const matchIndex = accidentals.indexOf(expected);
      accidentals.forEach((accidental, i) => {
        if (i === matchIndex) return;
        const label = formatAccidental(accidental, true) + (d + 1);
        if (matchIndex === -1 && i === 0) {
          alterations.push(label);
          distance += Math.abs(accidental - expected);
          salience += d === 2 ? 3 : d === 6 ? 2 : 1;
        } else {
          additions.push(label);
        }
      });
    }
    const key = [alterations.length + 1.5 * additions.length, distance, salience, b];
    if (bestKey === null || compareKeys(key, bestKey) < 0) {
      bestKey = key;
      const words = [base.name, ...alterations, ...(additions.length > 0 ? ['add', ...additions] : [])];
      bestName = words.join(' ') + (missing.length > 0 ? ` (${missing.map((d) => `no ${d}`).join(', ')})` : '');
    }
  }
  return bestName;
}

// ---------------------------------------------------------------------------
// Scale references: family + mode + spelled tonic
// ---------------------------------------------------------------------------

export interface ScaleRef {
  readonly familyId: string;
  /** 0-based mode; mode-slider stop k is mode k − 1. */
  readonly mode: number;
  /** Tonic of the mode (the note the slider made the root). */
  readonly tonic: SpelledPc;
}

/** Builds a reference from a spelled tonic ("F♯") or a pitch class (spelling chosen automatically). */
export function makeScaleRef(
  familyId: string,
  mode: number,
  tonic: string | PitchClass | SpelledPc,
  prefer?: EnharmonicPreference,
): ScaleRef {
  const m = normalizeMode(familyId, mode);
  const spelled =
    typeof tonic === 'string'
      ? parseSpelled(tonic)
      : typeof tonic === 'number'
        ? chooseTonicSpelling(tonic, modeIntervals(familyId, m), prefer)
        : tonic;
  return { familyId, mode: m, tonic: spelled };
}

export function scaleRefIntervals(ref: ScaleRef): readonly number[] {
  return modeIntervals(ref.familyId, ref.mode);
}

export function scaleRefPcSet(ref: ScaleRef): PcSet {
  return pcSetFromIntervals(scaleRefIntervals(ref), pcOfSpelled(ref.tonic));
}

export function scaleRefModeName(ref: ScaleRef): string {
  return modeName(ref.familyId, ref.mode);
}

/** "D Dorian", "C♭ Lydian". */
export function scaleRefName(ref: ScaleRef): string {
  return `${formatSpelled(ref.tonic)} ${scaleRefModeName(ref)}`;
}

export function scaleRefContext(ref: ScaleRef, chord?: ChordSpellingHint): ScaleContext {
  return { tonic: ref.tonic, intervals: scaleRefIntervals(ref), chord };
}

export function scaleRefSpelling(ref: ScaleRef): readonly SpelledPc[] {
  return spellScale(ref.tonic, scaleRefIntervals(ref));
}

/** Mode slider: makes another degree the tonic while keeping the pitch collection fixed. */
export function withMode(ref: ScaleRef, mode: number): ScaleRef {
  const family = getScaleFamily(ref.familyId);
  const from = normalizeMode(ref.familyId, ref.mode);
  const to = normalizeMode(ref.familyId, mode);
  const parentRoot = pcOfSpelled(ref.tonic) - family.intervals[from];
  const tonicPc = mod12(parentRoot + family.intervals[to]);
  return { familyId: ref.familyId, mode: to, tonic: spellPc(tonicPc, scaleRefContext(ref)) };
}

/**
 * Root box: moves the whole scale by `semitones`, keeping family and mode. The new tonic is
 * respelled from scratch; an exact enharmonic tie follows the direction of travel.
 */
export function transposeScaleRef(ref: ScaleRef, semitones: number): ScaleRef {
  if (mod12(semitones) === 0) return ref;
  const prefer: EnharmonicPreference = semitones > 0 ? 'sharp' : 'flat';
  const tonic = chooseTonicSpelling(pcOfSpelled(ref.tonic) + semitones, scaleRefIntervals(ref), prefer);
  return { ...ref, tonic };
}

/** The lowest mode with the same interval structure (symmetric scales repeat themselves). */
export function canonicalMode(familyId: string, mode: number): number {
  const target = modeIntervals(familyId, mode).join(',');
  const count = getScaleFamily(familyId).intervals.length;
  for (let m = 0; m < count; m++) {
    if (modeIntervals(familyId, m).join(',') === target) return m;
  }
  return normalizeMode(familyId, mode);
}

/** Modes of a family with distinct interval structures, for listing in a selector. */
export function distinctModes(familyId: string): number[] {
  return getScaleFamily(familyId)
    .intervals.map((_, m) => m)
    .filter((m) => canonicalMode(familyId, m) === m);
}

/** Scale selector: another family or mode on the same tonic pitch, respelled for the new scale. */
export function withFamilyMode(ref: ScaleRef, familyId: string, mode: number): ScaleRef {
  const m = normalizeMode(familyId, mode);
  const prefer: EnharmonicPreference = ref.tonic.accidental > 0 ? 'sharp' : 'flat';
  return { familyId, mode: m, tonic: chooseTonicSpelling(pcOfSpelled(ref.tonic), modeIntervals(familyId, m), prefer) };
}

/** Scale selector: the same scale on another tonic. Unlike the root box, nothing else moves. */
export function withTonic(ref: ScaleRef, pc: PitchClass): ScaleRef {
  if (mod12(pc) === pcOfSpelled(ref.tonic)) return ref;
  return { ...ref, tonic: chooseTonicSpelling(pc, scaleRefIntervals(ref)) };
}

/** The same pitch collection on the same tonic pitch, however it is spelled or filed. */
export function sameScale(a: ScaleRef, b: ScaleRef): boolean {
  return scaleRefPcSet(a) === scaleRefPcSet(b) && pcOfSpelled(a.tonic) === pcOfSpelled(b.tonic);
}
