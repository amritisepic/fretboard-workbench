/**
 * Scoring constants for finding the key of a progression (`findKey` in theory/keys.ts). Every major
 * and minor key is scored; the highest score wins.
 *
 *   score = fit · Σ chordFit + Σ over tonic chords (tonicChord + firstChord? + lastChord? + cadence?)
 *
 * chordFit is the share of a chord's sounding tones that lie in the key, each tone weighted by its role
 * as in scale ranking (root 10, 3rd 8, altered 5th 8, 7th 6, extension 3, perfect 5th 1).
 */
export const KEY_FINDING_WEIGHTS = {
  /** Weight of each chord's fit (0–1). */
  fit: 2,
  /** Each chord that is the key's tonic chord: rooted on the tonic, with a quality that suits the key. */
  tonicChord: 0.5,
  /** Extra when the progression starts on the tonic chord. */
  firstChord: 0.5,
  /** Extra when it ends on the tonic chord, the strongest single sign of a key. */
  lastChord: 1,
  /** Extra when a dominant (V, V7 or Vsus) moves straight to the tonic chord. */
  cadence: 0.5,
} as const;
