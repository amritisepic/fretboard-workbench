import { useMemo } from 'react';
import { useWorkbench, type Box, type LabelMode } from '../state/workbench';
import { formatSpelled, planKeys, scaleRefPcSet } from '../theory';
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

export function Sidebar({ box }: { readonly box: Box }) {
  const settings = useWorkbench((s) => s.settings);
  const boxes = useWorkbench((s) => s.boxes);
  const globalKey = useWorkbench((s) => s.key);
  const transposeBox = useWorkbench((s) => s.transposeBox);
  const setScale = useWorkbench((s) => s.setScale);
  const setLabelMode = useWorkbench((s) => s.setLabelMode);
  const setFillOn = useWorkbench((s) => s.setFillOn);
  const setFillMode = useWorkbench((s) => s.setFillMode);

  const view = getBoxView(box, settings);
  const index = boxes.findIndex((b) => b.id === box.id);
  const previousScale = index > 0 ? boxes[index - 1].scale : null;
  const keyHere = useMemo(
    () => planKeys(globalKey, boxes.map((b) => b.scale)).keys[index],
    [globalKey, boxes, index],
  );

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
