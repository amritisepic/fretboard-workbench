import { describe, expect, it } from 'vitest';
import css from '../../styles.css?inline';
import { SWATCHES } from '../../components/ColorField';
import { KEY_REGION_COLORS, bandShade, labelInk, mapShade } from '../../components/color';
import { MINIMUM, contrast, parseHex, ratio, rootColorTokens } from '../contrast';

const tokens = rootColorTokens(css);
const token = (name: string) => {
  const value = tokens[name];
  if (!value) throw new Error(`No --${name} on :root. If it was renamed, rename it here too.`);
  return value;
};

/**
 * Where each colour is actually used, and what WCAG asks of it there. Decorative rules are left out
 * on purpose: 1.4.11 covers what identifies a control, not every hairline.
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
 * The usages that fail today, and the plan item that fixes each. The test asserts this list exactly,
 * so a new failure breaks the build and a fixed one has to be deleted from here — it cannot quietly
 * stay on the list. Plan item 22 (Phase 3) clears it.
 */
const KNOWN_FAILURES: readonly string[] = [
  'ink-faint on paper', // 2.76:1, needs 4.5
  'ink-faint on paper-sunk', // 2.55:1, needs 4.5
  'rule-strong on paper', // 1.53:1, needs 3
];

/** The ink printed on the key bands and the scale bands, hardcoded in styles.css. */
const BAND_INK = '#56524A';

describe('design tokens', () => {
  it('declares every colour the usage table names', () => {
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
      'ink-faint on paper': 2.76,
      'ink-faint on paper-sunk': 2.55,
      'danger on paper': 6.33,
      'notice on paper': 5.6,
      'rule-strong on paper': 1.53,
    });
  });
});

describe('key region colours', () => {
  it('keeps the band ink readable on every region', () => {
    for (const region of KEY_REGION_COLORS) {
      expect(ratio(BAND_INK, region), `band ink on ${region}`).toBeGreaterThanOrEqual(MINIMUM.bodyText);
    }
  });

  it('keeps the band ink readable on a scale band tinted with any dot colour', () => {
    for (const swatch of SWATCHES) {
      expect(ratio(BAND_INK, bandShade(swatch.value)), `band ink on a ${swatch.name} scale band`).toBeGreaterThanOrEqual(
        MINIMUM.bodyText,
      );
    }
  });

  // ---- Known gaps -------------------------------------------------------

  // The eight region colours are all the same beige at slightly different hues. They are what tells
  // one key region from the next, and several pairs are close to the just-noticeable threshold, so
  // on a projector or in sunlight they read as one colour. Plan item 23 (Phase 3) rebuilds them.
  it.fails('keeps the region colours far enough apart to tell one from another', () => {
    for (let i = 0; i < KEY_REGION_COLORS.length; i++) {
      for (let j = i + 1; j < KEY_REGION_COLORS.length; j++) {
        expect(deltaE(KEY_REGION_COLORS[i], KEY_REGION_COLORS[j]), `${KEY_REGION_COLORS[i]} vs ${KEY_REGION_COLORS[j]}`)
          .toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('labelInk', () => {
  it('picks the more readable of dark ink and white for every dot colour and its map shade', () => {
    for (const swatch of SWATCHES) {
      for (const [kind, colour] of [
        ['clicked', swatch.value],
        ['map shade', mapShade(swatch.value)],
      ] as const) {
        const chosen = labelInk(colour);
        const other = chosen === '#FFFFFF' ? '#3A3A3A' : '#FFFFFF';
        expect(contrast(chosen, colour), `${swatch.name} ${kind}: chose the worse of the two`).toBeGreaterThanOrEqual(
          contrast(other, colour),
        );
      }
    }
  });

  // ---- Known gaps -------------------------------------------------------

  // labelInk picks by a luminance threshold and never checks what it got. Dot labels are 10.5px, or
  // 8.5px once a label runs past two characters, so they are body text. Plan item 22 (Phase 3) is
  // where the palette is chosen to clear this; plan item 22 also drops the 8.5px size.
  it.fails('leaves every dot label readable against its dot', () => {
    for (const swatch of SWATCHES) {
      const colour = swatch.value;
      expect(ratio(labelInk(colour), colour), `${swatch.name} dot label`).toBeGreaterThanOrEqual(MINIMUM.bodyText);
    }
  });
});

/**
 * CIE76 colour difference in Lab. Roughly: 1 is the smallest difference an eye can catch under ideal
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
