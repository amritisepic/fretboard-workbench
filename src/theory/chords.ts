/** Chord types and chord identification (spec §4.2). */

import { CHORD_ID_WEIGHTS } from '../data/chordIdWeights';
import { CHORD_TYPE_DEFS, type ChordQuality, type ChordTypeDef } from '../data/chords';
import {
  bit,
  isSubset,
  mod12,
  parseDegree,
  pcOf,
  pcSet,
  pcSetFromIntervals,
  setSize,
  transpose,
  type Midi,
  type PcSet,
  type PitchClass,
} from './pitch';
import {
  DEFAULT_SPELLINGS,
  accidentalFor,
  formatSpelled,
  spellPc,
  type ChordSpellingHint,
  type ScaleContext,
  type SpelledPc,
} from './spelling';

export interface ChordTone {
  readonly interval: number;
  readonly degree: number;
  readonly label: string;
}

export interface ChordType {
  readonly id: string;
  readonly name: string;
  readonly suffix: string;
  readonly intervals: readonly number[];
  readonly tones: readonly ChordTone[];
  /** Pitch-class set rooted on C. */
  readonly mask: PcSet;
  readonly quality: ChordQuality;
  readonly complexity: number;
  readonly usage: number;
  readonly hasPerfectFifth: boolean;
}

function buildChordType(def: ChordTypeDef): ChordType {
  const tones = def.degrees.map((label) => {
    const parsed = parseDegree(label);
    return { interval: parsed.semitones, degree: parsed.degree, label };
  });
  const intervals = tones.map((t) => t.interval);
  const mask = pcSetFromIntervals(intervals);
  if (setSize(mask) !== intervals.length) {
    throw new Error(`Chord type "${def.id}" has two tones on the same pitch class`);
  }
  return {
    id: def.id,
    name: def.name,
    suffix: def.suffix,
    intervals,
    tones,
    mask,
    quality: def.quality,
    complexity: def.complexity,
    usage: def.usage,
    hasPerfectFifth: def.degrees.includes('5'),
  };
}

export const CHORD_TYPES: readonly ChordType[] = CHORD_TYPE_DEFS.map(buildChordType);

const chordTypesById = new Map<string, ChordType>(CHORD_TYPES.map((t) => [t.id, t]));

export function getChordType(id: string): ChordType {
  const type = chordTypesById.get(id);
  if (!type) throw new Error(`Unknown chord type: "${id}"`);
  return type;
}

export type Omission = 'root' | '5';

export interface ChordCandidate {
  /** Stable identity for sticky per-box overrides: "root:typeId:omissions". */
  readonly key: string;
  readonly root: PitchClass;
  readonly type: ChordType;
  readonly omitted: readonly Omission[];
  /** Lowest sounding pitch class, when known. */
  readonly bass: PitchClass | null;
  readonly rootIsBass: boolean;
  /** The complete chord (omitted tones included) lies inside the reference scale. */
  readonly diatonic: boolean;
  readonly score: number;
}

export interface IdentifyOptions {
  /** Pitch classes of the box's reference scale; chords that fit it completely score higher. */
  readonly scale?: PcSet;
}

export function chordCandidateKey(root: PitchClass, typeId: string, omitted: readonly Omission[]): string {
  return `${mod12(root)}:${typeId}:${omitted.join('+')}`;
}

/** The same reading on a root moved by `semitones`, e.g. when the root box transposes a box. */
export function transposeChordCandidateKey(key: string, semitones: number): string {
  const [root, ...rest] = key.split(':');
  const pc = Number(root);
  return Number.isInteger(pc) && rest.length > 0 ? [mod12(pc + semitones), ...rest].join(':') : key;
}

/**
 * Every plausible name for a pitch-class set, best first. All 12 roots are tried so rootless
 * readings are found. Only the root and a perfect 5th may be omitted, and a rootless reading
 * needs a chord of at least four tones with at least three present. Complete chords outrank
 * readings that need an omission, even when the omission would put the root in the bass.
 */
