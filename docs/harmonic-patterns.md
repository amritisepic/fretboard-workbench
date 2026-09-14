# Harmonic patterns: the catalogue

Phase 0 of `docs/harmonic-analysis-plan.md`. This is every pattern the harmonic analysis knows, how the app reads it, and what it doesn't know yet. It describes the code as built:

- **Rules and costs** are data: `src/data/harmonyRules.ts` (cadences, borrowing sources, default scales, pattern names) and `src/data/analysisWeights.ts` (every cost).
- **Readings and relations** come from `src/theory/analysis.ts`; patterns spanning several chords from `src/theory/patterns.ts`.
- **The key bar, Find key and suggested scales** are in `src/theory/keyPlan.ts`.
- **Tests:** `src/theory/__tests__/harmonicAnalysis.test.ts` holds the labelled progressions (plan §3.6); `src/components/__tests__/analysisModel.test.ts` covers notation and explanations.

Examples are in C major or A minor unless stated.

## How a progression is read

1. **Home keys.** Every diatonic mode except Locrian, on all 12 tonics (72 keys). Major and minor cost nothing; Dorian and Mixolydian a little per box; Lydian and Phrygian a little more. A minor key accepts its raised 7th on V and vii (harmonic minor).
2. **Readings.** In each home key a chord gets every reading below that fits it. Each reading names a **local key**, the key the key bar shows: the home key, or the key a secondary chord tonicizes.
3. **Costs.** A reading costs its prior, plus the weighted share of chord tones it can't explain, plus whether the chord moves as the reading expects (a V7/x followed by x is cheaper). The cadence table lowers the cost of neighbours in the same home key; changing home key raises it (more for distant keys, and for a same-tonic change).
4. **Search.** The cheapest path through the whole progression is the analysis. Its cost is computed for every reading at every box, not just the winner's.
5. **Ambiguity.** Any other reading whose cheapest path costs at most `ambiguityMargin` more is an **alternative**. The key bar splits ("B♭ minor | B♭ major?"), the numeral is marked tentative, and the sidebar lists each reading with its explanation. Choosing one pins it (`Box.readingPin`, relative to the chord root so it survives transposing). A box's key can also be fixed by hand (`Box.keyPin`).
6. **Scales.** The key bar keeps the local key's tonic but may change its collection to hold the box's reference scale (A♭ Lydian in C major shows C minor; a Phrygian dominant V keeps "C minor"). Find key gives each chord the scale its function suggests.

## 1. Diatonic function

| Pattern | Example | Read as | Key bar | Default scale | Jazz | Classical | Ambiguities |
|---|---|---|---|---|---|---|---|
| Diatonic chord | Dm7 in C | reading `diatonic` | key stays | mode of the key (D Dorian) | ii7 | ii⁷ | The same chord in a relative or neighbouring key; resolved by context and cadences |
| Authentic cadence | G7 → C | relation `authenticCadence` | key stays | G Mixolydian; in minor, Phrygian dominant | V–I, arrow | authentic cadence | — |
| Leading-tone cadence | B° → C | `leadingToneCadence` | key stays | Locrian; B°7 diminished | vii°–I | leading-tone cadence | — |
| Implied tonic | Dm7 G7 (no C); B♭m7 Cm7 D♭maj7 E♭7 | cadence table: ii→V, ii→iii, iii→IV, IV→V count toward I | key of the implied I | mode of the key | ii–V bracket | ii–V | A ii–V vamp can also be Dorian or Mixolydian; all three are listed |
| Half cadence | … F → G at the end | tag `halfCadence` | key stays | mode of the key | V (half cadence) | V (half cadence) | Ending on V may be heard as a new tonic; the final-tonic bonus weighs both |
| Deceptive cadence | G7 → Am; G7 → A♭ | `deceptiveCadence` | key stays | mode of the key | deceptive | deceptive cadence | — |
| Plagal and minor plagal | F → C; Fm → C | `plagalCadence`, `minorPlagalCadence` | key stays; Fm tagged borrowed | Fm: F Dorian (from C minor) | plagal | plagal cadence | — |
| Double plagal | B♭ F C | cadence table (♭VII→IV) | key stays | B♭ Mixolydian | — | — | C major with a borrowed ♭VII, or C Mixolydian, or F major |
| Phrygian half cadence | Dm/F → E in A minor | `phrygianHalfCadence` | key stays | — | Phrygian half cadence | Phrygian half cadence | — |
| Cadential 6/4 | C/G → G7 → C | `cadential64` | key stays | mode of the key | I/5–V | I⁶₄–V, cadential ⁶₄ | — |
| Picardy third | Am … E → A | tag `picardyThird`; needs the minor tonic to have sounded | key stays (minor) | — | Picardy third | Picardy third | Without an earlier minor tonic it reads as a major key |
| Retrogression | G7 → Dm7 | small cost only, not shown | — | — | — | — | — |

