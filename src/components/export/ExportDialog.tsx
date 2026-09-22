import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Screen } from '../../state/preferences';
import { exportFileName } from '../../state/libraryTree';
import { useScaleWizard } from '../../state/scaleWizard';
import { useWorkbench, type HarmonyNotation, type LabelMode, type Orientation } from '../../state/workbench';
import { TOP_VOICES, maxTopVoice, scaleNotes, scaleRefName, type TopVoice } from '../../theory';
import { buildCanvasModel } from '../canvasModel';
import { downloadBlob } from '../download';
import { useModalLayer } from '../focusLayer';
import { TOP_VOICE_NAMES } from '../ScaleSheet';
import { Segmented, type SegmentedOption } from '../Segmented';
import {
  MAX_FIT_SCALE,
  MIN_LEGIBLE_SCALE,
  MIN_PRINT_POINTS,
  PAPER_SIZES,
  PX_PER_POINT,
  bestFit,
  isLegible,
  pageGeometry,
  paginate,
  trialWidths,
  type FitMode,
  type LayoutTrial,
  type PageGeometry,
  type PageOrientation,
  type PageSetup,
  type Paper,
} from './exportLayout';
import { buildPdf } from './pdfWriter';
import { canvasBlob, snapshot } from './rasterize';
import { ALL_SCALE_FEATURES, ScaleExportSheet, type ScaleFeatures } from './ScaleExportSheet';
import { ALL_WORKBENCH_FEATURES, WorkbenchSheet, type WorkbenchFeatures } from './WorkbenchSheet';

type Format = 'pdf' | 'png';
type PixelRatio = 1 | 2 | 3;
type Dpi = 150 | 300;

interface OutputOptions {
  readonly format: Format;
  readonly page: PageSetup;
  /** 0 lets the layout choose. */
  readonly boxesPerRow: number;
  readonly pixelRatio: PixelRatio;
  readonly dpi: Dpi;
}

/** The scale wizard is laid out at this width before scaling, about the width it has on screen. */
const SCALE_SHEET_WIDTH = 760;
/** An image export wraps boxes at this width unless a row count is chosen. */
const IMAGE_WIDTH = 1400;
const PREVIEW_DPI = 72;
const PREVIEW_DELAY_MS = 250;
/** Browsers refuse canvases much larger than this on a side. */
const MAX_CANVAS_SIDE = 16000;
const MAX_CANVAS_AREA = 120_000_000;

// Choices are remembered while the app stays open.
let rememberedOutput: OutputOptions = {
  format: 'pdf',
  page: { paper: 'a4', orientation: 'portrait', marginMm: 12, fit: 'width', scalePercent: 75 },
  boxesPerRow: 0,
  pixelRatio: 2,
  dpi: 300,
};
let rememberedWorkbench: WorkbenchFeatures = ALL_WORKBENCH_FEATURES;
let rememberedScale: ScaleFeatures = ALL_SCALE_FEATURES;

const FORMAT_OPTIONS: readonly SegmentedOption<Format>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'Image (PNG)' },
];
const ORIENTATION_OPTIONS: readonly SegmentedOption<Orientation>[] = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
];
const PAGE_ORIENTATION_OPTIONS: readonly SegmentedOption<PageOrientation>[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];
const FIT_OPTIONS: readonly SegmentedOption<FitMode>[] = [
  { value: 'page', label: 'One page' },
  { value: 'width', label: 'Page width' },
  { value: 'custom', label: 'Scale' },
];
const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Notes' },
  { value: 'degrees', label: 'Degrees' },
];
const NOTATION_OPTIONS: readonly SegmentedOption<HarmonyNotation>[] = [
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
];
const RATIO_OPTIONS: readonly SegmentedOption<'1' | '2' | '3'>[] = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '3', label: '3×' },
];
const DPI_OPTIONS: readonly SegmentedOption<'150' | '300'>[] = [
  { value: '150', label: '150 dpi' },
  { value: '300', label: '300 dpi' },
];
const MARGINS = [
  { value: 6, label: 'Narrow (6 mm)' },
  { value: 12, label: 'Normal (12 mm)' },
  { value: 20, label: 'Wide (20 mm)' },
];
const WORKBENCH_FEATURE_LABELS: readonly (readonly [keyof WorkbenchFeatures, string])[] = [
  ['title', 'Title'],
  ['keyBar', 'Key bar'],
  ['scaleBar', 'Scale bar'],
  ['numerals', 'Roman numerals'],
  ['chordNames', 'Chord names'],
  ['analysis', 'Harmonic analysis'],
  ['commonTones', 'Common tones'],
  ['voiceLeading', 'Voice leading'],
];
const SCALE_FEATURE_LABELS: readonly (readonly [keyof ScaleFeatures, string])[] = [
  ['title', 'Scale name'],
  ['notes', 'Chromatic notes'],
  ['degrees', 'Scale degrees'],
  ['fretboard', 'Fretboard'],
  ['chords', 'Chord table'],
];

