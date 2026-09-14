import { useMemo } from 'react';
import { keyPlanOf } from '../state/boxChords';
import { useWorkbench, type Box, type DegreeBasis, type LabelMode } from '../state/workbench';
import { formatSpelled, keyName, scaleRefName, scaleRefPcSet } from '../theory';
import { getBoxView } from './boardModel';
import { ChordNameField } from './ChordNameField';
import { ColorField } from './ColorField';
import { FillSwitch } from './FillSwitch';
import { RankingList } from './RankingList';
import { buildRankingView } from './rankingModel';
import { RootBox } from './RootBox';
import { ScalePicker } from './ScalePicker';
import { Segmented, type SegmentedOption } from './Segmented';

const LABEL_OPTIONS: readonly SegmentedOption<LabelMode>[] = [
  { value: 'names', label: 'Note names' },
  { value: 'degrees', label: 'Scale degrees' },
];

const BASIS_OPTIONS: readonly SegmentedOption<DegreeBasis>[] = [
  { value: 'key', label: 'From key' },
  { value: 'scale', label: 'From scale' },
];

export function Sidebar({ box }: { readonly box: Box }) {
  const settings = useWorkbench((s) => s.settings);
  const boxes = useWorkbench((s) => s.boxes);
  const globalKey = useWorkbench((s) => s.key);
  const transposeBox = useWorkbench((s) => s.transposeBox);
  const setScale = useWorkbench((s) => s.setScale);
  const setLabelMode = useWorkbench((s) => s.setLabelMode);
  const selectBox = useWorkbench((s) => s.selectBox);
  const setDegreeBasis = useWorkbench((s) => s.setDegreeBasis);
  const setFillOn = useWorkbench((s) => s.setFillOn);
  const setFillMode = useWorkbench((s) => s.setFillMode);

  const index = boxes.findIndex((b) => b.id === box.id);
  const previousScale = index > 0 ? boxes[index - 1].scale : null;
  const keyHere = useMemo(
    () => keyPlanOf(globalKey, boxes, settings).keys[index] ?? globalKey,
    [globalKey, boxes, settings, index],
  );
  const view = getBoxView(box, settings, keyHere);

  const ranking = useMemo(
    () =>
      box.fill.mode === 'scale'
        ? buildRankingView(box, view, previousScale ? scaleRefPcSet(previousScale) : undefined, keyHere)
        : null,
    [box, view, previousScale, keyHere],
  );

  return (
    <aside className="sidebar" aria-label="Box settings">
      <div className="sidebar-body">
        {/* Shown where the sidebar covers the canvas (tablets and phones). */}
        <button type="button" className="button is-compact sidebar-close" onClick={() => selectBox(null)}>
          Done
        </button>
        <RootBox root={formatSpelled(box.scale.tonic)} onStep={(semitones) => transposeBox(box.id, semitones)} />
        <ScalePicker box={box} />
        <ChordNameField box={box} view={view} />
        <div className="field">
          <span className="field-label">Dot labels</span>
          <Segmented
            label="Dot labels"
            options={LABEL_OPTIONS}
            value={box.labelMode}
            onChange={(mode) => setLabelMode(box.id, mode)}
          />
          {box.labelMode === 'degrees' && (
            <div className="degree-basis">
              <Segmented
                label="Count degrees from"
                options={BASIS_OPTIONS}
                value={box.degreeBasis}
                onChange={(basis) => setDegreeBasis(box.id, basis)}
              />
              <p className="hint">
                1 is the tonic of {box.degreeBasis === 'key' ? keyName(keyHere) : scaleRefName(box.scale)}.
              </p>
            </div>
          )}
        </div>
        <ColorField box={box} />
        {box.fill.mode === 'scale' && (
          <div className="field">
            <span className="field-label">{ranking ? `Scales for ${ranking.chordName}` : 'Scales'}</span>
            {ranking ? (
              <RankingList ranking={ranking} color={box.color} onSelect={(scale) => setScale(box.id, scale)} />
            ) : (
              <p className="field-note">Click at least two different notes to rank scales for the chord.</p>
            )}
          </div>
        )}
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
