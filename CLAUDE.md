# Fretboard Workbench — working rules

A React 19 + TypeScript 7 (strict) + Vite 8 app: guitar and bass fretboard maps, chord boxes, voice
leading and harmonic analysis. `HANDOFF.md` says what it is and where things stand;
`docs/ui-testing.md` says how the interface is tested and what it measures. Read both before a
change of any size.

## The design contract

The interface was rebuilt against a written plan in September 2026, after it had grown sixteen font
sizes, three controls for one kind of choice and a palette that failed WCAG. These rules are what
that work settled on. Each is enforced by a test, named beside it, so breaking one fails the build;
changing one is a design decision, and belongs in the commit message with the reason.

**Type.** Six sizes, and only six: `--text-xs` 11, `--text-sm` 12, `--text-md` 14, `--text-lg` 16,
`--text-xl` 20, `--text-2xl` 28 (px), with two line heights. No half-pixel sizes, and nothing under
11px, the fretboard's SVG text included. The one exception is the figured-bass figures (V⁶₅), sized
relative to their numeral as figures are in print. The smallest size is also what the export's
print floor and view mode's legibility floor are computed from (`SMALLEST_SHEET_TEXT_PX`).
*Enforced by `src/design/__tests__/scale.test.ts`, which names every exception.*

**Space.** Seven steps for padding, margin and gap: `--space-1` … `--space-7` = 4, 8, 12, 16, 24,
32, 48. A value between two steps means choosing one, not adding a step. Hairline borders, radii and
control sizes are not spacing. Spacing computed in JavaScript uses the same tokens (see `indentBy` in
`ExplorerPanel.tsx`). *Enforced by `src/design/__tests__/scale.test.ts`.*

**Color.** Every color is a token in `:root`, written once as `light-dark(light, dark)`; the theme
is the system's unless Settings overrides it (`data-theme` on `<html>`, set before first paint by the
script in `index.html`). No color literal outside the token blocks. Text clears 4.5:1 on whatever it
sits on and the edge of a control clears 3:1 (WCAG 1.4.3, 1.4.11), in both themes:
- `--ink`, `--ink-soft` and `--ink-faint` are the three text weights. `--ink-faint` is the quietest
  thing allowed to be text, and it still passes.
- `--rule` is a hairline inside a surface, `--rule-mid` outlines what only groups things, and
  `--rule-strong` is the edge of something you operate or a panel floating over the page.
- Opacity is not a way to make text quieter: it silently takes it under the floor. Use a token.
- A dot's label color comes from `labelInk()` in `src/components/color.ts`, which picks by measured
  contrast, never by a luminance threshold.
- The key-region colors stay at least ΔE 15 apart, and two neighboring regions never share one.
- The export sheet is always light: it is printed on white paper.

*Enforced by `src/design/__tests__/contrast.test.ts` and `theme.test.ts`; `KNOWN_FAILURES` is empty
for both themes and has to stay that way.*

**Controls.** One control per kind of decision:
- On or off → `Switch` (`src/components/Switch.tsx`).
- One of a few named options → `Segmented` (`src/components/Segmented.tsx`), which implements the
  radiogroup pattern with a roving tab stop (`rovingRadioGroup.ts`).
- An action → a button at one of three levels: `.button.is-primary` (solid; one per surface, the
  thing the surface is for), `.button` (outline) or `.button.is-tertiary` (ghost). `.is-danger` is a
  tone on any level, not a fourth level. `.is-compact` and `.is-icon` are sizes.
- A new visual treatment for a button is a new level, and there are three.

*Enforced by `src/components/__tests__/TopBar.test.tsx`, which allows only the modifiers above.*

**Targets.** Everything a pointer is meant to hit is at least 24 CSS px on its smaller side (WCAG
2.2, 2.5.8), fretboard positions included. *Measured by `targetsUnder24` and `smallestBoardTarget`
in `e2e/metrics.spec.ts`.*

**Information.** Nothing a user needs lives only in a `title`: a native tooltip never appears on a
touch screen, and phones are a primary target. Put it in visible text, in the accessible name, or in
`InfoPopover`. A `title` may repeat what is already on screen.

**ARIA you declare, you implement.** A role promises a keyboard pattern. `role="radio"` without
arrow keys, `aria-modal` without a focus trap and `role="tooltip"` on something always in the DOM
were all in this codebase once, and each was worse than no role at all. Modal layers use
`useModalLayer` and popovers use `usePopoverLayer` (`src/components/focusLayer.ts`).

**Charts line up.** Every fretboard in a row starts its neck at the same height (`nutSpread`, over
every row, must be 0): all charts keep the same head, and anything a card may or may not carry goes
below the board, never in the header.

## Working here

- `npm test` (Vitest: theory, state, component renders, axe, contrast), `npm run typecheck` (three
  TypeScript projects), `npm run test:e2e` (Playwright at 390, 768 and 1440px: screenshots and layout
  budgets), `npm run build`, then `npm run check:budgets` (bundle size ceilings). CI runs all of it
  on every push (`.github/workflows/ci.yml`).
- A budget in `e2e/metrics.spec.ts` or `scripts/check-budgets.mjs` is the measured value. Tighten it
  when a change improves it. Loosening one is a regression, and the reason goes in a comment beside
  it and in the commit message.
- A known defect goes in as a failing assertion marked `it.fails` / `test.fail`, with a comment
  naming what will fix it — not as a TODO. Fixing it makes the run fail until the marker comes off.
- Screenshot baselines are Linux (`-linux.png`) and Chromium's headless shell, as CI runs them;
  `npm run test:e2e:update` retakes them and the new pictures belong in the diff for review. Full
  Chromium wraps some text differently and fails them, so if `PLAYWRIGHT_CHROMIUM_PATH` is set it
  must point at a `headless_shell` binary.
- Running Playwright while anything else might be serving on port 4173 measures the wrong build:
  the config reuses an existing server. Use a copy of the config on a private port.
- Styles live in `src/styles/`: `base.css` (tokens and the control vocabulary), `workbench.css`,
  `sidebar.css` and `panels.css` load on first paint from `main.tsx`, in that order; `wizard.css`,
  `export.css` and `tour.css` are imported by their own lazily loaded components. An override goes in
  the sheet that loads at or after the rule it overrides. Tests read every sheet through
  `src/design/styles.ts`, and a sheet added to the folder but not to its list fails a test.
- Conventions: American spelling ("color"); comments say *why*, in full sentences; `import type` for
  types; no `!important`; no dead CSS; a new persisted field is optional on read and old presets
  upgrade (`src/state/presetFormat.ts`).
- `src/theory/` has no DOM and no React; keep it that way. No music-theory or charting libraries.
