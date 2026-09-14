/**
 * Costs for harmonic analysis (theory/analysis.ts), which the key bar and Find key share. The analyzer
 * picks the cheapest reading of the whole progression; bonuses are subtracted from the cost. Rules
 * that name particular patterns (cadences, borrowing sources, default scales) are in
 * data/harmonyRules.ts.
 */
export const ANALYSIS_WEIGHTS = {
  // ---- Keys -------------------------------------------------------------------------------------

  /** Changing the home key to one on another tonic: a modulation (to the relative key, or a 5th away). */
  tonicChange: 3,
  /** Each note beyond the first that a modulation changes, so distant keys need more evidence (C → E: 4.5). */
  keyDistance: 0.5,
  /**
   * Changing mode on the same tonic (C major → C minor as the home key): a real modulation too. A
   * scale that only alters the key's collection changes the key shown, not the home key.
   */
  sameTonicChange: 2.5,
  /** Extra on a same-tonic change, so the key doesn't flicker between modes of one tonic. */
  modeFlicker: 1,
  /** Per box in a modal home key. Such keys still win when their tonic and cadences are clear. */
  modalKey: { major: 0, minor: 0, dorian: 0.5, mixolydian: 0.5, lydian: 0.8, phrygian: 0.8 },
  /** Per box in a home key other than the preset's key, so ties stay in the preset's key. */
  awayFromHome: 0.1,

  // ---- How well a chord fits ----------------------------------------------------------------------

  /**
   * Times the share of a chord's sounding tones outside what its reading allows, each tone weighted
   * by its role as in scale ranking (root 10, 3rd 8, altered 5th 8, 7th 6, extension 3, perfect 5th 1).
   */
  chordMisfit: 3,
  /** Altered 9ths, 11ths and 13ths on a dominant count this share of a normal tone. */
  alteredTension: 0.3,

  // ---- Readings -----------------------------------------------------------------------------------

  /** A chord with a core tone outside the key that no other reading explains. */
  chromatic: 1,
  /** Secondary dominant (V/x). */
  secondaryDominant: 0.8,
  /** A plain major triad as a secondary dominant (V/x rather than V7/x). */
  appliedTriad: 0.4,
  /** A sus dominant as a secondary dominant. */
  suspendedDominant: 0.3,
  /** Secondary leading-tone chord (vii°/x, vii°7/x, viiø7/x). */
  secondaryLeadingTone: 1,
  /** Related ii of a secondary dominant (ii/x before V/x). */
  relatedTwo: 0.6,
  /** Tritone substitute (subV7, subV7/x). */
  tritoneSub: 1.3,
  /** Passing or common-tone diminished chord. */
  passingDiminished: 1.2,
  /** A chord outside the key shown in its own key, because its dominant just resolved to it. */
  tonicized: 0.4,
  /** A tonicized chord whose dominant isn't read as pointing at it. */
  unsupportedTonicization: 1.5,
  /** A chromatic chord a half step from the next chord of the same quality (F♯7 → G7). */
  chromaticApproach: 0.9,
  /** A chromatic major or minor chord a 3rd from a neighbour of the same quality, sharing a tone. */
  chromaticMediant: 1,
  /**
   * Extra for a related ii of a key outside the home key: a whole ii–V–I there is more likely a
   * modulation than a tonicization.
   */
  chromaticTwoFive: 0.8,
  /**
   * A secondary chord, tritone substitute or tonicized chord in a home key that isn't established yet:
   * not the preset's key, and neither its tonic nor its dominant has sounded. Without this the opening
   * key of a progression that later modulates reads as a tonicization within the later key.
   */
  unestablished: 0.3,
  /** Tonicizing a chord outside the key (V7/♭III in C major). */
  chromaticTarget: 0.8,
  /** Tonicizing a degree in the other mode than its chord in the key (V7/II rather than V7/ii). */
  oppositeTargetMode: 0.6,
  /** Dominant 7ths on I and IV in a major key when the progression has both: a blues. */
  bluesDominant: 0.3,

  // ---- Resolution ---------------------------------------------------------------------------------

  /** A secondary chord, tritone substitute or leading-tone chord moves to its target. */
  resolution: 1.2,
  /** Extra when the target has the quality the reading expects (A7 → Dm for V7/ii). */
  resolutionQuality: 0.4,
  /** The progression ends before a secondary chord resolves: its target is implied. */
  impliedResolution: { dominant: 0.2, leadingTone: 0.6, tritone: 0.8 },
  /** A secondary dominant moves to its target's submediant instead (V7/IV → ii). */
  deceptiveResolution: 0.5,
  /** A secondary chord moves somewhere else. */
  unresolved: { dominant: 0.8, leadingTone: 1.2, tritone: 1.6 },
  /** A related ii followed by its dominant. */
  relatedTwoFive: 0.8,
  /** A related ii whose dominant isn't read with it. */
  brokenPair: 3,
  /** A diminished chord shares a tone with the root that follows. */
  commonTone: 0.4,
  /** A diminished chord's bass moves by step from the chord before to the chord after. */
  passingLine: 0.4,

  // ---- Evidence for the tonic ---------------------------------------------------------------------

  /** A chord rooted on the key's tonic, with a quality that suits it. */
  tonicChord: 0.2,
  /** Extra when that chord ends the progression, the strongest single sign of a key. */
  finalTonic: 1,
  /** Extra in a modal key, whose tonic has no dominant to establish it. */
  modalTonic: 0.6,
  /**
   * Extra when the progression opens on the tonic chord and a dominant resolves to that tonic later:
   * C Dm G7 C … is in C major even if it goes on to G. Opening on ii (B♭m7 Cm7 …) earns nothing.
   */
  openingTonic: 1,

  // ---- Reference scales in the key bar -------------------------------------------------------------

  /** A chordless box's scale needs another key on the same tonic (A♭ Lydian in C major gives C minor). */
  scaleAdjust: 0.3,
  /**
   * The same for a box whose scale holds its chord: the scale someone chose for a chord says which
   * reading they hear (F Mixolydian over F7 says B♭ major, not B♭ minor).
   */
  scaleAdjustWithChord: 0.8,
  /** A chordless box's scale lacks the tonic: as for a chromatic scale in the first key bar. */
  chromaticScale: 3,
  /** The same for a box with a chord, where the chord's own reading already carries the evidence. */
  chromaticScaleWithChord: 1,

  // ---- Ambiguity ------------------------------------------------------------------------------------

  /** Other readings whose best path costs at most this much more are shown as possibilities. */
  ambiguityMargin: 0.9,
  /** At most this many alternatives per box. */
  maxAlternatives: 3,
  /** Readings whose own cost is this much above a box's cheapest are never considered. */
  beam: 9,
} as const;
