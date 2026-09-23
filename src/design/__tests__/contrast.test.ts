import { describe, expect, it } from 'vitest';
import { css } from '../styles';
import { SWATCHES } from '../../components/ColorField';
import {
  KEY_REGION_COLORS,
  PAPER,
  bandShadeIn,
  dotColorIn,
  labelInk,
  mapShadeIn,
  regionSlots,
  type Theme,
} from '../../components/color';
import { DEFAULT_BOX_COLOR } from '../../state/workbench';
import { MINIMUM, contrast, parseHex, ratio, rootColorTokens } from '../contrast';

const THEMES: readonly Theme[] = ['light', 'dark'];
const tokens = { light: rootColorTokens(css, 'light'), dark: rootColorTokens(css, 'dark') };
const token = (theme: Theme, name: string) => {
  const value = tokens[theme][name];
  if (!value) throw new Error(`No --${name} on :root for the ${theme} theme. If it was renamed, rename it here too.`);
  return value;
};
const regions = (theme: Theme) => KEY_REGION_COLORS.map((_, i) => token(theme, `region-${i + 1}`));

/**
 * Where each color is actually used, and what WCAG asks of it there. Decorative rules are left out
 * on purpose: 1.4.11 covers what identifies a control, not every hairline, which is why `--rule` and
 * `--rule-mid` (a card's outline, a table's head, an inlay) are not in the table.
 *
 * `--ink-faint` carries fret numbers, string names, the save status and the hint paragraphs, all of
 * them at --text-xs or --text-sm, so it is body text wherever it appears.
 *
 * Both themes are held to the whole table. A pairing in which the colors trade places, such as a
 * primary button's label (the page's color on the ink), measures the same as the pairing it inverts
 * and is not listed twice.
 */
const USAGE = [
  { what: 'body text', fg: 'ink', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'field and toolbar labels', fg: 'ink-soft', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'the export summary, over the preview', fg: 'ink-soft', bg: 'paper-sunk', minimum: MINIMUM.bodyText },
  { what: 'fret numbers, string names, save status, hints', fg: 'ink-faint', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'hints inside a sunk panel', fg: 'ink-faint', bg: 'paper-sunk', minimum: MINIMUM.bodyText },
  { what: 'destructive actions', fg: 'danger', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'a tertiary destructive action, pointed at', fg: 'danger', bg: 'paper-sunk', minimum: MINIMUM.bodyText },
  { what: 'the unsaved-changes status', fg: 'notice', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'the edge of an input, tab or panel', fg: 'rule-strong', bg: 'paper', minimum: MINIMUM.controlBoundary },
  { what: "the tonic's name in the chromatic grid", fg: 'on-tonic', bg: 'tonic', minimum: MINIMUM.bodyText },
] as const;

/**
 * The usages that fail today, per theme. The test asserts these lists exactly, so a new failure
 * breaks the build and a fixed one has to be deleted from here — it cannot quietly stay on the list.
 * Plan item 22 emptied the light theme's: `--ink-faint` went from 2.76:1 on paper and 2.55:1 on the
 * sunk panels to 4.96 and 4.59, and `--rule-strong` from 1.53:1 to 3.1. The dark theme was built to
 * the same table and has never had one.
 */
const KNOWN_FAILURES: Readonly<Record<Theme, readonly string[]>> = { light: [], dark: [] };

/** The dot colors before plan item 22 darkened four of them. Boxes saved in them keep them. */
const RETIRED_SWATCHES = ['#C9672A', '#B08A1E', '#3E8750', '#23828A'];

/** Every channel in steps of 17: 4,096 colors from black to white, with every mid-tone in between. */
const steps = Array.from({ length: 16 }, (_, i) => (i * 17).toString(16).padStart(2, '0'));
const EVERY_COLOR = steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => `#${r}${g}${b}`)));

