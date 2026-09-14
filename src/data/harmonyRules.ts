/**
 * Rule tables for harmonic analysis (theory/analysis.ts and theory/patterns.ts). Every pattern the
 * analyzer knows is data here, so each can be read, tested and tuned on its own;
 * docs/harmonic-patterns.md describes them in words. Bonuses use the units of
 * data/analysisWeights.ts.
 */

/** A chord's quality as harmonic function sees it. */
export type FunctionQuality =
  | 'major'
  | 'minor'
  | 'dominant'
  | 'diminished'
  | 'diminished7'
  | 'halfDiminished'
  | 'augmented'
  | 'suspended'
  | 'suspendedDominant'
  | 'power';

/** The home keys a progression can be in: the diatonic modes except Locrian. */
export type KeyMode = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'lydian' | 'phrygian';

/** In tie-break order. */
export const KEY_MODES: readonly KeyMode[] = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'];

/** Each key mode as a mode of the diatonic scale family (0 = Major … 5 = Minor). */
export const KEY_MODE_INDEX: Readonly<Record<KeyMode, number>> = {
  major: 0,
  dorian: 1,
  phrygian: 2,
  lydian: 3,
  mixolydian: 4,
  minor: 5,
};

// ---------------------------------------------------------------------------
// Borrowing (modal interchange)
// ---------------------------------------------------------------------------

/**
 * The parallel modes a chord can be borrowed from, by home key, and the cost of each. A chord takes
 * the cheapest source it fits. Minor as a source includes its raised 7th on V and vii, so vii°7 in
 * a major key is borrowed from the parallel minor.
 */
export const BORROW_SOURCES: Readonly<Record<KeyMode, readonly { readonly mode: KeyMode; readonly cost: number }[]>> = {
  major: [
    { mode: 'minor', cost: 0.8 },
    // Mixolydian alone lends a major key its I7, which outside a blues is heard as V7/IV.
    { mode: 'mixolydian', cost: 1.8 },
    { mode: 'dorian', cost: 1.1 },
    { mode: 'lydian', cost: 1.3 },
    { mode: 'phrygian', cost: 1.3 },
  ],
  minor: [
    { mode: 'dorian', cost: 0.7 },
    { mode: 'major', cost: 1 },
    { mode: 'phrygian', cost: 1 },
  ],
  dorian: [
    { mode: 'minor', cost: 0.7 },
    { mode: 'major', cost: 1.1 },
    { mode: 'mixolydian', cost: 1.1 },
  ],
  mixolydian: [
    { mode: 'major', cost: 0.7 },
    { mode: 'dorian', cost: 1 },
    { mode: 'minor', cost: 1.1 },
  ],
  lydian: [
    { mode: 'major', cost: 0.7 },
    { mode: 'mixolydian', cost: 1.1 },
  ],
  phrygian: [
    { mode: 'minor', cost: 0.7 },
    { mode: 'dorian', cost: 1.1 },
  ],
};

// ---------------------------------------------------------------------------
// Cadences and progressions between neighbouring chords in one home key
// ---------------------------------------------------------------------------

export type CadenceId =
  | 'authenticCadence'
  | 'leadingToneCadence'
  | 'tritoneSubCadence'
  | 'backdoorCadence'
  | 'backdoorTwoFive'
  | 'twoFive'
  | 'predominantToDominant'
  | 'phrygianHalfCadence'
  | 'cadential64'
  | 'deceptiveCadence'
  | 'plagalCadence'
  | 'minorPlagalCadence'
  | 'modalCadence'
  | 'tonicDeparture'
  | 'descendingFifth'
  | 'retrogression';

/** A chord in a key: its root in semitones above the tonic, the qualities that count, and optionally its bass. */
export interface ChordPattern {
  readonly degree: number;
  readonly qualities: readonly FunctionQuality[];
  /** 0 root position, 1 first inversion, 2 second inversion, 3 third inversion. */
  readonly inversion?: number;
}

export interface CadenceRule {
  readonly id: CadenceId;
  readonly keys: readonly KeyMode[];
  readonly from: ChordPattern;
  readonly to: ChordPattern;
  /** Subtracted from the cost of reading both chords in that key. Negative for a cost. */
  readonly bonus: number;
  /** Named in the analysis lane; the rest only weigh the choice of key. */
  readonly shown: boolean;
}

