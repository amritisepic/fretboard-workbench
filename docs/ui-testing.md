# UI testing: what is covered and how to read it

Before the design plan, `src/theory`, `src/state` and the view models had 277 tests and the
interface itself had none: every check on the rendered app was made by hand through the DOM. Phase 0
added three kinds of automated check over the interface and put every known defect on record as a
failing assertion. The later phases then fixed those defects one by one. This file says what the
checks are, how to read them, and what they measured before and after.

## What runs where

| Command | What it covers | In CI |
|---|---|---|
| `npm test` | Everything in `src`: theory, state, view models, component renders, axe over each component, the design-token checks (contrast, the type and space scales, motion, both themes) | Yes, in `ci.yml` and `deploy.yml` |
| `npm run typecheck` | `tsconfig.theory.json`, then `tsconfig.json`, then `tsconfig.e2e.json` | Yes, inside `npm run build` |
| `npm run check:budgets` | Gzipped size of what the first paint downloads, and of all the JavaScript, against ceilings in `scripts/check-budgets.mjs` | Yes, in `ci.yml` |
| `npm run test:e2e` | Screenshot baselines, layout budgets, overlays and themes in a real browser, at three widths | Yes, in `ci.yml`, which uploads the Playwright report when it fails |
| `npm run test:e2e:update` | The same, rewriting the screenshot baselines | — |

`ci.yml` runs on every push and every pull request. `deploy.yml` runs the unit tests and the build
again before it publishes `master`.

## Known gaps, and how they are kept honest

A known defect is written as the assertion that *should* hold, marked as expected to fail: in
Vitest, `it.fails(...)`; in Playwright, `test.fail(...)`; for a list of defects (the contrast
failures), an exact-match baseline. Fixing one makes the run fail until the marker comes off, and
adding one fails too, so a gap can be neither fixed nor added quietly.

There were 16 of these when Phase 0 landed, plus one in the browser suite. **There are none now.**
The last ones closed were the export dialog's decision count (Phase 5), the key bar drawn over the
wrong chord and the scale printed twice (Phase 2), the numeral printed twice (Phase 2), the three
contrast failures, unreadable dot labels and indistinct region colors (Phase 3), and the top bar
covering its own controls between 761 and 910px (Phase 3).

## The three kinds of check

### 1. Component render tests (`src/**/__tests__/*.test.tsx`)

Run in jsdom, which each file opts into with a `// @vitest-environment jsdom` docblock; the theory and
state tests stay in Node, where they are faster. Setup is `src/test/setup.ts`, shared fixtures are
`src/test/fixtures.ts`. Fixtures come from the built-in examples (`openExample('Autumn Leaves')`)
rather than hand-written boxes, so a test renders what a user would see.

Covered: `Fretboard`, `BoxCard`, `Canvas`, `CanvasToolbar` (the Display popover), `TopBar`, `Switch`,
`Segmented`, `ColorField`, `FillField`, `VoiceLeadingStrip`, the scale ranking, the harmony readings,
`ConfirmDialog`, `SettingsPanel` and `ExportDialog`.

`Fretboard` carries a DOM budget: an open-position chord chart is 72 elements (30 positions, each one
a real control), against 291 for the whole neck before Phase 1.

### 2. Accessibility (`src/test/axe.ts`)

axe-core over each rendered component. Page-level rules (`region`, `landmark-one-main`,
`document-title` and so on) are turned off, because a component rendered on its own cannot satisfy
them. `color-contrast` is off too, because jsdom has no layout or canvas; the third kind of check
covers contrast instead. The published `vitest-axe` wrapper is not used: version 0.1.0 re-exports its
matcher as a type only, which does not compile under this project's TypeScript.

### 3. Design tokens (`src/design/`)

The tests read the real stylesheet — every sheet in `src/styles/`, in cascade order, through
`src/design/styles.ts` — as text, through Vite's `?inline`. That is why `vite.config.ts` sets
`test.css: true`: without it Vitest returns an empty string for any CSS import. A sheet added to the
folder but not to the reader's list fails a test, so no rule can escape these checks by living in a
new file.

- **`contrast.test.ts`**: a usage table of each token against the background it sits on, at 4.5:1
  for text and 3:1 for the edge of a control (WCAG 1.4.3 and 1.4.11), for the light and the dark
  theme. `KNOWN_FAILURES` is empty for both. It also holds the region colors at least ΔE 15 apart,
  checks that two neighboring regions never share a color, and checks that `labelInk` gives every
  dot color — the swatches and 4,096 custom colors — a label at 4.5:1. Measured ratios are asserted
  exactly, so any change to a token shows up as a number in the diff.
- **`scale.test.ts`**: every font size is one of six tokens (11, 12, 14, 16, 20, 28px) and every
  padding, margin and gap one of seven (4, 8, 12, 16, 24, 32, 48px), with an exact, named list of
  exceptions. No color literal outside the token blocks.
- **`theme.test.ts`**: the dark theme is switched on identically by the system setting and by the
  override, and the export sheet always takes the light tokens.
- **`motionCss.test.ts`**: one duration token, zeroed under `prefers-reduced-motion`, and no
  `!important`.

