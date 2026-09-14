# Handoff: Fretboard Harmony Workbench

## What it is and where
- **What:** a browser-based fretboard visualizer for guitar and bass. It started from a long spec the user wrote, built in 7 stages; the user has since added features in later sessions.
  - Boxes hold chords the user clicks onto the fretboard, with arpeggio and scale maps across any tuning.
  - Each box has a reference scale, chosen automatically or by hand, and the progression gets a key bar.
  - Strips between boxes show common tones and voice leading.
  - Presets and export/import; offline PWA.
- **Live site:** https://amritisepic.github.io/fretboard-workbench/ (GitHub Pages). Repo: https://github.com/amritisepic/fretboard-workbench (public).
- **Project folder:** `C:\Users\amrit\Documents\fretboard-workbench`, deliberately kept out of the user's ME 315 class folder.
- **Stack:** React 19, TypeScript 7 (strict), Vite 8, Vitest 5, Zustand 5, `idb` 8, `vite-plugin-pwa` 1.3, `@fontsource-variable/inter`, and `fake-indexeddb` for tests.
- **Libraries the spec forbids:** music-theory libraries (no Tonal.js) and charting or diagram libraries. The fretboard is hand-built inline SVG.
- **The spec is not in the repo.** Its essentials and the user's rulings are summarised below.

## Current state and next steps
- **`master`** holds everything below and is deployed.
- **Next major work: harmonic analysis.** The plan is in `docs/harmonic-analysis-plan.md`, with the user's decisions recorded.
  - Phase 0 comes first: research to finish the pattern catalogue as `docs/harmonic-patterns.md`, reviewed with the user before any code.
  - Key decisions: tonicization switches the key bar to the target's key; ambiguous readings are all shown, never decided silently; a jazz/classical notation switch; every pattern (jazz, pop, classical) in scope; research corpora OK for offline testing.
- **Known weakness, deliberately not fixed yet:** Find key misreads progressions that start on ii (B♭m7 Cm7 D♭maj7 E♭7 comes out as B♭ minor/Dorian instead of ii–iii–IV–V in A♭). It also doesn't treat secondary dominants as pointing at their target. The plan covers both.
- **Other ideas raised with the user, not scheduled:** audio playback, typing chord symbols, suggested voicings, share links, image/PDF export, a practice mode, onboarding with example progressions, and accounts with sync. Accounts were deferred in favour of Export all.

## Environment
- **OS and Node:** Windows 11, with Node 24 LTS installed via winget at `C:\Program Files\nodejs`.
- **PATH:** shells opened before that install need `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **PowerShell is Windows PowerShell 5.1.** No `??`, `?.` or `&&`.
- **PowerShell blocks `npm.ps1`** (execution policy). Use `npm.cmd …`, or Command Prompt or Git Bash. The user was told they can run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` themselves. Don't change it for them; it's a security setting.
- **GitHub CLI:** installed at `C:\Program Files\GitHub CLI\gh.exe` and signed in as `amritisepic` (scopes repo, workflow). Shells opened before the install need the full path. Signing in is the user's to do.
- **Git:** `user.name` is "Amrit" and `user.email` is the GitHub no-reply address `290815722+amritisepic@users.noreply.github.com` (this repo only). The user's GitHub login email is amritisepic@gmail.com.
- **No servers are running.** The user runs the dev server themselves; if you start one, stop it afterwards (see Tooling lessons).

