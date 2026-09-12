import { useWorkbench, type LabelMode, type StripCompare } from '../state/workbench';
import { keyName } from '../theory';
import { ScaleSelects } from './ScaleSelects';
import { Segmented, type SegmentedOption } from './Segmented';

const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Names' },
  { value: 'degrees', label: 'Degrees' },
];

const COMPARE_OPTIONS: readonly SegmentedOption<StripCompare>[] = [
  { value: 'chords', label: 'Chords' },
  { value: 'scales', label: 'Scales' },
];

/** Preset-wide controls above the boxes: the key, and the voice-leading strips. */
export function CanvasToolbar() {
  const key = useWorkbench((s) => s.key);
  const setKey = useWorkbench((s) => s.setKey);
  const strips = useWorkbench((s) => s.strips);
  const setStrips = useWorkbench((s) => s.setStrips);

  return (
    <div className="canvas-toolbar">
      <div className="toolbar-group" role="group" aria-label={`Key: ${keyName(key)}`}>
        <span className="toolbar-label">Key</span>
        <ScaleSelects scale={key} label="Key" onChange={setKey} />
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
        <Segmented
          label="Compare"
          options={COMPARE_OPTIONS}
          value={strips.compare}
          onChange={(compare) => setStrips({ compare })}
        />
      </div>
    </div>
  );
}
