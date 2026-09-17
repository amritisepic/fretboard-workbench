# UI testing: what is covered and how to read it

Phase 0 of the design plan. Before this, `src/theory`, `src/state` and the view models had 277 tests
and the interface itself had none: every check on the rendered app was done by hand through the DOM.
This adds three kinds of automated check over the interface, and records where the interface falls
short today so the later phases can be measured rather than argued about.

Nothing here changes what the app does. One line of app code changed: `SWATCHES` in
`src/components/ColorField.tsx` is now exported so the contrast tests can read the real palette.

## What runs where

| Command | What it covers | In CI |
|---|---|---|
| `npm test` | Everything in `src`, now including component render tests, axe checks and the design-token contrast checks | Yes, in `deploy.yml` before the build |
| `npm run test:e2e` | Screenshot baselines and layout measurements in a real browser, at three widths | Not yet — plan item 38 (Phase 6) |
| `npm run test:e2e:update` | The same, rewriting the screenshot baselines | — |
| `npm run typecheck` | `tsconfig.theory.json`, then `tsconfig.json`, then `tsconfig.e2e.json` | Yes, inside `npm run build` |

## Known gaps, and why the build is still green

Most of what the plan sets out to fix is a defect that exists today. A test that simply failed would
turn the build red and stay red, and a build that is always red tells you nothing. So each known
defect is written as the assertion that *should* hold, marked as expected to fail:

- In Vitest, `it.fails(...)`. If the behaviour is fixed the test starts passing, Vitest reports
  "Expect test to fail", and the `.fails` has to come off in the same change.
- In Playwright, `test.fail(...)`, which behaves the same way.
- For lists of defects (the contrast failures), an exact-match baseline: fixing one without deleting
  it from the list fails, and adding a new one fails too.

A gap cannot therefore be fixed quietly, and cannot be added quietly. Every one carries a comment
naming the plan item that closes it.

There are 16 of them in `npm test` today and one in the browser suite.

## The three kinds of check

### 1. Component render tests (`src/**/__tests__/*.test.tsx`)

Run in jsdom, which each file opts into with a `// @vitest-environment jsdom` docblock; the theory
and state tests stay in Node, where they are faster. Setup is `src/test/setup.ts`, shared fixtures
are `src/test/fixtures.ts`.

Fixtures come from the built-in examples (`openExample('Autumn Leaves')`) rather than hand-written
boxes, so a test renders the data a user would actually see and cannot drift from what the app
produces.

Covered: `Fretboard`, `BoxCard`, `Canvas`, `Segmented`, `ConfirmDialog`, `SettingsPanel`,
`ExportDialog`.

`Fretboard` also carries a DOM budget: one board is 291 elements today (78 positions, each a group
holding a circle and a label), and the test holds it at 300 so it cannot grow before plan item 6
brings it down.

### 2. Accessibility (`src/test/axe.ts`)

axe-core over each rendered component. Page-level rules (`region`, `landmark-one-main`,
`document-title` and so on) are turned off, because a component rendered on its own cannot satisfy
them and would fail every time without saying anything about the component.

`color-contrast` is turned off too, but for a different reason: jsdom has no layout and no canvas,
so axe cannot compute it. That is what the third kind of check is for.

The published `vitest-axe` wrapper is not used. It is version 0.1.0 and its types entry re-exports
the matcher as a type only (`export type *`), so it does not compile under this project's
TypeScript. axe-core is the same engine underneath.

### 3. Design tokens and contrast (`src/design/`)

`contrast.ts` is pure arithmetic — relative luminance, contrast ratio, and reading the `:root`
custom properties out of a stylesheet. The test reads the real `src/styles.css` through Vite's
`?inline`, which is why `vite.config.ts` now sets `test.css: true`; without it Vitest hands back an
empty string for any CSS import.

It checks three things:

- **A usage table**: each token against the background it actually appears on, at the minimum WCAG
  asks for there — 4.5:1 behind body text, 3:1 for the visual boundary of a control. Decorative
  hairlines are left out on purpose; 1.4.11 covers what identifies a control, not every rule.
