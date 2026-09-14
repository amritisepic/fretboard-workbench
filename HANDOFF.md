# Handoff: Fretboard Harmony Workbench

## What it is and where
- **What:** a browser-based fretboard visualizer for guitar and bass. It draws arpeggio and scale maps across any tuning, and lays out several chord boxes side by side with voice leading between them. It was built from a long spec the user wrote, in 7 stages, all now finished and committed.
- **Project folder:** `C:\Users\amrit\Documents\fretboard-workbench`, deliberately kept out of the user's ME 315 class folder.
- **Stack:** React 19, TypeScript 7 (strict), Vite 8, Vitest 5, Zustand 5, `idb` 8, `vite-plugin-pwa` 1.3, `@fontsource-variable/inter`, and `fake-indexeddb` for tests. The spec forbids music-theory libraries (no Tonal.js) and charting or diagram libraries; the fretboard is hand-built inline SVG.
- **The spec is not in the repo.** Its essentials and the user's rulings are summarised below.

## Environment
- **OS and Node:** Windows 11, with Node 24 LTS installed via winget at `C:\Program Files\nodejs`.
- **PATH:** shells opened before that install need `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **PowerShell blocks `npm.ps1`** (execution policy). Use `npm.cmd …`, or Command Prompt or Git Bash. The user was told they can run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` themselves. Don't change it for them; it's a security setting.
- **Git:** `user.name` is "Amrit" (this repo only), and the email is the GitHub no-reply address `290815722+amritisepic@users.noreply.github.com`.
- **No servers are running.** The user runs the dev server themselves.

## Commands
- `npm.cmd run dev`: http://localhost:5173 (listens on `localhost`, not `127.0.0.1`).
- `npm.cmd test`: 178 tests in 17 files, about 16 s (most of it the exhaustive pitch-set tests).
- `npm.cmd run typecheck`: runs `tsconfig.theory.json` (no DOM allowed in `src/theory` and `src/data`) and `tsconfig.json`.
- `npm.cmd run build`, then `npm.cmd run preview`: http://localhost:4173.
- `npm.cmd run verify:pwa`: builds, then checks every `dist` file is precached and the manifest is installable.
- `npm.cmd run test:offline`: acceptance test 11. It uses headless Edge or Chrome over the DevTools protocol, serves on port 4174, shuts the server down, then checks the app boots offline.
- `npm.cmd run icons`: regenerates `public/` icons from `scripts/generate-icons.mjs`, which has no dependencies.

## Deployment
- **Host:** GitHub Pages, from `.github/workflows/deploy.yml`. Every push to `master` (or a manual run) installs, tests, builds and publishes `dist`.
- **Site path:** Pages serves the site at `/<repository-name>/`. The workflow passes that as `BASE_PATH`, which `vite.config.ts` uses as Vite's `base`; locally it stays `/`. A user site (`<name>.github.io`) or a custom domain needs `BASE_PATH` set to `/`.
- **One-time setup by the user:** create the GitHub repository (public on the free plan), add it as `origin`, push `master`, then set Settings → Pages → Source to "GitHub Actions". Accounts and sign-in are the user's to do.
- **Presets don't travel with the site:** each origin has its own IndexedDB, so move presets with Export all and Import.

## Git
- **Commits:**
  - `d55aa93`: stages 1–3
  - `4a14f7b` (`stage-4-sidebar`): stage 4
  - `2b794d4` (`stage-5-canvas`): stage 5
  - `90b222e` (`stage-6-presets`): stage 6
  - `e02b1fa` (`stage-7-pwa`): stage 7, the last commit
- **Branch workflow:** the user fast-forwards `master` after each stage. When asked to commit while on `master`, create a branch first, then suggest `git merge --ff-only`.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Commit only when asked.**

## How the user wants to work
- **Stop for review** after each chunk of work.
- **List every decision** made where the spec was ambiguous.
- **Ask about genuine ambiguities** instead of guessing, and don't silently substitute simpler features.
- **Check spec claims** rather than trusting them; the user explicitly asked for this.
- **Verify in the real app** where possible, and say plainly how it was verified and what couldn't be.

## Code layout
- **`src/theory/`** (pure, framework-free):
  - `pitch.ts`: 12-bit pitch-class sets, intervals, degrees
  - `spelling.ts`: derived enharmonic spelling, tonic spelling choice, scale-degree labels
  - `scales.ts`: families, mode rotation and naming, and helpers such as `withMode` and `transposeScaleRef`
  - `chords.ts`: chord types, chord identification with slash names, chord-tone spelling
  - `ranking.ts`: scale ranking by tiers, pinning of the key's own modes, voice-leading term
  - `voiceleading.ts`: minimum-motion matching
  - `keys.ts`: key regions, key names, roman numerals
  - `fretboard.ts`: tunings, positions, resizing, transposing shapes
