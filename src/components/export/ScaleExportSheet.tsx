import type { Ref } from 'react';
import { useScaleWizard } from '../../state/scaleWizard';
import { useWorkbench, type HarmonyNotation, type LabelMode, type Orientation } from '../../state/workbench';
import type { TopVoice } from '../../theory';
import { ChordTable, ChromaticGrid, ScaleBoard, ScaleHeading, TOP_VOICE_NAMES } from '../ScaleSheet';

/** What a scale wizard export shows. */
export interface ScaleFeatures {
  readonly title: boolean;
  readonly notes: boolean;
  readonly degrees: boolean;
  readonly fretboard: boolean;
  readonly chords: boolean;
}

export const ALL_SCALE_FEATURES: ScaleFeatures = { title: true, notes: true, degrees: true, fretboard: true, chords: true };

/** The scale wizard's sections, stacked for the page. Pages break between sections where they can. */
export function ScaleExportSheet({
  features,
  labelMode,
  orientation,
  notation,
  topVoice,
  width,
  sheetRef,
}: {
  readonly features: ScaleFeatures;
  readonly labelMode: LabelMode;
  readonly orientation: Orientation;
  readonly notation: HarmonyNotation;
  readonly topVoice: TopVoice;
  readonly width: number;
  readonly sheetRef: Ref<HTMLDivElement>;
}) {
  const scale = useScaleWizard((s) => s.scale);
  const settings = useWorkbench((s) => s.settings);

  return (
    <div className="export-sheet export-scale" style={{ width }} ref={sheetRef}>
      {features.title && (
        <section className="export-section" data-export-break="">
          <ScaleHeading scale={scale} />
        </section>
      )}
      {(features.notes || features.degrees) && (
        <section className="export-section" data-export-break="">
          <ChromaticGrid scale={scale} showNotes={features.notes} showDegrees={features.degrees} />
        </section>
      )}
      {features.fretboard && (
        <section className="export-section" data-export-break="">
          <ScaleBoard scale={scale} settings={settings} labelMode={labelMode} orientation={orientation} />
        </section>
      )}
      {features.chords && (
        <section className="export-section" data-export-break="">
          <h2 className="export-section-title">Chords: {TOP_VOICE_NAMES[topVoice]}</h2>
          <ChordTable scale={scale} topVoice={topVoice} notation={notation} />
        </section>
      )}
    </div>
  );
}
