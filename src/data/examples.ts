import type { VoicingStyle } from '../theory/voicing';

/**
 * The built-in example progressions listed under Examples in the presets panel. Each writes one chord
 * per box, so a chord held for several bars appears once; repeated sections of a standard are written
 * out. Standards use the changes commonly played from lead sheets. Chords and titles only, no melodies.
 */
export interface ExampleProgression {
  readonly name: string;
  /** "C major", "A minor", "D Dorian": a tonic and a mode of the major scale. */
  readonly key: string;
  /** Chord symbols separated by spaces; "|" marks a section and is ignored. */
  readonly chords: string;
}

export interface ExampleFolder {
  readonly name: string;
  /** Open-position strummed shapes for pop and rock, four-note mid-neck voicings for jazz. */
  readonly style: VoicingStyle;
  readonly examples: readonly ExampleProgression[];
}

export const EXAMPLE_FOLDERS: readonly ExampleFolder[] = [
  {
    name: 'Pop progressions',
    style: 'open',
    examples: [
      { name: 'I–V–vi–IV', key: 'G major', chords: 'G D Em C' },
      { name: 'vi–IV–I–V', key: 'C major', chords: 'Am F C G' },
      { name: 'IV–I–V–vi', key: 'C major', chords: 'F C G Am' },
      { name: 'I–vi–IV–V (’50s progression)', key: 'C major', chords: 'C Am F G' },
      { name: 'I–vi–ii–V', key: 'C major', chords: 'C Am Dm G7' },
      { name: 'I–VI7–ii–V7', key: 'C major', chords: 'C A7 Dm G7' },
      { name: 'I–IV–vi–V', key: 'G major', chords: 'G C Em D' },
      { name: 'I–iii–IV–V', key: 'C major', chords: 'C Em F G' },
      { name: 'vi–ii–V–I (circle of fifths)', key: 'C major', chords: 'Am Dm G C' },
      { name: 'IV–V–I', key: 'G major', chords: 'C D G' },
      { name: 'I–IV loop', key: 'D major', chords: 'D G' },
      { name: 'I–V/7–vi–IV (descending bass)', key: 'C major', chords: 'C G/B Am F' },
      { name: 'Pachelbel’s Canon', key: 'D major', chords: 'D A Bm F♯m G D G A' },
      { name: 'IVmaj7–V7–iii7–vi (Royal Road)', key: 'C major', chords: 'Fmaj7 G7 Em7 Am' },
      { name: 'IVmaj7–III7–vi7 (Just the Two of Us)', key: 'A♭ major', chords: 'D♭maj7 C7 Fm7 E♭m7 A♭7' },
      { name: 'I–II7–IV–I', key: 'D major', chords: 'D E7 G D' },
      { name: 'I–III–IV–iv', key: 'G major', chords: 'G B C Cm' },
      { name: 'I–IV–iv–I (minor plagal)', key: 'C major', chords: 'C F Fm C' },
      { name: '♭VI–♭VII–I', key: 'C major', chords: 'C A♭ B♭ C' },
      { name: 'i–♭VI–♭III–♭VII', key: 'A minor', chords: 'Am F C G' },
      { name: 'Ascending line cliché', key: 'C major', chords: 'C Caug C6 C7' },
    ],
  },
  {
    name: 'Rock progressions',
    style: 'open',
    examples: [
      { name: 'I–IV–V', key: 'E major', chords: 'E A B' },
      { name: 'I–IV–V–IV', key: 'A major', chords: 'A D E D' },
      { name: 'I–IV–v–IV', key: 'A major', chords: 'A D Em D' },
      { name: '12-bar blues', key: 'A major', chords: 'A7 D7 A7 | E7 D7 A7 E7' },
      { name: '12-bar blues, quick change', key: 'E major', chords: 'E7 A7 E7 | A7 E7 | B7 A7 E7 B7' },
      { name: 'Minor 12-bar blues', key: 'A minor', chords: 'Am Dm Am | E7 Dm Am E7' },
      { name: 'V–IV–I', key: 'A major', chords: 'E D A' },
      { name: 'I–♭VII–IV (Mixolydian)', key: 'D Mixolydian', chords: 'D C G' },
      { name: '♭VII–IV–I (double plagal)', key: 'G major', chords: 'F C G' },
      { name: 'I–♭III–IV', key: 'E major', chords: 'E G A' },
      { name: 'I7♯9–♭III–IV', key: 'E major', chords: 'E7♯9 G A' },
      { name: 'i–♭VII–♭VI–V (Andalusian cadence)', key: 'A minor', chords: 'Am G F E' },
      { name: 'i–♭VI–♭VII', key: 'E minor', chords: 'Em C D' },
      { name: 'i–♭VII–♭VI–♭VII', key: 'A minor', chords: 'Am G F G' },
      { name: 'i–iv–v', key: 'A minor', chords: 'Am Dm Em' },
      { name: 'Power chords: i–♭VI–♭III–♭VII', key: 'E minor', chords: 'E5 C5 G5 D5' },
      { name: 'i–♭II (Phrygian)', key: 'E Phrygian', chords: 'E5 F5' },
      { name: 'i7–IV9 (Dorian vamp)', key: 'A Dorian', chords: 'Am7 D9' },
      { name: 'Suspended chords', key: 'D major', chords: 'Dsus4 D Dsus2 D' },
    ],
  },
  {
    name: 'Jazz progressions',
    style: 'jazz',
    examples: [
      { name: 'ii–V–I', key: 'C major', chords: 'Dm7 G7 Cmaj7' },
      { name: 'Minor ii–V–i', key: 'C minor', chords: 'Dm7♭5 G7♭9 Cm6' },
      { name: 'I–vi–ii–V', key: 'C major', chords: 'Cmaj7 Am7 Dm7 G7' },
      { name: 'iii–VI7–ii–V–I', key: 'C major', chords: 'Em7 A7 Dm7 G7 Cmaj7' },
      { name: 'III7–VI7–II7–V7–I', key: 'C major', chords: 'E7 A7 D7 G7 Cmaj7' },
      { name: 'I–♭III7–ii–♭II7', key: 'C major', chords: 'Cmaj7 E♭7 Dm7 D♭7' },
      { name: 'ii–♭II7–I (tritone substitute)', key: 'C major', chords: 'Dm7 D♭7 Cmaj7' },
      { name: 'iv–♭VII7–I (backdoor)', key: 'C major', chords: 'Fm7 B♭7 Cmaj7' },
      { name: 'Descending ii–V chain', key: 'C major', chords: 'Em7 A7 E♭m7 A♭7 Dm7 G7 Cmaj7' },
      { name: 'Diminished passing chords', key: 'C major', chords: 'Cmaj7 C♯°7 Dm7 D♯°7 Em7 A7 Dm7 G7' },
      { name: 'Lady Bird turnaround', key: 'C major', chords: 'Cmaj7 E♭maj7 A♭maj7 D♭maj7 Cmaj7' },
      { name: 'Coltrane changes', key: 'C major', chords: 'Dm7 E♭7 A♭maj7 B7 Emaj7 G7 Cmaj7' },
      { name: 'ii–V–I into the relative minor', key: 'B♭ major', chords: 'Cm7 F7 B♭maj7 E♭maj7 Am7♭5 D7 Gm6' },
      {
        name: 'Rhythm changes, A section',
        key: 'B♭ major',
        chords: 'B♭6 G7 Cm7 F7 Dm7 G7 Cm7 F7 | Fm7 B♭7 E♭maj7 A♭7 Dm7 G7 Cm7 F7',
      },
      { name: 'Rhythm changes, bridge', key: 'B♭ major', chords: 'D7 G7 C7 F7' },
      { name: 'Montgomery–Ward bridge', key: 'C major', chords: 'C7 Fmaj7 D7 G7' },
      { name: 'Jazz blues', key: 'F major', chords: 'F7 B♭7 F7 Cm7 F7 | B♭7 B°7 F7 D7 | Gm7 C7 F7 D7 Gm7 C7' },
      { name: 'Minor blues', key: 'C minor', chords: 'Cm7 Fm7 Cm7 | Dm7♭5 G7♭9 Cm7 Dm7♭5 G7♭9' },
      { name: 'Minor line cliché', key: 'A minor', chords: 'Am Am(maj7) Am7 Am6' },
      { name: 'i7–IV7 (Dorian vamp)', key: 'D Dorian', chords: 'Dm7 G7' },
    ],
  },
  {
    name: 'Jazz standards',
    style: 'jazz',
    examples: [
      {
        name: 'All Blues',
        key: 'G Mixolydian',
        chords: 'G7 Gm7 G7 | D7♯9 E♭7♯9 D7♯9 G7',
      },
      {
        name: 'All the Things You Are',
        key: 'A♭ major',
        chords:
          'Fm7 B♭m7 E♭7 A♭maj7 D♭maj7 Dm7 G7 Cmaj7 | Cm7 Fm7 B♭7 E♭maj7 A♭maj7 Am7 D7 Gmaj7 | ' +
          'Am7 D7 Gmaj7 F♯m7 B7 Emaj7 C7♯5 | Fm7 B♭m7 E♭7 A♭maj7 D♭maj7 D♭m7 G♭7 Cm7 B°7 B♭m7 E♭7 A♭maj7 Gm7♭5 C7',
      },
      {
        name: 'Autumn Leaves',
        key: 'G minor',
        chords:
          'Cm7 F7 B♭maj7 E♭maj7 Am7♭5 D7 Gm6 | Cm7 F7 B♭maj7 E♭maj7 Am7♭5 D7 Gm6 | ' +
          'Am7♭5 D7 Gm6 Cm7 F7 B♭maj7 E♭maj7 | Am7♭5 D7 Gm7 C7 Fm7 B♭7 E♭maj7 Am7♭5 D7 Gm6',
      },
      {
        name: 'Blue Bossa',
        key: 'C minor',
        chords: 'Cm7 Fm7 Dm7♭5 G7♭9 Cm7 | E♭m7 A♭7 D♭maj7 | Dm7♭5 G7♭9 Cm7 Dm7♭5 G7♭9',
      },
      {
        name: 'Blues for Alice',
        key: 'F major',
        chords: 'Fmaj7 Em7♭5 A7♭9 Dm7 G7 Cm7 F7 | B♭7 B♭m7 E♭7 Am7 D7 A♭m7 D♭7 | Gm7 C7 Fmaj7 D7 Gm7 C7',
      },
      { name: 'Cantaloupe Island', key: 'F Dorian', chords: 'Fm7 D♭7 Dm7 Fm7' },
      { name: 'Chameleon', key: 'B♭ Dorian', chords: 'B♭m7 E♭7' },
      { name: 'Equinox', key: 'C♯ minor', chords: 'C♯m7 F♯m7 C♯m7 | A7 G♯7 C♯m7' },
      {
        name: 'Fly Me to the Moon',
        key: 'C major',
        chords:
          'Am7 Dm7 G7 Cmaj7 C7 Fmaj7 Bm7♭5 E7 Am7 A7 | Dm7 G7 Cmaj7 Am7 Dm7 G7 Cmaj7 Bm7♭5 E7 | ' +
          'Am7 Dm7 G7 Cmaj7 C7 Fmaj7 Bm7♭5 E7 Am7 A7 | Dm7 G7 Em7 A7 Dm7 G7 C6',
      },
      { name: 'Freddie Freeloader', key: 'B♭ major', chords: 'B♭7 E♭7 B♭7 | E♭7 B♭7 | F7 E♭7 A♭7 B♭7' },
      {
        name: 'Giant Steps',
        key: 'B major',
        chords:
          'Bmaj7 D7 Gmaj7 B♭7 E♭maj7 Am7 D7 | Gmaj7 B♭7 E♭maj7 F♯7 Bmaj7 Fm7 B♭7 | ' +
          'E♭maj7 Am7 D7 Gmaj7 C♯m7 F♯7 | Bmaj7 Fm7 B♭7 E♭maj7 C♯m7 F♯7',
      },
      {
        name: 'Lady Bird',
        key: 'C major',
        chords: 'Cmaj7 Fm7 B♭7 Cmaj7 B♭m7 E♭7 | A♭maj7 Am7 D7 Dm7 G7 | Cmaj7 E♭maj7 A♭maj7 D♭maj7',
      },
      {
        name: 'Misty',
        key: 'E♭ major',
        chords:
          'E♭maj7 B♭m7 E♭7 A♭maj7 A♭m7 D♭7 E♭maj7 Cm7 Fm7 B♭7 Gm7 C7 Fm7 B♭7 | ' +
          'E♭maj7 B♭m7 E♭7 A♭maj7 A♭m7 D♭7 E♭maj7 Cm7 Fm7 B♭7 E♭6 | ' +
          'B♭m7 E♭7 A♭maj7 Am7 D7 Gm7 C7 Fm7 B♭7 | ' +
          'E♭maj7 B♭m7 E♭7 A♭maj7 A♭m7 D♭7 E♭maj7 Cm7 Fm7 B♭7 E♭6',
      },
      { name: 'Mr. P.C.', key: 'C minor', chords: 'Cm7 Fm7 Cm7 | A♭7 G7 Cm7' },
      {
        name: 'Satin Doll',
        key: 'C major',
        chords:
          'Dm7 G7 Dm7 G7 Em7 A7 Em7 A7 Am7 D7 A♭m7 D♭7 Cmaj7 | ' +
          'Dm7 G7 Dm7 G7 Em7 A7 Em7 A7 Am7 D7 A♭m7 D♭7 Cmaj7 | ' +
          'Gm7 C7 Gm7 C7 Fmaj7 Am7 D7 Am7 D7 Dm7 G7 | ' +
          'Dm7 G7 Dm7 G7 Em7 A7 Em7 A7 Am7 D7 A♭m7 D♭7 Cmaj7',
      },
      { name: 'So What', key: 'D Dorian', chords: 'Dm7 | E♭m7 | Dm7' },
      {
        name: 'Solar',
        key: 'C minor',
        chords: 'Cm(maj7) Gm7 C7 Fmaj7 | Fm7 B♭7 E♭maj7 E♭m7 A♭7 D♭maj7 Dm7♭5 G7',
      },
      {
        name: 'Song for My Father',
        key: 'F minor',
        chords: 'Fm7 E♭7 D♭7 C7 Fm7 | E♭7 D♭7 C7 Fm7 | E♭7 Fm7 E♭7 D♭7 C7 Fm7',
      },
      {
        name: 'Stella by Starlight',
        key: 'B♭ major',
        chords:
          'Em7♭5 A7 Cm7 F7 Fm7 B♭7 E♭maj7 A♭7 | B♭maj7 Em7♭5 A7 Dm7 B♭m7 E♭7 Fmaj7 Em7♭5 A7 Am7♭5 D7 | ' +
          'G7♯5 Cm7 A♭7 B♭maj7 | Em7♭5 A7 Dm7♭5 G7 Cm7♭5 F7 B♭maj7',
      },
      {
        name: 'Take the “A” Train',
        key: 'C major',
        chords: 'C6 D7♭5 Dm7 G7 C6 Dm7 G7 | C6 D7♭5 Dm7 G7 C6 | Fmaj7 F6 D7 Dm7 G7 | C6 D7♭5 Dm7 G7 C6',
      },
      {
        name: 'The Girl from Ipanema',
        key: 'F major',
        chords:
          'Fmaj7 G7 Gm7 G♭7 Fmaj7 G♭7 | Fmaj7 G7 Gm7 G♭7 Fmaj7 | ' +
          'G♭maj7 B7 F♯m7 D7 Gm7 E♭7 Am7 D7♭9 Gm7 C7♭9 | Fmaj7 G7 Gm7 G♭7 Fmaj7',
      },
      {
        name: 'Tune Up',
        key: 'D major',
        chords: 'Em7 A7 Dmaj7 Dm7 G7 Cmaj7 | Cm7 F7 B♭maj7 E♭maj7 Em7 A7 Dmaj7',
      },
    ],
  },
];