- **`src/data/`:** scale families, chord types, chord-ID weights, ranking weights with commonness priors, tuning presets.
- **`src/state/`:**
  - `workbench.ts`: the Zustand store with settings, key, strips, boxes, selection and document
  - `library.ts`: the preset library store
  - `repository.ts`: IndexedDB access
  - `persistence.ts`: session autosave and restore before first render
  - `presetFormat.ts`: validation and the export format. Version 2 adds whole-library files ("Export all"); preset and folder files are still written as version 1 so older copies can open them
  - `libraryTree.ts`, `documentStatus.ts`, `ids.ts`
- **`src/components/`:**
  - top of screen: `TopBar`, `PresetNameField`, `ExplorerPanel`, `SettingsPanel`
  - canvas: `Canvas` with `useRowStarts`, `CanvasToolbar`, `BoxCard`, `Fretboard` (SVG), `VoiceLeadingStrip`
  - sidebar: `Sidebar` with `RootBox`, `ScalePicker`/`ScaleSelects`, `ChordNameField`, `ColorField`, `RankingList`, `FillSwitch`
  - other: `UpdateNotice`, `ConfirmDialog`, `useKeyboardShortcuts`
  - pure view models: `boardModel.ts`, `canvasModel.ts`, `stripModel.ts`, `rankingModel.ts`
- **Tests:** in `__tests__` folders under `theory`, `components` and `state`. `vite.config.ts` holds both the Vitest settings and the PWA settings.

## Spec essentials
- **Settings:** 4–9 strings, and resizing adds or removes at the low end. Per-string tuning with presets. 12–30 frets, clamped with an inline message.
- **Boxes:** click notes on the SVG fretboard. A fill switch gives an arpeggio map or a scale fill.
  - A reference scale is always required.
  - Spelling is derived, never toggled.
  - The chord-name dropdown lists every reasonable reading.
  - The mode slider keeps the notes and changes which degree is the root.
  - The root box transposes the whole box.
- **Scale ranking, with all weights in `data/rankingWeights.ts`:** tiers are
  1. contains the chord
  2. missing tones, weighted root 10, 3rd 8, 7th 6, altered 5th 8, extensions 3, perfect 5th 1
  3. everything else, sorted by overlap

  There's also a collapsed "maximally distant" list.
- **Voice-leading strips** between boxes, with a toggle.
- **Global key** with key regions, a coloured key band, and roman numerals.
- **Presets and folders** in IndexedDB, with JSON export/import.
- **Offline PWA.**
- **Design:** off-white `#FAF9F7`, dark grey `#3A3A3A`, rounded corners, and no gradients or shadows apart from a faint one on the sidebar.
- **Keys:** Esc deselects, arrows nudge the root, Space toggles the fill, Delete removes a box after confirming.

