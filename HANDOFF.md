# Handoff: Fretboard Harmony Workbench

## What it is and where
- **What:** a browser-based fretboard visualizer for guitar and bass. It started from a long spec the user wrote, built in 7 stages; the user has since added features in later sessions.
  - Boxes hold chords the user clicks onto the fretboard, with arpeggio and scale maps across any tuning.
  - Each box has a reference scale, chosen automatically or by hand, and the progression gets a key bar.
  - Strips between boxes show common tones, voice leading and harmonic analysis.
  - Presets and export/import; offline PWA.
- **Live site:** https://amritisepic.github.io/fretboard-workbench/ (GitHub Pages). Repo: https://github.com/amritisepic/fretboard-workbench (public).
- **Project folder:** `C:\Users\amrit\Documents\fretboard-workbench`, deliberately kept out of the user's ME 315 class folder.
- **Stack:** React 19, TypeScript 7 (strict), Vite 8, Vitest 5, Zustand 5, `idb` 8, `vite-plugin-pwa` 1.3, `@fontsource-variable/inter`, and `fake-indexeddb` for tests.
- **Libraries the spec forbids:** music-theory libraries (no Tonal.js) and charting or diagram libraries. The fretboard is hand-built inline SVG.
- **The spec is not in the repo.** Its essentials and the user's rulings are summarised below.

## Current state and next steps
- **`master`** is deployed and unchanged since the harmonic analysis decisions were recorded.
- **Branch `harmonic-analysis`, not committed** (the user asked for commits only on request). It holds:
  - the housekeeping from 2026-09-14: no animation on clicked notes, and a fret-marker switch in Settings
  - harmonic analysis: all six phases of `docs/harmonic-analysis-plan.md`. Phase 0's catalogue is `docs/harmonic-patterns.md`; it was written and built on without the planned review, at the user's request to work through the night.
- **Waiting on the user:**
  - Review the decisions listed at the end of this session's report and in the plan's §7.
  - Say whether to commit, merge or push.
  - Approve downloading research corpora for offline evaluation (plan §3.6, §5.5). Nothing has been downloaded or licence-checked yet.
- **Known gaps:** see `docs/harmonic-patterns.md` §7.
  - Melody and metre aren't known.
  - Augmented sixth chords aren't named Ger/Fr/It.
  - Diatonic planing isn't tagged.
  - The analysis takes about 60 ms for 32 chords; it's cached per change but not incremental.
- **Other ideas raised with the user, not scheduled:** audio playback, typing chord symbols, suggested voicings, share links, image/PDF export, a practice mode, onboarding with example progressions, and accounts with sync. Accounts were deferred in favour of Export all.

