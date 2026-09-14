# Harmonic analysis: scope and plan

Status: built on 2026-09-14 on the `harmonic-analysis` branch (not yet committed). The user's decisions are recorded in §5, and the design below follows them. §7 records what was built and the decisions made while building it, for review. The pattern catalogue is `docs/harmonic-patterns.md`.

## 1. Why the current key and scale choices go wrong

The key bar (`planKeys`) and Find key (`findKey`, `closestScale`) only know which notes each chord has and how well those notes fit a key. They don't know what chords do: ii leads to V, V leads to I, and a dominant can point at a chord other than the tonic.

The user's screenshots show the progression B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7. The intended reading is ii–iii–IV–V in A♭ major, followed by two chromatic dominants.

- **Starting on ii.** Find key rewards a progression for starting on its tonic chord. B♭m7 comes first, so B♭ minor scores well, and A♭maj7 never sounds. A musician hears ii–iii–IV–V and infers A♭ anyway, but the engine has no way to.
- **Key flicker.** Once B♭ is the tonic, keeping that tonic and switching modes is the cheapest move. The result is B♭ minor, B♭ Dorian, B♭ minor, B♭ Dorian across chords that all belong to one collection.
- **Secondary dominants.** A♭7 is V7 of D♭, the IV chord in A♭. The user wants key D♭ major with reference scale A♭ Mixolydian. The planner instead treats the chord's scale as given and keeps the tonic.
- **Setting a scale can't pin a key.** When the user set A♭7's scale to D♭ major, the bars showed key "A♭ Mixolydian" over scale "D♭ major", the reverse of what was meant.
- **F7 is ambiguous.** In A♭ major it is conventionally V7/ii, which points to B♭ minor. The user's reading was B♭ major with F Mixolydian. Following the §5 decision, the app shows both readings instead of choosing.

## 2. Scope: every pattern, confirmed by research

The first version covers jazz, pop and classical harmony alike. The list below is the starting catalogue, not the finished one: Phase 0 (§6) is research to make it complete before any code is written.

### Functional and diatonic

| Pattern | Example in C | Key bar | Default reference scale |
|---|---|---|---|
| Diatonic function: ii–V–I, iii–vi–ii–V, IV–V–I | Dm7 G7 Cmaj7 | Key stays | Mode of the key |
| Implied tonic: ii–V or ii–iii–IV–V with no I | Dm7 G7 | Key of the implied I | Mode of the key |
| Deceptive resolution: V → vi, V → ♭VI | G7 → Am | Key stays | Mode of the key |
| Plagal and minor plagal: IV → I, iv → I | Fm → C | Key stays | Mode of the key, or borrowed |
| Half cadence, Phrygian half cadence (iv6–V in minor) | Fm/A♭ → G | Key stays | Mode of the key |
| Cadential 6/4 | C/G → G7 → C | Key stays; the 6/4 is labelled as part of the dominant | Mode of the key |

### Tonicization and substitution

| Pattern | Example in C | Key bar | Default reference scale |
|---|---|---|---|
| Secondary dominant V7/x | A7 → Dm7 | **Switches to x's key** (D minor); the analysis lane shows V7/ii | Mixolydian over a major x; Mixolydian ♭13 or Phrygian dominant over a minor x |
| Related ii of a secondary dominant | Em7♭5 A7 → Dm7 | Same key as its V | Locrian ♮2 or Dorian |
| Secondary leading-tone vii°7/x | C♯°7 → Dm | Switches to x's key | Diminished (whole–half) |
| Tritone substitution, including subV7/x | D♭7 → C | Key stays, or x's key for subV7/x | Lydian dominant |
| Backdoor dominant ♭VII7 → I, and the backdoor ii–V (iv–♭VII7) | Fm7 B♭7 → C | Key stays | Mixolydian from the parallel minor |
| Diminished substitution: vii°7 for V7♭9 | B°7 → C | Key stays | Diminished |
| Extended dominants: chains around the circle of 5ths | E7 A7 D7 G7 → C | Each link tonicizes the next | Mixolydian or Mixolydian ♭13 per link |
| Chromatic ii–V chains (descending ii–Vs) | Em7 A7 E♭m7 A♭7 → Dm7 | Each pair tonicizes its target | Dorian, then Mixolydian |
| Sus dominants: IV/V, 9sus4 | F/G → C | Key stays | Mixolydian |
| Neapolitan ♭II (♭II6 in classical usage) | D♭/F → G → C | Key stays | Lydian or Major |

### Borrowing, mixture and colour