## Commands
- `npm.cmd run dev`: http://localhost:5173 (listens on `localhost`, not `127.0.0.1`).
- `npm.cmd test`: 178 tests in 17 files, about 16 s. Most of the time is the exhaustive pitch-set tests.
- `npm.cmd run typecheck`: runs `tsconfig.theory.json` (no DOM allowed in `src/theory` and `src/data`) and `tsconfig.json` (covers `src` only).
- `npm.cmd run build`, then `npm.cmd run preview`: http://localhost:4173.
- `npm.cmd run verify:pwa`: builds, then checks every `dist` file is precached and the manifest is installable.
- `npm.cmd run test:offline`: acceptance test 11. It uses headless Edge or Chrome over the DevTools protocol, serves on port 4174, shuts the server down, then checks the app boots offline.
- `npm.cmd run icons`: regenerates `public/` icons from `scripts/generate-icons.mjs`, which has no dependencies.
- **Subpath build like Pages:** set `$env:BASE_PATH = '/fretboard-workbench/'` before `build`, and before `preview` too.

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
  | latest | Harmonic analysis decisions and this handoff |

- **Old local branches:** `stage-4-sidebar`, `stage-5-canvas`, `stage-6-presets`, `stage-7-pwa`, `handoff-notes`, `find-key-workflow`, `key-bar` and `view-mode-mobile` point at those commits. `origin` has `master` and `view-mode-mobile`.
- **Branch workflow:** when asked to commit while on `master`, create a branch first. Then either suggest `git merge --ff-only`, or push to `master` if the user asks, as they did for the latest work. With `gh` available, PRs can be opened directly (`gh pr create`).
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Write them to a file and use `git commit -F`, because PowerShell splits quoted text.
- **Commit only when asked.**

## How the user wants to work
- **Stop for review** after each chunk of work.
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
  - `keys.ts`: key names, roman numerals, `planKeys` (key bar), `findKey`, `closestScale`
  - `fretboard.ts`: tunings, positions, capo, the one-note-per-string limit, transposing shapes
- **`src/data/`:** scale families, chord types and tension bases, chord-ID weights, ranking weights with commonness priors, key-plan weights (`keyPlanWeights.ts`), tuning presets.
- **`src/state/`:**
  - `workbench.ts`: the Zustand store with settings (tuning, frets, capo), key, strips, orientation, boxes, selection, view mode and document
  - `boxChords.ts`: each box's chord (memoised) and `keyPlanOf`, shared by the store and views
  - `library.ts`: the preset library store, including Export all
  - `repository.ts`: IndexedDB access
  - `persistence.ts`: session autosave and restore before first render
  - `presetFormat.ts`: validation and the export format. Version 2 adds whole-library files; preset and folder files are still written as version 1. Fields added later are optional when read, and old snapshots are upgraded.
  - `libraryTree.ts`, `documentStatus.ts`, `ids.ts`
- **`src/components/`:**
  - top of screen: `TopBar` (with the Edit/View switch), `PresetNameField`, `ExplorerPanel`, `SettingsPanel`
  - canvas: `Canvas`, `useRowStarts`, `useFitToFrame` (view mode), `CanvasToolbar`, `BoxCard`, `Fretboard` (SVG), `VoiceLeadingStrip`
  - sidebar: `Sidebar`, `RootBox`, `ScalePicker`/`ScaleSelects`, `ChordNameField`, `ColorField`, `RankingList`, `FillSwitch`
  - other: `UpdateNotice`, `ConfirmDialog`, `useKeyboardShortcuts`
  - pure view models: `boardModel.ts`, `canvasModel.ts`, `stripModel.ts`, `rankingModel.ts`, `findKeyModel.ts`
- **`docs/harmonic-analysis-plan.md`:** the harmonic analysis plan.
- **Tests:** in `__tests__` folders under `theory`, `components` and `state`. `vite.config.ts` holds both the Vitest settings and the PWA settings.

## Spec essentials
- **Settings:** 4–9 strings, and resizing adds or removes at the low end. Per-string tuning with presets. 12–30 frets, clamped with an inline message; the default is 12. Capo 0–11.
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

  There's also a collapsed "maximally distant" list.
- **Strips** between boxes: separate Common tones and Voice leading switches.
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
- **Find key** runs the key planner on the chords alone:
  - It considers only major, natural minor, harmonic minor and melodic minor keys.
  - The preset key becomes the key covering the most boxes.
  - Each box's scale is the one closest to the key at that box (`closestScale`).