## 2. Tonicization and substitution

Decision 5.1: a tonicization switches the key bar to the target's key. The target chord stays in the home key when it is diatonic there (A7 → Dm7 in C shows D minor over A7, C major over Dm7). A target outside the home key shows its own key (see "tonicized").

| Pattern | Example | Read as | Key bar | Default scale | Jazz | Classical | Ambiguities |
|---|---|---|---|---|---|---|---|
| Secondary dominant | A7 → Dm7 | `secondaryDominant`; relation `secondaryResolution` | the target's key (D minor) | Mixolydian over a major target; Phrygian dominant or Mixolydian ♭6 over a minor one | V7/ii, arrow | V⁷/ii | Target quality when the target doesn't sound: F7 at the end in A♭ lists B♭ minor and B♭ major |
| Unresolved or deceptive secondary dominant | A♭7 → F7 in A♭ | same, with a cost; `deceptiveResolution` when it goes to the target's vi | target's key (D♭ major) | A♭ Mixolydian | V7/IV | V⁷/IV | I7 outside a blues also reads as borrowed from Mixolydian, at a higher cost |
| Related ii | Em7♭5 A7 → Dm | `relatedTwo`, paired with its dominant; `relatedTwoFive` | same key as its dominant | Locrian ♮2 or Locrian (ø7); Dorian (m7) | ii/ii bracket | ii–V of ii | A diatonic ii can also be iii of the home key (Em7 in C) |
| Secondary leading-tone chord | C♯°7 → Dm | `secondaryLeadingTone` | target's key | whole–half diminished | vii°7/ii | vii°⁷/ii | A diminished 7th is read from any of its four notes, so the next chord decides |
| Tonicized chord | B♭7 → E♭maj7 in C | `tonicized` | the chord's own key (E♭ major) | its own collection | ♭III (tonicized) | ♭III (tonicized) | Also a borrowed chord in the home key; the dominant before it decides |
| Tritone substitution | D♭7 → C; A♭7 → G | `tritoneSub`; `tritoneResolution` | key stays for subV7; the target's key for subV7/x | Lydian dominant | subV7, dashed arrow | ♭II⁷ (tritone sub) | Half-step-down dominant can also be a plain chromatic chord |
| Backdoor dominant and ii–V | Fm7 B♭7 → C | `borrowed` from minor; `backdoorTwoFive`, `backdoorCadence`; tag `backdoorDominant` | key stays | F Dorian, B♭ Mixolydian | backdoor ii–V | iv⁷–♭VII⁷ | — |
| Diminished substitute for V7♭9 | B°7 → C | `borrowed` vii°7 from minor; `leadingToneCadence` | key stays | whole–half diminished | vii°7 | vii°⁷ | — |
| Extended dominants | E7 A7 D7 G7 C | a chain of `secondaryDominant`; pattern `extendedDominants` | each link shows its target's key | Mixolydian or Phrygian dominant per link | V7/vi V7/ii V7/V V7 | the same with ⁷ | Each target's quality comes from the key |
| Chromatic ii–V chains | Em7 A7 E♭m7 A♭7 → Dm7 | related ii's and dominants; pattern `twoFiveChain` | each pair shows its target's key | Dorian, Mixolydian | brackets | — | A♭7 → Dm7 can be subV7/ii |
| Sus dominant | G7sus4 → C, F/G | diatonic or `secondaryDominant` with a small cost | key stays | Mixolydian | V7sus | V (sus) | F/G is named as a chord by the chord picker; slash readings follow it |
| Neapolitan ♭II | D♭/F → G7 → C | `borrowed` from Phrygian; tag `neapolitan` | key stays | D♭ Lydian or major | ♭II (Neapolitan) | ♭II⁶ (Neapolitan) | — |