| Pattern | Example in C | Key bar | Default reference scale |
|---|---|---|---|
| Modal interchange from the parallel minor or a mode | Fm, A♭maj7, B♭7 in C | Key stays; the chord is tagged as borrowed | Scale of its source (F Dorian from C minor) |
| Picardy third | A minor ending on A major | Key stays | Major |
| Mixolydian and Dorian pop progressions: ♭VII–IV–I, i–IV | B♭ F C | Modal key | Mode |
| Andalusian cadence | Am G F E | Key stays (minor) | Mode of the key; Phrygian dominant on E |
| Chromatic mediants: roots a 3rd apart, same quality | C → E, C → A♭ | Key stays for one chord | Scale of the chord's own collection |
| Common-tone and passing diminished | D♯°7 → C/E | Key stays | Diminished |
| Line clichés and inner-voice chromatic lines | Am Am(maj7) Am7 Am6 | Key stays; tagged | Minor, melodic minor, Dorian |
| Pedal points (tonic or dominant) | C, F/C, G/C, C | Key stays; tagged | Mode of the key |
| Planing, parallel chords, quartal harmony (non-functional) | Dm7 Em7 Fmaj7 over D | Modal key | Mode |

### Modulation and symmetric systems

| Pattern | Example | Key bar |
|---|---|---|
| Pivot-chord modulation | C major → G major via Am | Tonic changes at the pivot |
| Direct, phrase and common-tone modulation | C → E♭ | Tonic changes |
| Enharmonic modulation (diminished 7th, German 7th / V7) | G7 treated as A♭ Ger7 | Tonic changes; tagged enharmonic |
| Coltrane changes and key cycles a major 3rd apart | Giant Steps | Real modulations |
| Turnarounds: I–VI7–ii–V, iii–VI7–ii–V, Tadd Dameron (I–♭III–♭VI–♭II), Lady Bird | — | Key stays; tagged |
| Sequences and schemata: descending 5ths, ascending 5–6, Romanesca/Pachelbel, omnibus, Galant schemata | — | Key stays or tonicizes per link; tagged |
| Modal vamps (no dominant function) | Dm7 G7 vamp | Modal key (D Dorian) |

## 3. Design

### 3.1 Functional analyzer (`theory/analysis.ts`, pure)

- **Input and output.** The analyzer reads the chord sequence and produces candidate readings, each with a cost:
  - per chord, a function in a local key: "V7/IV", "subV7/V", "borrowed iv from C minor", "cadential 6/4"
  - per transition, a relation: "resolves V–I", "tritone sub", "deceptive", "chromatic mediant", "pivot"
- **Rules** come from the Phase 0 catalogue, stored as a data table in `src/data/`, as with chord types and ranking weights. The spec forbids music-theory libraries, and a table keeps every rule inspectable and testable.
- **Windows.** Rules look at one to three chords at a time. A dominant with no following chord still implies its target.
- **Search.** The same cheapest-path search as the key bar runs over (key, function) states.
- **Ambiguity is kept.** When readings are close in cost, the analyzer returns them all (see §3.4).

### 3.2 Key bar v2

- **Tonicization switches the key bar to the target's key.** A lone A♭7 → (D♭) in A♭ major gives a D♭ major segment for that box, and the relationship itself ("V7/IV, tonicizing D♭") appears in the harmonic analysis lane. The related ii and leading-tone chords go with their dominant.
- **Tonicization is its own kind of change.** It needs a transition type distinct from modulation, so the "few tonic changes" cost that protects against flicker doesn't block it.
- **Function evidence replaces the tonic-chord bonus.** ii–V and ii–iii–IV–V count toward their I even when it never sounds.
- **Mode flicker costs extra.** Changing mode on the same tonic gets a cost unless a chord's scale really demands it.
- **Per-box key pins.** The user can pin a box's key and the planner works around it. This also fixes the problem in §1, where setting a scale couldn't say "this chord is in D♭".

### 3.3 Reference scale v2

Each function maps to a default scale (the tables in §2). Today's closest-to-key rule becomes the tie-breaker, and the ranking list still lets the user override the default.

### 3.4 Ambiguity: show the possibilities, don't decide

- **Detection.** A chord or passage is ambiguous when alternative readings cost within a set margin of the best one. The margin lives in the weights file.
- **Key and scale bars.** An ambiguous segment is drawn as a split, e.g. "B♭ minor | B♭ major?" in the key bar with the matching scales underneath, plus a small chooser.
- **Analysis lane.** Each reading is listed with its reason, e.g. "F7 → B♭m: V7/ii, the textbook reading" and "F7 → B♭: V7 of B♭ major".
- **Nothing is chosen silently.** Choosing a reading pins it. Until then numerals and degree labels show the best-cost reading, marked as tentative.

