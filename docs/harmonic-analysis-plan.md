# Harmonic analysis: scope and plan

Status: plan only. Nothing here is implemented yet.

## 1. Why the current key and scale choices go wrong

The key bar (`planKeys`) and Find key (`findKey`, `closestScale`) know which notes each chord has and how well those notes fit a key. They don't know what chords do: a ii leads to V, V leads to I, and a dominant can point at a chord other than the tonic. The user's four screenshots show three consequences.

**B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7.** The intended reading is ii iii IV V in A♭ major, then two chromatic dominants.

- **The progression starts on ii, not i.** Find key rewards a progression that starts on its tonic chord. B♭m7 is the first chord, so B♭ minor scores well. A♭maj7 never appears, so nothing counts for A♭. A reader hears ii–iii–IV–V and infers A♭ even without the I chord; the engine has no model of that.
- **Same-tonic changes are cheap, so the key flickers.** Once B♭ is the tonic, keeping B♭ while changing modes is the cheapest move. That produced B♭ minor, B♭ Dorian, B♭ minor, B♭ Dorian across chords that all belong to one collection.
- **Secondary dominants point at a different chord.** A♭7 is V7 of D♭, the IV of A♭. The user wants key D♭ major with reference scale A♭ Mixolydian. The planner instead takes the chord's own scale as given and keeps its tonic. When the user set A♭7's scale to D♭ major, the bar showed "A♭ Mixolydian" as the key and "D♭ major" as the scale. That's the reverse of the intent, and there's no way to set a box's key directly.
- **F7 follows the same pattern.** The user wants key B♭ major with scale F Mixolydian; Find key gave B♭ harmonic minor with F Phrygian dominant.
  - Open question: in A♭ major, F7 is conventionally V7/ii, which points to B♭ minor, where F Mixolydian ♭13 or Phrygian dominant is the textbook scale. B♭ major with F Mixolydian is a different reading. The analyzer needs an explicit rule for when a dominant's target is major or minor, probably from the next chord, the melody or a user choice.

## 2. Relationships worth recognizing

Each row is a pattern the analyzer should detect, a C major example, and what the key bar and reference scale should do.

| Relationship | Pattern | Example in C | Key bar | Reference scale (default) |
|---|---|---|---|---|
| Diatonic function | ii–V–I, iii–vi–ii–V, IV–V–I | Dm7 G7 Cmaj7 | Key stays | Mode of the key |
| Implied tonic | ii–V or ii–iii–IV–V with no I | Dm7 G7 | Key of the implied I | Mode of the key |
| Secondary dominant V7/x | Dominant a 5th above a diatonic chord x | A7 → Dm7 | Tonicization of x (see §5) | Mixolydian for a major x; Mixolydian ♭13 or Phrygian dominant for a minor x |
| Related ii | ii of a secondary dominant | Em7♭5 A7 → Dm7 | Same as its V | Locrian ♮2 or Dorian |
| Secondary leading-tone | vii°7/x | C♯°7 → Dm7 | Tonicization of x | Diminished (whole–half) |
| Tritone substitution | Dominant a half step above its target | D♭7 → C | Key stays | Lydian dominant |
| Backdoor dominant | ♭VII7 → I, often iv–♭VII7–I | Fm7 B♭7 → C | Key stays | Mixolydian from the parallel minor |
| Modal interchange (borrowed) | Chord from the parallel minor or a mode on the same tonic | Fm, A♭maj7, B♭7 in C | Key stays; tag as borrowed | Scale of the source mode (F Dorian from C minor) |
| Deceptive resolution | V → vi, V → ♭VI | G7 → Am, G7 → A♭maj7 | Key stays | Mode of the key |
| Plagal / minor plagal | IV → I, iv → I | F → C, Fm → C | Key stays | Mode of the key, or borrowed |
| Chromatic mediant | Roots a 3rd apart, same quality, one common tone | C → E, C → A♭ | Key stays for one chord | Scale of the chord's own collection |
| Common-tone / passing diminished | ♯ii°7 → I, ♯i°7 → ii | D♯°7 → C/E | Key stays | Diminished |
| Extended dominants | Chains of dominants around the circle of 5ths | E7 A7 D7 G7 → C | Key stays; tag the chain | Mixolydian or Mixolydian ♭13 per link |
| Symmetric key cycles | Keys a major 3rd apart (Coltrane changes) | Giant Steps | Real modulations | Modes of each key |
| Modulation | Pivot chord or direct | — | Tonic changes | Modes of the new key |
| Modal vamp (non-functional) | Two chords from one mode, no dominant | Dm7 G7 vamp | Modal key (D Dorian) | Mode |

Classical-only patterns can come later: cadential 6/4, applied vii° in inversion, pedal points and Picardy thirds.

## 3. Where the knowledge comes from