const MAJOR_TONIC: readonly FunctionQuality[] = ['major', 'dominant', 'suspended', 'suspendedDominant', 'power'];
const MINOR_TONIC: readonly FunctionQuality[] = ['minor', 'suspended', 'power'];
const DOMINANT: readonly FunctionQuality[] = ['major', 'dominant', 'suspendedDominant', 'augmented'];
const LEADING_TONE: readonly FunctionQuality[] = ['diminished', 'diminished7', 'halfDiminished'];
const MAJOR_KEYS: readonly KeyMode[] = ['major'];
const MINOR_KEYS: readonly KeyMode[] = ['minor'];
const FUNCTIONAL_KEYS: readonly KeyMode[] = ['major', 'minor'];

const rule = (
  id: CadenceId,
  keys: readonly KeyMode[],
  from: ChordPattern,
  to: ChordPattern,
  bonus: number,
  shown = true,
): CadenceRule => ({ id, keys, from, to, bonus, shown });

const I_MAJOR: ChordPattern = { degree: 0, qualities: MAJOR_TONIC };
const I_MINOR: ChordPattern = { degree: 0, qualities: MINOR_TONIC };
const V: ChordPattern = { degree: 7, qualities: DOMINANT };

export const CADENCE_RULES: readonly CadenceRule[] = [
  // Dominant to tonic.
  rule('authenticCadence', MAJOR_KEYS, V, I_MAJOR, 1.5),
  rule('authenticCadence', MINOR_KEYS, V, I_MINOR, 1.5),
  rule('authenticCadence', MINOR_KEYS, V, { degree: 0, qualities: ['major'] }, 1), // Picardy third
  rule('leadingToneCadence', MAJOR_KEYS, { degree: 11, qualities: LEADING_TONE }, I_MAJOR, 1.2),
  rule('leadingToneCadence', MINOR_KEYS, { degree: 11, qualities: LEADING_TONE }, I_MINOR, 1.2),
  rule('tritoneSubCadence', MAJOR_KEYS, { degree: 1, qualities: ['dominant'] }, I_MAJOR, 1),
  rule('tritoneSubCadence', MINOR_KEYS, { degree: 1, qualities: ['dominant'] }, I_MINOR, 1),
  rule('backdoorCadence', MAJOR_KEYS, { degree: 10, qualities: ['dominant'] }, I_MAJOR, 1),
  rule('backdoorTwoFive', MAJOR_KEYS, { degree: 5, qualities: ['minor'] }, { degree: 10, qualities: ['dominant'] }, 0.6),

  // Predominant to dominant.
  rule('twoFive', MAJOR_KEYS, { degree: 2, qualities: ['minor'] }, V, 1),
  rule('twoFive', MINOR_KEYS, { degree: 2, qualities: ['halfDiminished', 'diminished', 'minor'] }, V, 1),
  rule('predominantToDominant', FUNCTIONAL_KEYS, { degree: 5, qualities: ['major', 'minor'] }, V, 0.8),
  rule('predominantToDominant', MINOR_KEYS, { degree: 8, qualities: ['major'] }, V, 0.5),
  rule('predominantToDominant', FUNCTIONAL_KEYS, { degree: 2, qualities: ['minor', 'halfDiminished'] }, { degree: 11, qualities: LEADING_TONE }, 0.5),
  rule('phrygianHalfCadence', MINOR_KEYS, { degree: 5, qualities: ['minor'], inversion: 1 }, { degree: 7, qualities: ['major'] }, 0.3),
  // Less than a cadence: a 6/4 over the bass of V may also be a pedal 6/4 over a tonic bass.
  rule('cadential64', MAJOR_KEYS, { degree: 0, qualities: ['major'], inversion: 2 }, V, 0.6),
  rule('cadential64', MINOR_KEYS, { degree: 0, qualities: ['minor'], inversion: 2 }, V, 0.6),

  // Deceptive and plagal.
  rule('deceptiveCadence', MAJOR_KEYS, V, { degree: 9, qualities: ['minor'] }, 0.6),
  rule('deceptiveCadence', MAJOR_KEYS, V, { degree: 8, qualities: ['major'] }, 0.3),
  rule('deceptiveCadence', MINOR_KEYS, V, { degree: 8, qualities: ['major'] }, 0.6),
  rule('plagalCadence', MAJOR_KEYS, { degree: 5, qualities: ['major'] }, I_MAJOR, 0.6),
  rule('minorPlagalCadence', MAJOR_KEYS, { degree: 5, qualities: ['minor'] }, I_MAJOR, 0.6),
  rule('plagalCadence', MINOR_KEYS, { degree: 5, qualities: ['minor'] }, I_MINOR, 0.6),

  // Modal cadences: the chords that establish a mode's tonic without a dominant.
  rule('modalCadence', ['mixolydian'], { degree: 10, qualities: ['major'] }, I_MAJOR, 1),
  rule('modalCadence', ['mixolydian'], { degree: 7, qualities: ['minor'] }, I_MAJOR, 0.8),
  rule('modalCadence', ['mixolydian'], { degree: 5, qualities: ['major'] }, I_MAJOR, 0.5),
  rule('modalCadence', ['dorian'], { degree: 5, qualities: ['major', 'dominant'] }, I_MINOR, 1),
  rule('modalCadence', ['dorian'], { degree: 2, qualities: ['minor'] }, I_MINOR, 0.5),
  rule('modalCadence', ['dorian'], { degree: 10, qualities: ['major'] }, I_MINOR, 0.5),
  rule('modalCadence', ['lydian'], { degree: 2, qualities: ['major', 'dominant'] }, I_MAJOR, 1),
  rule('modalCadence', ['phrygian'], { degree: 1, qualities: ['major'] }, I_MINOR, 1),
  rule('modalCadence', ['phrygian'], { degree: 10, qualities: ['minor'] }, I_MINOR, 0.8),
  rule('modalCadence', MINOR_KEYS, { degree: 10, qualities: ['major'] }, I_MINOR, 0.5),
  rule('tonicDeparture', ['dorian'], I_MINOR, { degree: 5, qualities: ['major', 'dominant'] }, 0.6, false),
  rule('tonicDeparture', ['mixolydian'], I_MAJOR, { degree: 10, qualities: ['major'] }, 0.6, false),
  rule('tonicDeparture', ['lydian'], I_MAJOR, { degree: 2, qualities: ['major', 'dominant'] }, 0.6, false),
  rule('tonicDeparture', ['phrygian'], I_MINOR, { degree: 1, qualities: ['major'] }, 0.6, false),

  // Leaving the tonic, and the diatonic circle of fifths.
  rule('tonicDeparture', MAJOR_KEYS, I_MAJOR, { degree: 5, qualities: ['major'] }, 0.3, false),
  rule('tonicDeparture', MAJOR_KEYS, I_MAJOR, { degree: 2, qualities: ['minor'] }, 0.3, false),
  rule('tonicDeparture', MAJOR_KEYS, I_MAJOR, V, 0.3, false),
  rule('tonicDeparture', MAJOR_KEYS, I_MAJOR, { degree: 9, qualities: ['minor'] }, 0.2, false),
  rule('tonicDeparture', MINOR_KEYS, I_MINOR, { degree: 5, qualities: ['minor'] }, 0.3, false),
  rule('tonicDeparture', MINOR_KEYS, I_MINOR, V, 0.3, false),
  rule('tonicDeparture', MINOR_KEYS, I_MINOR, { degree: 8, qualities: ['major'] }, 0.2, false),
  rule('tonicDeparture', MINOR_KEYS, I_MINOR, { degree: 10, qualities: ['major'] }, 0.2, false),
  rule('descendingFifth', MAJOR_KEYS, { degree: 9, qualities: ['minor'] }, { degree: 2, qualities: ['minor'] }, 0.4, false),
  rule('descendingFifth', MAJOR_KEYS, { degree: 4, qualities: ['minor'] }, { degree: 9, qualities: ['minor'] }, 0.4, false),
  rule('descendingFifth', MAJOR_KEYS, { degree: 11, qualities: LEADING_TONE }, { degree: 4, qualities: ['minor'] }, 0.3, false),
  rule('descendingFifth', MINOR_KEYS, { degree: 3, qualities: ['major'] }, { degree: 8, qualities: ['major'] }, 0.3, false),
  rule('descendingFifth', MINOR_KEYS, { degree: 10, qualities: ['major', 'dominant'] }, { degree: 3, qualities: ['major'] }, 0.4, false),
  rule('descendingFifth', MINOR_KEYS, { degree: 5, qualities: ['minor'] }, { degree: 10, qualities: ['major', 'dominant'] }, 0.3, false),
  rule('descendingFifth', MINOR_KEYS, { degree: 8, qualities: ['major'] }, { degree: 2, qualities: ['halfDiminished', 'diminished'] }, 0.3, false),
  // Rising by step towards the dominant: ii–iii–IV–V points at I even when I never sounds.
  rule('tonicDeparture', MAJOR_KEYS, { degree: 2, qualities: ['minor'] }, { degree: 4, qualities: ['minor'] }, 0.3, false),
  rule('tonicDeparture', MAJOR_KEYS, { degree: 4, qualities: ['minor'] }, { degree: 5, qualities: ['major'] }, 0.4, false),
  // ♭VII–IV–I, the double plagal cadence, and ♭VI–♭VII–i.
  rule('plagalCadence', ['major', 'mixolydian'], { degree: 10, qualities: ['major'] }, { degree: 5, qualities: ['major'] }, 0.5, false),
  rule('tonicDeparture', MINOR_KEYS, { degree: 8, qualities: ['major'] }, { degree: 10, qualities: ['major', 'dominant'] }, 0.4, false),
  rule('retrogression', FUNCTIONAL_KEYS, { degree: 7, qualities: ['major', 'dominant'] }, { degree: 2, qualities: ['minor', 'halfDiminished'] }, -0.3, false),
];

