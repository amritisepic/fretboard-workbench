import { describe, expect, it } from 'vitest';
import css from '../../styles.css?inline';
import { SWATCHES } from '../../components/ColorField';
import { KEY_REGION_COLORS, bandShade, labelInk, mapShade, regionSlots } from '../../components/color';
import { MINIMUM, contrast, parseHex, ratio, rootColorTokens } from '../contrast';

const tokens = rootColorTokens(css);
const token = (name: string) => {
  const value = tokens[name];
  if (!value) throw new Error(`No --${name} on :root. If it was renamed, rename it here too.`);
  return value;
};

/**
 * Where each color is actually used, and what WCAG asks of it there. Decorative rules are left out
 * on purpose: 1.4.11 covers what identifies a control, not every hairline, which is why `--rule` and
 * `--rule-mid` (a card's outline, a table's head, an inlay) are not in the table.
 *
 * `--ink-faint` carries fret numbers, string names, the save status and the hint paragraphs, all of
 * them at 10.5–11.5px, so it is body text wherever it appears.
 */
const USAGE = [
  { what: 'body text', fg: 'ink', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'field and toolbar labels', fg: 'ink-soft', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'fret numbers, string names, save status, hints', fg: 'ink-faint', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'hints inside a sunk panel', fg: 'ink-faint', bg: 'paper-sunk', minimum: MINIMUM.bodyText },
  { what: 'destructive actions', fg: 'danger', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'the unsaved-changes status', fg: 'notice', bg: 'paper', minimum: MINIMUM.bodyText },
  { what: 'the edge of an input, tab or panel', fg: 'rule-strong', bg: 'paper', minimum: MINIMUM.controlBoundary },
] as const;

/**
 * The usages that fail today. The test asserts this list exactly, so a new failure breaks the build
 * and a fixed one has to be deleted from here — it cannot quietly stay on the list. Plan item 22
 * emptied it: `--ink-faint` went from 2.76:1 on paper and 2.55:1 on the sunk panels to 4.96 and
 * 4.59, and `--rule-strong` from 1.53:1 to 3.1.
 */
const KNOWN_FAILURES: readonly string[] = [];

/** The ink printed on the key bands and the scale bands, hardcoded in styles.css. */
const BAND_INK = '#56524A';
/** The lighter ink of a rival reading's scale on a scale band (`.scale-alternative`), also hardcoded. */
const RIVAL_SCALE_INK = '#625E56';

/** The dot colors before plan item 22 darkened four of them. Boxes saved in them keep them. */
const RETIRED_SWATCHES = ['#C9672A', '#B08A1E', '#3E8750', '#23828A'];

describe('design tokens', () => {
  it('declares every color the usage table names', () => {
    for (const { fg, bg } of USAGE) {
      expect(() => parseHex(token(fg))).not.toThrow();
      expect(() => parseHex(token(bg))).not.toThrow();
    }
  });

  it('meets its contrast minimums, apart from the failures on record', () => {
    const failing = USAGE.filter(({ fg, bg, minimum }) => contrast(token(fg), token(bg)) < minimum).map(
      ({ fg, bg }) => `${fg} on ${bg}`,
    );
    expect(failing, 'fix one and delete it from KNOWN_FAILURES; add one and it belongs in the plan').toEqual(
      KNOWN_FAILURES,
    );
  });

  it('reports the measured ratios, so a change to a token is visible in the diff', () => {
    const measured = Object.fromEntries(USAGE.map(({ fg, bg }) => [`${fg} on ${bg}`, ratio(token(fg), token(bg))]));
    expect(measured).toEqual({
      'ink on paper': 10.81,
      'ink-soft on paper': 5.68,
      'ink-faint on paper': 4.96,
      'ink-faint on paper-sunk': 4.59,
      'danger on paper': 6.33,
      'notice on paper': 5.6,
      'rule-strong on paper': 3.1,
    });
  });
});

describe('key region colors', () => {
  it('keeps the band ink readable on every region', () => {
    for (const region of KEY_REGION_COLORS) {
      expect(ratio(BAND_INK, region), `band ink on ${region}`).toBeGreaterThanOrEqual(MINIMUM.bodyText);
    }
  });

  it('keeps the band ink, and the rival scale beside it, readable on a scale band tinted with any dot color', () => {
    for (const swatch of SWATCHES) {
      for (const [what, ink] of [
        ['band ink', BAND_INK],
        ['rival scale', RIVAL_SCALE_INK],
      ] as const) {
        expect(ratio(ink, bandShade(swatch.value)), `${what} on a ${swatch.name} scale band`).toBeGreaterThanOrEqual(
          MINIMUM.bodyText,
        );
      }
    }
  });

  // They used to be eight beiges whose closest pair was ΔE 3.0, near the just-noticeable 2.3, so on
  // a projector or in sunlight two regions read as one. Plan item 23 rebuilt them.
  it('keeps the region colors far enough apart to tell one from another', () => {
    for (let i = 0; i < KEY_REGION_COLORS.length; i++) {
      for (let j = i + 1; j < KEY_REGION_COLORS.length; j++) {
        expect(deltaE(KEY_REGION_COLORS[i], KEY_REGION_COLORS[j]), `${KEY_REGION_COLORS[i]} vs ${KEY_REGION_COLORS[j]}`)
          .toBeGreaterThanOrEqual(15);
      }
    }
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

describe('labelInk', () => {
  it('picks the more readable of dark ink and white for every dot color and its map shade', () => {
    for (const swatch of SWATCHES) {
      for (const [kind, color] of [
        ['clicked', swatch.value],
        ['map shade', mapShade(swatch.value)],
      ] as const) {
        const chosen = labelInk(color);
        const other = chosen === '#FFFFFF' ? '#3A3A3A' : '#FFFFFF';
        expect(contrast(chosen, color), `${swatch.name} ${kind}: chose the worse of the two`).toBeGreaterThanOrEqual(
          contrast(other, color),
        );
      }
    }
  });

  // Dot labels are 10.5px at every length, so they are body text.
  it('leaves every dot label readable against its dot', () => {
    for (const swatch of SWATCHES) {
      for (const [kind, color] of [
        ['dot', swatch.value],
        ['map shade', mapShade(swatch.value)],
      ] as const) {
        expect(ratio(labelInk(color), color), `${swatch.name} ${kind} label`).toBeGreaterThanOrEqual(MINIMUM.bodyText);
      }
    }
  });

  it('labels every dot color in white, so the palette reads as one set', () => {
    expect(SWATCHES.filter((swatch) => labelInk(swatch.value) !== '#FFFFFF').map((swatch) => swatch.name)).toEqual([]);
  });

  it('finds a readable ink for any custom color, and for a box still in a retired dot color', () => {
    // Every channel in steps of 17: 4,096 colors from black to white, with every mid-tone in between.
    const steps = Array.from({ length: 16 }, (_, i) => (i * 17).toString(16).padStart(2, '0'));
    const colors = steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => `#${r}${g}${b}`)));
    const unreadable = [...colors, ...RETIRED_SWATCHES].filter((color) => ratio(labelInk(color), color) < MINIMUM.bodyText);
    expect(unreadable).toEqual([]);
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