- **Rules** come from standard theory texts:
  - Mark Levine, *The Jazz Theory Book*
  - Mulholland and Hojnacki, *The Berklee Book of Jazz Harmony*
  - Aldwell and Schachter, *Harmony and Voice Leading*
  - Tymoczko, *A Geometry of Music*

  They'd be encoded as a data table in `src/data/`, the same way chord types and ranking weights are. The spec forbids music-theory libraries, and a table keeps every rule visible and testable.
- **Algorithms to learn from:**
  - François Pachet, *Computer Analysis of Jazz Chord Sequences* (1997): a rule-based substitution analysis.
  - Andrew Choi, T2 (2009–2011, Computer Music Journal): analysis as tonality segmentation, with explicit modulations.
  - Granroth-Wilding and Steedman: grammar-based parsing of jazz chord sequences, with an annotated corpus.
  - François Pachet, *Tonal parsimony in chord-sequence analysis* (arXiv 2606.03459, 2026). It minimizes modulations, then the number of distinct keys, over 24 keys including jazz substitutions, and reports 95.6% chord–scale agreement on 1,555 annotated jazz standards. It is the closest published relative of `planKeys` and worth reading first.
- **Test data**, for offline evaluation only:
  - ChoCo: 18 chord datasets unified, including a jazz corpus with functional annotations
  - Weimar Jazz Database: chords for 456 tunes
  - carey-bunks/Jazz-Chord-Progressions-Corpus on GitHub
  - When in Rome: Roman-numeral analyses of classical music

  Check each licence before copying anything into the repo. Only the rule table ships.

## 4. Proposed design

1. **Functional analyzer** (`theory/analysis.ts`, pure):
   - It reads the chord sequence and emits candidate readings with costs:
     - per chord: a function in a local key, such as "V7/IV", "subV7/V" or "borrowed iv from C minor"
     - per transition: a relation, such as "resolves V–I", "tritone sub", "deceptive" or "chromatic mediant"
   - Rules look at windows of one to three chords. A dominant with no following chord still implies its target.
   - The same cheapest-path search the key bar uses picks one reading, over states of (key, function).
2. **Key plan v2.** Function evidence replaces the tonic-chord bonus. ii–V and ii–iii–IV–V count toward their I even when it never sounds. A secondary dominant costs almost nothing in the key it serves, instead of counting as chromatic. Same-tonic mode flicker gets a cost unless a scale really demands it.
3. **Reference scale v2.** Each function maps to a default scale from the chord–scale table in §2. Today's closest-to-key rule becomes the tie-breaker, and the ranking list still lets the user override.
4. **"Harmonic analysis" switch** next to Common tones and Voice leading:
   - It adds a third lane to the strips, using jazz lead-sheet notation: a bracket over ii–V pairs, a solid arrow for V→target, a dashed arrow for tritone subs.
   - Each box gets a tag under its numeral, such as "V7/IV", "borrowed" or "chr. mediant".
   - Each tag has a one-sentence explanation on hover or tap, e.g. "A♭7 is V7 of D♭: it borrows the dominant of the IV chord."
5. **Per-box key override.** The user can pin a box's key; the planner treats it as fixed and plans around it. This also fixes the problem in §1 where setting a scale can't express "this chord's key is D♭".
6. **Evaluation harness.** A fixture file of labelled progressions, each with expected key, scale and function per chord:
   - the user's screenshots
   - textbook examples: Autumn Leaves, All the Things You Are, the rhythm-changes bridge, Giant Steps, and borrowed chords in pop songs
   - later, a sample from a licensed corpus

   It reports key agreement and chord–scale agreement, so weight changes can be judged by numbers.

## 5. Decisions needed before building

1. **Tonicization in the key bar.** For a lone A♭7 → (D♭) in A♭ major, should the key bar switch to D♭ major for that box (the user's stated preference), or show a thin nested "→ D♭" segment inside a continuing A♭ major bar? The nested form keeps "as few key changes as possible" and still shows the target.
2. **Major or minor targets.** When a secondary dominant's target isn't present or is ambiguous (F7 in A♭ major), use V7/ii → minor as in the textbook, or major as in the user's example, or ask?
3. **Notation.** Jazz (V7/IV, subV7, brackets and arrows), classical (V⁷/IV, vii°⁷/V), or a switch?
4. **Scope of the first version.** Jazz and pop patterns first, with classical patterns later?
5. **Corpora.** Is it acceptable to use research datasets for offline testing only?

## 6. Phases

| Phase | Work | Rough size |
|---|---|---|
| 1 | Relationship table and detection (secondary dominants, related ii, tritone subs, backdoor, borrowed chords, deceptive and plagal, chromatic mediants), with textbook unit tests | 1–2 sessions |
| 2 | Harmonic analysis switch: strip lane, tags, explanations | 1 session |
| 3 | Key plan v2 with function evidence, the tonicization display, per-box key pins; the user's screenshots as acceptance tests | 2 sessions |
| 4 | Function-based reference scales | 1–2 sessions |
| 5 | Evaluation harness and weight tuning against labelled progressions | ongoing |
