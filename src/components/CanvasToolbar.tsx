import { useId } from 'react';
import { boxChord } from '../state/boxChords';
import { useWorkbench, type BoardView, type HarmonyNotation, type LabelMode, type Orientation } from '../state/workbench';
import { keyName } from '../theory';
import { planFoundKey } from './findKeyModel';
import { ScaleSelects } from './ScaleSelects';
import { Segmented, type SegmentedOption } from './Segmented';

const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Names' },
  { value: 'degrees', label: 'Degrees' },
];

const ORIENTATION_OPTIONS: readonly SegmentedOption<Orientation>[] = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
];

const BOARD_VIEW_OPTIONS: readonly SegmentedOption<BoardView>[] = [
  { value: 'chart', label: 'Chord chart' },
  { value: 'full', label: 'Full neck' },
];

const NOTATION_OPTIONS: readonly SegmentedOption<HarmonyNotation>[] = [
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
];

/**
 * Preset-wide controls above the boxes: the key and shifting everything (edit mode only), the neck
 * and how much of it each board draws, and what the strips between boxes show.
 */
export function CanvasToolbar() {
  const key = useWorkbench((s) => s.key);
  const setKey = useWorkbench((s) => s.setKey);
  const setKeyAndScales = useWorkbench((s) => s.setKeyAndScales);
  const transposeAll = useWorkbench((s) => s.transposeAll);
  const orientation = useWorkbench((s) => s.orientation);
  const setOrientation = useWorkbench((s) => s.setOrientation);
  const boardView = useWorkbench((s) => s.settings.boardView);
  const setBoardView = useWorkbench((s) => s.setBoardView);
  const strips = useWorkbench((s) => s.strips);
  const setStrips = useWorkbench((s) => s.setStrips);
  const viewing = useWorkbench((s) => s.viewing);
  const hasChord = useWorkbench((s) => s.boxes.some((box) => boxChord(box, s.settings).chord !== null));

  const findKeyReasonId = useId();

  const findKey = () => {
    const { boxes, settings } = useWorkbench.getState();
    const found = planFoundKey(boxes, settings);
    if (found) setKeyAndScales(found.key, found.boxes);
  };

  return (
    <div className="canvas-toolbar">
      {!viewing && (
        <>
          <div className="toolbar-group" role="group" aria-label={`Key: ${keyName(key)}`} data-tour="key">
            <span className="toolbar-label">Key</span>
            <ScaleSelects scale={key} label="Key" onChange={setKey} />
            <button
              type="button"
              className="button is-compact"
              // See the Export button in TopBar: a `disabled` button cannot be focused or hovered, so
              // the reason it is unavailable reaches nobody on a touch screen.
              aria-disabled={!hasChord}
              aria-describedby={hasChord ? undefined : findKeyReasonId}
              title={hasChord ? 'Find the key of the progression, and give each chord the scale closest to it' : undefined}
              onClick={hasChord ? findKey : undefined}
            >
              Find key
            </button>
            {!hasChord && (
              <span className="visually-hidden" id={findKeyReasonId}>
                Add chords to find their key.
              </span>
            )}
          </div>
          <div className="toolbar-group" role="group" aria-labelledby="shift-label">
            <span className="toolbar-label" id="shift-label">
              Shift
            </span>
            <div className="stepper">
              <button
                type="button"
                aria-label="Shift every chord, scale and the key down a semitone"
                title="Down a semitone"
                onClick={() => transposeAll(-1)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Shift every chord, scale and the key up a semitone"
                title="Up a semitone"
                onClick={() => transposeAll(1)}
              >
                +
              </button>
            </div>
          </div>
        </>
      )}
      <div className="toolbar-group" role="group" aria-labelledby="neck-label" data-tour="neck">
        <span className="toolbar-label" id="neck-label">
          Neck
        </span>
        <Segmented label="Neck orientation" options={ORIENTATION_OPTIONS} value={orientation} onChange={setOrientation} />
      </div>
      <div className="toolbar-group" role="group" aria-labelledby="board-label" data-tour="board">
        <span className="toolbar-label" id="board-label">
          Board
        </span>
        <Segmented label="Board view" options={BOARD_VIEW_OPTIONS} value={boardView} onChange={setBoardView} />
      </div>
      <div className="toolbar-group" role="group" aria-label="Lines between boxes" data-tour="strips">
        <ToolbarSwitch
          id="common-tones-label"
          label="Common tones"
          checked={strips.commonTones}
          onChange={(commonTones) => setStrips({ commonTones })}
        />
        <ToolbarSwitch
          id="voice-leading-label"
          label="Voice leading"
          checked={strips.voiceLeading}
          onChange={(voiceLeading) => setStrips({ voiceLeading })}
        />
        {(strips.commonTones || strips.voiceLeading) && (
          <Segmented
            label="Labels between boxes"
            options={LABEL_OPTIONS}
            value={strips.labelMode}
            onChange={(labelMode) => setStrips({ labelMode })}
          />
        )}
      </div>
      <div className="toolbar-group" role="group" aria-label="Harmonic analysis" data-tour="analysis">
        <ToolbarSwitch
          id="harmonic-analysis-label"
          label="Harmonic analysis"
          checked={strips.analysis}
          onChange={(analysis) => setStrips({ analysis })}
        />
        {strips.analysis && (
          <Segmented
            label="Analysis notation"
            options={NOTATION_OPTIONS}
            value={strips.notation}
            onChange={(notation) => setStrips({ notation })}
          />
        )}
      </div>
    </div>
  );
}

export function ToolbarSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <span className="toolbar-switch">
      {/* Not `toolbar-label`: that treatment marks a group heading ("Key", "Shift", "Neck", "Board"),
          and a switch's own name is not a heading. Seven uppercase headings in one row shout at each other. */}
      <span className="toolbar-switch-label" id={id}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        className="toggle"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </span>
  );
}