describe('design tokens', () => {
  it('declares every color the usage table names, in both themes', () => {
    for (const theme of THEMES) {
      for (const { fg, bg } of USAGE) {
        expect(() => parseHex(token(theme, fg))).not.toThrow();
        expect(() => parseHex(token(theme, bg))).not.toThrow();
      }
    }
  });

  it('meets its contrast minimums in both themes, apart from the failures on record', () => {
    for (const theme of THEMES) {
      const failing = USAGE.filter(({ fg, bg, minimum }) => contrast(token(theme, fg), token(theme, bg)) < minimum).map(
        ({ fg, bg }) => `${fg} on ${bg}`,
      );
      expect(failing, `${theme}: fix one and delete it from KNOWN_FAILURES; add one and it belongs in the plan`).toEqual(
        KNOWN_FAILURES[theme],
      );
    }
  });

  it('reports the measured ratios, so a change to a token is visible in the diff', () => {
    const measured = (theme: Theme) =>
      Object.fromEntries(USAGE.map(({ fg, bg }) => [`${fg} on ${bg}`, ratio(token(theme, fg), token(theme, bg))]));
    expect(measured('light')).toEqual({
      'ink on paper': 10.81,
      'ink-soft on paper': 5.68,
      'ink-soft on paper-sunk': 5.25,
      'ink-faint on paper': 4.96,
      'ink-faint on paper-sunk': 4.59,
      'danger on paper': 6.33,
      'danger on paper-sunk': 5.85,
      'notice on paper': 5.6,
      'rule-strong on paper': 3.1,
      'on-tonic on tonic': 5.19,
    });
    expect(measured('dark')).toEqual({
      'ink on paper': 14.23,
      'ink-soft on paper': 7.26,
      'ink-soft on paper-sunk': 6.48,
      'ink-faint on paper': 5.4,
      'ink-faint on paper-sunk': 4.82,
      'danger on paper': 6.54,
      'danger on paper-sunk': 5.84,
      'notice on paper': 7.17,
      'rule-strong on paper': 3.58,
      'on-tonic on tonic': 5.19,
    });
  });

  it('draws the page the color the scripts give the browser for it', () => {
    for (const theme of THEMES) expect(token(theme, 'paper').toLowerCase()).toBe(PAPER[theme].toLowerCase());
  });

  it("draws the chromatic grid's tonic in the color its dots are drawn in, in either theme", () => {
    for (const theme of THEMES) {
      const dot = dotColorIn(DEFAULT_BOX_COLOR, theme);
      expect(token(theme, 'tonic').toLowerCase(), theme).toBe(dot.toLowerCase());
      expect(token(theme, 'on-tonic').toLowerCase(), theme).toBe(labelInk(dot).toLowerCase());
    }
  });
});

describe('key region colors', () => {
  it('are the stylesheet tokens, one per slot', () => {
    expect(KEY_REGION_COLORS).toEqual(regions('light').map((_, i) => `var(--region-${i + 1})`));
  });

  it('keep the band ink readable on every region, in both themes', () => {
    for (const theme of THEMES) {
      for (const region of regions(theme)) {
        expect(ratio(token(theme, 'band-ink'), region), `${theme}: band ink on ${region}`).toBeGreaterThanOrEqual(
          MINIMUM.bodyText,
        );
        // A key choice turns to the page's ink under the pointer.
        expect(ratio(token(theme, 'ink'), region), `${theme}: ink on ${region}`).toBeGreaterThanOrEqual(MINIMUM.bodyText);
      }
    }
  });

  it('keep the band ink, and the rival scale beside it, readable on a scale band tinted with any dot color', () => {
    for (const theme of THEMES) {
      for (const swatch of SWATCHES) {
        for (const ink of ['band-ink', 'band-ink-soft']) {
          const band = bandShadeIn(swatch.value, theme);
          expect(ratio(token(theme, ink), band), `${theme}: ${ink} on a ${swatch.name} scale band`).toBeGreaterThanOrEqual(
            MINIMUM.bodyText,
          );
        }
      }
    }
  });

  // They used to be eight beiges whose closest pair was ΔE 3.0, near the just-noticeable 2.3, so on
  // a projector or in sunlight two regions read as one. Plan item 23 rebuilt them; the dark set keeps
  // their hues and chroma at a lower lightness, which keeps them as far apart.
  it('keep the region colors far enough apart to tell one from another, in both themes', () => {
    for (const theme of THEMES) {
      const colors = regions(theme);
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          expect(deltaE(colors[i], colors[j]), `${theme}: ${colors[i]} vs ${colors[j]}`).toBeGreaterThanOrEqual(15);
        }
      }
    }
  });

  it('stand off the dark page at least as far as they stand off the light one', () => {
    const closest = (theme: Theme) => Math.min(...regions(theme).map((region) => contrast(region, token(theme, 'paper'))));
    expect(closest('dark')).toBeGreaterThanOrEqual(closest('light'));
  });

  it('gives each of the first eight keys a color of its own, wherever the key comes back', () => {
    expect(regionSlots([0, 1, 0, 2, 3, 4, 5, 6, 7, 3, 0])).toEqual([0, 1, 0, 2, 3, 4, 5, 6, 7, 3, 0]);
  });

  it('never draws two neighbouring regions in the same color, however many keys there are', () => {
    const progressions = {
      // The regions of Blues for Alice, one of the built-in examples, numbered by key. Its ninth key
      // used to wrap round onto the first key's color, right beside the first key.
      'Blues for Alice': [0, 1, 2, 0, 3, 4, 5, 6, 0, 7, 8, 0, 7, 0],
      'a home key every other key returns to': [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10, 0, 8],
      // Its ninth key borders every one of the eight colors, so none is left that it could keep.
      'a key that borders all eight colors': [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 8, 1, 8, 2, 8, 3, 8, 4, 8, 5, 8, 6, 8],
    };
    for (const [name, keys] of Object.entries(progressions)) {
      const slots = regionSlots(keys);
      expect(slots.every((slot) => slot >= 0 && slot < KEY_REGION_COLORS.length), name).toBe(true);
      const clashes = slots.flatMap((slot, i) => (i > 0 && slot === slots[i - 1] ? [i] : []));
      expect(clashes, `${name}: regions drawn in the color of the region before`).toEqual([]);
    }
    // A key past the eighth still keeps one color wherever it comes back, when a color is free.
    const alice = regionSlots(progressions['Blues for Alice']);
    expect(new Set(alice.filter((_, i) => progressions['Blues for Alice'][i] === 8)).size).toBe(1);
    expect(new Set(alice.filter((_, i) => progressions['Blues for Alice'][i] === 0))).toEqual(new Set([0]));
  });
});

