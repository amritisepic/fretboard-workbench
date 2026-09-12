/**
 * Pitch classes, pitch-class sets and MIDI pitches.
 *
 * A pitch class is an integer 0–11 (0 = C). A pitch-class set is a 12-bit mask in
 * which bit n is set when pitch class n is present. Anything register-sensitive uses
 * MIDI note numbers (60 = C4).
 */

export type PitchClass = number;
export type PcSet = number;
export type Midi = number;

export const EMPTY_SET: PcSet = 0;
export const FULL_SET: PcSet = 0xfff;

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function pcOf(midi: Midi): PitchClass {
  return mod12(midi);
}

/** Scientific-pitch octave number (MIDI 60 → 4). */
export function octaveOf(midi: Midi): number {
  return Math.floor(midi / 12) - 1;
}

export function toMidi(pc: PitchClass, octave: number): Midi {
  return (octave + 1) * 12 + mod12(pc);
}

// ---------------------------------------------------------------------------
// Pitch-class sets
// ---------------------------------------------------------------------------

export function bit(pc: PitchClass): PcSet {
  return 1 << mod12(pc);
}

export function pcSet(pcs: Iterable<number>): PcSet {
  let set = EMPTY_SET;
  for (const pc of pcs) set |= bit(pc);
  return set;
}

/** Members of a set in ascending order. */
export function pcsOf(set: PcSet): PitchClass[] {
  const out: PitchClass[] = [];
  for (let pc = 0; pc < 12; pc++) if (set & (1 << pc)) out.push(pc);
  return out;
}

export function hasPc(set: PcSet, pc: PitchClass): boolean {
  return (set & bit(pc)) !== 0;
}

export function withPc(set: PcSet, pc: PitchClass): PcSet {
  return (set | bit(pc)) & FULL_SET;
}

export function withoutPc(set: PcSet, pc: PitchClass): PcSet {
  return set & ~bit(pc) & FULL_SET;
}

export function togglePc(set: PcSet, pc: PitchClass): PcSet {
  return (set ^ bit(pc)) & FULL_SET;
}

export function setSize(set: PcSet): number {
  let rest = set & FULL_SET;
  let count = 0;
  while (rest) {
    rest &= rest - 1;
    count++;
  }
  return count;
}

export function intersect(a: PcSet, b: PcSet): PcSet {
  return a & b & FULL_SET;
}

export function union(a: PcSet, b: PcSet): PcSet {
  return (a | b) & FULL_SET;
}

export function difference(a: PcSet, b: PcSet): PcSet {
  return a & ~b & FULL_SET;
}

export function complement(set: PcSet): PcSet {
  return ~set & FULL_SET;
}

/** True when every member of `a` is in `b`. */
export function isSubset(a: PcSet, b: PcSet): boolean {
  return (a & ~b & FULL_SET) === 0;
}

/** Transposition by `semitones` is a 12-bit rotation. */
export function transpose(set: PcSet, semitones: number): PcSet {
  const k = mod12(semitones);
  const s = set & FULL_SET;
  return ((s << k) | (s >>> (12 - k))) & FULL_SET;
}

export function pcSetFromIntervals(intervals: readonly number[], root: PitchClass = 0): PcSet {
  let set = EMPTY_SET;
  for (const iv of intervals) set |= bit(root + iv);
  return set;
}

/** Semitone offsets of a set's members measured upward from `root`, ascending. */
export function intervalsFrom(set: PcSet, root: PitchClass): number[] {
  return pcsOf(transpose(set, -root));
}

/** Shortest distance around the pitch-class circle (0–6). */
export function circularDistance(a: PitchClass, b: PitchClass): number {
  const d = mod12(a - b);
  return Math.min(d, 12 - d);
}

/** The interval list of the rotation starting on the `steps`-th note. */
export function rotateIntervals(intervals: readonly number[], steps: number): number[] {
  const n = intervals.length;
  const k = ((steps % n) + n) % n;
  const base = intervals[k];
  return intervals.map((_, i) => mod12(intervals[(i + k) % n] - base));
}

// ---------------------------------------------------------------------------
// Degrees and accidentals
// ---------------------------------------------------------------------------

/** Semitones above the tonic for major-scale degrees 1–7. */
export const MAJOR_SCALE_SEMITONES: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

export function formatAccidental(accidental: number, showNatural = false): string {
  if (accidental === 0) return showNatural ? '♮' : '';
  return (accidental > 0 ? '♯' : '♭').repeat(Math.abs(accidental));
}

export interface ParsedDegree {
  /** Generic degree number, e.g. 3 for "♭3", 9 for "♯9". */
  readonly degree: number;
  /** Alteration relative to the major/perfect degree. */
  readonly accidental: number;
  /** Pitch-class interval above the root (0–11). */
  readonly semitones: number;
}

/** Parses degree labels such as "5", "♭3", "♯11", "bb7". */
export function parseDegree(label: string): ParsedDegree {
  const match = /^([♭b♯#♮]*)(\d+)$/.exec(label.trim());
  if (!match) throw new Error(`Invalid degree label: "${label}"`);
  let accidental = 0;
  for (const ch of match[1]) {
    if (ch === '♭' || ch === 'b') accidental--;
    else if (ch === '♯' || ch === '#') accidental++;
  }
  const degree = Number(match[2]);
  if (degree < 1) throw new Error(`Invalid degree label: "${label}"`);
  const semitones = mod12(MAJOR_SCALE_SEMITONES[(degree - 1) % 7] + accidental);
  return { degree, accidental, semitones };
}

export function formatDegree(degree: number, accidental: number, showNatural = false): string {
  return formatAccidental(accidental, showNatural) + degree;
}
