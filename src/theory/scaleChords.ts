/**
 * The scale wizard: a scale's notes against the chromatic octave, each note's degree counted from
 * the major scale, and the chords built on each degree by stacking every other note of the scale.
 */

import { chordName, identifyChordPcs, tensionSuffix } from './chords';
import { MAJOR_SCALE_SEMITONES, formatAccidental, mod12, pcSet, type PcSet, type PitchClass } from './pitch';
import { scaleRefContext, scaleRefIntervals, scaleRefPcSet, type ScaleRef } from './scales';
import { formatSpelled, pcOfSpelled, spellDegree, spellPc, spellScale, type SpelledPc } from './spelling';

/** The highest chord tone a stack reaches: a triad (5th) up to a 13th chord. */
export const TOP_VOICES = [5, 7, 9, 11, 13] as const;
export type TopVoice = (typeof TOP_VOICES)[number];

export interface ScaleNote {
  readonly pc: PitchClass;
  readonly spelled: SpelledPc;
  readonly name: string;
  /** 1–7, read off the spelling. */
  readonly degree: number;
  /** Alteration from the major scale's degree: −1 for ♭3. */
  readonly accidental: number;
  /** "R", "♭2", "3", "♯4". */
  readonly label: string;
}

/** A degree counted from the major scale, with the tonic as "R". */
export function degreeLabel(degree: number, accidental: number): string {
  return degree === 1 && accidental === 0 ? 'R' : formatAccidental(accidental) + degree;
}

/** The scale's notes from the tonic up, spelled as the scale spells them. */
export function scaleNotes(ref: ScaleRef): ScaleNote[] {
  const ctx = scaleRefContext(ref);
  return spellScale(ref.tonic, scaleRefIntervals(ref)).map((spelled) => {
    const pc = pcOfSpelled(spelled);
    const { degree, accidental } = spellDegree(pc, ctx);
    return { pc, spelled, name: formatSpelled(spelled), degree, accidental, label: degreeLabel(degree, accidental) };
  });
}

export interface ChromaticStep {
  readonly pc: PitchClass;
  /** Semitones above the tonic, 0–12. */
  readonly semitones: number;
  readonly name: string;
  /** The scale note on this step, or null for a note outside the scale. */
  readonly note: ScaleNote | null;
}

/** Every semitone from the tonic to the tonic an octave up. Notes outside the scale are spelled against it. */
export function chromaticOctave(ref: ScaleRef): ChromaticStep[] {
  const notes = scaleNotes(ref);
  const ctx = scaleRefContext(ref);
  const tonic = pcOfSpelled(ref.tonic);
  return Array.from({ length: 13 }, (_, semitones) => {
    const pc = mod12(tonic + semitones);
    const note = notes.find((n) => n.pc === pc) ?? null;
    return { pc, semitones, name: note ? note.name : formatSpelled(spellPc(pc, ctx)), note };
  });
}

/** Notes in a stack for a top voice: 3 for a triad up to 7 for a 13th chord. */
export function stackSize(topVoice: TopVoice): number {
  return (topVoice + 1) / 2;
}

/**
 * The highest top voice a scale of `noteCount` notes reaches before a stack of every other note comes
 * back to its root. An odd-sized scale passes through all its notes, an even-sized one through half of
 * them: the whole-tone scale stacks only augmented triads, the diminished scale up to 7th chords.
 */
export function maxTopVoice(noteCount: number): TopVoice {
  const distinct = noteCount % 2 === 1 ? noteCount : noteCount / 2;
  let highest: TopVoice = TOP_VOICES[0];
  for (const voice of TOP_VOICES) if (stackSize(voice) <= distinct) highest = voice;
  return highest;
}

export type StackQuality = 'major' | 'minor' | 'diminished' | 'halfDiminished' | 'augmented';

export interface StackedTone {
  readonly note: ScaleNote;
  /** 1, 3, 5, 7, 9, 11 or 13. */
  readonly chordDegree: number;
  /** Alteration from the major or perfect interval above the root: −1 for ♭3 or ♭9. */
  readonly accidental: number;
}

