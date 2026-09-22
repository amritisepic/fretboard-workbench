import { describe, expect, it } from 'vitest';
import {
  MIN_LEGIBLE_SCALE,
  MIN_PRINT_POINTS,
  SMALLEST_SHEET_TEXT_PX,
  bestFit,
  isLegible,
  pageGeometry,
  paginate,
  printedPoints,
  trialWidths,
} from '../export/exportLayout';
import { buildPdf } from '../export/pdfWriter';

describe('export layout', () => {
  it('measures pages in points and their printable area in CSS pixels', () => {
    const a4 = pageGeometry({ paper: 'a4', orientation: 'portrait', marginMm: 10, fit: 'page', scalePercent: 100 });
    expect([Math.round(a4.width), Math.round(a4.height)]).toEqual([595, 842]);
    expect(Math.round(a4.contentWidthPx)).toBe(718);
    const letter = pageGeometry({ paper: 'letter', orientation: 'landscape', marginMm: 0, fit: 'page', scalePercent: 100 });
    expect([letter.width, letter.height, letter.contentWidthPx]).toEqual([792, 612, 1056]);
  });

  it('picks the layout width that fits the page at the largest scale', () => {
    expect(trialWidths(700, 1500)).toEqual([700, 840, 1008, 1210, 1452, 1500]);
    // Wrapping narrower makes the content taller: 3 rows at 700, 2 at 1000, 1 at 1500.
    const trials = [
      { width: 700, contentWidth: 700, contentHeight: 1800 },
      { width: 1000, contentWidth: 1000, contentHeight: 1200 },
      { width: 1500, contentWidth: 1500, contentHeight: 600 },
    ];
    const fit = bestFit(trials, 718, 1000);
    expect(fit.trial.width).toBe(1000);
    expect(fit.scale).toBeCloseTo(0.718);
    expect(bestFit([{ width: 100, contentWidth: 100, contentHeight: 50 }], 718, 1000).scale).toBe(2);
  });

  it('breaks pages at the latest row that fits, cutting only pieces taller than a page', () => {
    expect(paginate(900, 1000, [0, 300, 600])).toEqual([{ start: 0, end: 900 }]);
    expect(paginate(2500, 1000, [0, 450, 900, 1350, 1800, 2250])).toEqual([
      { start: 0, end: 900 },
      { start: 900, end: 1800 },
      { start: 1800, end: 2500 },
    ]);
    expect(paginate(2200, 1000, [0, 1500])).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 1500 },
      { start: 1500, end: 2200 },
    ]);
  });
});

describe('PDF writer', () => {
  it('writes one image page per page with a valid cross-reference table', () => {
    const image = { bytes: new Uint8Array([255, 216, 1, 2, 3, 255, 217]), width: 4, height: 2 };
    const page = { width: 595.28, height: 841.89, image, x: 28, y: 28, drawWidth: 539, drawHeight: 270 };
    const bytes = buildPdf([page, page], 'Autumn Leaves in G minor ♭');
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(text).toContain('/Count 2');
    expect(text).toContain('q 539 0 0 270 28 543.89 cm /Im0 Do Q');

    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(9);
    entries.forEach((offset, i) => expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });
});

describe('the legibility floor', () => {
  it('measures printed text in points, at 96 CSS pixels to the inch', () => {
    // 12 CSS px is 9 pt at full size, and half of that at half size.
    expect(printedPoints(12, 1)).toBe(9);
    expect(printedPoints(12, 0.5)).toBe(4.5);
  });

  it('puts the floor where the smallest text on the sheet still prints at the minimum', () => {
    expect(printedPoints(SMALLEST_SHEET_TEXT_PX, MIN_LEGIBLE_SCALE)).toBeCloseTo(MIN_PRINT_POINTS, 6);
    // The old default laid the page out at 60% of screen size, which printed those labels at 4.7 pt.
    expect(printedPoints(SMALLEST_SHEET_TEXT_PX, 0.6)).toBeLessThan(MIN_PRINT_POINTS);
    expect(isLegible(0.6)).toBe(false);
    expect(isLegible(MIN_LEGIBLE_SCALE)).toBe(true);
    expect(isLegible(1)).toBe(true);
  });

  it('fits a tall progression onto a page only when the fit stays readable', () => {
    const a4 = pageGeometry({ paper: 'a4', orientation: 'portrait', marginMm: 12, fit: 'page', scalePercent: 100 });
    // Thirty-one chords stacked on one A4 page: the scale that fits is far under the floor, which is
    // the reading the dialog uses to paginate instead of shrinking.
    const tall = bestFit([{ width: 900, contentWidth: 900, contentHeight: 6000 }], a4.contentWidthPx, a4.contentHeightPx);
    expect(isLegible(tall.scale)).toBe(false);
    // Four chords in a row fit on the same page at a size that is still readable.
    const short = bestFit([{ width: 900, contentWidth: 900, contentHeight: 700 }], a4.contentWidthPx, a4.contentHeightPx);
    expect(isLegible(short.scale)).toBe(true);
  });
});
