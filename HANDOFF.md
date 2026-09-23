# Handoff: Fretboard Harmony Workbench

## What it is and where
- **What:** a browser-based fretboard visualizer for guitar and bass. It started from a long spec the user wrote, built in 7 stages; the user has since added features in later sessions.
  - Boxes hold chords the user clicks onto the fretboard, with arpeggio and scale maps across any tuning.
  - Each box has a reference scale, chosen automatically or by hand, and the progression gets a key bar.
  - Strips between boxes show common tones, voice leading and harmonic analysis.
  - Presets and export/import; offline PWA.
- **Live site:** https://amritisepic.github.io/fretboard-workbench/ (GitHub Pages). Repo: https://github.com/amritisepic/fretboard-workbench (public).
- **Project folder:** `C:\Users\amrit\Documents\fretboard-workbench`, deliberately kept out of the user's ME 315 class folder.
- **Stack:** React 19, TypeScript 7 (strict), Vite 8, Vitest 5, Zustand 5, `idb` 8, `vite-plugin-pwa` 1.3, `@fontsource-variable/inter`. Tests add `fake-indexeddb`, jsdom, Testing Library, `axe-core` and Playwright.
- **First download:** 114.6 kB gzip of JavaScript and 7.5 kB of CSS, with about 30 kB more fetched when it is needed; `npm run check:budgets` holds both. Everything that opens on a click is split out in `App.tsx`: the presets panel (which carries the 88 examples), the export machinery, the tour, the scale wizard, the settings panel and the sidebar. Anything that renders on load is deliberately not split. The theory engine is still eager because the Zustand store calls `planKeys` synchronously through `state/boxChords.ts`; splitting it means changing the store.
- **Libraries the spec forbids:** music-theory libraries (no Tonal.js) and charting or diagram libraries. The fretboard is hand-built inline SVG.
- **The spec is not in the repo.** Its essentials and the user's rulings are summarised below.

## Current state
- **`master` holds everything** and deploys to Pages on every push. It includes:
  - harmonic analysis (all phases of `docs/harmonic-analysis-plan.md`)
  - the corpus evaluation and the retune it led to
  - still clicked notes and the fret-marker switch
- **PR #1** (`corpus-evaluation` → `master`) was merged on 2026-09-14 by fast-forwarding `master` and pushing it, which GitHub records as a merge.
- **Docs:**
  - `docs/harmonic-analysis-plan.md`: the plan, the user's decisions (§5), and what was built, with every building decision and the corpus results (§7)
  - `docs/harmonic-patterns.md`: the pattern catalogue, with known gaps in its §7
  - `docs/ui-testing.md`: what the interface tests cover, the measured layout budgets, and every known interface defect on record
- **The design plan (Phases 0–6)** was carried out on `claude/fretboard-design-review-bpx5lx`: Phase 0 and 1 merged to `master` as PR #2 on 2026-09-21, and Phases 2–6 on 2026-09-23. See "The design plan, carried out" below, `docs/ui-testing.md` for every before-and-after number, and `CLAUDE.md` for the design contract the build now enforces.
- **Work from 2026-09-15** is on `master` and deployed. It was fast-forwarded from `scale-wizard-examples-export-tour` the same day, and the live site's bundle was checked for the new features. It covers the scale wizard, built-in examples, PDF/PNG export, the guided tour, vertical necks by default and the delete-warnings switch. See "Added on 2026-09-15" below.

## Open work, roughly in priority order
0. **Look at the rebuilt interface on real devices**, in both themes: a phone in portrait, a tablet, and a laptop. Every number in `docs/ui-testing.md` was measured in headless Chromium; nobody has used it on a phone yet, or in Safari or Firefox. In particular:
   - dark mode on a stage-lit phone (colors set from JavaScript need `light-dark()`: Chrome 123, Safari 17.5, Firefox 120)
   - the Display popover on touch
   - the one-line strips on a phone
   - the key-bar choice buttons, now the bar's full height
0a. **Design targets not met, on the record:**
   - first-paint JavaScript is 114.6 kB against the plan's 60, because the theory engine is eager (the store calls `planKeys` synchronously)
   - 31 chords are about 4,170 elements against the plan's 2,000, because every fretboard position is a real control
   - fretboard positions are 26px, clearing the 24px WCAG floor but not the 44px touch guideline the plan hoped for under `(pointer: coarse)`
0b. **Small things known and left:**
   - between 1025 and about 1050px, and at 761–800px, the preset name is shortened with an ellipsis
   - boxes saved with the four old swatch colors (orange, ochre, green, teal) show as custom colors; `labelInk` still gives them readable labels
   - the PWA manifest's `theme_color` is the light paper color, since a manifest cannot vary it by theme
0c. **Review the 2026-09-15 decisions with the user** (listed under "Added on 2026-09-15"), in particular:
   - the standards' chord changes, written from memory rather than checked against a chart
   - export in Safari and Firefox, which was never tried
   - real printing of an exported PDF
1. **Visual check of the analysis interface on a visible screen.** It was verified through the DOM and a few screenshots only, since the app window was hidden for most of the session. Look at:
   - the function-tag explanation popover (hover, tap, view mode)
   - the key-bar split chooser ("B♭ minor | B♭ major?") and the scale-bar split under it
   - stacked figured bass in classical notation (V⁶₅)
   - the sidebar Harmony section and "Key at this box"
   - phone width (760px and below)