## Environment
- **OS and Node:** Windows 11, with Node 24 LTS installed via winget at `C:\Program Files\nodejs`.
- **PATH:** shells opened before that install need `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. In Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`.
- **PowerShell is Windows PowerShell 5.1.** No `??`, `?.` or `&&`.
- **PowerShell blocks `npm.ps1`** (execution policy). Use `npm.cmd …`, or Command Prompt or Git Bash. The user was told they can run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` themselves. Don't change it for them; it's a security setting.
- **GitHub CLI:** installed at `C:\Program Files\GitHub CLI\gh.exe` and signed in as `amritisepic` (scopes repo, workflow). Shells opened before the install need the full path. Signing in is the user's to do.
- **Git:** `user.name` is "Amrit" and `user.email` is the GitHub no-reply address `290815722+amritisepic@users.noreply.github.com` (this repo only). The user's GitHub login email is amritisepic@gmail.com.
- **No servers are running.** The user runs the dev server themselves; if you start one, stop it afterwards (see Tooling lessons).

## Commands
- `npm.cmd run dev`: http://localhost:5173 (listens on `localhost`, not `127.0.0.1`).
- `npm.cmd test`: 250 tests in 19 files, about 20 s. Most of the time is the exhaustive pitch-set tests.
- `npm.cmd run typecheck`: runs `tsconfig.theory.json` (no DOM allowed in `src/theory` and `src/data`) and `tsconfig.json` (covers `src` only). There is no `@types/node`, so tests can't import `node:` modules.
- `npm.cmd run build`, then `npm.cmd run preview`: http://localhost:4173.
- `npm.cmd run verify:pwa`: builds, then checks every `dist` file is precached and the manifest is installable.
- `npm.cmd run test:offline`: acceptance test 11. It uses headless Edge or Chrome over the DevTools protocol, serves on port 4174, shuts the server down, then checks the app boots offline.
- `npm.cmd run icons`: regenerates `public/` icons from `scripts/generate-icons.mjs`, which has no dependencies.
- **Subpath build like Pages:** set `$env:BASE_PATH = '/fretboard-workbench/'` before `build`, and before `preview` too.
- **Analysis fixtures:** `npx vitest run src/theory/__tests__/harmonicAnalysis.test.ts`. The last test reports agreement: fixtures passing, local keys, chord scales, ambiguous listings.

## Deployment
- **Workflow:** `.github/workflows/deploy.yml`. Every push to `master`, or a manual run from the Actions tab, runs `npm ci`, `npm test`, then `npm run build` with `BASE_PATH=/<repository-name>/`, and publishes `dist` with the Pages actions.
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

- **Old local branches:** `stage-4-sidebar`, `stage-5-canvas`, `stage-6-presets`, `stage-7-pwa`, `handoff-notes`, `find-key-workflow`, `key-bar` and `view-mode-mobile` point at those commits. `origin` has `master` and `view-mode-mobile`. `harmonic-analysis` branches from `0ce8623` with uncommitted work.
- **Branch workflow:** when asked to commit while on `master`, create a branch first. Then either suggest `git merge --ff-only`, or push to `master` if the user asks, as they did for earlier work. With `gh` available, PRs can be opened directly (`gh pr create`).
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Write them to a file and use `git commit -F`, because PowerShell splits quoted text.
- **Commit only when asked.**

## How the user wants to work
- **Stop for review** after each chunk of work. For the harmonic analysis the user asked instead for work through the night, deciding and reporting rather than asking, and stopping only for decisions that would be costly to undo.
- **List every decision** made where the spec or request was ambiguous.
- **Ask about genuine ambiguities** instead of guessing, and don't silently substitute simpler features.
- **Check claims** rather than trusting them, including the spec's.
- **Verify in the real app** where possible, and say plainly how it was verified and what couldn't be.
- **Plan before building large features:** the user has asked for plans (like the harmonic analysis plan) before implementation.

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
- **`src/data/`:** scale families, chord types and tension bases, chord-ID weights, ranking weights with commonness priors, tuning presets, `harmonyRules.ts` (borrowing sources, cadence table, function scales, pattern names), `analysisWeights.ts` (every analysis cost). `keyPlanWeights.ts` is gone.
- **`src/state/`:**
  - `workbench.ts`: the Zustand store with settings (tuning, frets, capo, fret markers), key, strips (including `analysis` and `notation`), orientation, boxes (including `keyPin` and `readingPin`), selection, view mode and document
  - `boxChords.ts`: each box's chord (memoised) and `keyPlanOf` (planKeys with pins; the last plan is cached), shared by the store and views
  - `library.ts`: the preset library store, including Export all
  - `repository.ts`: IndexedDB access
  - `persistence.ts`: session autosave and restore before first render
  - `presetFormat.ts`: validation and the export format. Version 2 adds whole-library files; preset and folder files are still written as version 1. Fields added later are optional when read, and old snapshots are upgraded.
  - `libraryTree.ts`, `documentStatus.ts`, `ids.ts`
- **`src/components/`:**
  - top of screen: `TopBar` (with the Edit/View switch), `PresetNameField`, `ExplorerPanel`, `SettingsPanel` (with the fret-marker switch)
  - canvas: `Canvas` (key-bar splits and choosers), `useRowStarts`, `useFitToFrame` (view mode), `CanvasToolbar` (with the Harmonic analysis switch and Jazz/Classical), `BoxCard` (function tag and explanation), `Fretboard` (SVG with inlays), `VoiceLeadingStrip` (with the analysis lane), `FunctionText`
  - sidebar: `Sidebar`, `RootBox`, `ScalePicker`/`ScaleSelects`, `ChordNameField`, `HarmonyField` (readings, pins, key at this box), `ColorField`, `RankingList` (marks the suggested scale), `FillSwitch`
  - other: `UpdateNotice`, `ConfirmDialog`, `useKeyboardShortcuts`, `readingChoice.ts` (pinning a reading moves an unedited scale with it)
  - pure view models: `boardModel.ts`, `canvasModel.ts` (analysis and key choices per box), `stripModel.ts`, `rankingModel.ts`, `findKeyModel.ts`, `analysisModel.ts` (labels in both notations, explanations, relation and pattern labels)
- **Docs:** `docs/harmonic-analysis-plan.md` (the plan, decisions, and what was built) and `docs/harmonic-patterns.md` (the catalogue).
- **Tests:** in `__tests__` folders under `theory`, `components` and `state`. `vite.config.ts` holds both the Vitest settings and the PWA settings.
  - `theory/__tests__/harmonicAnalysis.test.ts` is the evaluation harness of labelled progressions.
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
- **Key bar and scale bar** above the boxes, with roman numerals counted from the key bar.
- **Presets and folders** in IndexedDB, with JSON export/import and Export all.
- **Offline PWA.**
- **Design:** off-white `#FAF9F7`, dark grey `#3A3A3A`, rounded corners, and no gradients or shadows apart from a faint one on the sidebar. The exception is clicked notes, at the user's request.
- **Keys:** Esc deselects, arrows nudge the root, Space toggles the fill, Delete removes a box after confirming. All shortcuts are off in view mode.

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
- **Harmonic analysis decisions** (plan §5): tonicization switches the key bar to the target's key; ambiguous readings are all shown, never decided silently; a jazz/classical notation switch; every pattern in scope; corpora OK for offline testing.
- **Find key** runs the analyzer on the chords alone:
  - Home keys are major, minor, Dorian, Mixolydian, Lydian and Phrygian. The first key bar allowed only major and the minors; the plan's modal keys replace that, pending review.
  - The preset key becomes the home key covering the most boxes.
  - Each box's scale is the one its reading suggests (`functionScale`): Mixolydian for V7 of a major chord, Phrygian dominant for V7 of a minor one, whole–half diminished for a diminished 7th, Lydian dominant for a tritone substitute. Otherwise it's the scale closest to the local key, or to the source key for a borrowed chord.
  - Pins are respected.
