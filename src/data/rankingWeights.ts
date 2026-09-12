/**
 * Every tunable constant for scale ranking (spec §4.5).
 *
 *   score = fit · fitTerm − missing · missingPenalty + common · commonness + voiceLeading · voiceLeadingTerm
 *   voiceLeadingTerm = sharedToneRatio · |S ∩ P| / |S ∪ P| − motionPerVoice · minTotalMotion(S, P) / |S|
 */
export const RANKING_WEIGHTS = {
  /** Penalty for each chord tone a scale lacks, by that tone's role in the chord. */
  missingTone: {
    root: 10,
    /** Includes the 2nd or 4th of a sus chord, which stands in for the 3rd. */
    third: 8,
    /** Includes the 6th of a sixth chord. */
    seventh: 6,
    /** ♭5 or ♯5 (diminished, half-diminished, augmented, altered dominants). */
    alteredFifth: 8,
    /** 9ths, 11ths and 13ths, altered or not. */
    extension: 3,
    /** A perfect 5th carries almost no harmonic information. */
    fifth: 1,
  },
  /** A scale missing tones is tier 1 while its total missing penalty is at most this; otherwise tier 2. */
  tier1MaxMissingPenalty: 10,

  /** w_fit. fitTerm = covered / |chord| − fitSizePenalty · (|scale| − |chord|) / 12. */
  fit: 20,
  fitSizePenalty: 1,
  /** w_missing. */
  missing: 3,
  /** w_common (commonness is 0–100). */
  common: 0.1,
  /**
   * w_vl, a and b. Test 7 constrains them: moving a 7-note scale's D♭ to D when the previous scale
   * has D but not D♭ raises the shared-tone ratio by at least 0.106, and can add at most 1/7 to
   * the motion per voice. So a·0.106 − b/7 must exceed (commonness gap · w_common) / w_vl, where
   * the gap is Locrian 60 − Locrian ♮2 50 = 10. With a = 3, b = 1, w_vl = 10: 0.175 > 0.1.
   */
  voiceLeading: 10,
  /** a: weight of the shared-tone ratio. */
  sharedToneRatio: 3,
  /** b: weight of the average semitone motion per voice. */
  motionPerVoice: 1,

  /** Rows in the collapsed "maximally distant" section. */
  distantCount: 8,
} as const;

/** Curated 0–100 commonness priors, one per mode (0-based), keyed by scale-family id. */
export const SCALE_COMMONNESS: Readonly<Record<string, readonly number[]>> = {
  diatonic: [100, 80, 55, 65, 80, 90, 60],
  melodicMinor: [65, 30, 35, 55, 40, 50, 50],
  harmonicMinor: [65, 25, 20, 25, 55, 20, 20],
  harmonicMajor: [30, 15, 10, 15, 15, 10, 10],
  doubleHarmonic: [25, 8, 8, 20, 8, 8, 8],
  neapolitanMajor: [10, 5, 5, 5, 5, 5, 5],
  neapolitanMinor: [10, 5, 5, 5, 5, 5, 5],
  pentatonic: [80, 20, 20, 20, 90],
  blues: [85, 60, 5, 5, 5, 5],
  wholeTone: [35, 35, 35, 35, 35, 35],
  octatonic: [30, 40, 30, 40, 30, 40, 30, 40],
  augmented: [10, 10, 10, 10, 10, 10],
};
