/**
 * Enharmonic spelling (spec §4.1). Spelling is always derived from a scale context — a spelled
 * tonic plus the scale's intervals, optionally refined by the chord being displayed. There is no
 * sharp/flat toggle.
 *
 *  1. 7-note scales take successive letters from the tonic.
 *  2. Other scales borrow letters from the nearest diatonic parent collection that contains the
 *     tonic. A perfect 5th always takes the 5th letter. Other leftover notes become alterations
 *     of an adjacent parent degree, choosing the combination with the fewest repeated letters.
 *  3. Notes outside the scale take the smallest alteration of a scale letter, preferring letters
 *     the scale does not already use. Remaining ties go to the chord (letters stacked from the
 *     chord root, so E7 in C major gives G♯), then to the ♭2 ♭3 ♯4 ♭6 ♭7 convention.
 */

import {
  MAJOR_SCALE_SEMITONES,
  circularDistance,
  formatAccidental,
  hasPc,
  mod12,
  pcSetFromIntervals,
  transpose,
  type PcSet,
  type PitchClass,
} from './pitch';
import { compareKeys } from './util';

export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** A spelled pitch class: letter index (0 = C … 6 = B) and accidental in semitones (−2 = ♭♭ … +2 = ♯♯). */
export interface SpelledPc {
  readonly letter: number;
  readonly accidental: number;
}

export interface ChordToneHint {
  /** Semitones above the chord root. */
  readonly interval: number;
  /** Generic chord degree (1, 3, 5, 7, 9, 11, 13). */
  readonly degree: number;
}

export interface ChordSpellingHint {
  readonly root: PitchClass;
  readonly tones: readonly ChordToneHint[];
}

export interface ScaleContext {
  readonly tonic: SpelledPc;
  readonly intervals: readonly number[];
  readonly chord?: ChordSpellingHint | undefined;
}

export type EnharmonicPreference = 'sharp' | 'flat';

export function pcOfSpelled(s: SpelledPc): PitchClass {
  return mod12(MAJOR_SCALE_SEMITONES[s.letter] + s.accidental);
}

/** The accidental that makes `letter` sound as `pc`, in the range −5…+6. */
export function accidentalFor(letter: number, pc: PitchClass): number {
  const d = mod12(pc - MAJOR_SCALE_SEMITONES[letter]);
  return d > 6 ? d - 12 : d;
}

export function formatSpelled(s: SpelledPc, showNatural = false): string {
  return LETTER_NAMES[s.letter] + formatAccidental(s.accidental, showNatural);
}

