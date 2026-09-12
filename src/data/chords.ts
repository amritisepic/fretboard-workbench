export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dominant'
  | 'diminished'
  | 'halfDiminished'
  | 'augmented'
  | 'suspended'
  | 'power';

export interface ChordTypeDef {
  readonly id: string;
  readonly name: string;
  /** Appended to the root name: "" → C, "m7" → Cm7. */
  readonly suffix: string;
  /** Chord tones as degree labels above the root; intervals are derived from these. */
  readonly degrees: readonly string[];
  readonly quality: ChordQuality;
  /** 1 = plain triad … 6 = upper-structure chord. Lower is simpler. */
  readonly complexity: number;
  /** Curated 0–100 prior for how commonly the symbol is used. */
  readonly usage: number;
}

export const CHORD_TYPE_DEFS: readonly ChordTypeDef[] = [
  { id: 'maj', name: 'major', suffix: '', degrees: ['1', '3', '5'], quality: 'major', complexity: 1, usage: 100 },
  { id: 'min', name: 'minor', suffix: 'm', degrees: ['1', '♭3', '5'], quality: 'minor', complexity: 1, usage: 100 },
  { id: 'dim', name: 'diminished', suffix: 'dim', degrees: ['1', '♭3', '♭5'], quality: 'diminished', complexity: 2, usage: 55 },
  { id: 'aug', name: 'augmented', suffix: 'aug', degrees: ['1', '3', '♯5'], quality: 'augmented', complexity: 2, usage: 40 },
  { id: 'sus2', name: 'suspended second', suffix: 'sus2', degrees: ['1', '2', '5'], quality: 'suspended', complexity: 2, usage: 50 },
  { id: 'sus4', name: 'suspended fourth', suffix: 'sus4', degrees: ['1', '4', '5'], quality: 'suspended', complexity: 2, usage: 60 },
  { id: 'power', name: 'power chord', suffix: '5', degrees: ['1', '5'], quality: 'power', complexity: 1, usage: 60 },

  { id: '6', name: 'major sixth', suffix: '6', degrees: ['1', '3', '5', '6'], quality: 'major', complexity: 3, usage: 55 },
  { id: 'm6', name: 'minor sixth', suffix: 'm6', degrees: ['1', '♭3', '5', '6'], quality: 'minor', complexity: 3, usage: 40 },
  { id: '7', name: 'dominant seventh', suffix: '7', degrees: ['1', '3', '5', '♭7'], quality: 'dominant', complexity: 2, usage: 90 },
  { id: 'maj7', name: 'major seventh', suffix: 'maj7', degrees: ['1', '3', '5', '7'], quality: 'major', complexity: 2, usage: 85 },
  { id: 'm7', name: 'minor seventh', suffix: 'm7', degrees: ['1', '♭3', '5', '♭7'], quality: 'minor', complexity: 2, usage: 90 },
  { id: 'mMaj7', name: 'minor-major seventh', suffix: 'm(maj7)', degrees: ['1', '♭3', '5', '7'], quality: 'minor', complexity: 4, usage: 25 },
  { id: 'm7b5', name: 'half-diminished seventh', suffix: 'm7♭5', degrees: ['1', '♭3', '♭5', '♭7'], quality: 'halfDiminished', complexity: 3, usage: 60 },
  { id: 'dim7', name: 'diminished seventh', suffix: 'dim7', degrees: ['1', '♭3', '♭5', '♭♭7'], quality: 'diminished', complexity: 3, usage: 50 },
  { id: '7s5', name: 'augmented seventh', suffix: '7♯5', degrees: ['1', '3', '♯5', '♭7'], quality: 'augmented', complexity: 4, usage: 30 },
  { id: 'maj7s5', name: 'augmented major seventh', suffix: 'maj7♯5', degrees: ['1', '3', '♯5', '7'], quality: 'augmented', complexity: 5, usage: 15 },
  { id: '7b5', name: 'dominant seventh flat five', suffix: '7♭5', degrees: ['1', '3', '♭5', '♭7'], quality: 'dominant', complexity: 5, usage: 15 },
  { id: '7sus4', name: 'dominant seventh suspended fourth', suffix: '7sus4', degrees: ['1', '4', '5', '♭7'], quality: 'suspended', complexity: 3, usage: 45 },
  { id: 'add9', name: 'added ninth', suffix: 'add9', degrees: ['1', '3', '5', '9'], quality: 'major', complexity: 3, usage: 45 },
  { id: 'madd9', name: 'minor added ninth', suffix: 'm(add9)', degrees: ['1', '♭3', '5', '9'], quality: 'minor', complexity: 4, usage: 30 },

  { id: '69', name: 'six-nine', suffix: '6/9', degrees: ['1', '3', '5', '6', '9'], quality: 'major', complexity: 4, usage: 30 },
  { id: 'm69', name: 'minor six-nine', suffix: 'm6/9', degrees: ['1', '♭3', '5', '6', '9'], quality: 'minor', complexity: 5, usage: 15 },
  { id: '9', name: 'dominant ninth', suffix: '9', degrees: ['1', '3', '5', '♭7', '9'], quality: 'dominant', complexity: 3, usage: 60 },
  { id: 'maj9', name: 'major ninth', suffix: 'maj9', degrees: ['1', '3', '5', '7', '9'], quality: 'major', complexity: 3, usage: 50 },
  { id: 'm9', name: 'minor ninth', suffix: 'm9', degrees: ['1', '♭3', '5', '♭7', '9'], quality: 'minor', complexity: 3, usage: 50 },
  { id: '7b9', name: 'dominant flat nine', suffix: '7♭9', degrees: ['1', '3', '5', '♭7', '♭9'], quality: 'dominant', complexity: 4, usage: 40 },
  { id: '7s9', name: 'dominant sharp nine', suffix: '7♯9', degrees: ['1', '3', '5', '♭7', '♯9'], quality: 'dominant', complexity: 4, usage: 40 },
  { id: '9sus4', name: 'ninth suspended fourth', suffix: '9sus4', degrees: ['1', '4', '5', '♭7', '9'], quality: 'suspended', complexity: 4, usage: 30 },
  { id: '7s11', name: 'dominant sharp eleven', suffix: '7♯11', degrees: ['1', '3', '5', '♭7', '♯11'], quality: 'dominant', complexity: 5, usage: 25 },
  { id: 'maj7s11', name: 'major seventh sharp eleven', suffix: 'maj7♯11', degrees: ['1', '3', '5', '7', '♯11'], quality: 'major', complexity: 5, usage: 30 },
  { id: '7b13', name: 'dominant flat thirteen', suffix: '7♭13', degrees: ['1', '3', '5', '♭7', '♭13'], quality: 'dominant', complexity: 5, usage: 15 },

  { id: '11', name: 'dominant eleventh', suffix: '11', degrees: ['1', '3', '5', '♭7', '9', '11'], quality: 'dominant', complexity: 5, usage: 20 },
  { id: 'm11', name: 'minor eleventh', suffix: 'm11', degrees: ['1', '♭3', '5', '♭7', '9', '11'], quality: 'minor', complexity: 4, usage: 35 },
  { id: '13', name: 'dominant thirteenth', suffix: '13', degrees: ['1', '3', '5', '♭7', '9', '13'], quality: 'dominant', complexity: 5, usage: 35 },
  { id: 'maj13', name: 'major thirteenth', suffix: 'maj13', degrees: ['1', '3', '5', '7', '9', '13'], quality: 'major', complexity: 6, usage: 15 },
  { id: 'm13', name: 'minor thirteenth', suffix: 'm13', degrees: ['1', '♭3', '5', '♭7', '9', '11', '13'], quality: 'minor', complexity: 6, usage: 15 },
];
