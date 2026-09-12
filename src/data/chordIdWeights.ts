/**
 * Scoring constants for chord identification (spec §4.2). Higher score = better name.
 *
 * The bass bonus is deliberately smaller than the omitted-5th penalty. A complete chord in
 * inversion therefore beats a reading that puts the root in the bass by leaving a tone out:
 * C E A over C is Am/C, not C6 (no 5).
 */
export const CHORD_ID_WEIGHTS = {
  /** Bonus when the candidate root is the lowest sounding note. */
  rootIsBass: 20,
  /** Penalty for a rootless reading. */
  omittedRoot: 30,
  /** Penalty for an omitted perfect 5th. */
  omittedFifth: 15,
  /** Penalty per point of chord-type complexity (1–6). */
  complexity: 4,
  /** Bonus per point of the chord type's 0–100 usage prior. */
  usage: 0.1,
  /** Bonus when the complete chord lies inside the box's reference scale. */
  diatonic: 10,
} as const;