interface Layout {
  /** CSS width the sheet is laid out at. */
  readonly width: number;
  /** CSS pixels on the page per CSS pixel of the sheet (PDF only). */
  readonly scale: number;
  /**
   * Whether pages break between rows rather than everything being squeezed onto one. True for every
   * fit but "One page", and true for "One page" as well once one page would mean illegible text.
   */
  readonly paginated: boolean;
}

interface RenderedPage {
  readonly canvas: HTMLCanvasElement;
  /** Placement on the page in points, from the top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly drawWidth: number;
  readonly drawHeight: number;
}

const topWithin = (element: Element, container: Element) =>
  element.getBoundingClientRect().top - container.getBoundingClientRect().top;

/** Tops of the rows and sections a page may break before, a little above each so rings aren't cut. */
function breakPoints(sheet: HTMLElement): number[] {
  const elements = sheet.querySelectorAll('[data-export-break], .export-canvas > .box-group');
  return [...new Set(Array.from(elements, (el) => Math.max(0, Math.round(topWithin(el, sheet) - 10))))].sort((a, b) => a - b);
}

/** Widths of the widest run of `count` consecutive box groups, measured on one unwrapped row. */
function rowWidth(sheet: HTMLElement, count: number): number {
  const canvas = sheet.querySelector<HTMLElement>('.export-canvas');
  if (!canvas) return sheet.scrollWidth;
  const groups = Array.from(canvas.querySelectorAll<HTMLElement>(':scope > .box-group'));
  if (groups.length === 0) return sheet.scrollWidth;
  const n = Math.min(count, groups.length);
  let widest = 0;
  for (let i = 0; i + n <= groups.length; i++) {
    const first = groups[i].getBoundingClientRect();
    const last = groups[i + n - 1].getBoundingClientRect();
    widest = Math.max(widest, last.right - first.left);
  }
  return Math.ceil(widest) + 1;
}

/** Lays the sheet out at trial widths and returns the width and scale the options call for. */
function planLayout(sheet: HTMLElement, workbench: boolean, output: OutputOptions, geometry: PageGeometry): Layout {
  const canvas = sheet.querySelector<HTMLElement>('.export-canvas');
  const measureAt = (width: number): LayoutTrial => {
    sheet.style.width = `${width}px`;
    return { width, contentWidth: sheet.scrollWidth, contentHeight: sheet.scrollHeight };
  };

  let singleRow = SCALE_SHEET_WIDTH;
  let perRow: number | null = null;
  let widestGroup = SCALE_SHEET_WIDTH;
  if (workbench && canvas) {
    canvas.style.flexWrap = 'nowrap';
    sheet.style.width = 'max-content';
    singleRow = Math.ceil(sheet.scrollWidth) + 1;
    widestGroup = rowWidth(sheet, 1);
    if (output.boxesPerRow > 0) perRow = rowWidth(sheet, output.boxesPerRow);
    canvas.style.flexWrap = '';
  }

  const { contentWidthPx: boxWidth, contentHeightPx: boxHeight } = geometry;

  /**
   * Rows filling the page width at the legibility floor, breaking pages between them. This is both
   * the "Page width" fit and where "One page" lands when one page cannot be read: the content is
   * laid out wide enough that shrinking it to the page leaves the smallest text at the floor.
   *
   * A single chord group wider than the page can still come out below the floor. Nothing can be
   * done about that from here — a box is not divisible — so the preview says so instead.
   */
  const fillPageWidth = (): Layout => {
    const width = perRow ?? (workbench ? Math.min(singleRow, Math.max(widestGroup, boxWidth / MIN_LEGIBLE_SCALE)) : SCALE_SHEET_WIDTH);
    const trial = measureAt(width);
    return { width, scale: Math.min(boxWidth / Math.max(trial.width, trial.contentWidth), MAX_FIT_SCALE), paginated: true };
  };

  let layout: Layout;
  if (output.format === 'png') {
    layout = {
      width: perRow ?? (workbench ? Math.min(singleRow, Math.max(IMAGE_WIDTH, widestGroup)) : SCALE_SHEET_WIDTH),
      scale: 1,
      paginated: false,
    };
  } else if (output.page.fit === 'page') {
    const widths = perRow !== null ? [perRow] : workbench ? trialWidths(widestGroup, singleRow) : [SCALE_SHEET_WIDTH];
    const { trial, scale } = bestFit(widths.map(measureAt), boxWidth, boxHeight);
    layout = isLegible(scale) ? { width: trial.width, scale, paginated: false } : fillPageWidth();
  } else if (output.page.fit === 'width') {
    layout = fillPageWidth();
  } else {
    // A scale the user chose is theirs to keep, whatever it prints at; the hint under the slider is
    // where the floor is named rather than enforced.
    const scale = output.page.scalePercent / 100;
    const available = boxWidth / scale;
    const width = workbench ? Math.max(widestGroup, perRow !== null ? Math.min(perRow, available) : available) : SCALE_SHEET_WIDTH;
    layout = { width, scale, paginated: true };
  }
  sheet.style.width = `${layout.width}px`;
  return layout;
}

/** Keeps a canvas inside what browsers allow, shrinking both sides together. */
function canvasSize(width: number, height: number): { width: number; height: number } {
  const shrink = Math.min(1, MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height, Math.sqrt(MAX_CANVAS_AREA / (width * height)));
  return { width: Math.max(1, Math.round(width * shrink)), height: Math.max(1, Math.round(height * shrink)) };
}

async function renderPdfPages(sheet: HTMLElement, layout: Layout, geometry: PageGeometry, dpi: number) {
  const copy = await snapshot(sheet);
  const height = sheet.scrollHeight;
  const contentWidth = Math.max(layout.width, sheet.scrollWidth);
  const { scale } = layout;
  const slices = layout.paginated
    ? paginate(height, geometry.contentHeightPx / scale, breakPoints(sheet))
    : [{ start: 0, end: height }];
  const regionWidth = Math.min(contentWidth, geometry.contentWidthPx / scale);
  const pixelsPerCss = (scale * dpi) / 96;
  const pages: RenderedPage[] = [];
  for (const slice of slices) {
    const regionHeight = slice.end - slice.start;
    const size = canvasSize(regionWidth * pixelsPerCss, regionHeight * pixelsPerCss);
    const canvas = await copy.draw({ x: 0, y: slice.start, width: regionWidth, height: regionHeight }, size.width, size.height);
    const drawWidth = (regionWidth * scale) / PX_PER_POINT;
    const drawHeight = (regionHeight * scale) / PX_PER_POINT;
    const printableWidth = geometry.width - 2 * geometry.margin;
    pages.push({ canvas, x: geometry.margin + (printableWidth - drawWidth) / 2, y: geometry.margin, drawWidth, drawHeight });
  }
  return pages;
}

async function renderImage(sheet: HTMLElement, layout: Layout, ratio: number) {
  const width = Math.max(layout.width, sheet.scrollWidth);
  const height = sheet.scrollHeight;
  const size = canvasSize(width * ratio, height * ratio);
  return (await snapshot(sheet)).draw({ x: 0, y: 0, width, height }, size.width, size.height);
}

/** A page as the preview shows it: white paper with the content placed inside the margins. */
function previewPage(geometry: PageGeometry, page: RenderedPage): string {
  const k = PREVIEW_DPI / 72;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geometry.width * k);
  canvas.height = Math.round(geometry.height * k);
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(page.canvas, page.x * k, page.y * k, page.drawWidth * k, page.drawHeight * k);
  return canvas.toDataURL('image/jpeg', 0.85);
}

