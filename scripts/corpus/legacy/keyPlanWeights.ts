/**
 * Costs for the key in effect across a progression (`planKeys` in theory/keys.ts) and for finding the
 * keys of a progression from its chords (`findKey`). The cheapest sequence of keys wins; bonuses are
 * subtracted from the cost.
 */
export const KEY_PLAN_WEIGHTS = {
  /** Changing to another key on the same tonic: C minor → C Harmonic Major. */
  sameTonicChange: 1,
  /** Changing to a key on another tonic: a modulation. */
  tonicChange: 4,
  /**
   * A box whose reference scale has notes outside the key: a chromatic chord there. It costs more than
   * a same-tonic change and back (2, plus `modalKey` for a less common key) but less than two changes
   * of tonic (8), so the tonic moves only for about three such chords in a row, or two at the end.
   */
  chromaticScale: 3,
  /**
   * Finding the key, before any scale is chosen: times the share of a chord's tones outside the key,
   * each tone weighted by its role as in scale ranking (root 10, 3rd 8, altered 5th 8, 7th 6,
   * extension 3, perfect 5th 1). A chord wholly outside the key costs as much as a chromatic scale.
   */
  chordMisfit: 3,
  /**
   * A key other than major, minor, harmonic minor or melodic minor: C Dorian, C Harmonic Major,
   * E Neapolitan Minor. Such keys still appear when a scale needs one, but never win on a guess.
   */
  modalKey: 0.5,
  /** Each box in a key other than the preset's key, so ties stay in the preset's key. */
  awayFromHome: 0.1,
  /** Bonus when a chord is the key's tonic chord: rooted on the tonic, with a quality that suits the key. */
  tonicChord: 1,
  /** Extra bonus when that tonic chord starts the progression. */
  firstChord: 0.5,
  /** Extra bonus when it ends the progression, the strongest single sign of a key. */
  lastChord: 1,
  /** Extra bonus when a dominant (V, V7 or Vsus) leads straight into it. */
  cadence: 1,
} as const;
