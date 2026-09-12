import { useWorkbench, type Box, type LabelMode } from '../state/workbench';
import { scaleRefName } from '../theory';
import { FillSwitch } from './FillSwitch';
import { Segmented, type SegmentedOption } from './Segmented';

const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Note names' },
  { value: 'degrees', label: 'Scale degrees' },
];

export function Sidebar({ box }: { readonly box: Box }) {
  const setLabelMode = useWorkbench((s) => s.setLabelMode);
  const setFillOn = useWorkbench((s) => s.setFillOn);
  const setFillMode = useWorkbench((s) => s.setFillMode);

  return (
    <aside className="sidebar" aria-label="Box settings">
      <div className="sidebar-body">
        <div className="field">
          <span className="field-label">Reference scale</span>
          <p className="field-value">{scaleRefName(box.scale)}</p>
        </div>
        <div className="field">
          <span className="field-label">Dot labels</span>
          <Segmented
            label="Dot labels"
            options={LABEL_OPTIONS}
            value={box.labelMode}
            onChange={(mode) => setLabelMode(box.id, mode)}
          />
        </div>
      </div>
      <div className="sidebar-footer">
        <FillSwitch
          fill={box.fill}
          onSetOn={(on) => setFillOn(box.id, on)}
          onSetMode={(mode) => setFillMode(box.id, mode)}
        />
      </div>
    </aside>
  );
}