## The user's rulings (don't revert)
- **Out-of-scale spelling ties** are chord-aware (letters stacked from the chord root), then fall back to ♭2 ♭3 ♯4 ♭6 ♭7.
- **In non-7-note scales,** a perfect 5th always keeps the 5th letter.
- **Unnamed blues rotations** are called "Blues mode n".
- **Chord ID** prefers the closest complete triad or diatonic chord, with slash names (C E A over C is Am/C). From four sounding notes up, an omitted 5th is cheap, so the bass decides (C E♭ F B♭ over C is Cm7(11), not F7sus4/C). Five-plus-tone chords don't print "(no 5)".
- **Tension chords:** seventh chords with added tensions are generated from `TENSION_BASES` in `data/chords.ts`: F♯7(11), G7(13), m9♭5, 9(♯11).
- **Workflow:** fill in the chords, press Find key (global major/minor key, then the scale closest to it for each chord), then adjust.
- **Chords** have one note per string and six notes at most.
- **Capo** keeps the tuning. Shapes move with it, so chords, scales and the key transpose. Toolbar Shift transposes everything by a semitone.
- **Orientation switch** rotates the fretboards (vertical = chord-chart style), not the box layout.
- **Voice-leading strips** compare scales when both boxes are set to fill scale; the chords/scales switch was removed.
- **Ranking** rows all start on the chord root. Tier-0 modes of the key in effect are pinned first.
- **The tier-1 limit is 8.**
- **Names:** Ionian and Aeolian read "Major" and "Minor" everywhere; after a tonic they are lower case, like key names ("C major", "A minor").
- **Default fret count is 12.**
- **Strips** have separate Common tones and Voice leading switches; either one on shows a strip. Old presets' single "visible" switch sets both.
- **Edit / View** switch in the top bar. View mode hides the sidebar, the add button, each box's remove button and the Key/Find key/Shift controls, disables note clicks and shortcuts, and scales the whole canvas to fit (`useFitToFrame`: tries layout widths up to a single row, enlarges at most 1.5×). It isn't saved.
- **Each box has an "x"** that removes it after the same confirmation as the Delete key.
- **Clicked notes** have a gradient core, a crisp ring, a slow pulse and an orbiting highlight, all in the box color (the user asked for this despite the no-gradients design rule); reduced motion turns the animation off.
- **Responsive:** at 1024px and below the sidebar slides over the canvas with a Done button. At 760px and below the top bar uses icons, the toolbar is one scrolling row, strips sit above their box, and wide necks scroll sideways so notes stay finger-sized.
- **Harmonic analysis** is scoped in `docs/harmonic-analysis-plan.md`, with open decisions. Nothing there is built yet.
- **Key bar** (`planKeys`, weights in `data/keyPlanWeights.ts`): the cheapest sequence of keys from the preset key. A scale that alters the key changes it but keeps the tonic (G Mixolydian ♭2 in C minor → C Harmonic Major; A♭ Lydian in C major → C minor). A passing chord whose scale lacks the tonic stays in the key as chromatic (F♯7 in C minor is ♯IV). The tonic moves only for about three such chords in a row, or two at the end. This replaced the old "new region per new note collection" rule, and test 10 was amended to match.
- **Two bars** above the boxes: key regions, then each box's reference scale. Numerals count from the key bar.
- **Degree labels** count from the key in effect by default; each box can switch to its reference scale, and the strips follow that choice.
- **Find key** runs the same planner on the chords alone (free start), sets the preset key to the key covering most boxes, and picks each scale against the key at that box.

## Spec errors found (the code uses the correct theory)
- F♯ natural minor's 7th is E; E♯ belongs to harmonic or melodic minor.
- Harmonic minor mode 3 is Ionian ♯5 and mode 7 is Altered ♭♭7, not the spec's names.
- Rootless chord readings need roots outside the clicked set.
- Test 9's total motion is 3, not 4.
- Test 11's "hard reload": Chromium's Ctrl+Shift+R bypasses service workers, so the test uses a normal reload and a new tab.

## Other design choices (reported to the user)
- **Scale library:** major, melodic minor, harmonic minor, harmonic major, double harmonic, Neapolitan major and minor, pentatonic, blues, whole tone, octatonic, augmented. Unnamed 7-note modes get generated names such as "Dorian ♭5".
- **Settings panel** opens from a tab at top right. Highest string is on top, frets are evenly spaced, and a clicked note gets a ring while fill is on.
- **Sidebar** is on the right. The root box shows the scale's tonic. The chord-name choice is kept per box.
- **Strips:** settings are global and live in a toolbar next to the key picker. Each strip is grouped with the box it leads into, so wrapping never separates them. Scales are compared only when both boxes are in scale mode.
- **Numerals** count accidentals from the key's own degrees (C in A minor is III). New boxes start in the key in effect at the last box.
- **Saving:** the session autosaves (300 ms after changes). Save or Ctrl+S overwrites the open preset or creates a new one.
  - Folders nest. Deleting one takes its contents, after a confirmation with counts.
  - Names are unique within a folder.
  - Opening a preset or starting a new one asks before discarding unsaved work.
  - The name field writes on every keystroke, and Esc reverts to the last saved name.
- **Updates:** the app asks before reloading (Reload / Later), and says once when it's ready to work offline.

## Tooling lessons
- **The Claude in-app browser pane can't run service workers.** Test offline behaviour with `npm run test:offline`.
- **When the Claude window is hidden,** screenshots and clicks fail, and focus and blur events don't fire. Drive React with dispatched events from page scripts, and tell the user.
- **The browser tool's `key` action can't send Space.**
- **`preview_start` couldn't find `launch.json`** after the session moved folders. Run servers as background shell commands instead.
- **The Grep tool skips gitignored folders** (`node_modules`, `dist`). Use PowerShell `Select-String` for those.
- **In PowerShell, `$pid` is read-only.**
- **Control-character escapes like `\u0000` in written file content turned into raw bytes.** Avoid them, and scan `src` and `scripts` for control characters afterwards.
- **Hot reload:** adding hooks can crash Fast Refresh in `App`, so reload after such edits. The console keeps old errors across reloads.