- **The key-region and scale-band colors**, against the ink printed on them.
- **`labelInk`**, which picks dark ink or white for a dot label by a luminance threshold and never
  checks what it got.

Measured ratios are asserted exactly, so any change to a token shows up as a number in the diff.

Three usages fail today and are on the record in `KNOWN_FAILURES`:

| Usage | Measured | Needs |
|---|---|---|
| `--ink-faint` on `--paper` (fret numbers, string names, save status, hints, all 10.5–11.5px) | 2.76:1 | 4.5:1 |
| `--ink-faint` on `--paper-sunk` | 2.55:1 | 4.5:1 |
| `--rule-strong` on `--paper` (input, tab and panel edges) | 1.53:1 | 3:1 |

## The browser suite (`e2e/`)

Chromium at three widths, matching the stylesheet's breakpoints: `phone` 390×844, `tablet` 768×1024,
`desktop` 1440×900. Six states, named in `e2e/states.ts`: empty, a four-chord progression, the
31-chord standard, the sidebar open, the export dialog, and view mode.

The service worker is blocked in the test context. The offline notice appears on its own timer once
the worker registers and clears itself five seconds later, which would make every screenshot a race.

### Screenshots (`e2e/visual.spec.ts`)

18 baselines, one per state per width. They exist to put a layout change in front of a reviewer, not
to claim the layout is good — most of what they show is what the plan intends to change. A
deliberate change is accepted with `npm run test:e2e:update`, and the new picture lands in the diff.

Playwright names each file after the platform it was taken on (`-linux.png`). The committed
baselines are Linux, which is what CI runs. A run on Windows does not fail against them: it reports
a missing snapshot and writes its own, which should not be committed.

### Measurements (`e2e/metrics.spec.ts`, `e2e/measure.ts`)

The numbers the design work has to move, with today's value as the budget. Measured 2026-09-17:

| | phone | tablet | desktop |
|---|---|---|---|
| Screen spent on chrome before the first chord | 27.4% (231px) | 29.0% (297px) | 28.1% (253px) |
| Toolbar content width ÷ width available | **3.86** | 1.00 | 1.00 |
| Fretboard that is empty grid, four chords | 73.2% | 73.2% | 73.2% |
| Fretboard that is empty grid, *Autumn Leaves* | **94.6%** | 94.6% | 94.6% |
| Chords of *Autumn Leaves* on screen at once | 1 of 31 | 2 of 31 | 3 of 31 |
| Elements in the document, *Autumn Leaves* | 11,446 | 11,444 | 11,415 |
| — of those, inside fretboards | 9,021 | 9,021 | 9,021 |
| Controls under 24 CSS px, four chords | 316 of 366 | 316 of 366 | 316 of 366 |
| Smallest control on screen | 21.6px | 21.6px | 21.6px |

A toolbar overflow above 1 means the toolbar scrolls sideways with `scrollbar-width: none`, so the
controls past the edge cannot be found at all. On a phone that is roughly three quarters of them.

Budgets are ceilings and floors, not targets. A phase that lands should tighten the budget in the
same change; loosening one is a regression and the reason belongs in the commit message.

### The bug this found on its first run

`.topbar` is a three-column grid whose outer columns are `minmax(0, 1fr)`, so the left column
shrinks below its content and spills over the columns beside it. `.topbar-tab` carries `z-index: 21`
and lands on top.

**Between 761px and 910px, top-bar controls are covered and cannot be clicked.** At 770px that is
Save, the preset name field, Edit and View — a tap on View opens the Presets panel instead. Up to
910px the preset name field is still covered, so the preset cannot be renamed. Phones (760px and
below) use a different grid and are fine, as is 920px and up.

`every control in the top bar can be clicked` asserts it, marked `test.fail` on the tablet project.
Plan item 21 (Phase 3) closes it.

## Adding to this

- A new component test goes in `src/components/__tests__/` as `.test.tsx`, with the jsdom docblock.
- A new defect found along the way goes in as `it.fails`/`test.fail` with a comment naming the plan
  item that will close it — not as a TODO.
- A new state worth a screenshot goes in `STATES` in `e2e/states.ts`; both browser suites pick it up.