## 3. Borrowing, mixture and colour

| Pattern | Example | Read as | Key bar | Default scale | Jazz | Classical | Ambiguities |
|---|---|---|---|---|---|---|---|
| Modal interchange | Fm, A♭maj7, B♭7, E♭ in C | `borrowed`, from the cheapest parallel mode (minor first) | tonic stays; the scale may change the collection shown | the source mode on the chord root (F Dorian) | "borrowed from C minor" | "mixture (C minor)" | Several sources can hold a chord; the cheapest wins |
| Blues dominants | A7 D7 E7 in A | `borrowed` at the blues cost; tag `bluesDominant`; pattern `blues` | key stays | Mixolydian | I7, IV7 (blues) | — | I7 → IV7 also reads as V7/IV |
| Mixolydian and Dorian pop | G F C G; Dm G Dm | modal home key, or major/minor with borrowing | modal key | modes | — | — | Listed together when close |
| Andalusian cadence | Am G F E | diatonic in minor; pattern `andalusian` | key stays | Phrygian dominant on E | — | — | — |
| Chromatic mediant | C → E → C; C → A♭ | `chromaticMediant`; relation `chromaticMediant` | key stays | the chord's own collection | chromatic mediant | chromatic mediant | E major can also be V/vi; resolution decides |
| Common-tone and passing diminished | C C°7 C; C C♯°7 Dm | `passingDiminished`; `commonToneDiminished`, `passingDiminished` | key stays | whole–half diminished | passing, common tone | passing, common tone | vii°7/x when it resolves up a half step |
| Chromatic approach (side-slip) | F♯7 → G7 → Cm | `chromaticApproach` | key stays | the scale closest to the key | approach | chromatic approach | — |
| Line cliché | Am Am(maj7) Am7 Am6 | pattern `lineCliche` | key stays | — | line cliché | — | — |
| Pedal point | C F/C G/C C | pattern `tonicPedal`, `dominantPedal` or `pedalPoint` | key stays | — | — | — | — |
| Planing | D7 E♭7 E7 (same type, same step) | pattern `planing` | chord by chord | — | planing | — | Diatonic planing isn't detected (it would tag ii–iii–IV) |

## 4. Modulation, sequences and symmetric systems

| Pattern | Example | Read as | Key bar |
|---|---|---|---|
| Pivot-chord modulation | C Am D7 G | relation `modulation` (`pivot`) when a chord at the change fits both keys | tonic changes |
| Direct modulation | C → E♭ | `modulation` (`direct`) | tonic changes |
| Common-tone modulation | C → A♭ sharing C | `modulation` (`commonTone`) | tonic changes |
| Enharmonic modulation | a diminished 7th at the change | `modulation` (`enharmonic`) | tonic changes |
| Coltrane changes | Giant Steps | tonicizations or modulations by major 3rds; pattern `coltraneChanges` | each key centre shows |
| I–VI–ii–V, iii–VI–ii–V | Cmaj7 A7 Dm7 G7 | patterns `turnaround`, `thirdTurnaround` | A7 shows D minor |
| Tadd Dameron (Lady Bird) turnaround | Cmaj7 E♭maj7 A♭maj7 D♭maj7 | pattern `taddDameron` | key stays |
| Tritone-substitute turnaround | C E♭7 A♭7 D♭7 | pattern `tritoneTurnaround` | — |
| Circle of fifths | Am Dm G C F Bdim E | pattern `circleProgression` | key stays |
| Ascending 5–6 | C Am/C Dm B°/D Em | pattern `ascendingFiveSix` | key stays |
| Pachelbel / Romanesca | C G Am Em F C | pattern `pachelbel` | key stays |
| Monte | C7 F D7 G | pattern `monte` (two secondary dominants, targets a step up) | each dominant tonicizes |
| Fonte | A7 Dm G7 C | pattern `fonte` (minor target, then a major one a step down) | each dominant tonicizes |
| Prinner | F C/E G/D C (bass 4–3–2–1) | pattern `prinner` | key stays |
| Modal vamp | Dm7 G7 Dm7 G7 Dm7 | modal home key; pattern `modalVamp` | modal key (D Dorian) |