- **Key bar** (`planKeys`, weights in `data/keyPlanWeights.ts`) is the cheapest sequence of keys from the preset key:
  - A scale that alters the key changes it but keeps the tonic: G Mixolydian ♭2 in C minor gives C Harmonic Major; A♭ Lydian in C major gives C minor.
  - A passing chord whose scale lacks the tonic stays in the key as chromatic (F♯7 in C minor is ♯IV).
  - The tonic moves only for about three such chords in a row, or two at the end.
  - Test 10 was amended to match. Harmonic analysis v2 will add tonicization (see the plan).
- **Degree labels** count from the key in effect by default. Each box can switch to its reference scale, and the strips follow that choice.
- **Capo** keeps the tuning. Shapes move with it, so chords, scales and the key transpose. Toolbar Shift transposes everything by a semitone.
- **Neck orientation switch** rotates the fretboards (vertical = chord-chart style); it doesn't change the box layout.
- **Strips:**
  - Scales are compared when both boxes are set to fill scale.
  - Common tones and Voice leading are separate switches, and the Names/Degrees choice shows while one is on.
  - Old presets' single "visible" switch sets both.
- **Ranking:** rows all start on the chord root. Tier-0 modes of the key in effect are pinned first. The tier-1 limit is 8.
- **Edit / View** switch in the top bar:
  - View mode hides the sidebar, the add button, each box's "x" and the Key/Find key/Shift controls, and disables note clicks and shortcuts.
  - It scales the whole canvas to fit. `useFitToFrame` tries layout widths up to a single row, box groups keep their natural width, and it enlarges at most 1.5×.
  - It isn't saved.
- **Each box has an "x"** that removes it after the same confirmation as the Delete key.
- **Clicked notes** have a gradient core, a crisp ring, a slow pulse and an orbiting highlight, all in the box color, staggered per note. Reduced motion turns the animation off.
- **Responsive:**
  - The `.app` grid column is `minmax(0, 1fr)`, so content scrolls instead of widening the page.
  - At 1024px and below the sidebar slides over the canvas with a Done button.
  - At 760px and below: the top bar uses icons and the name takes the leftover width, the toolbar is one scrolling row, strips sit above their box, and wide necks scroll sideways so notes stay finger-sized.
- **Accounts:** not now. Export all is the backup and migration path.
- **Harmonic analysis decisions** are recorded in `docs/harmonic-analysis-plan.md` §5.

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
- **Mobile emulation:** after switching the browser tool to the mobile or tablet preset, reload the page, or the layout viewport stays desktop-sized.
- **Clicking notes from scripts:** pick a note by its `.position` group index (string × playable frets + fret − capo), then click its `.dot-core` or first circle. Clicked notes contain extra circles, so indexing circles directly goes wrong.
- **The browser tool's `key` action can't send Space.**
- **`preview_start` with a name fails** (npm can't find `node`). Run the dev server as a background shell with Node on PATH, then open the URL.
- **Stopping a background `npm run dev` task can leave its Node process running on port 5173.** Check the port and only stop a Vite process you started.
- **The Grep tool skips gitignored folders** (`node_modules`, `dist`). Use PowerShell `Select-String` for those.
- **In PowerShell, `$pid` is read-only.** Native tools writing to stderr (git push) show up as "NativeCommandError" even on success; read the actual output.
- **Control-character escapes like `\u0000` in written file content turned into raw bytes.** Avoid them, and scan `src` and `scripts` for control characters afterwards.
- **Hot reload:** adding hooks can crash Fast Refresh in `App`, so reload after such edits. The console keeps old errors across reloads.
- **Web research:** the search tool can't reach reddit.com.
- **GitHub's public API** shows Actions runs, job steps, check-run annotations and environment branch policies without signing in. That's how the Pages 404 (a branch policy) was found.
