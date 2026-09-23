import { useCallback, useEffect, useState } from 'react';
import { useWorkbench, type Box, type Orientation } from '../state/workbench';
import { MAX_CHORD_NOTES, type FretPosition } from '../theory';
import { numeralLabel, type FunctionLabel } from './analysisModel';
import type { BoxView } from './boardModel';
import { editableWindow } from './boardModel';
import { Fretboard } from './Fretboard';
import { FunctionText } from './FunctionText';
import { InfoPopover } from './InfoPopover';

/** How long the "chord is full" note stays up after a refused click. */
const NOTICE_MS = 2500;

/** What the chip says of a reading the analysis is not confident in. */
const TENTATIVE_NOTE = 'tentative: other readings are nearly as likely';

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

  // The card says the chord's function once, in the fullest form it knows. With harmonic analysis on
  // that is the analyzer's label and the sentence that goes with it ("I7", "C is I in C major"); with
  // it off, the numeral in the key is all there is, and it wears the same chip with nothing to open.
  const analyzed = tag && tag.label.text ? tag : null;
  const label = analyzed ? analyzed.label : numeral ? numeralLabel(numeral) : null;

  return (
    <section
      className={className}
      aria-label={view.title || 'Empty box'}
      onClick={viewing ? undefined : () => selectBox(box.id)}
    >
      {/*
        Nothing but the chord's name, and a notice that is taken out of the flow. The header is the
        one part of the card that has to lay out to the same height in every box, because the board
        hangs below it and a row of boards has to start together; so anything a box may or may not
        have — the function chip above all — belongs below, beside the board it describes.
      */}
      <header className="box-header">
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
        The board and the function chip beside or under it. The chip is kept out of the header on
        purpose: a label long enough to wrap used to push its own board down while its neighbors'
        stayed put, so the nuts no longer lined up across a row, and comparing shapes across a
        progression is the whole point of the canvas. Out here the header holds the same elements in
        every box and every board starts at the same height.

        Which side the chip takes follows the orientation the card is actually drawing, which is the
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
        {label && (
          <FunctionTag label={label} keyName={keyName} tentative={tentative} explanation={analyzed?.explanation ?? ''} />
        )}
      </div>
    </section>
  );
}

/**
 * The chord's function: one chip carrying the whole label, the key it is counted from, and whether
 * the reading is firm. Where there is an explanation to give, clicking or tapping it gives it.
 *
 * It comes after the board in the DOM because that is where it is on the screen in both
 * orientations — to the right of a horizontal neck, under a vertical one — so reading order and
 * focus order follow the picture rather than being reshuffled by `order`.
 *
 * The key used to live in a `title` on a second chip up in the header, which on a phone is nowhere
 * at all: a native tooltip needs a pointer to hover, and a finger cannot hover. So it is spoken with
 * the label instead, and the sentence about the reading opens in a real popover that a tap reaches.
 */
function FunctionTag({
  label,
  keyName,
  tentative,
  explanation,
}: {
  readonly label: FunctionLabel;
  readonly keyName: string;
  readonly tentative: boolean;
  /** The analysis's sentence about this chord, or "" when there is no analysis to explain. */
  readonly explanation: string;
}) {
  const className = tentative ? 'function-tag is-tentative' : 'function-tag';
  // The mark is the tentative modifier's visible half; the words are carried by the accessible name
  // or the hidden copy of the label, so reading "?" out on top of them would only be noise.
  const body = (
    <>
      <FunctionText label={label} context={tentative ? `in ${keyName}, ${TENTATIVE_NOTE}` : `in ${keyName}`} />
      {tentative && (
        <span className="tentative-mark" aria-hidden="true">
          ?
        </span>
      )}
      {label.note && <span className="function-note">{label.note}</span>}
    </>
  );

  return (
    <div className="box-analysis">
      {explanation ? (
        <InfoPopover
          className={className}
          label={`Chord function, ${label.text} in ${keyName}${tentative ? ', tentative' : ''}. What this means`}
          explanation={tentative ? `${explanation} This reading is ${TENTATIVE_NOTE}.` : explanation}
        >
          {body}
        </InfoPopover>
      ) : (
        // Nothing to disclose without the analysis, so the chip is not a button: a control that
        // opens nothing is worse than plain text. `title` is left as a convenience for a mouse, on
        // top of the hidden copy of the label that every reader gets.
        <span className={className} title={`${label.text} in ${keyName}${tentative ? `, ${TENTATIVE_NOTE}` : ''}`}>
          {body}
        </span>
      )}
    </div>
  );
}