interface Preview {
  readonly images: readonly string[];
  readonly summary: string;
  readonly landscape: boolean;
}

interface Status {
  readonly tone: 'info' | 'error';
  readonly text: string;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'The export failed.');

/**
 * Export as PDF or PNG. On the workbench: which boxes, which parts of the canvas, the neck direction.
 * On the scale wizard: which sections and how they read. A PDF fits one page, the page width (breaking
 * pages between rows) or a chosen scale; an image is drawn at 1–3 times screen size. The preview is
 * drawn the same way as the file.
 */
export function ExportDialog({ screen, onClose }: { readonly screen: Screen; readonly onClose: () => void }) {
  const workbench = screen === 'workbench';
  const boxes = useWorkbench((s) => s.boxes);
  const settings = useWorkbench((s) => s.settings);
  const globalKey = useWorkbench((s) => s.key);
  const presetName = useWorkbench((s) => s.document.name);
  const storeOrientation = useWorkbench((s) => s.orientation);
  const wizard = useScaleWizard();

  const [output, setOutputState] = useState(rememberedOutput);
  const [workbenchFeatures, setWorkbenchFeaturesState] = useState(rememberedWorkbench);
  const [scaleFeatures, setScaleFeaturesState] = useState(rememberedScale);
  const [boxIds, setBoxIds] = useState<ReadonlySet<string>>(() => new Set(boxes.map((b) => b.id)));
  const [orientation, setOrientation] = useState<Orientation>(workbench ? storeOrientation : wizard.orientation);
  const [labelMode, setLabelMode] = useState<LabelMode>(wizard.labelMode);
  const [notation, setNotation] = useState<HarmonyNotation>(wizard.notation);
  const highestVoice = maxTopVoice(scaleNotes(wizard.scale).length);
  const [topVoice, setTopVoice] = useState<TopVoice>(wizard.topVoice > highestVoice ? highestVoice : wizard.topVoice);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  // Closed on every open: the dialog's job is one screen with a format, a picture of the result and
  // a Download button, and remembering that someone once opened the options would put the wall of
  // controls back in front of everyone who did.
  const [showMore, setShowMore] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // The dialog blocks the app until it is answered or dismissed, so it is modal in earnest: the page
  // behind goes inert and Tab stays inside. Focus opens on the dialog itself rather than on a
  // control, so its name is read out before the dozen or so decisions it offers.
  const { ref: dialogRef, onKeyDown } = useModalLayer<HTMLDivElement>({ onClose });
  // A literal id is a claim on the whole document; these are the dialog's to hand out.
  const ids = useId();

  const setOutput = (patch: Partial<OutputOptions>) =>
    setOutputState((current) => (rememberedOutput = { ...current, ...patch }));
  const setPage = (patch: Partial<PageSetup>) =>
    setOutputState((current) => (rememberedOutput = { ...current, page: { ...current.page, ...patch } }));
  const setWorkbenchFeature = (name: keyof WorkbenchFeatures, on: boolean) =>
    setWorkbenchFeaturesState((current) => (rememberedWorkbench = { ...current, [name]: on }));
  const setScaleFeature = (name: keyof ScaleFeatures, on: boolean) =>
    setScaleFeaturesState((current) => (rememberedScale = { ...current, [name]: on }));

  const titles = useMemo(
    () => (workbench ? buildCanvasModel(boxes, settings, globalKey).entries.map((e) => ({ id: e.box.id, title: e.view.title || 'No notes' })) : []),
    [workbench, boxes, settings, globalKey],
  );
  const geometry = pageGeometry(output.page);
  const chosenCount = boxes.filter((b) => boxIds.has(b.id)).length;
  const nothing = workbench ? chosenCount === 0 : !Object.values(scaleFeatures).some(Boolean);
  const title = workbench ? presetName : scaleRefName(wizard.scale);
  const optionsKey = JSON.stringify({ output, workbenchFeatures, scaleFeatures, ids: [...boxIds], orientation, labelMode, notation, topVoice });

  // Lay the sheet out whenever an option changes what it contains or how it fits.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || nothing) return;
    const next = planLayout(sheet, workbench, output, geometry);
    setLayout((current) =>
      current && current.width === next.width && current.scale === next.scale && current.paginated === next.paginated ? current : next,
    );
    // The page geometry follows the output options, which optionsKey already covers.
  }, [optionsKey, boxes, settings, globalKey, wizard.scale, nothing, workbench]);

  // Redraw the preview shortly after the layout settles.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !layout || nothing) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (output.format === 'pdf') {
            const pages = await renderPdfPages(sheet, layout, geometry, PREVIEW_DPI);
            if (cancelled) return;
            setPreview({
              images: pages.map((page) => previewPage(geometry, page)),
              summary: `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · ${PAPER_SIZES[output.page.paper].label} ${output.page.orientation} · ${Math.round(layout.scale * 100)}%${
                isLegible(layout.scale) ? '' : ` · smallest text under ${MIN_PRINT_POINTS} pt`
              }`,
              landscape: output.page.orientation === 'landscape',
            });
          } else {
            const canvas = await renderImage(sheet, layout, 1);
            if (cancelled) return;
            const width = Math.round(canvas.width * output.pixelRatio);
            const height = Math.round(canvas.height * output.pixelRatio);
            const size = canvasSize(width, height);
            setPreview({ images: [canvas.toDataURL('image/png')], summary: `${size.width} × ${size.height} pixels`, landscape: true });
          }
          setStatus((current) => (current?.tone === 'error' ? null : current));
        } catch (error) {
          if (!cancelled) setStatus({ tone: 'error', text: errorText(error) });
        }
      })();
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [layout, optionsKey, boxes, settings, globalKey, wizard.scale, nothing]);

  const download = async () => {
    const sheet = sheetRef.current;
    if (!sheet || !layout || busy) return;
    setBusy(true);
    setStatus({ tone: 'info', text: 'Preparing the file…' });
    try {
      const base = exportFileName(title).replace(/\.json$/, '');
      if (output.format === 'pdf') {
        const pages = await renderPdfPages(sheet, layout, geometry, output.dpi);
        const pdfPages = [];
        for (const page of pages) {
          const blob = await canvasBlob(page.canvas, 'image/jpeg', 0.92);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          pdfPages.push({ ...page, width: geometry.width, height: geometry.height, image: { bytes, width: page.canvas.width, height: page.canvas.height } });
        }
        const fileName = `${base}.pdf`;
        downloadBlob(fileName, new Blob([buildPdf(pdfPages, title)], { type: 'application/pdf' }));
        setStatus({ tone: 'info', text: `Saved ${fileName}.` });
      } else {
        const canvas = await renderImage(sheet, layout, output.pixelRatio);
        const fileName = `${base}.png`;
        downloadBlob(fileName, await canvasBlob(canvas, 'image/png'));
        setStatus({ tone: 'info', text: `Saved ${fileName}.` });
      }
    } catch (error) {
      setStatus({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const toggleBox = (id: string, on: boolean) =>
    setBoxIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}title`}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <header className="export-dialog-head">
          <h2 id={`${ids}title`}>Export {workbench ? 'preset' : 'scale'}</h2>
          <button type="button" className="box-remove export-close" aria-label="Close export" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </header>

        <div className="export-dialog-body">
          <div className="export-options">
            <div className="export-group">
              <span className="field-label">Format</span>
              <Segmented label="Format" options={FORMAT_OPTIONS} value={output.format} onChange={(format) => setOutput({ format })} />
            </div>

            <div className="export-group">
              {/* Everything past the format is mounted only once it is asked for. Rendering it
                  hidden would leave every control in the tab order and in the accessibility tree,
                  which is the same fourteen decisions wearing a different coat. */}
              <button
                type="button"
                className="button export-more"
                aria-expanded={showMore}
                aria-controls={`${ids}more`}
                onClick={() => setShowMore((open) => !open)}
              >
                {showMore ? 'Fewer options' : 'More options'}
              </button>
            </div>

            {showMore && (
              <div className="export-advanced" id={`${ids}more`}>
              {workbench && (
                // The label is what names the checkboxes, and a screen reader only knows that if the
                // group says so; without it a dozen chord names are read out belonging to nothing.
                <div className="export-group" role="group" aria-labelledby={`${ids}chords`}>
                  <div className="export-row">
                    <span className="field-label" id={`${ids}chords`}>
                      Chords ({chosenCount} of {boxes.length})
                    </span>
                    <span className="export-links">
                      <button type="button" className="link-button" onClick={() => setBoxIds(new Set(boxes.map((b) => b.id)))}>
                        All
                      </button>
                      <button type="button" className="link-button" onClick={() => setBoxIds(new Set())}>
                        None
                      </button>
                    </span>
                  </div>
                  <div className="export-boxes">
                    {titles.map((entry, i) => (
                      <label key={entry.id} className="export-check" title={entry.title}>
                        <input type="checkbox" checked={boxIds.has(entry.id)} onChange={(event) => toggleBox(entry.id, event.target.checked)} />
                        <span>
                          <span className="export-index">{i + 1}</span> {entry.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="export-group" role="group" aria-labelledby={`${ids}show`}>
                <span className="field-label" id={`${ids}show`}>
                  Show
                </span>
                <div className="export-features">
                  {workbench
                    ? WORKBENCH_FEATURE_LABELS.map(([name, label]) => (
                        <label key={name} className="export-check">
                          <input type="checkbox" checked={workbenchFeatures[name]} onChange={(event) => setWorkbenchFeature(name, event.target.checked)} />
                          <span>{label}</span>
                        </label>
                      ))
                    : SCALE_FEATURE_LABELS.map(([name, label]) => (
                        <label key={name} className="export-check">
                          <input type="checkbox" checked={scaleFeatures[name]} onChange={(event) => setScaleFeature(name, event.target.checked)} />
                          <span>{label}</span>
                        </label>
                      ))}
                </div>
              </div>

              {(workbench || scaleFeatures.fretboard) && (
                <div className="export-group">
                  <span className="field-label">Fretboard</span>
                  <Segmented label="Neck orientation" options={ORIENTATION_OPTIONS} value={orientation} onChange={setOrientation} />
                  {!workbench && <Segmented label="Fretboard labels" options={LABEL_OPTIONS} value={labelMode} onChange={setLabelMode} />}
                </div>
              )}

              {!workbench && scaleFeatures.chords && (
                <div className="export-group">
                  <span className="field-label">Chord table</span>
                  <Segmented label="Numeral notation" options={NOTATION_OPTIONS} value={notation} onChange={setNotation} />
                  <select
                    className="select full"
                    aria-label="Top voice"
                    value={topVoice}
                    onChange={(event) => setTopVoice(TOP_VOICES.find((v) => v === Number(event.target.value)) ?? topVoice)}
                  >
                    {TOP_VOICES.filter((voice) => voice <= highestVoice).map((voice) => (
                      <option key={voice} value={voice}>
                        Up to the {voice}th: {TOP_VOICE_NAMES[voice]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {output.format === 'pdf' ? (
                <>
                  <div className="export-group">
                    <span className="field-label">Page</span>
                    <div className="export-pair">
                      <select className="select" aria-label="Paper size" value={output.page.paper} onChange={(event) => setPage({ paper: paperOf(event.target.value) })}>
                        {Object.entries(PAPER_SIZES).map(([id, size]) => (
                          <option key={id} value={id}>
                            {size.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        aria-label="Margins"
                        value={output.page.marginMm}
                        onChange={(event) => setPage({ marginMm: Number(event.target.value) })}
                      >
                        {MARGINS.map((margin) => (
                          <option key={margin.value} value={margin.value}>
                            {margin.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Segmented
                      label="Page orientation"
                      options={PAGE_ORIENTATION_OPTIONS}
                      value={output.page.orientation}
                      onChange={(orientationValue) => setPage({ orientation: orientationValue })}
                    />
                  </div>
                  <div className="export-group">
                    <span className="field-label">Scaling</span>
                    <Segmented label="Fit" options={FIT_OPTIONS} value={output.page.fit} onChange={(fit) => setPage({ fit })} />
                    {output.page.fit === 'custom' && (
                      <div className="export-row">
                        <input
                          className="mode-range"
                          type="range"
                          min={25}
                          max={200}
                          step={5}
                          value={output.page.scalePercent}
                          aria-label="Scale"
                          onChange={(event) => setPage({ scalePercent: Number(event.target.value) })}
                        />
                        <output className="export-value">{output.page.scalePercent}%</output>
                      </div>
                    )}
                    <p className="hint">
                      {output.page.fit === 'page'
                        ? `Everything on one page, as large as it fits — unless that would print text under ${MIN_PRINT_POINTS} pt, when the page count grows instead.`
                        : output.page.fit === 'width'
                          ? `Rows fill the page width at the largest size that keeps every label at ${MIN_PRINT_POINTS} pt or more. Pages break between rows.`
                          : `A fixed size; 100% is screen size. Below ${Math.round(MIN_LEGIBLE_SCALE * 100)}% the smallest labels print under ${MIN_PRINT_POINTS} pt. Pages break between rows.`}
                    </p>
                  </div>
                  <div className="export-group">
                    <span className="field-label">Quality</span>
                    <Segmented
                      label="Resolution"
                      options={DPI_OPTIONS}
                      value={output.dpi === 150 ? '150' : '300'}
                      onChange={(dpi) => setOutput({ dpi: dpi === '150' ? 150 : 300 })}
                    />
                  </div>
                </>
              ) : (
                <div className="export-group">
                  <span className="field-label">Size</span>
                  <Segmented
                    label="Pixel size"
                    options={RATIO_OPTIONS}
                    value={output.pixelRatio === 1 ? '1' : output.pixelRatio === 2 ? '2' : '3'}
                    onChange={(ratio) => setOutput({ pixelRatio: ratio === '1' ? 1 : ratio === '2' ? 2 : 3 })}
                  />
                </div>
              )}

              {workbench && (
                <div className="export-group">
                  <label className="field-label" htmlFor="export-per-row">
                    Boxes per row
                  </label>
                  <select
                    id="export-per-row"
                    className="select full"
                    value={output.boxesPerRow}
                    onChange={(event) => setOutput({ boxesPerRow: Number(event.target.value) })}
                  >
                    <option value={0}>Automatic</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              </div>
            )}
          </div>

          <div className="export-preview" aria-label="Preview">
            {nothing ? (
              <p className="export-empty">{workbench ? 'Choose at least one chord to export.' : 'Choose at least one section to export.'}</p>
            ) : preview ? (
              <>
                <p className="export-summary">{preview.summary}</p>
                <div className={preview.landscape ? 'export-pages is-wide' : 'export-pages'}>
                  {preview.images.map((src, i) => (
                    <img key={i} className={output.format === 'pdf' ? 'export-page' : 'export-page is-image'} src={src} alt={`Page ${i + 1} of the export`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="export-empty">Drawing the preview…</p>
            )}
          </div>
        </div>

        <footer className="export-dialog-foot">
          {status && <p className={status.tone === 'error' ? 'export-status is-error' : 'export-status'} role="status">{status.text}</p>}
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button is-primary" disabled={nothing || !layout || busy} onClick={() => void download()}>
            {busy ? 'Preparing…' : output.format === 'pdf' ? 'Download PDF' : 'Download PNG'}
          </button>
        </footer>
      </div>

      <div className="export-stage" aria-hidden="true">
        {!nothing &&
          (workbench ? (
            <WorkbenchSheet
              boxIds={boxIds}
              features={workbenchFeatures}
              orientation={orientation}
              width={layout?.width ?? IMAGE_WIDTH}
              sheetRef={sheetRef}
            />
          ) : (
            <ScaleExportSheet
              features={scaleFeatures}
              labelMode={labelMode}
              orientation={orientation}
              notation={notation}
              topVoice={topVoice}
              width={layout?.width ?? SCALE_SHEET_WIDTH}
              sheetRef={sheetRef}
            />
          ))}
      </div>
    </div>
  );
}

const paperOf = (value: string): Paper => (value === 'letter' || value === 'a3' ? value : 'a4');
