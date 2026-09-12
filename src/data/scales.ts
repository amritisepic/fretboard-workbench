export interface ScaleFamilyDef {
  readonly id: string;
  readonly name: string;
  /** Semitones above the root for mode 1: ascending, starting at 0. */
  readonly intervals: readonly number[];
  /**
   * Established name for each mode (index = 0-based mode). `null` means no accepted name exists
   * and the engine generates an altered-mode name.
   */
  readonly modeNames: readonly (string | null)[];
  /** Other accepted names, keyed by 0-based mode. */
  readonly aliases?: Readonly<Record<number, readonly string[]>>;
}

const unnamed = (n: number): null[] => Array<null>(n).fill(null);

export const SCALE_FAMILIES: readonly ScaleFamilyDef[] = [
  {
    id: 'diatonic',
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    modeNames: ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'],
    aliases: { 0: ['Major'], 5: ['Natural Minor'] },
  },
  {
    id: 'melodicMinor',
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    modeNames: [
      'Melodic Minor',
      'Dorian ♭2',
      'Lydian Augmented',
      'Lydian Dominant',
      'Mixolydian ♭6',
      'Locrian ♮2',
      'Altered',
    ],
    aliases: { 0: ['Jazz Minor'], 3: ['Lydian ♭7'], 6: ['Super Locrian'] },
  },
  {
    id: 'harmonicMinor',
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    modeNames: [
      'Harmonic Minor',
      'Locrian ♮6',
      'Ionian ♯5',
      'Dorian ♯4',
      'Phrygian Dominant',
      'Lydian ♯2',
      'Altered ♭♭7',
    ],
    aliases: { 2: ['Ionian Augmented'], 3: ['Ukrainian Dorian'], 6: ['Ultralocrian'] },
  },
  {
    id: 'harmonicMajor',
    name: 'Harmonic Major',
    intervals: [0, 2, 4, 5, 7, 8, 11],
    modeNames: ['Harmonic Major', ...unnamed(6)],
  },
  {
    id: 'doubleHarmonic',
    name: 'Double Harmonic',
    intervals: [0, 1, 4, 5, 7, 8, 11],
    modeNames: ['Double Harmonic Major', null, null, 'Hungarian Minor', null, null, null],
    aliases: { 0: ['Byzantine'] },
  },
  {
    id: 'neapolitanMajor',
    name: 'Neapolitan Major',
    intervals: [0, 1, 3, 5, 7, 9, 11],
    modeNames: ['Neapolitan Major', ...unnamed(6)],
  },
  {
    id: 'neapolitanMinor',
    name: 'Neapolitan Minor',
    intervals: [0, 1, 3, 5, 7, 8, 11],
    modeNames: ['Neapolitan Minor', ...unnamed(6)],
  },
  {
    id: 'pentatonic',
    name: 'Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    modeNames: [
      'Major Pentatonic',
      'Suspended Pentatonic',
      'Blues Minor Pentatonic',
      'Blues Major Pentatonic',
      'Minor Pentatonic',
    ],
  },
  {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    modeNames: ['Blues', 'Major Blues', 'Blues mode 3', 'Blues mode 4', 'Blues mode 5', 'Blues mode 6'],
  },
  {
    id: 'wholeTone',
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    modeNames: Array<string>(6).fill('Whole Tone'),
  },
  {
    id: 'octatonic',
    name: 'Diminished',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    modeNames: Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? 'Whole-Half Diminished' : 'Half-Whole Diminished',
    ),
  },
  {
    id: 'augmented',
    name: 'Augmented',
    intervals: [0, 3, 4, 7, 8, 11],
    modeNames: Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? 'Augmented' : 'Augmented Inverse')),
  },
];