export interface ClassicalNumeral {
  /** Numeral with its quality sign: "viiø", "III+". */
  readonly numeral: string;
  /** The top chord tone as a figure ("7", "13"), or "" for a triad. */
  readonly figure: string;
}

export interface ScaleChord {
  readonly root: ScaleNote;
  /** Root first, then every other scale note. */
  readonly tones: readonly StackedTone[];
  readonly pcs: PcSet;
  /**
   * Null when the 3rd, 5th, 7th or a tension falls outside the usual chord qualities (a diminished
   * 3rd, a ♯♯5). Such a stack is named by chord identification instead, which may give a slash chord.
   */
  readonly quality: StackQuality | null;
  /** "Dm7", "F♯maj13(♯11)", "Am/C". */
  readonly name: string;
  /** Numeral with the chord's suffix, accidentals counted from the major scale: "♭VImaj7", "iiø7". */
  readonly jazz: string;
  /** Accidentals counted from the scale's own degrees (from major for scales without 7 notes). */
  readonly classical: ClassicalNumeral;
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const TRIADS = new Map<string, { readonly quality: StackQuality; readonly suffix: string }>([
  ['0,0', { quality: 'major', suffix: '' }],
  ['-1,0', { quality: 'minor', suffix: 'm' }],
  ['-1,-1', { quality: 'diminished', suffix: 'dim' }],
  ['0,1', { quality: 'augmented', suffix: 'aug' }],
]);

const SEVENTHS = new Map<string, { readonly quality: StackQuality; readonly suffix: string }>([
  ['major:0', { quality: 'major', suffix: 'maj7' }],
  ['major:-1', { quality: 'major', suffix: '7' }],
  ['minor:0', { quality: 'minor', suffix: 'm(maj7)' }],
  ['minor:-1', { quality: 'minor', suffix: 'm7' }],
  ['diminished:-1', { quality: 'halfDiminished', suffix: 'm7♭5' }],
  ['diminished:-2', { quality: 'diminished', suffix: 'dim7' }],
  ['diminished:0', { quality: 'diminished', suffix: 'dim(maj7)' }],
  ['augmented:0', { quality: 'augmented', suffix: 'maj7♯5' }],
  ['augmented:-1', { quality: 'augmented', suffix: '7♯5' }],
]);

const MARKS: Readonly<Record<StackQuality, string>> = {
  major: '',
  minor: '',
  diminished: '°',
  halfDiminished: 'ø',
  augmented: '+',
};

function toneAccidental(root: PitchClass, pc: PitchClass, chordDegree: number): number {
  const offset = mod12(pc - root - MAJOR_SCALE_SEMITONES[(chordDegree - 1) % 7]);
  return offset > 6 ? offset - 12 : offset;
}

const toneLabel = (tone: StackedTone) => formatAccidental(tone.accidental) + tone.chordDegree;

/**
 * The quality and symbol suffix of a stack built from ordinary thirds, or null. Tensions follow the
 * workbench's tension-chord names (tensionSuffix): a natural 9th stacks into the symbol, others go in
 * parentheses. A diminished 7th keeps its tensions in parentheses: dim7(9).
 */
function regularSymbol(tones: readonly StackedTone[]): { readonly quality: StackQuality; readonly suffix: string } | null {
  const accidentalOf = (degree: number) => tones.find((t) => t.chordDegree === degree)?.accidental;
  const triad = TRIADS.get(`${accidentalOf(3)},${accidentalOf(5)}`);
  if (!triad || tones.length === 3) return triad ?? null;
  const seventh = SEVENTHS.get(`${triad.quality}:${accidentalOf(7)}`);
  if (!seventh) return null;
  const tensions = tones.slice(4);
  if (tensions.some((t) => Math.abs(t.accidental) > 1)) return null;
  if (tensions.length === 0) return seventh;
  const labels = tensions.map(toneLabel);
  const suffix = seventh.suffix === 'dim7' ? `dim7(${labels.join(',')})` : tensionSuffix(seventh.suffix, labels);
  // One set of parentheses: m(maj11)(♭13) reads m(maj11,♭13).
  return { quality: seventh.quality, suffix: suffix.replace(/\)\(([^)]*)\)$/, ',$1)') };
}

