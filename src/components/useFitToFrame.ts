import { useLayoutEffect, useRef, type RefObject } from 'react';
import { MIN_LEGIBLE_SCALE } from './export/exportLayout';

/** The most view mode enlarges a short progression. */
const MAX_SCALE = 1.5;
/** How much wider each trial layout is than the one before. */
const WIDTH_STEP = 1.2;

/**
 * View mode: fits `content` inside `frame`. The boxes wrap to the width they are given, so the content
 * is laid out at a range of widths, from the frame's own up to a single row, and the width that allows
 * the largest scale wins. The content is then scaled and centred with a transform. When `enabled` is
 * false, every style set here is cleared.
 *
 * Fitting has a floor. Thirty-one chords fitted to a laptop screen used to come out at a scale that
 * put chord names at about five pixels and dot labels at three, which is a picture of a progression
 * rather than something anyone can read. Below the floor the content stays at the floor, fills the
 * frame's width, and the frame scrolls: more rows to move through, every one of them legible.
 *
 * The floor is the export's: the scale at which the smallest text on a board lands at six points,
 * which is eight CSS pixels on a screen. One number for paper and screen, because the question —
 * can the smallest label be read — is the same one.
 */
export function useFitToFrame(
  frameRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  const fit = useRef(() => {});

  fit.current = () => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    if (!enabled) {
      content.style.width = '';
      content.style.transform = '';
      delete frame.dataset.paged;
      return;
    }
    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    if (frameWidth === 0 || frameHeight === 0) return;

    content.style.transform = 'none';
    content.style.flexWrap = 'nowrap';
    content.style.width = 'max-content';
    const singleRow = content.scrollWidth;
    content.style.flexWrap = '';

    const layoutAt = (width: number) => {
      content.style.width = `${width}px`;
      const contentWidth = Math.max(width, content.scrollWidth);
      const contentHeight = content.scrollHeight;
      const scale = Math.min(frameWidth / contentWidth, frameHeight / contentHeight, MAX_SCALE);
      return { width, contentWidth, contentHeight, scale };
    };

    const widths = [frameWidth];
    for (let width = frameWidth * WIDTH_STEP; width < singleRow; width *= WIDTH_STEP) widths.push(Math.round(width));
    if (singleRow > frameWidth) widths.push(singleRow);
    const best = widths.map(layoutAt).reduce((a, b) => (b.scale > a.scale + 0.001 ? b : a));

    if (best.scale >= MIN_LEGIBLE_SCALE) {
      const layout = layoutAt(best.width);
      const x = Math.max(0, (frameWidth - layout.contentWidth * layout.scale) / 2);
      const y = Math.max(0, (frameHeight - layout.contentHeight * layout.scale) / 2);
      content.style.transform = `translate(${x}px, ${y}px) scale(${layout.scale})`;
      delete frame.dataset.paged;
      return;
    }

    // Laid out as wide as the frame is at the floor, so that once scaled down it fills the width and
    // the rows run down the frame. A single box wider than that still overflows sideways, which the
    // frame then scrolls as well rather than cropping.
    const layout = layoutAt(Math.max(frameWidth, Math.floor(frameWidth / MIN_LEGIBLE_SCALE)));
    const x = Math.max(0, (frameWidth - layout.contentWidth * MIN_LEGIBLE_SCALE) / 2);
    content.style.transform = `translate(${x}px, 0) scale(${MIN_LEGIBLE_SCALE})`;
    frame.dataset.paged = 'true';
  };

  // Content changes with every render (boxes, strips, labels), so fit after each one.
  useLayoutEffect(() => {
    fit.current();
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fit.current());
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [frameRef, contentRef]);
}
