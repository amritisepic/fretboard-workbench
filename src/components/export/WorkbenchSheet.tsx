import { useMemo, useRef, type Ref } from 'react';
import { useWorkbench, type Orientation } from '../../state/workbench';
import { keyName } from '../../theory';
import { explainReading, functionLabel, patternsAcross, relationViews } from '../analysisModel';
import { BoxCard } from '../BoxCard';
import { buildCanvasModel } from '../canvasModel';
import { KEY_REGION_COLORS, bandShade } from '../color';
import { buildStripView } from '../stripModel';
import { useRowStarts } from '../useRowStarts';
import { VoiceLeadingStrip } from '../VoiceLeadingStrip';

/** What a workbench export shows. */
export interface WorkbenchFeatures {
  readonly title: boolean;
  readonly keyBar: boolean;
  readonly scaleBar: boolean;
  readonly numerals: boolean;
  readonly chordNames: boolean;
  /** Function tags under the numerals, and the analysis lane in the strips. */
  readonly analysis: boolean;
  readonly commonTones: boolean;
  readonly voiceLeading: boolean;
}

export const ALL_WORKBENCH_FEATURES: WorkbenchFeatures = {
  title: true,
  keyBar: true,
  scaleBar: true,
  numerals: true,
  chordNames: true,
  analysis: true,
  commonTones: true,
  voiceLeading: true,
};

const NO_REMOVE = () => {};

/**
 * The chosen boxes laid out as on the canvas in view mode, without controls. Keys, numerals and the
 * analysis come from the whole progression. A strip joins two chosen boxes that are next to each other
 * in the progression; boxes further apart get common tones and voice leading but no analysis lane.
 */
export function WorkbenchSheet({
  boxIds,
  features,
  orientation,
  width,
  sheetRef,
}: {
  readonly boxIds: ReadonlySet<string>;
  readonly features: WorkbenchFeatures;
  readonly orientation: Orientation;
  readonly width: number;
  readonly sheetRef: Ref<HTMLDivElement>;
}) {
  const boxes = useWorkbench((s) => s.boxes);
  const settings = useWorkbench((s) => s.settings);
  const globalKey = useWorkbench((s) => s.key);
  const strips = useWorkbench((s) => s.strips);
  const name = useWorkbench((s) => s.document.name);
  const model = useMemo(() => buildCanvasModel(boxes, settings, globalKey), [boxes, settings, globalKey]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rowStarts = useRowStarts(canvasRef);

  const entries = model.entries.filter((entry) => boxIds.has(entry.box.id));
  const voices = features.commonTones || features.voiceLeading;
  const stripSettings = { ...strips, commonTones: features.commonTones, voiceLeading: features.voiceLeading };
  const sameRegion = (a: (typeof entries)[number] | undefined, b: (typeof entries)[number] | undefined) =>
    a !== undefined && b !== undefined && a.colorIndex === b.colorIndex && a.keyName === b.keyName;

  return (
    <div
      className={features.chordNames ? 'export-sheet' : 'export-sheet no-chord-names'}
      style={{ width }}
      ref={sheetRef}
    >
      {features.title && (
        <header className="export-header" data-export-break="">
          <h1 className="export-title">{name}</h1>
          <p className="export-subtitle">
            {keyName(globalKey)} · {entries.length} {entries.length === 1 ? 'chord' : 'chords'}
          </p>
        </header>
      )}
      <div className="canvas export-canvas" ref={canvasRef}>
        {entries.map((entry, i) => {
          const previous = entries[i - 1];
          const index = model.entries.indexOf(entry);
          const adjacent = previous !== undefined && model.entries.indexOf(previous) === index - 1;
          const rowStart = i === 0 || rowStarts[i] === true;
          const regionStart = !sameRegion(previous, entry);
          const { analysis, keyChoices } = entry;
          const next = model.entries[index + 1];
          const tag =
            features.analysis && analysis.facts
              ? {
                  label: functionLabel(analysis, analysis.reading, strips.notation),
                  explanation: explainReading(analysis, analysis.reading, {
                    title: entry.view.title,
                    previousTitle: model.entries[index - 1]?.view.title || null,
                    nextTitle: next?.view.title || null,
                    nextRoot: next?.analysis.facts?.root ?? null,
                    notation: strips.notation,
                  }),
                }
              : null;
          const lane =
            features.analysis && adjacent
              ? {
                  relations: relationViews(entry.relationsIn, strips.notation, keyName(analysis.reading.home.ref)),
                  patterns: patternsAcross(model.patterns, index),
                }
              : null;
          const keyText =
            keyChoices.length > 0
              ? keyChoices.map((c) => `${c.keyName}${c.chosen || analysis.pinned ? '' : '?'}`).join(' | ')
              : entry.keyName;
          // The sheet shares the canvas's bar: one bar per chord, over the card alone, naming the
          // key and adding the reference scale only when it is not the key said again. The two
          // export switches still choose independently which of the two the sheet prints.
          const showScale = features.scaleBar && entry.view.scaleName !== entry.keyName;

          return (
            <div key={entry.box.id} className="box-group">
              {previous &&
                (voices || lane ? (
                  <VoiceLeadingStrip
                    strip={buildStripView(previous, entry, stripSettings)}
                    voices={voices}
                    lane={lane}
                    wrapped={rowStart}
                  />
                ) : (
                  <div className="box-spacer" />
                ))}
              {(features.keyBar || showScale) && (
                <div className="key-band" style={{ backgroundColor: KEY_REGION_COLORS[entry.colorIndex % KEY_REGION_COLORS.length] }}>
                  {features.keyBar && (
                    <span className={regionStart || keyChoices.length > 0 ? 'key-band-label' : 'key-band-label is-continued'}>{keyText}</span>
                  )}
                  {showScale && (
                    <span className="key-band-scale" style={{ backgroundColor: bandShade(entry.box.color) }}>
                      {entry.view.scaleName}
                    </span>
                  )}
                </div>
              )}
              <div className="box-group-body">
                <div className="box-column">
                  <BoxCard
                    box={entry.box}
                    view={entry.view}
                    numeral={features.numerals ? entry.numeral : ''}
                    keyName={entry.keyName}
                    tentative={features.numerals && analysis.ambiguous && (features.analysis || keyChoices.length > 0)}
                    tag={tag}
                    selected={false}
                    viewing
                    orientation={orientation}
                    onRequestRemove={NO_REMOVE}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