- **Key bar** (`planKeys`, analysis in `theory/analysis.ts`, costs in `data/analysisWeights.ts`):
  - Each box shows the local key of its reading. That's the home key, or the key a secondary dominant, leading-tone chord, related ii or tritone substitute tonicizes. A chord outside the key that its dominant just resolved to shows its own key.
  - A diatonic target stays in the home key (A7 → Dm7 in C: D minor over A7, C major over Dm7).
  - A scale that alters the key still changes the collection but keeps the tonic: A♭ Lydian in C major shows C minor. A minor key's raised 7th on V/vii doesn't count as an alteration.
  - A box's scale is evidence for its reading only when the scale holds the chord.
  - Ambiguous boxes split the key band and scale band ("B♭ minor | B♭ major?", at most two) and mark the numeral tentative. Clicking a choice pins that reading, and clicking the pinned one again unpins.
  - The sidebar's Harmony section lists every reading with its explanation and can fix the key at the box.
  - Test 10 (first amendment) still passes. The run-of-chords test was amended again for tonicization.
- **Degree labels** count from the key in effect by default. Each box can switch to its reference scale, and the strips follow that choice.
- **Capo** keeps the tuning. Shapes move with it, so chords, scales, the key and key pins transpose. Toolbar Shift transposes everything by a semitone.
- **Neck orientation switch** rotates the fretboards (vertical = chord-chart style); it doesn't change the box layout.
- **Strips:**
  - Scales are compared when both boxes are set to fill scale.
  - Common tones, Voice leading and Harmonic analysis are separate switches. The Names/Degrees choice shows while common tones or voice leading is on, and Jazz/Classical shows while harmonic analysis is on.
  - Old presets' single "visible" switch sets both.
- **Ranking:** rows all start on the chord root. Tier-0 modes of the key in effect are pinned first. The tier-1 limit is 8.
- **Edit / View** switch in the top bar:
  - View mode hides the sidebar, the add button, each box's "x" and the Key/Find key/Shift controls, and disables note clicks and shortcuts.
  - It scales the whole canvas to fit. `useFitToFrame` tries layout widths up to a single row, box groups keep their natural width, and it enlarges at most 1.5×.
  - Key-bar choices show as text, and function tags still explain on hover or tap.
  - It isn't saved.
- **Each box has an "x"** that removes it after the same confirmation as the Delete key.
- **Clicked notes** have a gradient core and a crisp ring in the box color. The animation was removed on 2026-09-14, at the user's request.
- **Fret markers:** light grey inlays at 3, 5, 7, 9, 12 (two dots), 15 and so on, behind the strings. A switch in Settings, on by default and saved with the preset.
- **Responsive:**
  - The `.app` grid column is `minmax(0, 1fr)`, so content scrolls instead of widening the page.
  - At 1024px and below the sidebar slides over the canvas with a Done button.
  - At 760px and below: the top bar uses icons and the name takes the leftover width, the toolbar is one scrolling row, strips sit above their box, and wide necks scroll sideways so notes stay finger-sized.
- **Accounts:** not now. Export all is the backup and migration path.

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
- **Updates:** the app asks before reloading (Reload / Later), and says once when it's ready to work offline.

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
- **Stopping a background `npm run dev` task can leave its Node process running on port 5173.** Check the port and only stop a Vite process you started.
- **Vitest 5 hides `console.log` from passing tests.** To inspect engine output while tuning, write it to a file from a throwaway test (with `// @ts-nocheck`, since there are no Node types) and delete the test afterwards.
- **In the Bash tool, `cd` persists** between calls; prefix commands with the project path.
- **The Grep tool skips gitignored folders** (`node_modules`, `dist`). Use PowerShell `Select-String` for those.
- **In PowerShell, `$pid` is read-only.** Native tools writing to stderr (git push) show up as "NativeCommandError" even on success; read the actual output.
- **Control-character escapes like `\u0000` in written file content turned into raw bytes.** Avoid them, and scan `src` and `scripts` for control characters afterwards.
- **Hot reload:** adding hooks can crash Fast Refresh in `App`, so reload after such edits. The console keeps old errors across reloads.
- **Web research:** the search tool can't reach reddit.com.
- **GitHub's public API** shows Actions runs, job steps, check-run annotations and environment branch policies without signing in. That's how the Pages 404 (a branch policy) was found.