Modulation or tonicization is weighed three ways. A ii–V–I into a key outside the home key costs extra (`chromaticTwoFive`). A secondary chord in a home key that hasn't sounded its tonic or dominant costs extra (`unestablished`). A progression that opens on a tonic a dominant later resolves to counts toward that key (`openingTonic`). So an opening key area isn't read as a tonicization within a later key. Both readings stay listed when close. A modulation to a closely related key (a 5th away, or the relative key) costs less than one to a distant key.

## 5. Modes as keys

| Mode | Characteristic motion (cadence table) |
|---|---|
| Dorian | IV → i, ii → i, ♭VII → i, i → IV |
| Mixolydian | ♭VII → I, v → I, IV → I, I → ♭VII |
| Lydian | II → I, I → II |
| Phrygian | ♭II → i, ♭vii → i, i → ♭II |
| Minor (Aeolian) | ♭VII → i, ♭VI → ♭VII |

A modal key also gains more from each of its tonic chords, since it has no dominant to establish it.

## 6. Notation

| | Jazz | Classical |
|---|---|---|
| Diatonic seventh chords | ii7, V7, Imaj7, viiø7, vii°7 | ii⁷, V⁷, I⁷, viiø⁷, vii°⁷ |
| Inversions | none (the chord name has the slash) | figured bass: I⁶, I⁶₄, V⁶₅, V⁴₃, V⁴₂ |
| Secondary chords | V7/IV, vii°7/ii, ii/V; an arrow to the target | V⁷/IV, vii°⁷/ii |
| Tritone substitute | subV7, subV7/V; a dashed arrow | ♭II⁷ (tritone sub); of V, by its augmented sixth: Ger⁶₅, Fr⁴₃, It⁶ |
| ii–V pairs | a bracket in the strip | named "ii–V" |
| Borrowed chords | "borrowed from C minor" | "mixture (C minor)" |

## 7. Not covered yet

- **Melody and non-chord tones.** The app has chords only, so suspensions, appoggiaturas and passing tones inside a chord aren't analysed. Neither are schemata that depend on the melody (Do–Re–Mi, Quiescenza, Meyer) or the omnibus progression's chromatic voices.
- **Rhythm and metre.** Every box weighs the same. Cadences on strong beats and harmonic rhythm aren't known.
- **Augmented sixth chords** are recognised only as tritone substitutes of V. Classical notation then names them Ger⁶₅, Fr⁴₃ or It⁶. One resolving elsewhere, or spelled for a key where it isn't ♭VI, keeps its tritone-substitute label.
- **Enharmonic modulation** is flagged only when a diminished 7th sits at the change.
- **Diatonic planing** (parallel diatonic 7ths) isn't tagged.
- **Corpus evaluation** (plan §3.6, §5.5) covers keys only.
  - McGill Billboard, RS200 and When in Rome are downloaded locally, and `npm run eval:corpus` compares the analysis with their annotated keys (results in the plan's §7).
  - Billboard and RS200 annotate only tonics.
  - No open corpus annotates chord scales, so reference-scale suggestions are tested only by the labelled progressions.
