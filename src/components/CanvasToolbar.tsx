import { useWorkbench, type LabelMode, type Orientation } from '../state/workbench';
import { keyName } from '../theory';
import { getBoxView } from './boardModel';
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

/** Preset-wide controls above the boxes: the key, shifting everything, the neck, and the voice-leading strips. */
export function CanvasToolbar() {
  const key = useWorkbench((s) => s.key);
  const setKey = useWorkbench((s) => s.setKey);
  const setKeyAndScales = useWorkbench((s) => s.setKeyAndScales);
  const transposeAll = useWorkbench((s) => s.transposeAll);
  const orientation = useWorkbench((s) => s.orientation);
  const setOrientation = useWorkbench((s) => s.setOrientation);
  const strips = useWorkbench((s) => s.strips);
  const setStrips = useWorkbench((s) => s.setStrips);
  const hasChord = useWorkbench((s) => s.boxes.some((box) => getBoxView(box, s.settings).chord !== null));

  const findKey = () => {
    const { boxes, settings } = useWorkbench.getState();
    const found = planFoundKey(boxes, settings);
    if (found) setKeyAndScales(found.key, found.boxes);
  };

  return (
    <div className="canvas-toolbar">
      <div className="toolbar-group" role="group" aria-label={`Key: ${keyName(key)}`}>
        <span className="toolbar-label">Key</span>
        <ScaleSelects scale={key} label="Key" onChange={setKey} />
        <button
          type="button"
          className="button is-compact"
          disabled={!hasChord}
          title={
            hasChord
              ? 'Find the key of the progression, and give each chord the scale closest to it'
              : 'Add chords to find their key'
          }
          onClick={findKey}
        >
          Find key
        </button>
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
      <div className="toolbar-group" role="group" aria-labelledby="neck-label">
        <span className="toolbar-label" id="neck-label">
          Neck
        </span>
        <Segmented label="Neck orientation" options={ORIENTATION_OPTIONS} value={orientation} onChange={setOrientation} />
      </div>
      <div className="toolbar-group" role="group" aria-label="Voice leading">
        <span className="toolbar-label" id="strips-label">
          Voice leading
        </span>
        <button
          type="button"
          role="switch"
          className="toggle"
          aria-checked={strips.visible}
          aria-labelledby="strips-label"
          onClick={() => setStrips({ visible: !strips.visible })}
        >
          <span className="toggle-knob" />
        </button>
        <Segmented
          label="Voice-leading labels"
          options={LABEL_OPTIONS}
          value={strips.labelMode}
          onChange={(labelMode) => setStrips({ labelMode })}
        />
      </div>
    </div>
  );
}