/** Parses "F#", "F♯", "Gb", "G♭", "Cbb", "B♮". */
export function parseSpelled(name: string): SpelledPc {
  const match = /^([A-Ga-g])([♭b♯#♮]*)$/.exec(name.trim());
  if (!match) throw new Error(`Invalid note name: "${name}"`);
  const letter = 'CDEFGAB'.indexOf(match[1].toUpperCase());
  let accidental = 0;
  for (const ch of match[2]) {
    if (ch === '♭' || ch === 'b') accidental--;
    else if (ch === '♯' || ch === '#') accidental++;
  }
  return { letter, accidental };
}

/** Context-free fallback spellings, used only when there is no scale context at all. */
export const DEFAULT_SPELLINGS: readonly SpelledPc[] = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B',
].map(parseSpelled);

// ---------------------------------------------------------------------------
// Scale spelling (rules 1 and 2)
// ---------------------------------------------------------------------------

const scaleSpellingCache = new Map<string, readonly SpelledPc[]>();

/** Spells every note of a scale, in interval order. */
export function spellScale(tonic: SpelledPc, intervals: readonly number[]): readonly SpelledPc[] {
  const key = `${tonic.letter}:${tonic.accidental}:${intervals.join(',')}`;
  let spelled = scaleSpellingCache.get(key);
  if (!spelled) {
    spelled = Object.freeze(
      intervals.length === 7 ? spellHeptatonic(tonic, intervals) : spellByDiatonicParent(tonic, intervals),
    );
    scaleSpellingCache.set(key, spelled);
  }
  return spelled;
}

function spellHeptatonic(tonic: SpelledPc, intervals: readonly number[]): SpelledPc[] {
  const tonicPc = pcOfSpelled(tonic);
  return intervals.map((iv, i) => {
    const letter = (tonic.letter + i) % 7;
    return { letter, accidental: accidentalFor(letter, tonicPc + iv) };
  });
}

const MAJOR_MASK: PcSet = pcSetFromIntervals(MAJOR_SCALE_SEMITONES);

/** Spells a 7-note collection that contains the tonic by walking letters up from the tonic. */
function spellCollectionFromTonic(tonic: SpelledPc, collection: PcSet): Map<PitchClass, SpelledPc> {
  const tonicPc = pcOfSpelled(tonic);
  const out = new Map<PitchClass, SpelledPc>();
  let step = 0;
  for (let offset = 0; offset < 12; offset++) {
    const pc = mod12(tonicPc + offset);
    if (!hasPc(collection, pc)) continue;
    const letter = (tonic.letter + step) % 7;
    out.set(pc, { letter, accidental: accidentalFor(letter, pc) });
    step++;
  }
  return out;
}

interface SlotOption {
  readonly spelled: SpelledPc;
  /** 1 when this alteration goes against the parent collection's accidental direction. */
  readonly againstDirection: number;
}

function spellByDiatonicParent(tonic: SpelledPc, intervals: readonly number[]): SpelledPc[] {
  const tonicPc = pcOfSpelled(tonic);
  const pcs = intervals.map((iv) => mod12(tonicPc + iv));

  // Nearest parent: most shared notes, then fewest accidentals on those notes, then on the parent.
  let parent: Map<PitchClass, SpelledPc> | null = null;
  let parentKey: number[] | null = null;
  for (let root = 0; root < 12; root++) {
    const collection = transpose(MAJOR_MASK, root);
    if (!hasPc(collection, tonicPc)) continue;
    const spelling = spellCollectionFromTonic(tonic, collection);
    let shared = 0;
    let sharedAccidentals = 0;
    let parentAccidentals = 0;
    for (const s of spelling.values()) parentAccidentals += Math.abs(s.accidental);
    for (const pc of pcs) {
      const s = spelling.get(pc);
      if (s) {
        shared++;
        sharedAccidentals += Math.abs(s.accidental);
      }
    }
    const key = [-shared, sharedAccidentals, parentAccidentals];
    if (parentKey === null || compareKeys(key, parentKey) < 0) {
      parent = spelling;
      parentKey = key;
    }
  }
  if (!parent) throw new Error('unreachable: every pitch class lies in seven diatonic collections');
  const parentSpelling = parent;

  let direction = 0;
  for (const s of parentSpelling.values()) direction += s.accidental;
  const preferSharps = direction > 0;

  const fifthPc = mod12(tonicPc + 7);
  const slots: SlotOption[][] = pcs.map((pc) => {
    const own = parentSpelling.get(pc);
    if (own) return [{ spelled: own, againstDirection: 0 }];
    if (pc === fifthPc) {
      // A perfect 5th always keeps the 5th letter: F♯ blues has C♯, not D♭.
      const letter = (tonic.letter + 4) % 7;
      return [{ spelled: { letter, accidental: accidentalFor(letter, pc) }, againstDirection: 0 }];
    }
    // Diatonic gaps are at most a whole step, so both neighbours are parent degrees.
    const options: SlotOption[] = [];
    const below = parentSpelling.get(mod12(pc - 1));
    const above = parentSpelling.get(mod12(pc + 1));
    if (below && Math.abs(below.accidental + 1) <= 2) {
      options.push({
        spelled: { letter: below.letter, accidental: below.accidental + 1 },
        againstDirection: preferSharps ? 0 : 1,
      });
    }
    if (above && Math.abs(above.accidental - 1) <= 2) {
      options.push({
        spelled: { letter: above.letter, accidental: above.accidental - 1 },
        againstDirection: preferSharps ? 1 : 0,
      });
    }
    if (options.length === 0) options.push({ spelled: DEFAULT_SPELLINGS[pc], againstDirection: 0 });
    return options;
  });

  // At most five leftover notes with two options each, so exhaustive search is cheap.
  const counters = slots.map(() => 0);
  let best: SpelledPc[] = [];
  let bestKey: number[] | null = null;
  for (;;) {
    const choice = slots.map((options, i) => options[counters[i]]);
    const letterCounts = [0, 0, 0, 0, 0, 0, 0];
    let doubles = 0;
    let total = 0;
    let against = 0;
    for (const option of choice) {
      letterCounts[option.spelled.letter]++;
      const a = Math.abs(option.spelled.accidental);
      if (a >= 2) doubles++;
      total += a;
      against += option.againstDirection;
    }
    const duplicates = letterCounts.reduce((sum, c) => sum + Math.max(0, c - 1), 0);
    const key = [duplicates, doubles, total, against];
    if (bestKey === null || compareKeys(key, bestKey) < 0) {
      best = choice.map((option) => option.spelled);
      bestKey = key;
    }

    let i = 0;
    while (i < slots.length) {
      counters[i]++;
      if (counters[i] < slots[i].length) break;
      counters[i] = 0;
      i++;
    }
    if (i === slots.length) break;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Notes outside the scale (rule 3)
// ---------------------------------------------------------------------------

/** Letter offset from the tonic for each chromatic interval under the ♭2 ♭3 ♯4 ♭6 ♭7 convention. */
const CONVENTION_LETTER_OFFSET: readonly number[] = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

function spellOutsideScale(
  pc: PitchClass,
  scale: readonly SpelledPc[],
  tonic: SpelledPc,
  chordLetter: number | null,
): SpelledPc {
  const conventionLetter = (tonic.letter + CONVENTION_LETTER_OFFSET[mod12(pc - pcOfSpelled(tonic))]) % 7;
  let best: SpelledPc | null = null;
  let bestKey: number[] | null = null;
  for (let letter = 0; letter < 7; letter++) {
    const accidental = accidentalFor(letter, pc);
    if (Math.abs(accidental) > 2) continue;
    const sameLetter = scale.filter((s) => s.letter === letter);
    const alteration =
      sameLetter.length > 0
        ? Math.min(...sameLetter.map((s) => circularDistance(pc, pcOfSpelled(s))))
        : Math.abs(accidental);
    const key = [
      alteration,
      sameLetter.length > 0 ? 1 : 0,
      chordLetter === null || chordLetter === letter ? 0 : 1,
      letter === conventionLetter ? 0 : 1,
      Math.abs(accidental),
    ];
    if (bestKey === null || compareKeys(key, bestKey) < 0) {
      best = { letter, accidental };
      bestKey = key;
    }
  }
  return best ?? DEFAULT_SPELLINGS[pc];
}

/** Spells any pitch class against a scale context. */
export function spellPc(pc: PitchClass, ctx: ScaleContext): SpelledPc {
  const p = mod12(pc);
  const scale = spellScale(ctx.tonic, ctx.intervals);
  const inScale = scale.find((s) => pcOfSpelled(s) === p);
  if (inScale) return inScale;

  let chordLetter: number | null = null;
  const chord = ctx.chord;
  if (chord && mod12(chord.root) !== p) {
    const tone = chord.tones.find((t) => mod12(chord.root + t.interval) === p);
    if (tone) {
      const root = spellPc(chord.root, { tonic: ctx.tonic, intervals: ctx.intervals });
      chordLetter = (root.letter + tone.degree - 1) % 7;
    }
  }
  return spellOutsideScale(p, scale, ctx.tonic, chordLetter);
}

export function spell(pc: PitchClass, ctx: ScaleContext): string {
  return formatSpelled(spellPc(pc, ctx));
}

export interface SpelledDegree {
  readonly degree: number;
  /** Alteration relative to the major-scale degree: F in D Dorian is ♭3, F♯ in C major is ♯4. */
  readonly accidental: number;
}

/** A pitch class's scale degree above the context tonic, read off its spelling. */
export function spellDegree(pc: PitchClass, ctx: ScaleContext): SpelledDegree {
  const note = spellPc(pc, ctx);
  const degree = ((note.letter - ctx.tonic.letter + 7) % 7) + 1;
  const d = mod12(pcOfSpelled(note) - pcOfSpelled(ctx.tonic) - MAJOR_SCALE_SEMITONES[degree - 1]);
  return { degree, accidental: d > 6 ? d - 12 : d };
}

/** "1", "♭3", "♯4". */
export function formatScaleDegree(pc: PitchClass, ctx: ScaleContext): string {
  const { degree, accidental } = spellDegree(pc, ctx);
  return formatAccidental(accidental) + degree;
}

/**
 * Chooses how to spell a tonic for a scale: no accidentals beyond double, then fewest double
 * accidentals, then fewest accidentals overall. An exact tie (F♯ vs G♭ major) goes to `prefer`.
 */
export function chooseTonicSpelling(
  pc: PitchClass,
  intervals: readonly number[],
  prefer: EnharmonicPreference = 'flat',
): SpelledPc {
  let best: SpelledPc | null = null;
  let bestKey: number[] | null = null;
  for (let letter = 0; letter < 7; letter++) {
    const accidental = accidentalFor(letter, pc);
    if (Math.abs(accidental) > 1) continue;
    const tonic = { letter, accidental };
    let overflow = 0;
    let doubles = 0;
    let total = 0;
    let net = 0;
    for (const s of spellScale(tonic, intervals)) {
      const a = Math.abs(s.accidental);
      if (a > 2) overflow++;
      else if (a === 2) doubles++;
      total += a;
      net += s.accidental;
    }
    const key = [overflow, doubles, total, Math.abs(accidental), prefer === 'flat' ? net : -net];
    if (bestKey === null || compareKeys(key, bestKey) < 0) {
      best = tonic;
      bestKey = key;
    }
  }
  return best ?? DEFAULT_SPELLINGS[mod12(pc)];
}