export function identifyChordPcs(
  set: PcSet,
  bassPc: PitchClass | null = null,
  options: IdentifyOptions = {},
): ChordCandidate[] {
  const present = setSize(set);
  if (present < 2) return [];
  const bass = bassPc === null ? null : mod12(bassPc);
  const w = CHORD_ID_WEIGHTS;
  const out: ChordCandidate[] = [];
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPES) {
      const full = transpose(type.mask, root);
      if (!isSubset(set, full)) continue;
      const missing = full & ~set;
      const rootBit = bit(root);
      const fifthBit = type.hasPerfectFifth ? bit(root + 7) : 0;
      if ((missing & ~(rootBit | fifthBit)) !== 0) continue;

      const omitted: Omission[] = [];
      if (missing & rootBit) omitted.push('root');
      if (missing & fifthBit) omitted.push('5');
      const rootless = omitted.includes('root');
      if (rootless && (type.intervals.length < 4 || present < 3)) continue;

      const rootIsBass = bass === root;
      const diatonic = options.scale !== undefined && isSubset(full, options.scale);
      const score =
        (rootIsBass ? w.rootIsBass : 0) -
        (rootless ? w.omittedRoot : 0) -
        (omitted.includes('5') ? w.omittedFifth : 0) -
        w.complexity * type.complexity +
        w.usage * type.usage +
        (diatonic ? w.diatonic : 0);
      out.push({
        key: chordCandidateKey(root, type.id, omitted),
        root,
        type,
        omitted,
        bass,
        rootIsBass,
        diatonic,
        score,
      });
    }
  }
  return out.sort(
    (a, b) => b.score - a.score || a.type.complexity - b.type.complexity || a.root - b.root,
  );
}

/** Identifies sounding pitches; doublings collapse to pitch classes and the lowest pitch is the bass. */
export function identifyChord(pitches: readonly Midi[], options: IdentifyOptions = {}): ChordCandidate[] {
  if (pitches.length === 0) return [];
  return identifyChordPcs(pcSet(pitches.map(pcOf)), pcOf(Math.min(...pitches)), options);
}

export function chordSpellingHint(candidate: ChordCandidate): ChordSpellingHint {
  return { root: candidate.root, tones: candidate.type.tones };
}

/**
 * Spells a tone of the chord. With a box context the scale decides and the chord breaks ties.
 * Without one, letters are stacked from the root (E7 over G♯, not A♭).
 */
export function spellChordTone(candidate: ChordCandidate, pc: PitchClass, ctx?: ScaleContext): SpelledPc {
  const p = mod12(pc);
  if (ctx) return spellPc(p, { ...ctx, chord: chordSpellingHint(candidate) });
  const root = DEFAULT_SPELLINGS[candidate.root];
  const tone = candidate.type.tones.find((t) => mod12(candidate.root + t.interval) === p);
  if (!tone) return DEFAULT_SPELLINGS[p];
  const letter = (root.letter + tone.degree - 1) % 7;
  const accidental = accidentalFor(letter, p);
  return Math.abs(accidental) <= 2 ? { letter, accidental } : DEFAULT_SPELLINGS[p];
}

export function chordRootSpelling(candidate: ChordCandidate, ctx?: ScaleContext): SpelledPc {
  return spellChordTone(candidate, candidate.root, ctx);
}

export interface ChordNameOptions {
  /** Append "/bass" when the lowest note is not the root (default true). Never used for rootless readings. */
  readonly slash?: boolean;
}

/** "Am", "Am/C", "C6/A (no 5)", "Fmaj7 (no root)". Notes are spelled against `ctx` when given. */
export function chordName(candidate: ChordCandidate, ctx?: ScaleContext, options: ChordNameOptions = {}): string {
  const slash = options.slash ?? true;
  let name = formatSpelled(chordRootSpelling(candidate, ctx)) + candidate.type.suffix;
  const { bass } = candidate;
  if (slash && bass !== null && bass !== candidate.root && !candidate.omitted.includes('root')) {
    name += `/${formatSpelled(spellChordTone(candidate, bass, ctx))}`;
  }
  if (candidate.omitted.length > 0) {
    name += ` (${candidate.omitted.map((o) => (o === 'root' ? 'no root' : 'no 5')).join(', ')})`;
  }
  return name;
}