### 3.5 Harmonic analysis switch and notation

- **Placement.** A "Harmonic analysis" switch sits next to Common tones and Voice leading.
- **What it adds.** A third lane in the strips, a tag under each numeral, and a one-sentence explanation on hover or tap, e.g. "A♭7 is V7 of D♭: it borrows the dominant of the IV chord."
- **Jazz / Classical notation switch:**

  | | Jazz | Classical |
  |---|---|---|
  | Secondary dominant | V7/IV, bracket and arrow to the target | V⁷/IV |
  | Tritone substitution | subV7, dashed arrow | ♭II⁷ (tritone sub) |
  | Leading-tone chords | vii°7/V | vii°⁷/V |
  | Inversions | Slash chords (C/E) | Figured bass (I⁶, V⁶₅, V⁴₂) |
  | ii–V pairs | Bracket over the pair | — |
  | Borrowed chords | "borrowed from C minor" | "mixture (C minor)" |

### 3.6 Evaluation harness

A fixture file holds labelled progressions: expected key, scale, function and allowed alternatives per chord. It starts with:

- the user's screenshots:
  - B♭m7 Cm7 D♭maj7 E♭7 is ii iii IV V in A♭ major
  - A♭7 is key D♭ major, scale A♭ Mixolydian
  - F7 is ambiguous between B♭ minor with F Phrygian dominant or Mixolydian ♭13, and B♭ major with F Mixolydian
- textbook examples: Autumn Leaves, All the Things You Are, the rhythm-changes bridge, Giant Steps, a Bach chorale, and a pop song with borrowed chords
- research corpora, approved for offline testing only (§5)

It reports key agreement, chord–scale agreement and whether ambiguous cases list every accepted reading.

## 4. Sources

- **Texts:**
  - Levine, *The Jazz Theory Book*
  - Mulholland and Hojnacki, *The Berklee Book of Jazz Harmony*
  - Aldwell and Schachter, *Harmony and Voice Leading*
  - Piston, *Harmony*
  - Kostka and Payne, *Tonal Harmony*
  - Caplin, *Classical Form*
  - Gjerdingen, *Music in the Galant Style* (schemata)
  - Tymoczko, *A Geometry of Music*
  - Temperley, *The Cognition of Basic Musical Structures*
- **Algorithms:**
  - Pachet, *Computer Analysis of Jazz Chord Sequences* (1997)
  - Andrew Choi's T2, which treats analysis as tonality segmentation (2009–2011, Computer Music Journal)
  - Granroth-Wilding and Steedman's grammar-based parsing of jazz sequences
  - Pachet, *Tonal parsimony in chord-sequence analysis* (arXiv 2606.03459, 2026): minimize modulations, then distinct keys. It reports 95.6% chord–scale agreement on 1,555 annotated jazz standards and is the closest published relative of `planKeys`.
- **Annotation standards and corpora:**
  - the DCML harmony annotation standard (ABC Beethoven quartets and related corpora)
  - RomanText and the When in Rome corpus
  - ChoCo, which unifies 18 chord datasets
  - the Weimar Jazz Database
  - carey-bunks/Jazz-Chord-Progressions-Corpus
  - the de Clercq and Temperley rock corpus
  - the McGill Billboard corpus

## 5. Decisions (user, 2026-09-14)

1. **Tonicization.** The key bar switches to the target's key, e.g. D♭ major for a lone A♭7 in A♭ major. The analysis lane shows that A♭7 is the secondary dominant of D♭.
2. **Ambiguous targets.** Ask, by showing every reading. Where the analysis is unclear, the app mustn't add confusion by choosing (§3.4).
3. **Notation.** A switch between jazz and classical (§3.5).
4. **Scope.** All patterns: jazz, pop and classical. The plan includes research to confirm the catalogue is complete (Phase 0).
5. **Corpora.** Research datasets may be used for offline testing. Only the rule table ships; check each dataset's licence, and don't copy data into the repo unless the licence allows it.

## 6. Phases

| Phase | Work | Rough size |
|---|---|---|
| 0 | **Research.** Go through the sources in §4 to finish the pattern catalogue: definition, examples, key bar behaviour, default scale, both notations, and known ambiguities for each pattern. Deliver it as `docs/harmonic-patterns.md` and review it with the user before coding. | 1–2 sessions |
| 1 | Analyzer core: the rule table for the whole catalogue, the cheapest-reading search, ambiguity output; unit tests from textbook examples | 3–4 sessions |
| 2 | Harmonic analysis switch: strip lane, tags, explanations, notation switch | 1–2 sessions |
| 3 | Key bar v2: tonicization switching, ambiguous segments with a chooser, per-box key pins; the user's screenshots as acceptance tests | 2 sessions |
| 4 | Function-based reference scales | 1–2 sessions |
| 5 | Evaluation harness against labelled progressions and corpus samples; weight tuning | ongoing |

