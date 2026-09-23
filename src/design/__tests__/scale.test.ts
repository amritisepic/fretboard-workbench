import { describe, expect, it } from 'vitest';
import { css } from '../styles';
import { SMALLEST_SHEET_TEXT_PX } from '../../components/export/exportLayout';
import { declarations } from '../stylesheet';

/**
 * The type scale and the space scale, held to the six sizes and seven steps they were cut down to.
 *
 * Before plan items 19 and 20 the stylesheet used fifteen font sizes, five of them half pixels, and
 * nearly every integer from 1 to 20 as spacing, each value nudged until one rule looked right on its
 * own. A scale nobody checks drifts back to that within a month, one reasonable-looking 13px at a
 * time; these tests are what stop the sixteenth size.
 *
 * The exceptions are listed exactly, as the contrast test lists its known failures: adding one means
 * adding it here, where a reviewer sees it, and fixing one means deleting it.
 */

const all = declarations(css);
// The tokens are declared on the page's root and on the two roots the export is drawn in; see the top of
// src/styles/base.css for why.
const TOKENS = ':root, .export-stage, .export-root';
const outsideRoot = all.filter((d) => d.selector !== TOKENS);
const describeDeclaration = ({ selector, property, value }: { selector: string; property: string; value: string }) =>
  `${selector} { ${property}: ${value} }`;

const TEXT = { xs: 11, sm: 12, md: 14, lg: 16, xl: 20, '2xl': 28 } as const;
const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

/** Font sizes that are not on the scale, each with the reason in the stylesheet beside it. */
const OFF_SCALE_SIZES = [
  // Figured bass, set in proportion to the numeral it annotates.
  '.function-text .figure { font-size: 0.68em }',
  '.function-text .figures { font-size: 0.62em }',
];

/** Spacing properties whose value is geometry rather than space. */
const OFF_SCALE_SPACING = [
  // Centres the 16px thumb on the 2px track: (2 - 16) / 2.
  '.mode-range::-webkit-slider-thumb { margin-top: -7px }',
];

/** Line heights other than the two leading tokens, in the order the stylesheet has them. */
const OFF_SCALE_LEADING = [
  // The pill in a 24px key bar.
  '.key-band-scale { line-height: 18px }',
  // Figured bass: a superscript takes no room in the line, and stacked figures sit close.
  '.function-text .figure { line-height: 0 }',
  '.function-text .figures { line-height: 0.95 }',
  // A single glyph centred in a fixed box.
  '.swatch-custom { line-height: 1 }',
  '.explorer-more { line-height: 1 }',
];

const SPACING = /^(padding|margin|gap|row-gap|column-gap|scroll-padding)(-(top|right|bottom|left|block|inline))*$/;
const SPACE_TERM = /^(0|auto|var\(--space-[1-7]\)|calc\(-1 \* var\(--space-[1-7]\)\))$/;

/** A value's space-separated terms, keeping a `calc(...)` whole. */
const terms = (value: string) => value.match(/calc\([^)]*\)\)|\S+/g) ?? [];

describe('the type scale', () => {
  it('declares six sizes, in whole pixels', () => {
    const declared = Object.fromEntries(
      all.filter((d) => d.selector === TOKENS && d.property.startsWith('--text-')).map((d) => [d.property, d.value]),
    );
    expect(declared).toEqual(Object.fromEntries(Object.entries(TEXT).map(([name, px]) => [`--text-${name}`, `${px}px`])));
  });

  it('sets every font size from it', () => {
    const offScale = outsideRoot
      .filter((d) => d.property === 'font-size' && !/^var\(--text-(xs|sm|md|lg|xl|2xl)\)$/.test(d.value))
      .map(describeDeclaration);
    expect(offScale, 'a font size off the scale: use a --text token, or list it here with the reason').toEqual(
      OFF_SCALE_SIZES,
    );
  });

  it('sets every line height from the two leading tokens', () => {
    const offScale = outsideRoot
      .filter((d) => d.property === 'line-height' && !/^var\(--leading(-tight)?\)$/.test(d.value))
      .map(describeDeclaration);
    expect(offScale).toEqual(OFF_SCALE_LEADING);
  });

  it("puts the export's print floor at the scale's smallest size, the size of a board's own text", () => {
    expect(`${SMALLEST_SHEET_TEXT_PX}px`).toBe(`${TEXT.xs}px`);
    const boardText = outsideRoot.filter((d) =>
      ['.fretboard .string-name, .fretboard .fret-number', '.fretboard .dot-label'].includes(d.selector),
    );
    expect(boardText.filter((d) => d.property === 'font-size').map((d) => d.value)).toEqual([
      'var(--text-xs)',
      'var(--text-xs)',
    ]);
  });
});

describe('the space scale', () => {
  it('declares seven steps', () => {
    const declared = Object.fromEntries(
      all.filter((d) => d.selector === TOKENS && d.property.startsWith('--space-')).map((d) => [d.property, d.value]),
    );
    expect(declared).toEqual(Object.fromEntries(Object.entries(SPACE).map(([step, px]) => [`--space-${step}`, `${px}px`])));
  });

  it('sets every padding, margin and gap from it', () => {
    const offScale = outsideRoot
      .filter((d) => SPACING.test(d.property) && !terms(d.value).every((term) => SPACE_TERM.test(term)))
      .map(describeDeclaration);
    expect(offScale, 'a spacing value off the scale: use a --space token, or list it here with the reason').toEqual(
      OFF_SCALE_SPACING,
    );
  });

  it('reads a declaration the way the guard above needs it to', () => {
    // The guard is only as good as its reading of the file, so it is checked against a sample.
    const sample = declarations('.a { padding: 0 var(--space-2); } @media (x) { .b { margin: calc(-1 * var(--space-5)) 3px; } }');
    expect(sample).toEqual([
      { selector: '.a', property: 'padding', value: '0 var(--space-2)' },
      { selector: '@media (x) / .b', property: 'margin', value: 'calc(-1 * var(--space-5)) 3px' },
    ]);
    expect(terms('calc(-1 * var(--space-5)) 3px')).toEqual(['calc(-1 * var(--space-5))', '3px']);
    expect(SPACE_TERM.test('3px')).toBe(false);
  });
});