/** "(maj11,♭13)" → "maj11(♭13)": the major 7th leaves the parentheses once no quality letter precedes it. */
const unwrapMajor = (text: string) =>
  text.replace(/^\((maj[^,)]*)(?:,([^)]*))?\)/, (_match, major: string, rest: string | undefined) =>
    rest ? `${major}(${rest})` : major,
  );

/** The symbol suffix as it follows a numeral whose case and sign already show the quality: m7 → 7, m7♭5 → 7. */
function jazzSuffix(suffix: string, quality: StackQuality): string {
  switch (quality) {
    case 'minor':
      return suffix.startsWith('m(maj') ? unwrapMajor(suffix.slice(1)) : suffix.replace(/^m/, '');
    case 'halfDiminished':
      return suffix.replace(/^m/, '').replace('♭5', '');
    case 'diminished':
      return unwrapMajor(suffix.replace(/^dim/, ''));
    case 'augmented':
      return suffix.replace(/^aug/, '').replace('♯5', '');
    default:
      return suffix;
  }
}

function numeral(root: ScaleNote, lower: boolean, accidental: number): string {
  const roman = NUMERALS[(root.degree - 1) % 7];
  return formatAccidental(accidental) + (lower ? roman.toLowerCase() : roman);
}

/**
 * The chord on each degree of the scale: its root, then every other scale note up to `topVoice`
 * (capped at maxTopVoice). Regular stacks are named from their thirds (Cmaj13, Em7(♭9,11,♭13));
 * others by the workbench's chord identification with the degree in the bass.
 */
export function harmonizeScale(ref: ScaleRef, topVoice: TopVoice): ScaleChord[] {
  const notes = scaleNotes(ref);
  const count = notes.length;
  const size = Math.min(stackSize(topVoice), stackSize(maxTopVoice(count)));
  const ctx = scaleRefContext(ref);
  const scalePcs = scaleRefPcSet(ref);
  const heptatonic = count === 7;

  return notes.map((root, i): ScaleChord => {
    const tones = Array.from({ length: size }, (_, k): StackedTone => {
      const note = notes[(i + 2 * k) % count];
      const chordDegree = 2 * k + 1;
      return { note, chordDegree, accidental: toneAccidental(root.pc, note.pc, chordDegree) };
    });
    const pcs = pcSet(tones.map((t) => t.note.pc));
    const figure = size > 3 ? String(tones[tones.length - 1].chordDegree) : '';
    const classicalAccidental = heptatonic ? 0 : root.accidental;

    const regular = regularSymbol(tones);
    if (regular) {
      const { quality, suffix } = regular;
      const lower = quality === 'minor' || quality === 'diminished' || quality === 'halfDiminished';
      return {
        root,
        tones,
        pcs,
        quality,
        name: root.name + suffix,
        jazz: numeral(root, lower, root.accidental) + MARKS[quality] + jazzSuffix(suffix, quality),
        classical: { numeral: numeral(root, lower, classicalAccidental) + MARKS[quality], figure },
      };
    }

    const lower = tones[1].accidental < 0;
    const [candidate] = identifyChordPcs(pcs, root.pc, { scale: scalePcs });
    const name = candidate ? chordName(candidate, ctx) : `${root.name}(${tones.slice(1).map(toneLabel).join(',')})`;
    return {
      root,
      tones,
      pcs,
      quality: null,
      name,
      jazz: numeral(root, lower, root.accidental),
      classical: { numeral: numeral(root, lower, classicalAccidental), figure },
    };
  });
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "viiø" + "7" → "viiø⁷", for plain-text uses of a classical numeral. */
export function classicalText({ numeral: text, figure }: ClassicalNumeral): string {
  return text + [...figure].map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit).join('');
}
