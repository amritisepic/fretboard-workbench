import { useCallback, useId, useState } from 'react';
import { boxChord } from '../state/boxChords';
import { useWorkbench, type BoardView, type HarmonyNotation, type LabelMode, type Orientation } from '../state/workbench';
import { keyName } from '../theory';
import { planFoundKey } from './findKeyModel';
import { usePopoverLayer } from './focusLayer';
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
 * Preset-wide controls above the boxes.
 *
 * The bar is split by what a control does rather than by what it is. The key, Find key and Shift
 * change the music itself and stay in the bar; the neck's direction, how much of it each board
 * draws and what the strips between boxes show only change how that music is drawn, and live behind
 * the Display button. Eight groups in one row came to 4.4 times the width of a 390px phone, and the
 * bar scrolled sideways with `scrollbar-width: none` — three quarters of the controls were off the
 * side of the screen with nothing to say they were there. What is left fits one row at every width.
 */
export function CanvasToolbar() {
  const key = useWorkbench((s) => s.key);
  const setKey = useWorkbench((s) => s.setKey);
  const setKeyAndScales = useWorkbench((s) => s.setKeyAndScales);
  const transposeAll = useWorkbench((s) => s.transposeAll);
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
      <DisplayMenu />
    </div>
  );
}

/**
 * The Display button and the popover it opens.
 *
 * The panel is mounted only while it is open, because `usePopoverLayer` takes focus on mount and
 * hands it back on unmount: keeping an empty panel in the DOM would mean the layer never opens or
 * closes as far as focus is concerned.
 */
function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Stable across renders so the layer's press-outside listener is not torn down and rebuilt on
  // every keystroke the panel's controls cause.
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="toolbar-group toolbar-display" data-tour="display">
      <button
        type="button"
        className="button is-compact"
        data-display-trigger=""
        aria-haspopup="dialog"
        aria-expanded={open}
        // The panel is not in the DOM when it is closed, and pointing at an id that is not there
        // tells a screen reader about a relationship it cannot follow.
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Display
      </button>
      {open && <DisplayPanel id={panelId} onClose={close} />}
    </div>
  );
}

/**
 * How the canvas is drawn: the neck, the board, and what the strips between boxes show.
 *
 * Like the settings and preset panels this is a non-modal `role="dialog"` — the canvas behind stays
 * live and stays readable, which is the point of a control that changes how it looks, so a press
 * outside closes it and there is no focus trap and no `aria-modal`. What it does owe the user is
 * what `usePopoverLayer` provides: focus moves in when it opens, Escape closes it, and focus goes
 * back to the Display button when it does.
 */
function DisplayPanel({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const { ref, onKeyDown } = usePopoverLayer<HTMLDivElement>({ trigger: '[data-display-trigger]', onClose });
  const orientation = useWorkbench((s) => s.orientation);
  const setOrientation = useWorkbench((s) => s.setOrientation);
  const boardView = useWorkbench((s) => s.settings.boardView);
  const setBoardView = useWorkbench((s) => s.setBoardView);
  const strips = useWorkbench((s) => s.strips);
  const setStrips = useWorkbench((s) => s.setStrips);

  const labels = useId();
  const stripsLabelId = `${labels}-strips`;

  return (
    <div
      className="toolbar-display-panel"
      id={id}
      role="dialog"
      aria-label="Display"
      tabIndex={-1}
      ref={ref}
      onKeyDown={onKeyDown}
    >
      <div className="toolbar-display-row">
        <span className="toolbar-label">Neck</span>
        <Segmented label="Neck orientation" options={ORIENTATION_OPTIONS} value={orientation} onChange={setOrientation} />
      </div>
      <div className="toolbar-display-row">
        <span className="toolbar-label">Board</span>
        <Segmented label="Board view" options={BOARD_VIEW_OPTIONS} value={boardView} onChange={setBoardView} />
      </div>
      <div className="toolbar-display-section" role="group" aria-labelledby={stripsLabelId}>
        <span className="toolbar-label" id={stripsLabelId}>
          Between boxes
        </span>
        <ToolbarSwitch
          id={`${labels}-common-tones`}
          label="Common tones"
          checked={strips.commonTones}
          onChange={(commonTones) => setStrips({ commonTones })}
        />
        <ToolbarSwitch
          id={`${labels}-voice-leading`}
          label="Voice leading"
          checked={strips.voiceLeading}
          onChange={(voiceLeading) => setStrips({ voiceLeading })}
        />
        {/* Only worth showing once there are lines to label. Appearing here adds a row to the foot of
            a section the user is already looking at, rather than shoving the controls beside it
            sideways as it did when it sat in the bar itself. */}
        {(strips.commonTones || strips.voiceLeading) && (
          <div className="toolbar-display-row">
            <span className="toolbar-label">Labels</span>
            <Segmented
              label="Labels between boxes"
              options={LABEL_OPTIONS}
              value={strips.labelMode}
              onChange={(labelMode) => setStrips({ labelMode })}
            />
          </div>
        )}
      </div>
      <div className="toolbar-display-section">
        <ToolbarSwitch
          id={`${labels}-analysis`}
          label="Harmonic analysis"
          checked={strips.analysis}
          onChange={(analysis) => setStrips({ analysis })}
        />
        {/* Last in the panel on purpose: switching harmonic analysis on used to inject this control
            into the middle of the bar and move every control to its right, so the thing the user was
            reaching for was no longer under their finger. Here there is nothing below it to move. */}
        {strips.analysis && (
          <div className="toolbar-display-row">
            <span className="toolbar-label">Notation</span>
            <Segmented
              label="Analysis notation"
              options={NOTATION_OPTIONS}
              value={strips.notation}
              onChange={(notation) => setStrips({ notation })}
            />
          </div>
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
      {/* Not `toolbar-label`: that treatment marks a group heading ("Key", "Neck", "Board"), and a
          switch's own name is not a heading. */}
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