2. **Reviews with the user that never happened:**
   - the pattern catalogue (Phase 0's review)
   - the building decisions in the plan's §7 (tonicization scope, modal home keys, ambiguity margin, pinning moving the scale, notation choices)
3. **Accuracy, guided by `npm run eval:corpus`** (results in the plan's §7):
   - Pop and rock: the key "a 5th below" the annotated one is still the largest error (I–IV loops read in the IV key).
   - Classical: "a 5th above" and the relative key are the largest errors.
   - Early choral music (70.5%) and the Lieder (77.9%) still trail the old key finder (72.4%, 80.6%).
   - Any weight change must keep all 60 labelled progressions passing and be re-measured on all three corpora. The runs take about 1 minute for Billboard, 30 s for RS200 and 7 minutes for When in Rome.
4. **Performance:** about 60 ms for 32 chords, and up to about 230 ms for a long classical piece. The key plan is cached per store change but recomputed from scratch, not incrementally.
5. **Known analysis gaps** (patterns doc §7):
   - no melody or metre
   - diatonic planing isn't tagged
   - enharmonic modulation is flagged only at a diminished 7th
   - augmented sixth chords are named only as tritone substitutes of V
   - chord-scale suggestions can't be checked against any open corpus
6. **Ideas raised with the user, not scheduled:** audio playback, typing chord symbols, suggested voicings, share links, image/PDF export, a practice mode, onboarding with example progressions, and accounts with sync. Accounts were deferred in favour of Export all.

## Environment
- **OS and Node:** Windows 11, with Node 24 LTS installed via winget at `C:\Program Files\nodejs`.
- **PATH:** shells opened before that install need `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. In Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`.
- **PowerShell is Windows PowerShell 5.1.** No `??`, `?.` or `&&`.
- **PowerShell blocks `npm.ps1`** (execution policy). Use `npm.cmd …`, or Command Prompt or Git Bash. The user was told they can run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` themselves. Don't change it for them; it's a security setting.
- **GitHub CLI:** installed at `C:\Program Files\GitHub CLI\gh.exe` and signed in as `amritisepic` (scopes repo, workflow). Shells opened before the install need the full path. Signing in is the user's to do.
- **Git:** `user.name` is "Amrit" and `user.email` is the GitHub no-reply address `290815722+amritisepic@users.noreply.github.com` (this repo only). The user's GitHub login email is amritisepic@gmail.com.
- **No servers are running.** The user runs the dev server themselves; if you start one, stop it afterwards (see Tooling lessons).
- **Research corpora** are in the gitignored `corpora/` folder on this machine, never in the repo:
  - McGill Billboard (CC0)
  - RS200 (CC BY 4.0)
  - When in Rome analyses only (mixed licences, including CC BY-NC-SA)

  `corpora/SOURCES.md` records sources, sizes and licences, and reports go to `corpora/reports/`. Another machine would need them downloaded again (see Tooling lessons).

## Commands
- `npm.cmd run dev`: http://localhost:5173 (listens on `localhost`, not `127.0.0.1`).
- `npm.cmd test`: 339 tests in 32 files, about 22 s. Most of the time is the exhaustive pitch-set tests. 16 are `it.fails`: interface defects on record, see `docs/ui-testing.md`.
- `npm.cmd run test:e2e`: the browser suite (screenshots and layout measurements) in Chromium at 390, 768 and 1440 px. It builds and previews first, so allow a minute. `test:e2e:update` rewrites the screenshot baselines. Not part of `npm test` and not in CI yet.
  - The first run on this machine needs `npx playwright install chromium`.
  - Screenshot baselines are per platform (`-linux.png`, committed, matching CI). A Windows run writes its own `-win32.png`; don't commit those.
- `npm.cmd run typecheck`: runs `tsconfig.theory.json` (no DOM allowed in `src/theory` and `src/data`), `tsconfig.json` (covers `src` only) and `tsconfig.e2e.json` (covers `e2e/` and `playwright.config.ts`). `@types/node` is installed but only `tsconfig.e2e.json` enables it, so tests in `src` still can't import `node:` modules. `scripts/` isn't typechecked.
- `npm.cmd run eval:corpus`: evaluates the analysis against the corpora in `corpora/`.
  - It writes `corpora/reports/latest.md`, or `latest-<corpus>.md` when limited to some corpora, plus a timestamped copy.
  - Environment variables: `CORPUS_ONLY` (for example `rs200` or `billboard,when-in-rome`), `CORPUS_LIMIT` (pieces per corpus) and `CORPUS_WINDOW` (chords per window; the default 0 reads whole pieces).
  - Runs with different `CORPUS_ONLY` values can go side by side without overwriting each other's reports.
- **Analysis fixtures:** `npx vitest run src/theory/__tests__/harmonicAnalysis.test.ts`. The last test reports agreement: fixtures passing, local keys, chord scales, ambiguous listings.
- `npm.cmd run build`, then `npm.cmd run preview`: http://localhost:4173.
- `npm.cmd run verify:pwa`: builds, then checks every `dist` file is precached and the manifest is installable.
- `npm.cmd run test:offline`: acceptance test 11. It uses headless Edge or Chrome over the DevTools protocol, serves on port 4174, shuts the server down, then checks the app boots offline.
- `npm.cmd run icons`: regenerates `public/` icons from `scripts/generate-icons.mjs`, which has no dependencies.
- **Subpath build like Pages:** set `$env:BASE_PATH = '/fretboard-workbench/'` before `build`, and before `preview` too.

## Deployment
- **Workflow:** `.github/workflows/deploy.yml`. Every push to `master`, or a manual run from the Actions tab, runs `npm ci`, `npm test`, then `npm run build` with `BASE_PATH=/<repository-name>/`, and publishes `dist` with the Pages actions.
- **Checks:** `.github/workflows/ci.yml` runs on every push and pull request: unit tests (with axe and the design-token checks), the build with its typecheck, the bundle budgets, the PWA check, and the browser suite (screenshots, layout budgets, overlays, themes), uploading the Playwright report when it fails.
- **Base path:** `vite.config.ts` uses `process.env.BASE_PATH ?? '/'` as Vite's `base`. A user site or a custom domain needs `BASE_PATH` set to `/`.
- **Pages setup, already done:**
  - Source is set to "GitHub Actions".
  - The `github-pages` environment only allows deploys from `master`. It first allowed only `main`, which rejected the deploy and gave a 404 until the user changed it.
- **Check deploys** with `gh run list --branch master` and `gh run watch <id> --exit-status`, or with the public Actions API.
- **Presets don't travel between sites:** each origin has its own IndexedDB, so move presets with Export all and Import.

## Git
- **History was rewritten on 2026-09-13** to replace the old commit email with the no-reply address everywhere, including a line in this file. SHAs from before then no longer exist.
- **Commits** (all on `master`):

  | SHA | What |
  |---|---|
  | `b559fbc` | Stages 1–3 |
  | `b885973` | Stage 4, sidebar |
  | `76a91f2` | Stage 5, canvas |
  | `9c7e78b` | Stage 6, presets |
  | `1146eb9` | Stage 7, PWA |
  | `5d74ef8` | First handoff |
  | `06877ca` | Find key, capo, global shift, tension chord names |
  | `d08b992` | Key bar and scale bar, tonic-preserving key plan |
  | `fd550d1` | Export all, GitHub Pages deployment |
  | `1d454d6` | View mode, mobile layout, animated notes, split strip switches |
  | `0ce8623` | Harmonic analysis decisions and the previous handoff |
  | `5aaef1f` | Harmonic analysis, fret markers, still clicked notes |
  | `09dc5a2` | Corpus evaluation and the tonic-weight retune |
  | `6c125bc` | Final corpus results and the previous handoff |
  | `237bb4c` | Scale wizard, examples, export, guided tour |
  | `ea8967c` | Handoff for the 2026-09-15 work |
  | latest | Handoff marked as merged and deployed |

- **Branches:**
  - Old local branches `stage-4-sidebar`, `stage-5-canvas`, `stage-6-presets`, `stage-7-pwa`, `handoff-notes`, `find-key-workflow`, `key-bar` and `view-mode-mobile` point at earlier commits.
  - `harmonic-analysis` (local) points at `5aaef1f`, and `corpus-evaluation` (local and `origin`, PR #1) at the latest commit.
  - `origin` has `master`, `view-mode-mobile`, `corpus-evaluation` and `scale-wizard-examples-export-tour`.
  - `scale-wizard-examples-export-tour` (local and `origin`) points at `ea8967c`. It was fast-forwarded into `master` and deployed on 2026-09-15.
  - `handoff-merged` (local) holds the commit that marks it merged; `master` was fast-forwarded to it.
- **Branch workflow:** when asked to commit while on `master`, create a branch first. Merge by fast-forwarding (`git merge --ff-only`) and pushing `master` when the user asks. That keeps history linear, keeps SHAs, and marks a matching PR as merged. `gh pr create` opens PRs.
- **Commit messages** end with the `Co-Authored-By` line the session gives. Write them to a file and use `git commit -F`, because PowerShell splits quoted text.
- **Commit only when asked.**

## How the user wants to work
- **Stop for review** after each chunk of work. For big autonomous stretches (like the overnight harmonic analysis build) the user may instead ask for decisions to be made and reported, stopping only for ones that would be costly to undo.
- **List every decision** made where the spec or request was ambiguous.
- **Ask about genuine ambiguities** instead of guessing, and don't silently substitute simpler features.
- **Check claims** rather than trusting them, including the spec's.
- **Verify in the real app** where possible, and say plainly how it was verified and what couldn't be.
- **Plan before building large features:** the user has asked for plans (like the harmonic analysis plan) before implementation.
- **Report measured trade-offs honestly.** When a result misses a bar that was stated beforehand, say so and let the user decide rather than moving the bar.

## Code layout
- **`src/theory/`** (pure, framework-free):
  - `pitch.ts`: 12-bit pitch-class sets, intervals, degrees
  - `spelling.ts`: derived enharmonic spelling, tonic spelling choice, scale-degree labels
  - `scales.ts`: families, mode rotation and naming ("C major", "A minor", "D Dorian"), `withMode`, `transposeScaleRef`
  - `chords.ts`: chord types including generated tension chords, chord identification with slash names, chord-tone spelling
  - `ranking.ts`: scale ranking by tiers, pinning of the key's own modes, voice-leading term
  - `voiceleading.ts`: minimum-motion matching
  - `keys.ts`: key names, roman numerals (`romanNumeral`, `degreeNumeral`), `closestScale`
  - `analysis.ts`: the harmonic analyzer. It covers chord facts, home keys, readings per key, the cheapest-path search with per-reading path costs, alternatives, pins, relations and box tags.
  - `patterns.ts`: named multi-chord patterns found in a finished analysis
  - `keyPlan.ts`: `planKeys` (key bar), `findKey`, `functionScale` (the scale a reading suggests)
  - `fretboard.ts`: tunings, positions, capo, the one-note-per-string limit, transposing shapes
  - `scaleChords.ts`: the scale wizard's notes, degrees (R, ♭2…), chromatic octave and chords stacked from each degree with jazz and classical numerals
  - `chordSymbols.ts`: lead-sheet symbols ("Dø7", "G7b9", "C/G") into chord types; the test helper `__tests__/chordSymbols.ts` uses it
  - `voicing.ts`: playable voicings for a symbol, "open" (pop/rock) or "jazz" (mid-neck, no open strings, smooth motion)
- **`src/data/`:** `examples.ts` (the built-in example progressions and standards), and scale families, chord types and tension bases, chord-ID weights, ranking weights with commonness priors, tuning presets, `harmonyRules.ts` (borrowing sources, cadence table, function scales, pattern names), `analysisWeights.ts` (every analysis cost).
- **`src/state/`:**
  - `workbench.ts`: the Zustand store with settings (tuning, frets, capo, fret markers), key, strips (including `analysis` and `notation`), orientation, boxes (including `keyPin` and `readingPin`), selection, view mode and document
  - `boxChords.ts`: each box's chord (memoised) and `keyPlanOf` (planKeys with pins; the last plan is cached), shared by the store and views
  - `library.ts`: the preset library store, including Export all
  - `repository.ts`: IndexedDB access
  - `persistence.ts`: session autosave and restore before first render
  - `presetFormat.ts`: validation and the export format. Version 2 adds whole-library files; preset and folder files are still written as version 1. Fields added later are optional when read, and old snapshots are upgraded.
  - `libraryTree.ts`, `documentStatus.ts`, `ids.ts`
  - `preferences.ts` (screen, delete warnings, tour seen) and `scaleWizard.ts` (wizard settings), both in localStorage through `localSettings.ts`
  - `examples.ts`: builds an example into a preset (voicings, key, function scales) and opens it as an unsaved copy
  - `persistence.ts` also has `pauseSessionSaves`, which the tour uses
- **`src/components/`:**
  - top of screen: `TopBar` (with the Edit/View switch), `PresetNameField`, `ExplorerPanel`, `SettingsPanel` (with the fret-marker switch)
  - canvas: `Canvas` (one key bar per chord, over that chord, with the scale when it differs and the key-choice buttons), `useRowStarts`, `useFitToFrame` (view mode, with a legibility floor past which it scrolls), `CanvasToolbar` (Key, Find key and Shift in the bar; everything about how things are drawn in the Display popover), `BoxCard` (function tag and explanation), `Fretboard` (SVG with inlays), `VoiceLeadingStrip` (with the analysis lane), `FunctionText`
  - sidebar: `Sidebar`, `RootBox`, `ScalePicker`/`ScaleSelects`, `ChordNameField`, `HarmonyField` (readings, pins, key at this box), `ColorField`, `RankingList` (marks the suggested scale, with a visible legend), `FillField` (a Switch for the fill and a Segmented for its type)
  - the control vocabulary: `Switch`, `Segmented` (with `rovingRadioGroup.ts`), and three button levels in CSS; `InfoPopover`; `focusLayer.ts` (`useModalLayer`, `usePopoverLayer`)
  - other: `UpdateNotice`, `ConfirmDialog`, `useKeyboardShortcuts`, `readingChoice.ts` (pinning a reading moves an unedited scale with it)
  - scale wizard: `ScaleWizard` (screen and controls), `ScaleSheet` (heading, chromatic grid, fretboard, chord table, shared with export), `scaleWizardModel.ts`
  - `export/`: `ExportDialog` (options, preview, download), `WorkbenchSheet` and `ScaleExportSheet` (static layouts drawn off screen), `rasterize.ts` (element → SVG foreignObject with inlined CSS and Inter → canvas), `exportLayout.ts` (pages, fit, pagination), `pdfWriter.ts` (JPEG pages into a PDF)
  - `tour/`: `GuidedTour` (overlay, demo, restore) and `tourSteps.ts`; steps find their targets through `data-tour` attributes
  - pure view models: `boardModel.ts`, `canvasModel.ts` (analysis and key choices per box), `stripModel.ts`, `rankingModel.ts`, `findKeyModel.ts`, `analysisModel.ts` (labels in both notations, explanations, relation and pattern labels)
- **`src/corpus/`** (pure; typechecked and unit-tested with inline snippets):
  - parsers that turn research-corpus annotations into the analyzer's chords, each with its annotated key: `billboard.ts` (McGill Billboard, Harte chord labels), `rockCorpus.ts` (RS200 `.har` rules) and `romanText.ts` (When in Rome)
  - `chords.ts`, which builds chords from degrees
  - RS200 documents "V7" as a major seventh; the parser reads a seventh on V as dominant, as its analysts mean.
- **`scripts/corpus/`:**
  - `evaluate.eval.ts`, the evaluation runner, run by `vitest.corpus.config.ts`
  - `legacy/`: the key finder from commit `0ce8623`, kept only as the "old key finder" comparison
- **Styles:** seven sheets in `src/styles/`. `base.css` holds the tokens (every color as `light-dark()`, the six type sizes, the seven spacing steps) and the control vocabulary; `workbench.css`, `sidebar.css` and `panels.css` load on first paint; `wizard.css`, `export.css` and `tour.css` arrive with their components' chunks. `src/state/theme.ts` and a few lines in `index.html` apply the theme before first paint.
- **Tests:** in `__tests__` folders under `theory`, `components`, `state`, `corpus` and `design`. `vite.config.ts` holds both the Vitest settings and the PWA settings.
  - Component tests are `.test.tsx` and open with `// @vitest-environment jsdom`; everything else stays in Node. Setup is `src/test/setup.ts`, shared fixtures `src/test/fixtures.ts` (which builds progressions out of the built-in examples), axe helpers `src/test/axe.ts`.
  - `src/design/` holds the contrast arithmetic and the design-token checks: contrast in both themes, the type and space scales, the theme switching, motion. They read every sheet through `src/design/styles.ts` and `?inline`, which is why `vite.config.ts` sets `test.css: true`.
  - `e2e/` holds the browser suite: `states.ts` (the seven states), `visual.spec.ts` (21 screenshot baselines), `measure.ts` and `metrics.spec.ts` (the layout budgets), `overlays.spec.ts` (focus and inert in a real browser), `theme.spec.ts`.
  - `theory/__tests__/harmonicAnalysis.test.ts` is the harness of 60 labelled progressions.
  - `theory/__tests__/chordSymbols.ts` builds chords from symbols ("B♭m7", "C/G", "F♯7(11)") for tests.

## Spec essentials
- **Settings:** 4–9 strings, and resizing adds or removes at the low end. Per-string tuning with presets. 12–30 frets, clamped with an inline message; the default is 12. Capo 0–11. Fret markers on or off (default on).
- **Boxes:** click notes on the SVG fretboard, one per string, six at most. A fill switch gives an arpeggio map or a scale fill.
  - A reference scale is always required.
  - Spelling is derived, never toggled.
  - The chord-name dropdown lists every reasonable reading.
  - The mode slider keeps the notes and changes which degree is the root.
  - The root box transposes the whole box.
- **Scale ranking, with all weights in `data/rankingWeights.ts`:** tiers are
  1. contains the chord
  2. missing tones, weighted root 10, 3rd 8, 7th 6, altered 5th 8, extensions 3, perfect 5th 1
  3. everything else, sorted by overlap

  There's also a collapsed "maximally distant" list. The scale the chord's function suggests is marked "Suggested".
- **Strips** between boxes: separate Common tones, Voice leading and Harmonic analysis switches.
- **Key bar** above each box, carrying the reference scale too when it differs from the key, with roman numerals counted from the key.
- **Presets and folders** in IndexedDB, with JSON export/import and Export all.
- **Offline PWA.**
- **Design:** off-white `#FAF9F7`, dark grey `#3A3A3A`, rounded corners, and no gradients or shadows apart from a faint one on the sidebar and the scroll shadows on the export options. The exception is clicked notes, at the user's request, whose highlight is now a small spot at the top that stays clear of the label. A dark theme follows the system or a choice in Settings. `CLAUDE.md` holds the rest of the design contract.
- **Keys:** Esc deselects, arrows nudge the root, Space toggles the fill, Delete removes a box after confirming. All shortcuts are off in view mode.
  - These are window-level shortcuts, and a widget that claims the same key must call `stopPropagation`, not only `preventDefault`: React hands the event on to `window` afterwards. The fretboard and the radiogroups all do, and each has a test for it. Note `isControl` in `useKeyboardShortcuts.ts` matches a `button` element and so never matches an SVG group carrying `role="button"`.
- **Keyboard access:** every fretboard position is a toggle button. A board is one tab stop, landing on the first note of the chord; arrow keys walk the grid following the drawn orientation; Enter and Space place or remove a note; Home and End run along a string. View mode takes the roles and tab stops away again. Segmented controls, the dot-color swatches and the fill switch follow the ARIA radiogroup pattern through `components/rovingRadioGroup.ts` (one tab stop, arrows that move focus and selection, wrap, Home/End).
- **Empty workbench:** a card naming what a box is, with "Add a box" and "Open an example". The old full-height bordered frame with a bare "+" is gone.

## The user's rulings (don't revert)
- **Out-of-scale spelling ties** are chord-aware (letters stacked from the chord root), then fall back to ♭2 ♭3 ♯4 ♭6 ♭7.
- **In non-7-note scales,** a perfect 5th always keeps the 5th letter.
- **Unnamed blues rotations** are called "Blues mode n".
- **Names:** Ionian and Aeolian read "Major" and "Minor" everywhere; after a tonic they are lower case, like key names ("C major", "A minor").
- **Chord ID:**
  - Prefers the closest complete triad or diatonic chord, with slash names (C E A over C is Am/C).
  - From four sounding notes up, an omitted 5th is cheap, so the bass decides (C E♭ F B♭ over C is Cm7(11), not F7sus4/C).
  - Five-plus-tone chords don't print "(no 5)".
- **Tension chords** come from `TENSION_BASES` in `data/chords.ts`: F♯7(11), G7(13), m9♭5, 9(♯11).
- **Chords** have one note per string and six notes at most; a refused click shows a brief notice.
- **Workflow:** fill in the chords, press Find key, then adjust.
- **Harmonic analysis decisions** (plan §5): tonicization switches the key bar to the target's key; ambiguous readings are all shown, never decided silently; a jazz/classical notation switch; every pattern in scope; corpora OK for offline testing, with only code (never data) committed.
- **Analysis weights after the corpus evaluation** (user, 2026-09-14):
  - A plain major triad on V resolving to I earns 0.9; a dominant seventh keeps 1.5.
  - Each tonic chord counts 0.4 (was 0.2).
  - The user kept these although When in Rome fell 0.2 points below the old weights, for +5.2 on Billboard and +4.2 on RS200.
  - Rejected: 0.6 (classical −0.8) and 1.2 (brings back the rock-loop misread and fails a labelled test).
- **Find key** runs the analyzer on the chords alone:
  - Home keys are major, minor, Dorian, Mixolydian, Lydian and Phrygian. The first key bar allowed only major and the minors; the plan's modal keys replace that, pending the user's review of §7.
  - The preset key becomes the home key covering the most boxes.
  - Each box's scale is the one its reading suggests (`functionScale`): Mixolydian for V7 of a major chord, Phrygian dominant for V7 of a minor one, whole–half diminished for a diminished 7th, Lydian dominant for a tritone substitute. Otherwise it's the scale closest to the local key, or to the source key for a borrowed chord.
  - Pins are respected.
- **Key bar** (`planKeys`, analysis in `theory/analysis.ts`, costs in `data/analysisWeights.ts`):
  - Each box shows the local key of its reading. That's the home key, or the key a secondary dominant, leading-tone chord, related ii or tritone substitute tonicizes. A chord outside the key that its dominant just resolved to shows its own key.
  - A diatonic target stays in the home key (A7 → Dm7 in C: D minor over A7, C major over Dm7).
  - A scale that alters the key still changes the collection but keeps the tonic: A♭ Lydian in C major shows C minor. A minor key's raised 7th on V/vii doesn't count as an alteration.
  - A box's scale is evidence for its reading only when the scale holds the chord.
  - Ambiguous boxes split the key bar ("B♭ minor | B♭ major?", at most two) and mark the numeral tentative. Clicking a choice pins that reading, and clicking the pinned one again unpins.
  - The sidebar's Harmony section lists every reading with its explanation and can fix the key at the box.
  - Test 10 (first amendment) still passes. The run-of-chords test was amended again for tonicization.
- **Degree labels** count from the key in effect by default. Each box can switch to its reference scale, and the strips follow that choice.
- **Capo** keeps the tuning. Shapes move with it, so chords, scales, the key and key pins transpose. Toolbar Shift transposes everything by a semitone.
- **Neck orientation switch** rotates the fretboards (vertical = chord-chart style); it doesn't change the box layout.
- **Board switch** (in the Display popover, next to Neck, available in view mode too): **Chord chart** crops each board to a window around its shape, the way a printed chart does; **Full neck** draws all the frets as before. Saved with the preset; new presets default to Chord chart, and a preset saved before the field existed opens Full neck, since that is how it was made.
  - The window is `fretWindow` in `components/boardModel.ts`, carried on `BoxView.window`. It covers the drawn positions (clicked notes and whatever a fill lights), at least five frets wide, growing towards the nut when the shape is near it so an open chord shows the nut rather than floating above it. A window that does not reach the capo draws a position marker — the first fret's number — instead of a nut.
  - **Only the selected box gets room to move** (`editableWindow`, two frets up and one down). A window worked out from the notes is a dead end for building, because nothing reachable inside it can push it up the neck; paying for that on every board cost half the density the window was for (three chords on a laptop against six). Clicking any note selects its box, so the reach arrives when it is wanted and the rest of the canvas stays tight.
  - The scale wizard passes no window and is unaffected.
- **Harmonic analysis sits by the neck**, not in the header: beside the board when the neck is horizontal, under it when vertical. Keeping it out of the header is what makes every header the same height, so the boards in a row start at the same place — a tag that wrapped to two lines used to push its own board 17px down. The refused-click notice is positioned rather than in the flow for the same reason.
- **Strips:**
  - Scales are compared when both boxes are set to fill scale.
  - Common tones, Voice leading and Harmonic analysis are separate switches in the Display popover. The Names/Degrees choice shows while common tones or voice leading is on, and Jazz/Classical while harmonic analysis is on; both appear inside the popover, so nothing on screen moves when they do.
  - A strip draws only the voices that move, as a labelled arrow each (`B♭ ↘ A −1`); held voices are a dot each, and a summary line counts the work. The screen-reader text names every voice either way.
  - Old presets' single "visible" switch sets both.
- **Ranking:** rows all start on the chord root. Tier-0 modes of the key in effect are pinned first. The tier-1 limit is 8.
- **Edit / View** switch in the top bar:
  - View mode hides the sidebar, the add button, each box's "x" and the Key/Find key/Shift controls, and disables note clicks and shortcuts.
  - It scales the whole canvas to fit. `useFitToFrame` tries layout widths up to a single row, box groups keep their natural width, and it enlarges at most 1.5×. It does not shrink below the scale at which the smallest text is 8px (the export's print floor, `MIN_LEGIBLE_SCALE`); past that the frame scrolls.
  - Key-bar choices show as text, and function tags still explain on hover or tap.
  - It isn't saved.
- **Each box has an "x"** that removes it after the same confirmation as the Delete key.
- **Clicked notes** have a gradient core and a crisp ring in the box color. The animation was removed on 2026-09-14, at the user's request.
- **Fret markers:** quiet inlays at 3, 5, 7, 9, 12 (two dots), 15 and so on, behind the strings. A switch in Settings, on by default and saved with the preset.
- **Responsive:**
  - The `.app` grid column is `minmax(0, 1fr)`, so content scrolls instead of widening the page.
  - At 1024px and below the sidebar slides over the canvas with a Done button.
  - At 1024px and below the top bar's tertiary buttons show icons only (their names stay accessible), and the save status steps out of sight, kept for screen readers; the Save button carries it.
  - At 760px and below: the name takes the leftover width, the toolbar is one row that fits, strips sit above their box as a single line (`3 semitones · 2 common`), and wide necks scroll sideways.
- **Accounts:** not now. Export all is the backup and migration path.

## The design plan, carried out (2026-09-17 to 2026-09-23)

A design review found that the interface had not kept up with the theory engine behind it. The review
and its plan were delivered in conversation, not committed; `docs/ui-testing.md` records every
measurement, and `CLAUDE.md` records the rules the work settled on. In short:

- **Phase 0, instrumentation:** component render tests, axe, contrast tests and a Playwright suite at
  three widths, with every known defect on record as a failing assertion.
- **The AI-code callouts:** keyboard access to every fretboard position, radiogroups that implement
  their pattern, real modal layers, a touch-reachable popover instead of a permanent tooltip, code
  splitting, and a first-run state that says something.
- **Phase 1, the fretboard:** a chord-chart window instead of the whole neck (the Board switch), one
  element per empty position, 25px notes, and boards in a row that start together.
- **Phase 2, information architecture:**
  - one key bar per chord, over the chord it names
  - one function chip
  - strips that draw only the voices that move
  - a Display popover that lets the toolbar fit a phone
  - the load-bearing `title`s moved into text or accessible names
  - rows of charts that line up at their heads and chips
- **Phase 3, the design system:**
  - one control vocabulary and a top bar nothing covers
  - a palette that clears WCAG, and region colors ΔE 15 apart
  - six type sizes and seven spacing steps
  - a dark theme
  - the stylesheet split into seven sheets, three of them lazy
- **Phase 4, accessibility:** closed by the callouts, plus reduced motion.
- **Phase 5, export:** one screen by default, a print floor of 6 pt, and view mode that scrolls rather
  than shrinking text below 8px.
- **Phase 6, guardrails:** `ci.yml`, bundle budgets, and `CLAUDE.md`.

## Added on 2026-09-15 (merged and deployed; decisions await the user's review)
- **Asked and answered before building:**
  - The guided start is an interactive tour.
  - PDFs are built in the app and downloaded directly.
  - Examples are a built-in read-only section.
  - Scales without 7 notes stack every other note.
  - Jazz numerals count accidentals from major and classical ones from the scale.
  - The delete-warnings switch covers boxes only.
  - Pacing: build everything and report the decisions.
- **Vertical necks by default** for new presets and new documents. Files without an orientation still open horizontal, since they were made that way.
- **Show delete warnings:** a Settings switch kept on this device (localStorage), on by default. It covers the box × and the Delete key. Preset and folder deletions always ask.
- **Tool switch** in the top bar: Workbench | Scale wizard, remembered on this device.
  - The wizard hides Save, Presets, the name and Edit/View, and Ctrl+S does nothing there.
  - At 760px and below the workbench top bar takes two rows: the switch, Guide, Export and Save above; Presets, the name, Edit/View and Settings below.
- **Scale wizard:**
  - Tonic and scale dropdowns (any mode of any family).
  - A chromatic octave from the tonic, with scale notes lit and the tonic red. Notes outside the scale use the usual out-of-scale spelling, and their degree boxes stay empty.
  - Degrees are counted from major, with "R" for the tonic. The user's example gave Phrygian dominant a 7; it is ♭7, and the wizard shows ♭7.
  - Show scale draws the scale on the workbench's tuning, frets, capo and markers: the tonic at full strength, other notes in the map shade, notes or degrees, either orientation.
  - The chord table has Numeral | Chord | Notes | Degrees, a Jazz/Classical switch and a top-voice slider (5–13).
  - Settings are kept on this device. The defaults are show scale on, notes, vertical, jazz, and 7ths.
- **Chord names in the wizard:**
  - Regular stacks are named from their thirds with the tension-chord rules: a natural 9th stacks into the symbol, so the I13 of C major reads Cmaj13 although it holds F. One set of parentheses is used: Fm(maj11,♭13).
  - Other stacks (a diminished 3rd, pentatonic "triads") are named by identification with the degree in the bass (C pentatonic on C: Am/C). Their numeral is the plain degree.
  - Even-sized scales return to the root after half their notes, so whole tone, blues and augmented stack triads only and the diminished scale stacks up to 7ths. The slider stops beyond that are disabled.
  - Classical numerals count from the scale only for 7-note scales. They show quality signs and the top figure (⁷ ⁹ ¹¹ ¹³), not the alterations.
- **Examples** (Presets panel, below the saved presets):
  - Four folders: Pop progressions (21), Rock progressions (19), Jazz progressions (20) and Jazz standards (22).
  - One box per chord change, with repeated sections written out.
  - The standards' changes were written from memory in common lead-sheet form. jazz-circle.com gave obviously wrong charts, so no web source was used.
  - Each example opens in standard tuning, 12 frets, vertical, with analysis on. It opens in its own key, and each box takes `functionScale` for that key.
  - Voicings are generated by `theory/voicing.ts`, which prefers keeping the 5th where omitting it would print "(no 5)". A test checks that every box names its chord as written.
  - An opened example is an unsaved copy that keeps a snapshot, so browsing examples doesn't ask about discarding until one is edited (`hasUnsavedWork`).
- **Export** (top-bar button on both screens; disabled on an empty workbench):
  - **Workbench options:** which chords, and whether to show the title, key bar, scale bar, numerals, chord names, analysis, common tones and voice leading. Also the neck orientation and boxes per row.
  - **Strips:** a strip between chosen boxes that aren't neighbours in the progression compares them but has no analysis lane.
  - **PDF page:** A4, Letter or A3, portrait or landscape, with 6, 12 or 20 mm margins.
  - **PDF fit:** one page (up to 200%), page width (60% of screen size unless boxes per row is set), or a 25–200% scale. Pages break between rows or sections.
  - **PDF quality:** JPEG pages at 150 or 300 dpi, so the text isn't selectable.
  - **PNG:** 1–3× screen size, wrapping at 1400 px, at most 16,000 px a side.
  - Exports are white and always use the desktop layout, because media queries are left out. Choices are remembered until the app closes.
  - **Scale wizard export:** name, chromatic notes, degrees, fretboard and chord table.
- **Guided tour:**
  - The welcome card appears by itself only on a first visit (never seen, empty workbench, no presets or folders). The Guide button starts it any time.
  - Starting it sets aside the workbench, the wizard settings and the screen, pauses session saving and opens the demo Cmaj7 A7 Dm7 G7 Cmaj7.
  - It has 22 steps across both tools. Ending it at any step restores everything.
  - The overlay blocks the app, and Esc ends the tour.
- **Fixed on the way:** the sticky canvas toolbar used `top: 0` inside the padded workspace, so it stuck 28px low and content scrolled into view above it. It now uses `top: -28px` (−16px on phones).
- **Verification:**
  - Tests, typecheck, build, `verify:pwa` and `test:offline` (15/15) all pass. The offline script now declines the tour and reads only saved presets.
  - The app was driven through the DOM at 1280×720 and 375×812.
  - A real PDF download was captured: Autumn Leaves, 8 pages, 2.3 MB.
  - Exported pages were checked as images.
  - Not checked: Safari and Firefox (foreignObject rendering), touch devices, printing, and on-screen screenshots of the tour.

## Spec errors found (the code uses the correct theory)
- F♯ natural minor's 7th is E; E♯ belongs to harmonic or melodic minor.
- Harmonic minor mode 3 is Ionian ♯5 (now "Major ♯5") and mode 7 is Altered ♭♭7, not the spec's names.
- Rootless chord readings need roots outside the clicked set.
- Test 9's total motion is 3, not 4.
- Test 11's "hard reload": Chromium's Ctrl+Shift+R bypasses service workers, so the test uses a normal reload and a new tab.

## Other design choices (reported to the user)
- **Scale library:** major, melodic minor, harmonic minor, harmonic major, double harmonic, Neapolitan major and minor, pentatonic, blues, whole tone, octatonic, augmented. Unnamed 7-note modes get generated names such as "Dorian ♭5".
- **Settings panel** opens from a tab at top right. Highest string is on top and frets are evenly spaced.
- **Sidebar** is on the right. The root box shows the scale's tonic. The chord-name choice is kept per box.
- **Strips:** settings are global and live in the canvas toolbar. Each strip is grouped with the box it leads into, so wrapping never separates them.
- **Numerals** count accidentals from the key's own degrees (C in A minor is III). New boxes start in the key in effect at the last box.
- **Saving:** the session autosaves (300 ms after changes). Save or Ctrl+S overwrites the open preset or creates a new one.
  - Folders nest. Deleting one takes its contents, after a confirmation with counts.
  - Names are unique within a folder.
  - Opening a preset or starting a new one asks before discarding unsaved work.
  - The name field writes on every keystroke, and Esc reverts to the last saved name.
- **Updates:** the app asks before reloading (Reload / Later). The "Ready to work offline" message was dropped: it could only ever fire on a first visit, asked nothing of the reader, and landed on top of the welcome card.

## Tooling lessons
- **The Claude in-app browser pane can't run service workers.** Test offline behaviour with `npm run test:offline`.
- **When the Claude window is hidden:**
  - Screenshots and clicks can fail, and focus and blur events don't fire.
  - `requestAnimationFrame` never fires, so a page script waiting on it hangs and may resume later, even running leftover clicks.
  - Drive React with dispatched events and `setTimeout` waits, and tell the user.
- **Driving the app from page scripts:**
  - Click DOM buttons (`button.click()`) rather than importing the store with `await import('/src/state/workbench.ts')`. After a hot update the page's store is a newer module instance, and the import gets a stale one.
  - Importing before any hot update works, and is a quick way to build a progression.
- **A clean browser session:** run a second dev server on another port (`npx vite --port 5175 --strictPort`). Each origin has its own IndexedDB, so testing doesn't overwrite the session saved at 5173.
- **Mobile emulation:** after switching the browser tool to the mobile or tablet preset, reload the page, or the layout viewport stays desktop-sized.
- **Clicking notes from scripts:** pick a note by its `.position` group index (string × playable frets + fret − capo), then click its `.dot-core` or first circle. Clicked notes contain extra circles, so indexing circles directly goes wrong.
- **The browser tool's `key` action can't send Space.**
- **`preview_start` with a name fails** (npm can't find `node`). Run the dev server as a background shell with Node on PATH, then open the URL.
- **Stopping a background `npm run dev` or `npx vite` task leaves its Node process listening** (it happened on both 5173 and 5175). Find it with `Get-NetTCPConnection -LocalPort <port>`, check its command line, and stop only a Vite process you started.
- **Vitest 5 hides `console.log` from passing tests.** To inspect engine output while tuning, write it to a file from a throwaway test (with `// @ts-nocheck`, since there are no Node types) and delete the test afterwards.
- **Corpus runs load the analyzer when they start,** so weights can be edited while a run is in flight without affecting it. Three runs side by side slow each other; a background Bash task stops at 10 minutes, so run When in Rome on its own.
- **Windowed corpus runs mislead:** a window cut mid-phrase ends on an arbitrary chord, which the analysis takes as evidence for the tonic. Read whole pieces (the default) for key accuracy.
- **In the Bash tool, `cd` persists** between calls, and calls made in parallel share it. A `cd corpora/billboard` in one call put a clone started alongside it inside that folder. Prefix commands with the absolute project path.
- **Downloading the corpora again:**
  - Billboard: `billboard-2.0-salami_chords.tar.xz` from the McGill Billboard page on ddmal.ca, 219 KB.
  - RS200: `https://rockcorpus.midside.com/versions/rock_corpus_v2-1.zip` (note `2-1`, not `2.1`), 673 KB.
  - When in Rome: `git clone --filter=blob:none --no-checkout --depth 1`, then `git config core.longpaths true` (its Lieder paths pass Windows' 260-character limit), then `git sparse-checkout set --no-cone '/Corpus/**/analysis*.txt'`.
- **The Grep tool skips gitignored folders** (`node_modules`, `dist`, `corpora`). Use PowerShell `Select-String` for those.
- **In PowerShell, `$pid` is read-only.** Native tools writing to stderr (git push) show up as "NativeCommandError" even on success; read the actual output.
- **Control-character escapes like `\u0000` in written file content turned into raw bytes.** Avoid them, and scan `src` and `scripts` for control characters afterwards.
- **Hot reload:** adding hooks can crash Fast Refresh in `App`, so reload after such edits. The console keeps old errors across reloads.
- **Web research:** the search tool can't reach reddit.com. WebFetch can't render PDFs locally (no poppler), but `arxiv.org/html/<id>` works.
- **GitHub's public API** shows Actions runs, job steps, check-run annotations and environment branch policies without signing in. That's how the Pages 404 (a branch policy) was found.
- **Seeing rendered output while the window is hidden:**
  - Run a tiny Node receiver in the scratchpad that saves POSTed data URLs as files (port 5199).
  - From a page script, `fetch` export canvases to it, then open the images with Read.
  - `rasterize.ts`'s `snapshot(element).draw(region, w, h)` renders any element this way.
- **The export preview is slow on very tall sheets.** Every page draw lays out the whole foreignObject. Keep the snapshot (serialize once), and don't default to layouts that make sheets tens of thousands of pixels tall.
- **A fresh browser profile gets the tour's welcome card,** which blocks shortcuts such as Ctrl+S. Scripts driving a fresh app must click "Not now" first (as `test-offline.mjs` does).