// ---------------------------------------------------------------------------
// Default reference scales by function (Find key)
// ---------------------------------------------------------------------------

export interface ScaleChoice {
  readonly familyId: string;
  readonly mode: number;
}

/**
 * Preferred scales on the chord root for functions whose scale isn't simply the key's own mode.
 * Find key uses the first choice that holds every chord tone, the one closest to the key on a tie,
 * and otherwise falls back to the scale closest to the key.
 */
export const FUNCTION_SCALES = {
  /** Mixolydian over a major target. */
  secondaryDominantMajor: [{ familyId: 'diatonic', mode: 4 }],
  /** Phrygian dominant or Mixolydian ♭13 over a minor target. */
  secondaryDominantMinor: [
    { familyId: 'harmonicMinor', mode: 4 },
    { familyId: 'melodicMinor', mode: 4 },
  ],
  /** Diminished (whole–half) for any diminished seventh. */
  diminishedSeventh: [{ familyId: 'octatonic', mode: 0 }],
  leadingToneHalfDiminished: [{ familyId: 'diatonic', mode: 6 }],
  relatedTwoMinor: [{ familyId: 'diatonic', mode: 1 }],
  relatedTwoHalfDiminished: [
    { familyId: 'melodicMinor', mode: 5 },
    { familyId: 'diatonic', mode: 6 },
  ],
  tritoneSub: [{ familyId: 'melodicMinor', mode: 3 }],
  /** ♭II: Lydian or major. */
  neapolitan: [
    { familyId: 'diatonic', mode: 3 },
    { familyId: 'diatonic', mode: 0 },
  ],
  /** A chromatic mediant keeps its own collection. */
  chromaticMediantMajor: [{ familyId: 'diatonic', mode: 0 }],
  chromaticMediantMinor: [{ familyId: 'diatonic', mode: 5 }],
} as const satisfies Readonly<Record<string, readonly ScaleChoice[]>>;

