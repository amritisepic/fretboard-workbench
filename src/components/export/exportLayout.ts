/** Page sizes, how content is scaled to them, and where pages break. Pure, so it can be tested without a browser. */

export type Paper = 'a4' | 'letter' | 'a3';
export type PageOrientation = 'portrait' | 'landscape';
/** One page for everything, the page's width (as many pages as needed), or a chosen scale. */
export type FitMode = 'page' | 'width' | 'custom';

export interface PageSetup {
  readonly paper: Paper;
  readonly orientation: PageOrientation;
  readonly marginMm: number;
  readonly fit: FitMode;
  /** Used when `fit` is custom: 100 draws content at screen size (96 CSS px per inch). */
  readonly scalePercent: number;
}

export const PAPER_SIZES: Readonly<Record<Paper, { readonly label: string; readonly width: number; readonly height: number }>> = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  letter: { label: 'Letter', width: 612, height: 792 },
  a3: { label: 'A3', width: 841.89, height: 1190.55 },
};

export const POINTS_PER_MM = 72 / 25.4;
/** CSS pixels per point: 96 px and 72 pt to the inch. */
export const PX_PER_POINT = 96 / 72;
/** The largest a fitted export enlarges short content. */
export const MAX_FIT_SCALE = 2;

/**
 * The smallest text a board on an export sheet draws, in CSS pixels: the fret numbers, the string
 * names and every note's label, which all share this size.
 *
 * A note's label used to drop to 8.5px once it ran past two glyphs, and this floor was set without
 * it, since a floor that honored it would have forced a page count nobody wanted. That size is gone:
 * a long label is now narrowed to fit its note at full height, so nothing on a board is smaller than
 * this and the floor covers every glyph on it.
 */
export const SMALLEST_SHEET_TEXT_PX = 10.5;

/**
 * The size below which printed text is fine print rather than something read at arm's length. Six
 * points is the usual floor, and a chord chart is read on a music stand.
 */
export const MIN_PRINT_POINTS = 6;

/** What `cssPixels` of text measures on paper, in points, when the sheet is printed at `scale`. */
export const printedPoints = (cssPixels: number, scale: number): number => (cssPixels / PX_PER_POINT) * scale;

/**
 * The smallest scale an export may shrink to before the page count has to grow instead.
 *
 * The sheet's smallest text is 7.9 points at full size, so six points is about 76% of it. Fitting
 * everything onto one page is a promise about the page count, and it is the wrong promise to keep
 * when keeping it means printing a chart nobody can read.
 */
export const MIN_LEGIBLE_SCALE = MIN_PRINT_POINTS / printedPoints(SMALLEST_SHEET_TEXT_PX, 1);

/** Whether `scale` keeps the sheet's smallest text at or above the print floor. */
export const isLegible = (scale: number): boolean =>
  printedPoints(SMALLEST_SHEET_TEXT_PX, scale) >= MIN_PRINT_POINTS - 0.001;

export interface PageGeometry {
  /** The page in points. */
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  /** The printable area in CSS pixels at 100%. */
  readonly contentWidthPx: number;
  readonly contentHeightPx: number;
}

export function pageGeometry({ paper, orientation, marginMm }: PageSetup): PageGeometry {
  const size = PAPER_SIZES[paper];
  const [width, height] = orientation === 'portrait' ? [size.width, size.height] : [size.height, size.width];
  const margin = marginMm * POINTS_PER_MM;
  return {
    width,
    height,
    margin,
    contentWidthPx: (width - 2 * margin) * PX_PER_POINT,
    contentHeightPx: (height - 2 * margin) * PX_PER_POINT,
  };
}

export interface LayoutTrial {
  /** The width the content was laid out at. */
  readonly width: number;
  /** Its size at that width; wide pieces may overflow the layout width. */
  readonly contentWidth: number;
  readonly contentHeight: number;
}

/** Layout widths to try for fitting: from `from` up to a single row, each 20% wider than the last. */
export function trialWidths(from: number, singleRow: number): number[] {
  const widths = [Math.round(from)];
  for (let width = from * 1.2; width < singleRow; width *= 1.2) widths.push(Math.round(width));
  if (singleRow > from) widths.push(Math.round(singleRow));
  return widths;
}

/** The trial that fits a `boxWidth` × `boxHeight` area at the largest scale, capped at `maxScale`. */
export function bestFit(
  trials: readonly LayoutTrial[],
  boxWidth: number,
  boxHeight: number,
  maxScale = MAX_FIT_SCALE,
): { readonly trial: LayoutTrial; readonly scale: number } {
  let best: { trial: LayoutTrial; scale: number } | null = null;
  for (const trial of trials) {
    const scale = Math.min(boxWidth / Math.max(trial.width, trial.contentWidth), boxHeight / trial.contentHeight, maxScale);
    if (!best || scale > best.scale + 0.001) best = { trial, scale };
  }
  if (!best) throw new Error('bestFit needs at least one trial');
  return best;
}

export interface PageSlice {
  /** Top and bottom of the page's content, in layout pixels. */
  readonly start: number;
  readonly end: number;
}

/**
 * Splits content `height` tall into pages `pageHeight` tall. Each page ends at the latest break (a row
 * or section top) that fits; a piece taller than a page is cut where the page ends.
 */
export function paginate(height: number, pageHeight: number, breaks: readonly number[]): PageSlice[] {
  const pages: PageSlice[] = [];
  let start = 0;
  while (height - start > 0.5) {
    const limit = start + pageHeight;
    if (limit >= height - 0.5) {
      pages.push({ start, end: height });
      break;
    }
    const fitting = breaks.filter((b) => b > start + 1 && b <= limit);
    const end = fitting.length > 0 ? Math.max(...fitting) : limit;
    pages.push({ start, end });
    start = end;
  }
  return pages;
}