describe('dot colors', () => {
  it('draw every dot color as chosen in the light theme', () => {
    for (const swatch of SWATCHES) expect(dotColorIn(swatch.value, 'light')).toBe(swatch.value);
  });

  // The dark theme keeps a box's color wherever the dark page can show it, and lifts the rest.
  it('keep five of the eight in the dark theme, and lift the three the dark page would hide', () => {
    const changed = SWATCHES.filter((swatch) => dotColorIn(swatch.value, 'dark') !== swatch.value).map((s) => s.name);
    expect(changed).toEqual(['Blue', 'Violet', 'Graphite']);
  });

  it('stand out from the page in both themes', () => {
    for (const theme of THEMES) {
      for (const swatch of SWATCHES) {
        expect(ratio(dotColorIn(swatch.value, theme), PAPER[theme]), `${theme}: ${swatch.name}`).toBeGreaterThanOrEqual(
          MINIMUM.graphic,
        );
      }
    }
  });

  it('let the dark page show any custom color, and a box still in a retired dot color', () => {
    const hidden = [...EVERY_COLOR, ...RETIRED_SWATCHES].filter(
      (color) => ratio(dotColorIn(color, 'dark'), PAPER.dark) < MINIMUM.graphic,
    );
    expect(hidden).toEqual([]);
  });
});

describe('labelInk', () => {
  it('picks the more readable of dark ink and white for every dot color and its map shade', () => {
    for (const theme of THEMES) {
      for (const swatch of SWATCHES) {
        for (const [kind, color] of [
          ['clicked', dotColorIn(swatch.value, theme)],
          ['map shade', mapShadeIn(swatch.value, theme)],
        ] as const) {
          const chosen = labelInk(color);
          const other = chosen === '#FFFFFF' ? '#3A3A3A' : '#FFFFFF';
          expect(contrast(chosen, color), `${theme}: ${swatch.name} ${kind}: chose the worse of the two`).toBeGreaterThanOrEqual(
            contrast(other, color),
          );
        }
      }
    }
  });

  // Dot labels are --text-xs at every length, so they are body text.
  it('leaves every dot label readable against its dot, in both themes', () => {
    for (const theme of THEMES) {
      for (const swatch of SWATCHES) {
        for (const [kind, color] of [
          ['dot', dotColorIn(swatch.value, theme)],
          ['map shade', mapShadeIn(swatch.value, theme)],
        ] as const) {
          expect(ratio(labelInk(color), color), `${theme}: ${swatch.name} ${kind} label`).toBeGreaterThanOrEqual(
            MINIMUM.bodyText,
          );
        }
      }
    }
  });

  it('labels every dot color in white, in both themes, so the palette reads as one set', () => {
    for (const theme of THEMES) {
      const other = SWATCHES.filter((swatch) => labelInk(dotColorIn(swatch.value, theme)) !== '#FFFFFF');
      expect(other.map((swatch) => swatch.name), theme).toEqual([]);
    }
  });

  it('finds a readable ink for any custom color, and for a box still in a retired dot color', () => {
    for (const theme of THEMES) {
      const unreadable = [...EVERY_COLOR, ...RETIRED_SWATCHES]
        .map((color) => dotColorIn(color, theme))
        .filter((color) => ratio(labelInk(color), color) < MINIMUM.bodyText);
      expect(unreadable, theme).toEqual([]);
    }
  });
});

/**
 * CIE76 color difference in Lab. Roughly: 1 is the smallest difference an eye can catch under ideal
 * conditions, 2.3 is the usual "just noticeable" threshold, and large flat areas separated in space
 * need considerably more than that.
 */
function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = parseHex(hex).map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
