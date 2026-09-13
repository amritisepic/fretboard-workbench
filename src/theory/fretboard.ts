/**
 * Logical fretboard: which pitch sounds at a (string, fret), plus tunings and their names. Pixel
 * geometry such as fret spacing and dot placement belongs to the UI, not here.
 */

import { MAJOR_SCALE_SEMITONES, hasPc, octaveOf, pcOf, pcSet, type Midi, type PcSet, type PitchClass } from './pitch';
import { parseSpelled } from './spelling';

/** Open-string MIDI pitches, lowest-sounding string first. */
export type Tuning = readonly Midi[];

export interface FretPosition {
  /** 0 = lowest-sounding string. */
  readonly string: number;
  /** 0 = open string. */
  readonly fret: number;
}

export const MIN_STRINGS = 4;
export const MAX_STRINGS = 9;
export const MIN_FRETS = 12;
export const MAX_FRETS = 30;
export const DEFAULT_FRET_COUNT = 24;
/** Below MIN_FRETS, so a capo always leaves frets to play. */
export const MAX_CAPO = 11;
/** A chord holds one note per string, and this many notes at most. */
export const MAX_CHORD_NOTES = 6;

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function clampStringCount(count: number): number {
  return clampInt(count, MIN_STRINGS, MAX_STRINGS);
}

export function clampFretCount(count: number): number {
  return clampInt(count, MIN_FRETS, MAX_FRETS);
}

export function clampCapo(capo: number): number {
  return clampInt(capo, 0, MAX_CAPO);
}

/** Tuning pitches use sharps. A tuning belongs to no key, so there is no context to derive a spelling from. */
export const PITCH_CLASS_NAMES: readonly string[] = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "E2", "F♯1". */
export function pitchName(midi: Midi): string {
  return PITCH_CLASS_NAMES[pcOf(midi)] + octaveOf(midi);
}

/** Parses "E2", "F♯1", "Bb0". The octave number belongs to the letter, so "B♯3" is MIDI 60. */
export function parsePitchName(name: string): Midi {
  const match = /^([A-Ga-g][♭b♯#♮]*)(-?\d+)$/.exec(name.trim());
  if (!match) throw new Error(`Invalid pitch name: "${name}"`);
  const note = parseSpelled(match[1]);
  return (Number(match[2]) + 1) * 12 + MAJOR_SCALE_SEMITONES[note.letter] + note.accidental;
}

/** "E2 A2 D3 G3 B3 E4", lowest string first. */
export function formatTuning(tuning: Tuning): string {
  return tuning.map(pitchName).join(' ');
}

/**
 * Changes the string count at the low end and keeps every remaining string's pitch. New strings
 * go a perfect 4th below the current lowest: E standard gains B, then F♯.
 */
export function resizeTuning(tuning: Tuning, count: number): Midi[] {
  const n = clampStringCount(count);
  if (n <= tuning.length) return tuning.slice(tuning.length - n);
  const added: Midi[] = [];
  let lowest = tuning.length > 0 ? tuning[0] : 40;
  for (let i = tuning.length; i < n; i++) {
    lowest -= 5;
    added.unshift(lowest);
  }
  return [...added, ...tuning];
}

/** Re-indexes positions after `delta` strings were added (positive) or removed (negative) at the low end. */
export function shiftStrings(positions: readonly FretPosition[], delta: number, stringCount: number): FretPosition[] {
  return positions
    .map((p) => ({ string: p.string + delta, fret: p.fret }))
    .filter((p) => p.string >= 0 && p.string < stringCount);
}

export function pitchAt(tuning: Tuning, string: number, fret: number): Midi {
  const open = tuning[string];
  if (open === undefined) throw new RangeError(`No string ${string} in a ${tuning.length}-string tuning`);
  return open + fret;
}

export function pcAt(tuning: Tuning, string: number, fret: number): PitchClass {
  return pcOf(pitchAt(tuning, string, fret));
}

export function positionKey(position: FretPosition): string {
  return `${position.string}:${position.fret}`;
}

/**
 * A click on the fretboard: removes a clicked note, moves the note on that string if it has one, and
 * otherwise adds the note. Returns null when the chord already has MAX_CHORD_NOTES notes.
 */
export function toggleChordPosition(positions: readonly FretPosition[], position: FretPosition): FretPosition[] | null {
  const key = positionKey(position);
  if (positions.some((p) => positionKey(p) === key)) return positions.filter((p) => positionKey(p) !== key);
  const others = positions.filter((p) => p.string !== position.string);
  if (others.length >= MAX_CHORD_NOTES) return null;
  return [...others, position];
}

/** Applies the chord limits to positions saved without them: the last click on each string, then the last six clicks. */
export function limitChordPositions(positions: readonly FretPosition[]): FretPosition[] {
  const lastOnString = positions.filter((p, i) => !positions.slice(i + 1).some((later) => later.string === p.string));
  return lastOnString.slice(-MAX_CHORD_NOTES);
}

/** Every position from the open string to `fretCount` whose pitch class is in `set`, by string then fret. */
export function positionsInSet(tuning: Tuning, fretCount: number, set: PcSet): FretPosition[] {
  const out: FretPosition[] = [];
  for (let string = 0; string < tuning.length; string++) {
    for (let fret = 0; fret <= fretCount; fret++) {
      if (hasPc(set, pcAt(tuning, string, fret))) out.push({ string, fret });
    }
  }
  return out;
}

export function pitchesAt(tuning: Tuning, positions: readonly FretPosition[]): Midi[] {
  return positions.map((p) => pitchAt(tuning, p.string, p.fret));
}

export function pcSetAt(tuning: Tuning, positions: readonly FretPosition[]): PcSet {
  return pcSet(pitchesAt(tuning, positions).map(pcOf));
}

/**
 * Moves a clicked shape by `semitones`, keeping it between `lowestFret` (the capo) and `fretCount`.
 * The shape moves as a rigid block: first by the exact amount, otherwise by the nearest
 * octave-equivalent shift that keeps every note on the board. Only a shape too wide for any such
 * shift has notes wrapped one at a time, and a note with no room left on its string is dropped.
 */
export function transposePositions(
  positions: readonly FretPosition[],
  semitones: number,
  fretCount: number,
  lowestFret = 0,
): FretPosition[] {
  const fits = (shift: number) =>
    positions.every((p) => p.fret + shift >= lowestFret && p.fret + shift <= fretCount);
  const alternatives = [semitones - 12, semitones + 12, semitones - 24, semitones + 24].sort(
    (a, b) => Math.abs(a) - Math.abs(b),
  );
  for (const shift of [semitones, ...alternatives]) {
    if (fits(shift)) return positions.map((p) => ({ string: p.string, fret: p.fret + shift }));
  }
  return positions.flatMap((p) => {
    let fret = p.fret + semitones;
    while (fret > fretCount) fret -= 12;
    while (fret < lowestFret) fret += 12;
    return fret <= fretCount ? [{ string: p.string, fret }] : [];
  });
}
