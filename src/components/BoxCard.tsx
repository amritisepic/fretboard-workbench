import { useCallback } from 'react';
import { useWorkbench, type Box } from '../state/workbench';
import type { FretPosition } from '../theory';
import { getBoxView } from './boardModel';
import { Fretboard } from './Fretboard';

export function BoxCard({ box, selected }: { readonly box: Box; readonly selected: boolean }) {
  const settings = useWorkbench((s) => s.settings);
  const selectBox = useWorkbench((s) => s.selectBox);
  const togglePosition = useWorkbench((s) => s.togglePosition);
  const view = getBoxView(box, settings);

  const onToggle = useCallback(
    (position: FretPosition) => {
      togglePosition(box.id, position);
      selectBox(box.id);
    },
    [box.id, togglePosition, selectBox],
  );

  return (
    <section
      className={selected ? 'box is-selected' : 'box'}
      aria-label={view.title || 'Empty box'}
      onClick={() => selectBox(box.id)}
    >
      <header className="box-header">
        {view.title ? (
          <h2 className="box-title">{view.title}</h2>
        ) : (
          <h2 className="box-title is-placeholder">Click the fretboard to add notes</h2>
        )}
        {box.fill.mode === 'scale' && <p className="box-scale">{view.scaleName}</p>}
      </header>
      <Fretboard
        tuning={settings.tuning}
        fretCount={settings.fretCount}
        dots={view.dots}
        color={box.color}
        ringSelected={box.fill.on}
        onToggle={onToggle}
      />
    </section>
  );
}