// ---------------------------------------------------------------------------
// Named patterns spanning several chords (theory/patterns.ts)
// ---------------------------------------------------------------------------

export type PatternId =
  | 'extendedDominants'
  | 'twoFiveChain'
  | 'turnaround'
  | 'thirdTurnaround'
  | 'taddDameron'
  | 'tritoneTurnaround'
  | 'andalusian'
  | 'mixolydianCadence'
  | 'pachelbel'
  | 'circleProgression'
  | 'ascendingFiveSix'
  | 'lineCliche'
  | 'tonicPedal'
  | 'dominantPedal'
  | 'pedalPoint'
  | 'planing'
  | 'blues'
  | 'modalVamp'
  | 'coltraneChanges'
  | 'monte'
  | 'fonte'
  | 'prinner';

export const PATTERN_NAMES: Readonly<Record<PatternId, string>> = {
  extendedDominants: 'Extended dominants',
  twoFiveChain: 'Chain of ii–Vs',
  turnaround: 'I–VI–ii–V turnaround',
  thirdTurnaround: 'iii–VI–ii–V turnaround',
  taddDameron: 'Tadd Dameron (Lady Bird) turnaround',
  tritoneTurnaround: 'Turnaround in tritone substitutes',
  andalusian: 'Andalusian cadence',
  mixolydianCadence: '♭VII–IV–I',
  pachelbel: 'Pachelbel (Romanesca) progression',
  circleProgression: 'Circle of fifths',
  ascendingFiveSix: 'Ascending 5–6 sequence',
  lineCliche: 'Line cliché',
  tonicPedal: 'Tonic pedal',
  dominantPedal: 'Dominant pedal',
  pedalPoint: 'Pedal point',
  planing: 'Planing',
  blues: 'Blues',
  modalVamp: 'Modal vamp',
  coltraneChanges: 'Coltrane changes',
  monte: 'Monte',
  fonte: 'Fonte',
  prinner: 'Prinner',
};
