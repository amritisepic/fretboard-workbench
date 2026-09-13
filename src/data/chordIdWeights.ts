/**
 * Scoring constants for chord identification (spec §4.2). Higher score = better name.
 *
 * With three notes, the bass bonus is deliberately smaller than the omitted-5th penalty. A complete
 * triad in inversion therefore beats a reading that puts the root in the bass by leaving a tone out:
 * C E A over C is Am/C, not C6 (no 5). From four notes up, leaving out the 5th is how seventh and
 * extended chords are normally voiced, so it costs little: C E♭ F B♭ over C is Cm7(11), not F7sus4/C.
 */
export const CHORD_ID_WEIGHTS = {
  /** Bonus when the candidate root is the lowest sounding note. */
  rootIsBass: 20,
  /** Penalty for a rootless reading. */
  omittedRoot: 30,
  /** Penalty for an omitted perfect 5th when fewer than `voicingSize` pitch classes sound. */
  omittedFifth: 15,
  /** Penalty for an omitted perfect 5th when at least `voicingSize` pitch classes sound. */
  omittedFifthInVoicing: 4,
  /** Pitch classes from which leaving out the 5th counts as a normal voicing. */
  voicingSize: 4,
  /** Penalty per point of chord-type complexity. */
  complexity: 4,
  /** Bonus per point of the chord type's 0–100 usage prior. */
  usage: 0.1,
  /** Bonus when the complete chord lies inside the box's reference scale. */
  diatonic: 10,
} as const;
