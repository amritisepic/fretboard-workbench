import { useCallback, useEffect, useState } from 'react';
import { useWorkbench, type Box } from '../state/workbench';
import { MAX_CHORD_NOTES, type FretPosition } from '../theory';
import type { BoxView } from './boardModel';
import { Fretboard } from './Fretboard';

/** How long the "chord is full" note stays up after a refused click. */
const NOTICE_MS = 2500;

export function BoxCard({
  box,
  view,
  numeral,
  keyName,
  selected,
  viewing,
  onRequestRemove,
}: {
  readonly box: Box;
  readonly view: BoxView;
  /** Roman numeral in the key in effect, or "" without a chord. */
  readonly numeral: string;
  readonly keyName: string;
  readonly selected: boolean;
  /** View mode: no selecting, clicking notes or removing. */
  readonly viewing: boolean;
  /** Asks to remove the box; the app confirms first. */
  readonly onRequestRemove: (boxId: string) => void;
}) {
  const tuning = useWorkbench((s) => s.settings.tuning);
  const fretCount = useWorkbench((s) => s.settings.fretCount);
  const capo = useWorkbench((s) => s.settings.capo);
  const orientation = useWorkbench((s) => s.orientation);
  const selectBox = useWorkbench((s) => s.selectBox);
  const togglePosition = useWorkbench((s) => s.togglePosition);
  /** Time of the latest refused click, so each refusal restarts the timer. */
  const [refusedAt, setRefusedAt] = useState<number | null>(null);

  useEffect(() => {
    if (refusedAt === null) return;
    const timer = setTimeout(() => setRefusedAt(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [refusedAt]);

  const onToggle = useCallback(
    (position: FretPosition) => {
      if (!togglePosition(box.id, position)) setRefusedAt(Date.now());
      selectBox(box.id);
    },
    [box.id, togglePosition, selectBox],
  );

  const className = ['box', selected ? 'is-selected' : '', viewing ? 'is-viewing' : ''].filter(Boolean).join(' ');

  return (
    <section
      className={className}
      aria-label={view.title || 'Empty box'}
      onClick={viewing ? undefined : () => selectBox(box.id)}
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
          <h2 className="box-title is-placeholder">{viewing ? 'No notes' : 'Click the fretboard to add notes'}</h2>
        )}
        {refusedAt !== null && (
          <p className="box-notice" role="status">
            A chord has {MAX_CHORD_NOTES} notes at most. Click one to remove it first.
          </p>
        )}
      </header>
      {!viewing && (
        <button
          type="button"
          className="box-remove"
          aria-label={`Remove ${view.title || 'this box'}`}
          title="Remove box"
          onClick={(event) => {
            event.stopPropagation();
            onRequestRemove(box.id);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      )}
      <div className="fretboard-scroll">
        <Fretboard
          tuning={tuning}
          fretCount={fretCount}
          capo={capo}
          orientation={orientation}
          dots={view.dots}
          color={box.color}
          interactive={!viewing}
          onToggle={onToggle}
        />
      </div>
    </section>
  );
}
