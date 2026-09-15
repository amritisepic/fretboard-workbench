/**
 * Playable voicings for chord symbols, used to build the example progressions. A voicing has one note
 * per string with the bass lowest, every tone the chord needs (a perfect 5th may be left out of chords
 * of four or more tones), no unisons, and a hand-sized shape: fretted notes within four frets and four
 * fingers, counting a barre at the lowest fret as one. Its notes must identify as the symbol.
 *
 * "open" voicings are what pop and rock guitarists strum: first position, open strings, as many strings
 * as possible. "jazz" voicings keep to about four notes in the middle of the neck with no open strings,
 * may skip one string, and move as little as they can from the chord before.
 */

import { chordCandidateKey, identifyChord, type Omission } from './chords';
import type { ChordSymbol } from './chordSymbols';
import { pcAt, pitchAt, type FretPosition, type Tuning } from './fretboard';
import { mod12, type Midi } from './pitch';
import { pcOfSpelled } from './spelling';

export type VoicingStyle = 'open' | 'jazz';

export interface Voicing {
  /** In string order, bass first. */
  readonly positions: readonly FretPosition[];
  /** The reading the notes identify as (chordCandidateKey): the symbol's root and type. */
  readonly chordKey: string;
}

/** Voicings stay on a 12-fret board. */
const MAX_FRET = 12;
/** Fretted notes span the lowest one and three frets above it. */
const REACH = 3;
const MAX_FINGERS = 4;
/** How many of the cheapest shapes are checked against chord identification. */
const CHECKED = 80;
/** Extra cost when the symbol is a reading of the notes but not the first one. */
const SECOND_READING = 1.5;
/** Extra cost for leaving out the 5th of a chord small enough that its name then says "(no 5)". */
const MARKED_OMISSION = 3;
/** Chords with this many tones leave out their 5th unmarked (see chordName). */
const UNMARKED_FIFTH_TONES = 5;