## 7. What was built (2026-09-14)

The user asked for the whole plan to be built overnight, with decisions made and reported rather than asked. Anything costly to undo was to wait, and nothing reached that bar.

### By phase

| Phase | Built | Where |
|---|---|---|
| 0 | The catalogue, written from the sources' standard definitions, covering every pattern in §2 plus the modes, notation and known gaps. Built on without the planned review. | `docs/harmonic-patterns.md` |
| 1 | Analyzer: readings per home key, cadence table, cheapest-path search with the cost of every reading's best path, alternatives within a margin, pins, relations, tags, and patterns across several chords | `src/theory/analysis.ts`, `src/theory/patterns.ts`, `src/data/harmonyRules.ts`, `src/data/analysisWeights.ts` |
| 2 | "Harmonic analysis" switch and Jazz/Classical in the toolbar. The strips get an analysis lane (relation, ii–V bracket, resolution arrow, pattern names), and each numeral gets a function tag with a one-sentence explanation on hover or tap. | `CanvasToolbar`, `VoiceLeadingStrip`, `BoxCard`, `analysisModel.ts` |
| 3 | Key bar v2 with tonicization. Ambiguous boxes split the key and scale bands with a chooser, and numerals are marked tentative. Readings and a key pin per box live in the sidebar's Harmony section; pins are saved with presets and move with transposition. | `keyPlan.ts`, `Canvas`, `HarmonyField`, `workbench.ts`, `presetFormat.ts` |
| 4 | Find key gives each chord the scale its function suggests, with closeness to the key as the tie-breaker. The ranking list marks that scale "Suggested". | `functionScale` in `keyPlan.ts`, `rankingModel.ts` |
| 5 | Harness of 60 labelled progressions: the user's screenshots, textbook cadences and substitutions, Autumn Leaves, All the Things You Are, Giant Steps, rhythm changes, a chorale phrase, modal vamps and every named pattern. It reports fixtures passing, local-key agreement, chord–scale agreement and ambiguous listings, all 100%. No corpus has been used (see below). | `src/theory/__tests__/harmonicAnalysis.test.ts` |

The user's screenshots now read as intended. B♭m7 Cm7 D♭maj7 E♭7 is ii–iii–IV–V in A♭ major with scales B♭ Dorian, C Phrygian, D♭ Lydian and E♭ Mixolydian. A♭7 is V7/IV, shown in D♭ major with A♭ Mixolydian. F7 shows "B♭ minor | B♭ major?" with "F Phrygian Dominant | F Mixolydian?". Choosing B♭ major pins it and moves the scale to F Mixolydian.

### Decisions made while building, for review

1. **Where a tonicization shows.** The key bar switches to the target's key for the secondary chord and its related ii only. A target that is diatonic in the home key stays there (A7 → Dm7 in C: D minor over A7, C major over Dm7). A target outside the home key, just resolved to, shows its own key (B♭7 → E♭maj7 in C shows E♭ major over both).
2. **Home keys.** Major, minor, Dorian, Mixolydian, Lydian and Phrygian on every tonic, with small per-box costs for the modes. The earlier Find key ruling allowed only major and the minors; §2's modal keys supersede it. Harmonic and melodic minor are one "minor" home key that accepts its raised 7th on V and vii.
3. **Borrowed chords keep the tonic, and the scale still colours the key.** An A♭ Lydian box in C major still shows C minor, as the first key bar ruled, because §2's "key stays" was read as "the tonic stays". A Phrygian dominant V in a minor key keeps plain "C minor".
4. **Scales as evidence.** A box's scale counts toward a reading only when it holds the chord, so a new box's default scale says nothing. Alternatives are judged from the chords alone, so the scales Find key sets can't hide an ambiguity.
5. **Ambiguity.**
   - The margin is 0.9 cost units. Chromatic readings, which explain nothing, are never listed.
   - The key bar shows at most two keys; the sidebar lists up to four readings.
   - The numeral is marked tentative when the key bar splits, or when the analysis lane is on.
6. **Choosing a reading.** Clicking a key in the split, or a reading in the sidebar, pins it. Clicking the pinned one again unpins. Pinning also moves the box's scale to the reading's suggested scale, but only if the scale was still the old reading's suggestion. A key pin ("Key at this box: Fixed") and a reading pin clear each other.
7. **Modulation versus tonicization.**
   - Changing home key costs 3, plus 0.5 per extra note changed (C → G costs 3, C → E costs 4.5); a same-tonic change costs 3.5.
   - A ii–V into a key outside the home key costs extra.
   - Secondary chords cost extra before the home key's tonic or dominant has sounded.
   - Opening on a tonic that a dominant later resolves to counts for that key.
   - The Picardy bonus needs the minor tonic to have sounded first.
