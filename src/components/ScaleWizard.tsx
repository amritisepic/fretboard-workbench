import { useScaleWizard } from '../state/scaleWizard';
import { useWorkbench, type HarmonyNotation, type LabelMode, type Orientation } from '../state/workbench';
import { TOP_VOICES, maxTopVoice, scaleNotes, scaleRefName, type TopVoice } from '../theory';
import { ToolbarSwitch } from './CanvasToolbar';
import { ScaleSelects } from './ScaleSelects';
import { ChordTable, ChromaticGrid, ScaleBoard, ScaleHeading, TOP_VOICE_NAMES } from './ScaleSheet';
import { Segmented, type SegmentedOption } from './Segmented';

const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Notes' },
  { value: 'degrees', label: 'Degrees' },
];

const ORIENTATION_OPTIONS: readonly SegmentedOption<Orientation>[] = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
];

const NOTATION_OPTIONS: readonly SegmentedOption<HarmonyNotation>[] = [
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
];

const THUMB_RADIUS = 8;

/**
 * Scale wizard: pick a tonic and scale, see its notes against the chromatic octave with their degrees,
 * optionally on the fretboard (the workbench's tuning, frets and capo), and the chords on each degree.
 */
export function ScaleWizard() {
  const wizard = useScaleWizard();
  const settings = useWorkbench((s) => s.settings);
  const { scale } = wizard;
  const highest = maxTopVoice(scaleNotes(scale).length);
  const topVoice = wizard.topVoice > highest ? highest : wizard.topVoice;

  return (
    <main className="workspace wizard" aria-label="Scale wizard">
      <div className="canvas-toolbar">
        <div className="toolbar-group" role="group" aria-label={`Scale: ${scaleRefName(scale)}`} data-tour="wizard-scale">
          <span className="toolbar-label">Scale</span>
          <ScaleSelects scale={scale} label="Scale" onChange={wizard.setScale} />
        </div>
      </div>

      <div className="wizard-body">
        <section className="wizard-section" aria-label="Notes and degrees" data-tour="wizard-notes">
          <ScaleHeading scale={scale} />
          <ChromaticGrid scale={scale} />
        </section>

        <section className="wizard-section" aria-label="Fretboard" data-tour="wizard-board">
          <div className={wizard.showScale ? 'wizard-section-head' : 'wizard-section-head is-alone'}>
            <div className="wizard-section-controls">
              <ToolbarSwitch id="show-scale-label" label="Show scale" checked={wizard.showScale} onChange={wizard.setShowScale} />
              {wizard.showScale && (
                <>
                  <Segmented label="Fretboard labels" options={LABEL_OPTIONS} value={wizard.labelMode} onChange={wizard.setLabelMode} />
                  <Segmented
                    label="Fretboard orientation"
                    options={ORIENTATION_OPTIONS}
                    value={wizard.orientation}
                    onChange={wizard.setOrientation}
                  />
                </>
              )}
            </div>
          </div>
          {wizard.showScale && (
            <ScaleBoard scale={scale} settings={settings} labelMode={wizard.labelMode} orientation={wizard.orientation} />
          )}
        </section>

        <section className="wizard-section" aria-label="Chords in the scale" data-tour="wizard-chords">
          <div className="wizard-section-head">
            <div className="wizard-section-controls">
              <span className="toolbar-label">Chords</span>
              <Segmented label="Numeral notation" options={NOTATION_OPTIONS} value={wizard.notation} onChange={wizard.setNotation} />
            </div>
            <TopVoiceSlider value={topVoice} highest={highest} onChange={wizard.setTopVoice} />
          </div>
          <ChordTable scale={scale} topVoice={topVoice} notation={wizard.notation} />
        </section>
      </div>
    </main>
  );
}

/** 5, 7, 9, 11, 13: how far each chord stacks. Stops past what the scale can stack are disabled. */
function TopVoiceSlider({
  value,
  highest,
  onChange,
}: {
  readonly value: TopVoice;
  readonly highest: TopVoice;
  readonly onChange: (voice: TopVoice) => void;
}) {
  const last = TOP_VOICES.length - 1;
  const highestIndex = TOP_VOICES.indexOf(highest);
  const choose = (index: number) => onChange(TOP_VOICES[Math.min(index, highestIndex)]);

  return (
    <div className="mode-slider top-voice" data-tour="wizard-top-voice">
      <div className="mode-head">
        <span className="mode-label" id="top-voice-label">
          Top voice
        </span>
        <span className="mode-name">{TOP_VOICE_NAMES[value]}</span>
      </div>
      <input
        className="mode-range"
        type="range"
        min={0}
        max={last}
        step={1}
        value={TOP_VOICES.indexOf(value)}
        aria-labelledby="top-voice-label"
        aria-valuetext={TOP_VOICE_NAMES[value]}
        onChange={(event) => choose(Number(event.target.value))}
      />
      <div className="mode-stops" aria-hidden="true">
        {TOP_VOICES.map((voice, i) => (
          <button
            key={voice}
            type="button"
            tabIndex={-1}
            disabled={i > highestIndex}
            className={voice === value ? 'mode-stop is-current' : 'mode-stop'}
            style={{ left: `calc(${THUMB_RADIUS}px + (100% - ${2 * THUMB_RADIUS}px) * ${i / last})` }}
            onClick={() => choose(i)}
          >
            {voice}
          </button>
        ))}
      </div>
    </div>
  );
}