interface Shape {
  readonly positions: readonly FretPosition[];
  readonly pitches: readonly Midi[];
  readonly omitted: readonly Omission[];
  readonly cost: number;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * The cheapest voicing of `symbol` on `tuning` in `style`, or null when none fits (a bass outside the
 * chord, say). `previous` is the sounding pitches of the chord before, which jazz voicings stay near.
 */
export function voiceChord(
  symbol: ChordSymbol,
  tuning: Tuning,
  style: VoicingStyle,
  previous: readonly Midi[] | null = null,
): Voicing | null {
  const root = pcOfSpelled(symbol.root);
  const bass = symbol.bass ? pcOfSpelled(symbol.bass) : root;
  const { type } = symbol;
  const tones = type.intervals.map((interval) => mod12(root + interval));
  if (!tones.includes(bass)) return null;
  const optionalFifth = type.hasPerfectFifth && type.intervals.length >= 4 ? mod12(root + 7) : null;
  const required = tones.filter((pc) => pc !== optionalFifth);
  const strings = tuning.length;
  const shapes = new Map<string, Shape>();

  const cost = (positions: readonly FretPosition[], pitches: readonly Midi[], distinct: number, gaps: number) => {
    const fretted = positions.filter((p) => p.fret > 0).map((p) => p.fret);
    const lowest = fretted.length > 0 ? Math.min(...fretted) : 0;
    const highest = fretted.length > 0 ? Math.max(...fretted) : 0;
    const span = highest - lowest;
    const bassString = positions[0].string;
    const doubled = positions.length - distinct;
    if (style === 'open') {
      const opens = positions.length - fretted.length;
      const mutedAbove = strings - bassString - positions.length;
      const extraPowerNotes = type.id === 'power' ? Math.max(0, positions.length - 3) * 3 : 0;
      return highest * 1.2 + span + bassString * 1.5 + mutedAbove * 2.5 + gaps * 6 - opens * 0.8 + doubled * 0.3 + extraPowerNotes;
    }
    const size = Math.abs(positions.length - Math.max(4, required.length)) * 2;
    const motion =
      previous && previous.length > 0
        ? Math.abs(mean(pitches) - mean(previous)) * 0.35 + Math.abs(Math.max(...pitches) - Math.max(...previous)) * 0.25
        : 0;
    return Math.abs(lowest - 5) * 0.5 + span * 1.2 + bassString + size + gaps * 1.5 + doubled * 2 + motion;
  };

  const consider = (positions: readonly FretPosition[], pitches: readonly Midi[]) => {
    if (positions.length < Math.min(3, tones.length)) return;
    const present = new Set(pitches.map(mod12));
    if (!required.every((pc) => present.has(pc))) return;
    const fretted = positions.filter((p) => p.fret > 0).map((p) => p.fret);
    const lowest = Math.min(...fretted);
    if (fretted.length > MAX_FINGERS) {
      // Only a barre at the lowest fret frees enough fingers, and it stops any open string under it.
      const barredStrings = positions.filter((p) => p.fret === lowest).map((p) => p.string);
      if (barredStrings.length < 2 || fretted.length - barredStrings.length + 1 > MAX_FINGERS) return;
      const [first, last] = [barredStrings[0], barredStrings[barredStrings.length - 1]];
      if (positions.some((p) => p.fret === 0 && p.string > first && p.string < last)) return;
    }
    const gaps = positions[positions.length - 1].string - positions[0].string + 1 - positions.length;
    if (gaps > 1) return;
    const key = positions.map((p) => `${p.string}:${p.fret}`).join(',');
    if (shapes.has(key)) return;
    const omitsFifth = optionalFifth !== null && !present.has(optionalFifth);
    const marked = omitsFifth && tones.length < UNMARKED_FIFTH_TONES ? MARKED_OMISSION : 0;
    shapes.set(key, {
      positions: [...positions],
      pitches: [...pitches],
      omitted: omitsFifth ? ['5'] : [],
      cost: cost(positions, pitches, present.size, gaps) + marked,
    });
  };

  for (let bassString = 0; bassString <= strings - 2; bassString++) {
    for (let bassFret = style === 'jazz' ? 1 : 0; bassFret <= MAX_FRET; bassFret++) {
      if (pcAt(tuning, bassString, bassFret) !== bass) continue;
      const bassPitch = pitchAt(tuning, bassString, bassFret);
      const lows = bassFret === 0 ? range(1, MAX_FRET - REACH) : range(Math.max(1, bassFret - REACH), bassFret);
      for (const low of lows) {
        const frets = [...(style === 'open' ? [0] : []), ...range(low, Math.min(MAX_FRET, low + REACH))];
        const positions: FretPosition[] = [{ string: bassString, fret: bassFret }];
        const pitches: Midi[] = [bassPitch];
        const visit = (string: number) => {
          if (string === strings) {
            consider(positions, pitches);
            return;
          }
          visit(string + 1);
          for (const fret of frets) {
            const pitch = pitchAt(tuning, string, fret);
            if (pitch <= bassPitch || pitches.includes(pitch) || !tones.includes(mod12(pitch))) continue;
            positions.push({ string, fret });
            pitches.push(pitch);
            visit(string + 1);
            positions.pop();
            pitches.pop();
          }
        };
        visit(bassString + 1);
      }
    }
  }

  let best: { readonly shape: Shape; readonly chordKey: string; readonly cost: number } | null = null;
  for (const shape of [...shapes.values()].sort((a, b) => a.cost - b.cost).slice(0, CHECKED)) {
    if (best && shape.cost >= best.cost) break;
    const chordKey = chordCandidateKey(root, type.id, shape.omitted);
    const index = identifyChord(shape.pitches).findIndex((reading) => reading.key === chordKey);
    if (index === -1) continue;
    const total = shape.cost + (index === 0 ? 0 : SECOND_READING);
    if (!best || total < best.cost) best = { shape, chordKey, cost: total };
  }
  return best ? { positions: best.shape.positions, chordKey: best.chordKey } : null;
}
