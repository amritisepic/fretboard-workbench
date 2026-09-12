import { useCallback } from 'react';
import { useWorkbench, type Box } from '../state/workbench';
import type { FretPosition } from '../theory';
import type { BoxView } from './boardModel';
import { Fretboard } from './Fretboard';

export function BoxCard({
  box,
  view,
  numeral,
  keyName,
  selected,
}: {
  readonly box: Box;
  readonly view: BoxView;
  /** Roman numeral in the key in effect, or "" without a chord. */
  readonly numeral: string;
  readonly keyName: string;
  readonly selected: boolean;
}) {
  const tuning = useWorkbench((s) => s.settings.tuning);
  const fretCount = useWorkbench((s) => s.settings.fretCount);
  const selectBox = useWorkbench((s) => s.selectBox);
  const togglePosition = useWorkbench((s) => s.togglePosition);

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
        {numeral && (
          <span className="box-numeral" title={`${numeral} in ${keyName}`}>
            {numeral}
          </span>
        )}
        {view.title ? (
          <h2 className="box-title">{view.title}</h2>
        ) : (
          <h2 className="box-title is-placeholder">Click the fretboard to add notes</h2>
        )}
        {box.fill.mode === 'scale' && <p className="box-scale">{view.scaleName}</p>}
      </header>
      <Fretboard
        tuning={tuning}
        fretCount={fretCount}
        dots={view.dots}
        color={box.color}
        ringSelected={box.fill.on}
        onToggle={onToggle}
      />
    </section>
  );
}