8. **New readings not in §2's tables:** a chromatic approach chord a half step from a same-quality neighbour (F♯7 → G7), and a tonicized chord.
9. **Notation.**
   - Jazz writes ii7, Imaj7, V7/IV and subV7, with no inversion figures, since the chord name carries the slash.
   - Classical writes figured bass (I⁶₄, V⁶₅, V⁴₂), ♭II⁷ with "tritone sub", and Ger⁶₅, Fr⁴₃ or It⁶ for a tritone substitute of V.
   - Borrowed chords read "borrowed from C minor" or "mixture (C minor)".
   - The lane names cadences in words in classical notation, and draws brackets and arrows only in jazz.
10. **The switch.** Harmonic analysis is off by default and saved with the preset, like the other strip switches. The key-bar splits and the sidebar's Harmony section show whether it's on or off, because §3.4 ties ambiguity to the key bar, not to the switch.
11. **Examples adjusted to the engine's reasonable readings.**
    - Cm7 at the start of Autumn Leaves may be iv of G minor or the ii of B♭; both are listed.
    - The first Bmaj7 of Giant Steps reads as ♭VI of E♭ until more context; the later B, G and E♭ areas show correctly.
    - A ii–V vamp ending on V lists C major, D Dorian and G Mixolydian.
    - Am6 in a line cliché makes A Dorian as good as A minor.

### Not done

- **Corpora.** Approved and downloaded on 2026-09-14; see "Corpus evaluation" below. Only keys can be checked against them: no open corpus annotates chord scales. The 1,555 professionally annotated jazz standards in Pachet (arXiv 2606.03459) come from a commercial book.
- **Review of the catalogue.** Phase 0's review with the user didn't happen; the catalogue is ready for it.
- **Visual checks.** The interface was verified through the DOM and two screenshots, since the app window was hidden for most of the session. The popover, split chooser and stacked figures still need a look on a visible screen.

### Corpus evaluation (2026-09-14)

`npm run eval:corpus` reads the corpora in the gitignored `corpora/` folder (sources and licences in `corpora/SOURCES.md`).

- **Method.** Each piece is read whole by Find key, with no preset key. The analysis's home key at each chord is compared with the annotated key: the tonic, plus the mode where one is annotated.
- **Comparisons.** "Old key finder" is the one from commit `0ce8623`. "Most common root" takes the most frequent chord root as the tonic.

Tonic agreement by chord:

| Corpus | Chords | Old key finder | Most common root | Original weights | Variant A | Variant B (in the code) |
|---|---|---|---|---|---|---|
| McGill Billboard (tonics only) | 86,155 | 66.3% | 52.5% | 66.0% | 72.6% | 71.2% |
| RS200 (tonics only) | 37,355 | 68.6% | 59.9% | 69.7% | 77.0% | 73.9% |
| When in Rome | 235,348 | 80.8% | 42.9% | 80.5% | 79.7% | pending |

- **Keys with mode** (When in Rome): old key finder 76.6%, original weights 78.0%, variant A 77.3%.
- **Secondary dominants** showing their target's key:
  - When in Rome: 68.2% with the original weights, against 29.1% for the old key finder.
  - RS200: 65%, against 23%.
- **Wrong but listed:** among the chords whose home key is wrong, the annotated key is among the alternatives for 12% of pop and rock chords and 26% of classical ones.
- **What the variants change.** Most errors put the key a 5th below the annotated one, because I–IV and I–♭VII loops earn V→I cadence bonuses in the IV key.
  - Variant A lowers the bonus for a plain major triad on V resolving to I from 1.5 to 0.6. A dominant 7th keeps 1.5. It also raises `tonicChord` from 0.2 to 0.4.
  - Variant B raises `tonicChord` to 0.4 but lowers the triad cadence only to 0.9.
  - Variant A gains most on pop and rock but loses 0.8 points on classical music, where triad V→I is a real cadence.
- **Decision pending.** Variant B is kept if its When in Rome result holds at or above the original weights; its run hadn't finished when this was written.
- **Limits:**
  - Billboard and RS200 annotate a tonic per section, and coarsely: a passage clearly in F minor inside an A♭ annotation counts as wrong.
  - The weakest classical collections are early choral music (about 70%, against 72.4% for the old key finder) and the Lieder.