## The browser suite (`e2e/`)

Chromium at three widths, matching the stylesheet's breakpoints: `phone` 390×844, `tablet` 768×1024,
`desktop` 1440×900. The service worker is blocked, since the offline notice appears on its own timer.

Seven states, named in `e2e/states.ts`: empty, a four-chord progression, the 31-chord standard, the
sidebar open, the export dialog, view mode, and a progression whose analysis tags differ in length.
Two of them used to be wrong, and the screenshots hid it:
- **View mode on the tablet was edit mode.** The top-bar bug covered the Edit/View switch at 768px, so
  the forced click landed on Presets. The state now clicks for real and waits for view mode.
- **The sidebar showed a chord nobody wrote.** The state selected the first card by clicking its
  middle, which is a fretboard cell, so it added a note and turned G into Em/G. It now clicks the
  chord's name.

**Screenshots (`visual.spec.ts`)**: 21 baselines, one per state per width. They exist to put a layout
change in front of a reviewer, not to claim the layout is good. A deliberate change is accepted with
`npm run test:e2e:update`, and the new picture lands in the diff. The committed baselines are Linux
(`-linux.png`), which is what CI runs; a run on another platform reports missing snapshots instead.

**Overlays (`overlays.spec.ts`)**: Escape ends the tour and leaves nothing inert; a confirmation traps
Tab and hands focus back; the settings panel stays non-modal. jsdom cannot test these: it focuses
hidden elements and does not implement `inert`.

**Themes (`theme.spec.ts`)**: the system setting and the override; a stored choice applied before the
app's JavaScript loads (tested with JavaScript blocked); and export pages byte-identical in either
theme.

**Measurements (`metrics.spec.ts`, `e2e/measure.ts`)**: the numbers the design work had to move. The
budgets are the values measured after the last phase — ceilings and floors, not targets. A change
that improves one tightens it in the same commit. Loosening one is a regression, and the reason goes
beside it and in the commit message.

A warning for anyone running this suite: `playwright.config.ts` reuses a server already on port 4173.
With anything else serving there — another checkout, another agent — a run measures the wrong build
and can lose it halfway. Copy the config to a private port with `reuseExistingServer: false`.

## What moved

| | before phase 1 | after phase 1 | after every phase |
|---|---|---|---|
| Fret wires drawn on one board | 12 | 4–6 | **4–6** |
| Board that is empty grid, four chords | 73.2% | 34.9% | **34.9%** |
| Board that is empty grid, *Autumn Leaves* | 94.6% | 85.6% | **88.3%**¹ |
| Elements in the document, *Autumn Leaves* | 11,429 | 4,496 | **≈4,170** |
| Chords of *Autumn Leaves* on screen (phone / tablet / laptop) | 1 / 2 / 3 | 1 / 3 / 6 | **2 / 4 / 9** |
| Boards in a row starting apart, worst row | 17px² | 0px² | **0px** |
| Smallest place a note can be put | 21.6px | 26px | **26px** |
| Controls under 24px, four chords | 316 of 366 | 4 of 155 | **0 of 145** |
| Controls under 24px, *Autumn Leaves* and *All Blues* | — | — | **0** |
| Screen spent on chrome before the first chord | 27–29% | 27–29% | **16–22%** |
| Toolbar content ÷ width available, phone | 3.86 | 4.4 | **1** |
| Smallest text in view mode, *Autumn Leaves* (phone / tablet / laptop) | 2.1 / 2.9 / 4.2px | — | **8px** |
| Default export, smallest printed text | 4.7pt | — | **6pt** |
| Top-bar controls covered, 761–910px | up to 4 | up to 4 | **0** |
| Contrast failures on record | 3 | 3 | **0, in both themes** |
| First-paint JavaScript / CSS, gzipped | 133.4 kB / — | 115.5 kB | **114.6 / 7.5 kB** |

¹ Up from Phase 1 on purpose. Every chart keeps the same head, the string names and the open-string
run, whether it shows the nut or a window up the neck. A row mixing the two then starts its shapes at
one height, where before they were 48px apart. On a standard whose boards are mostly up the neck,
that head holds no notes.

² Measured on the first row only. That row happened to hold no open-position board, and for a
windowed board the measurement read the wire a fret below its head. The mixed-row misalignment above
was invisible to it. The measurement now takes the worst row on the page and the head wire by class.

Two of the plan's targets are not met, and the budgets record where things stand rather than where
the plan hoped:
- **First-paint JavaScript under 60 kB.** It is 114.6 kB, because the theory engine is still eager:
  the store calls it synchronously.
- **Under 2,000 elements for 31 chords.** It is about 4,170, because every fretboard position became
  a real control with its own name, pressed state and tab stop.

## Adding to this

- A new component test goes in `src/components/__tests__/` as `.test.tsx`, with the jsdom docblock.
- A new defect found along the way goes in as `it.fails`/`test.fail` with a comment naming what will
  close it — not as a TODO.
- A new state worth a screenshot goes in `STATES` in `e2e/states.ts`; both browser suites pick it up.
- A new stylesheet goes in `src/styles/` and in `SHEET_ORDER` in `src/design/styles.ts`.
