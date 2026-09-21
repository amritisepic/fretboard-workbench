import { useCallback, useEffect, useState } from 'react';
import { useWorkbench, type Box, type Orientation } from '../state/workbench';
import { MAX_CHORD_NOTES, type FretPosition } from '../theory';
import type { FunctionLabel } from './analysisModel';
import type { BoxView } from './boardModel';
import { editableWindow } from './boardModel';
import { Fretboard } from './Fretboard';
import { FunctionText } from './FunctionText';
import { InfoPopover } from './InfoPopover';

/** How long the "chord is full" note stays up after a refused click. */
const NOTICE_MS = 2500;

/** What harmonic analysis adds beside the board: the chord's function and a sentence about it. */
export interface AnalysisTag {
  readonly label: FunctionLabel;
  readonly explanation: string;
}

export function BoxCard({
  box,
  view,
  numeral,
  keyName,
  tentative,
  tag,
  selected,
  viewing,
  orientation: neckOverride,
  onRequestRemove,
}: {
  readonly box: Box;
  readonly view: BoxView;
  /** Roman numeral in the key in effect, or "" without a chord. */
  readonly numeral: string;
  readonly keyName: string;
  /** Other readings are nearly as likely, and none is pinned. */
  readonly tentative: boolean;
  /** Null while harmonic analysis is off, or without a chord. */
  readonly tag: AnalysisTag | null;
  readonly selected: boolean;
  /** View mode: no selecting, clicking notes or removing. */
  readonly viewing: boolean;
  /** Draws the neck this way instead of the preset's orientation (exports). */
  readonly orientation?: Orientation;
  /** Asks to remove the box; the app confirms first. */
  readonly onRequestRemove: (boxId: string) => void;
}) {
  const tuning = useWorkbench((s) => s.settings.tuning);
  const fretCount = useWorkbench((s) => s.settings.fretCount);
  const capo = useWorkbench((s) => s.settings.capo);
  const fretMarkers = useWorkbench((s) => s.settings.fretMarkers);
  const boardView = useWorkbench((s) => s.settings.boardView);
  const presetOrientation = useWorkbench((s) => s.orientation);
  const orientation = neckOverride ?? presetOrientation;
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
          <span
            className={tentative ? 'box-numeral is-tentative' : 'box-numeral'}
            title={tentative ? `${numeral} in ${keyName}, tentative: other readings are nearly as likely` : `${numeral} in ${keyName}`}
          >
            {numeral}
            {tentative && <span className="tentative-mark">?</span>}
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
      {/*
        The board and, when harmonic analysis is on, the function tag beside or under it. The tag is
        kept out of the header on purpose: a tag long enough to wrap used to push its own board down
        while its neighbors' stayed put, so the nuts no longer lined up across a row, and comparing
        shapes across a progression is the whole point of the canvas. Out here the header holds the
        same elements in every box and every board starts at the same height.

        Which side the tag takes follows the orientation the card is actually drawing, which is the
        preset's unless an export overrode it. The stylesheet does the placing; the class only says
        which way the neck runs.
      */}
      <div className={`box-body is-${orientation}`}>
        <div className="fretboard-scroll">
          <Fretboard
            tuning={tuning}
            fretCount={fretCount}
            capo={capo}
            orientation={orientation}
            fretMarkers={fretMarkers}
            dots={view.dots}
            // A chord chart crops the neck to a window around the shape; the whole neck is the other
            // choice, and passing no window is what asks for it.
            //
            // Only the selected box gets room to move. A window worked out from the notes is a dead
            // end for building — nothing reachable inside it can push it up the neck — but paying
            // for that on every board costs half the density the window was for, measured at three
            // chords on a laptop against six. One box is edited at a time, and clicking any note
            // selects its box, so the reach arrives exactly when it is wanted.
            window={
              boardView !== 'chart'
                ? undefined
                : selected && !viewing
                  ? editableWindow(view.window, capo, fretCount)
                  : view.window
            }
            color={box.color}
            interactive={!viewing}
            onToggle={onToggle}
          />
        </div>
        {tag && tag.label.text && <FunctionTag tag={tag} />}
      </div>
    </section>
  );
}

/**
 * The chord's function, beside the board or under it; clicking or tapping it explains what it means.
 *
 * It comes after the board in the DOM because that is where it is on the screen in both
 * orientations — to the right of a horizontal neck, under a vertical one — so reading order and
 * focus order follow the picture rather than being reshuffled by `order`.
 */
function FunctionTag({ tag }: { readonly tag: AnalysisTag }) {
  return (
    <div className="box-analysis">
      <InfoPopover
        className="function-tag"
        label={`Chord function, ${tag.label.text}. What this means`}
        explanation={tag.explanation}
      >
        <FunctionText label={tag.label} />
        {tag.label.note && <span className="function-note">{tag.label.note}</span>}
      </InfoPopover>
    </div>
  );
}
