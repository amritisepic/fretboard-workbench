import { memo, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type SVGProps } from 'react';
import type { Orientation } from '../state/workbench';
import { PITCH_CLASS_NAMES, pitchName, type FretPosition, type PitchClass, type Tuning } from '../theory';
import type { BoardDot, DotKind } from './boardModel';
import { labelInk, mapShade, mix } from './color';

/** Along the neck: space per fret and for the open strings. */
const FRET_LENGTH = 38;
const OPEN_LENGTH = 34;
/** Across the neck. */
const STRING_GAP = 26;
const DOT_RADIUS = 11;
const PAD_END = 10;
const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27];
/** The inlay dots at the marker frets; octave frets get two. */
const INLAY_RADIUS = 5;

/** Space for the string names before the open strings, and for the fret numbers beside the neck. */
const MARGINS: Readonly<Record<Orientation, { readonly names: number; readonly numbers: number }>> = {
  horizontal: { names: 30, numbers: 24 },
  vertical: { names: 22, numbers: 24 },
};

export interface FretboardProps {
  readonly tuning: Tuning;
  readonly fretCount: number;
  /** Fret the capo sits at, 0 for none. */
  readonly capo: number;
  readonly orientation: Orientation;
  /** Light grey inlay dots at the marker frets. */
  readonly fretMarkers: boolean;
  readonly dots: readonly BoardDot[];
  readonly color: string;
  /** False in view mode: nothing responds to clicks. */
  readonly interactive: boolean;
  readonly onToggle: (position: FretPosition) => void;
}

/** Radius of the ring drawn around each clicked note. */
const RING_GAP = 3;

/** How far one arrow key moves, counted in strings and frets rather than pixels. */
interface Step {
  readonly string: number;
  readonly fret: number;
}

/**
 * Arrow keys follow the picture rather than the data, so the mapping depends on the orientation.
 * `alongOf` runs the frets along x on a horizontal board and along y on a vertical one, and
 * `acrossOf` puts string 0 — the lowest-sounding string — at the bottom of a horizontal board but
 * at the left of a vertical one. So on a horizontal board Right walks towards the bridge and Up
 * climbs to a higher-sounding string; on a vertical board Down walks towards the bridge and Right
 * crosses to a higher-sounding string.
 */
const ARROW_STEPS: Readonly<Record<Orientation, Readonly<Record<string, Step | undefined>>>> = {
  horizontal: {
    ArrowLeft: { string: 0, fret: -1 },
    ArrowRight: { string: 0, fret: 1 },
    ArrowUp: { string: 1, fret: 0 },
    ArrowDown: { string: -1, fret: 0 },
  },
  vertical: {
    ArrowLeft: { string: -1, fret: 0 },
    ArrowRight: { string: 1, fret: 0 },
    ArrowUp: { string: 0, fret: -1 },
    ArrowDown: { string: 0, fret: 1 },
  },
};

/**
 * How a position that is not in the chord ends its spoken label. The words describe the map rather
 * than naming chord and scale tones, because `kind` only says how strongly the dot is drawn: a
 * faint dot is a scale tone under a scale fill but a chord tone under an inversion fill, and the
 * board is never told which fill it is drawing.
 */
const KIND_WORDS: Readonly<Record<DotKind, string>> = {
  empty: 'not on the map',
  weak: 'on the map, faint',
  strong: 'on the map',
};

/**
 * `PITCH_CLASS_NAMES` spells with the ♯ glyph, which a screen reader either skips — turning C♯ into
 * a second C — or reads out as the name of the symbol. Spelling it as a word keeps the label
 * speakable.
 */
const speakNote = (pc: PitchClass) => PITCH_CLASS_NAMES[pc].replace('♯', ' sharp');

/**
 * Horizontal boards run the frets across the page with the highest string on top, as in tab.
 * Vertical boards run them down the page with the lowest string on the left, as in a chord chart.
 * Geometry is worked out along and across the neck, then mapped to x and y.
 *
 * Clicked notes stand apart from map notes: a lit gradient in the box color inside a crisp ring.
 *
 * Each position is a toggle button: the whole board is one tab stop, the arrow keys walk the grid
 * of strings and frets, and Enter or Space clicks the note under the cursor.
 */
export const Fretboard = memo(function Fretboard({
  tuning,
  fretCount,
  capo,
  orientation,
  fretMarkers,
  dots,
  color,
  interactive,
  onToggle,
}: FretboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const coreFill = `dot-core-${uid}`;
  const ringRadius = DOT_RADIUS + RING_GAP;
  const vertical = orientation === 'vertical';
  const stringCount = tuning.length;
  const margins = MARGINS[orientation];
  const nut = margins.names + OPEN_LENGTH;
  const neckEnd = nut + fretCount * FRET_LENGTH;
  const firstString = vertical ? margins.numbers + DOT_RADIUS : DOT_RADIUS + 3;
  const lastString = firstString + (stringCount - 1) * STRING_GAP;
  const width = vertical ? lastString + DOT_RADIUS + 3 : neckEnd + PAD_END;
  const height = vertical ? neckEnd + PAD_END : lastString + DOT_RADIUS + margins.numbers;

  const alongOf = (fret: number) => (fret === 0 ? nut - OPEN_LENGTH / 2 : nut + (fret - 0.5) * FRET_LENGTH);
  const acrossOf = (string: number) => firstString + (vertical ? string : stringCount - 1 - string) * STRING_GAP;
  const point = (along: number, across: number) => (vertical ? { x: across, y: along } : { x: along, y: across });
  const segment = (along1: number, across1: number, along2: number, across2: number) => {
    const a = point(along1, across1);
    const b = point(along2, across2);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };
  const area = (along1: number, along2: number, across1: number, across2: number) => {
    const a = point(along1, across1);
    const b = point(along2, across2);
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  };

  const weak = mapShade(color);
  const strongInk = labelInk(color);
  const weakInk = labelInk(weak);
  const capoWire = nut + capo * FRET_LENGTH;
  const markerFrets = MARKER_FRETS.filter((fret) => fret <= fretCount);
  // Centred across the neck; an octave fret's pair sits a string gap either side of the centre.
  const neckMiddle = (firstString + lastString) / 2;

  const boardRef = useRef<SVGSVGElement>(null);
  /** Where the roving tabindex sits once the user has moved or clicked, as `string:fret`. */
  const [cursor, setCursor] = useState<string | null>(null);
  const keyOf = (position: FretPosition) => `${position.string}:${position.fret}`;

  /**
   * The board is one tab stop. Tabbing in lands on the position the user last worked on; before
   * that on the first note of the chord, so a board with a chord on it opens on the chord rather
   * than in the empty corner by the nut; and on a bare board on the first position. A cursor left
   * over from a board that has since changed shape — a shorter neck, a capo, a different tuning —
   * is dropped rather than leaving the board with no tab stop at all.
   */
  const landing = dots.find((dot) => dot.selected) ?? dots.at(0);
  const tabStop =
    cursor !== null && dots.some((dot) => keyOf(dot) === cursor) ? cursor : landing ? keyOf(landing) : null;

  /** Moves the cursor, unless the move runs off the board: then it stays where it is. */
  const moveTo = (position: FretPosition) => {
    const key = keyOf(position);
    const target = boardRef.current?.querySelector<SVGGElement>(`[data-position="${key}"]`);
    if (!target) return;
    setCursor(key);
    target.focus();
  };

  /** The fret at one end of a string, for Home and End. The drawn frets start at the capo. */
  const endFret = (string: number, last: boolean) => {
    let found: number | null = null;
    for (const dot of dots) {
      if (dot.string === string && (found === null || (last ? dot.fret > found : dot.fret < found))) found = dot.fret;
    }
    return found;
  };

  const onPositionKeyDown = (event: ReactKeyboardEvent<SVGGElement>, dot: BoardDot) => {
    // The workbench listens on the window for arrow keys, which nudge the selected box's root, and
    // for Space, which turns its fill on and off. Inside the board those keys belong to the note
    // under the cursor, so every key handled here is stopped before it gets that far; stopping
    // Space also keeps it from scrolling the page.
    const step = ARROW_STEPS[orientation][event.key];
    if (step) {
      event.preventDefault();
      event.stopPropagation();
      moveTo({ string: dot.string + step.string, fret: dot.fret + step.fret });
    } else if (event.key === 'Home' || event.key === 'End') {
      const fret = endFret(dot.string, event.key === 'End');
      if (fret === null) return;
      event.preventDefault();
      event.stopPropagation();
      moveTo({ string: dot.string, fret });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onToggle({ string: dot.string, fret: dot.fret });
    }
  };

  /**
   * What makes a position a control. In view mode it is undefined: a position is then a drawing,
   * with no role, no tab stop and no handlers, exactly as nothing there is clickable. The board's
   * own aria-label still says what is on show.
   *
   * Strings are numbered as players number them, 1 being the highest-sounding, which is the reverse
   * of the index the board draws from.
   */
  const controlProps = (dot: BoardDot): SVGProps<SVGGElement> | undefined => {
    if (!interactive) return undefined;
    const where = `String ${stringCount - dot.string}, ${dot.fret === 0 ? 'open' : `fret ${dot.fret}`}`;
    return {
      role: 'button',
      tabIndex: keyOf(dot) === tabStop ? 0 : -1,
      'aria-label': `${where}, ${speakNote(dot.pc)}, ${dot.selected ? 'in chord' : KIND_WORDS[dot.kind]}`,
      'aria-pressed': dot.selected,
      onClick: () => {
        // A click moves the tab stop as well, so Tab comes back to the note just worked on.
        setCursor(keyOf(dot));
        onToggle({ string: dot.string, fret: dot.fret });
      },
      onKeyDown: (event) => onPositionKeyDown(event, dot),
    };
  };

  return (
    <svg
      ref={boardRef}
      className={interactive ? 'fretboard' : 'fretboard is-static'}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label={`Fretboard, ${stringCount} strings, ${fretCount} frets${capo > 0 ? `, capo at fret ${capo}` : ''}`}
    >
      <defs>
        <radialGradient id={coreFill} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={mix(color, '#FFFFFF', 0.45)} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={mix(color, '#1E1E1E', 0.7)} />
        </radialGradient>
      </defs>
      {capo > 0 && (
        <rect
          className="capo-covered"
          {...area(nut - OPEN_LENGTH, capoWire - FRET_LENGTH, firstString - DOT_RADIUS, lastString + DOT_RADIUS)}
          rx={6}
        />
      )}

      {fretMarkers &&
        markerFrets.flatMap((fret) =>
          (fret % 12 === 0 ? [neckMiddle - STRING_GAP, neckMiddle + STRING_GAP] : [neckMiddle]).map((across, i) => {
            const at = point(alongOf(fret), across);
            return <circle key={`inlay-${fret}-${i}`} className="inlay" cx={at.x} cy={at.y} r={INLAY_RADIUS} />;
          }),
        )}

      {tuning.map((midi, string) => {
        const across = acrossOf(string);
        const weight = 1 + 0.8 * (1 - string / Math.max(1, stringCount - 1));
        const name = vertical ? point(margins.names / 2 - 1, across) : point(margins.names - 4, across);
        return (
          <g key={`string-${string}`}>
            <text
              className="string-name"
              x={name.x}
              y={name.y}
              textAnchor={vertical ? 'middle' : 'end'}
              dominantBaseline="central"
            >
              {pitchName(midi)}
            </text>
            <line className="string-stub" {...segment(margins.names + 2, across, nut, across)} strokeWidth={weight} />
            <line className="string" {...segment(nut, across, neckEnd, across)} strokeWidth={weight} />
          </g>
        );
      })}

      {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => {
        const along = nut + fret * FRET_LENGTH;
        return <line key={`wire-${fret}`} className="wire" {...segment(along, firstString, along, lastString)} />;
      })}
      <line className="nut" {...segment(nut, firstString, nut, lastString)} />

      {markerFrets.map((fret) => {
        const at = vertical
          ? point(alongOf(fret), margins.numbers - 6)
          : point(alongOf(fret), lastString + DOT_RADIUS + 14);
        return (
          <text
            key={`marker-${fret}`}
            className={fret % 12 === 0 ? 'fret-number is-octave' : 'fret-number'}
            x={at.x}
            y={at.y}
            textAnchor={vertical ? 'end' : 'middle'}
            dominantBaseline={vertical ? 'central' : undefined}
          >
            {fret}
          </text>
        );
      })}

      {capo > 0 && <rect className="capo" {...area(capoWire - 8, capoWire - 2, firstString - 8, lastString + 8)} rx={3} />}

      {dots.map((dot) => {
        const { x: cx, y: cy } = point(alongOf(dot.fret), acrossOf(dot.string));
        const key = keyOf(dot);
        if (dot.selected) {
          return (
            <g key={key} data-position={key} className="position position-strong is-clicked" {...controlProps(dot)}>
              <circle className="dot-ring" cx={cx} cy={cy} r={ringRadius} stroke={color} />
              <circle className="dot-core" cx={cx} cy={cy} r={DOT_RADIUS} fill={`url(#${coreFill})`} />
              <text className={dot.label.length > 2 ? 'dot-label is-long' : 'dot-label'} x={cx} y={cy} fill={strongInk}>
                {dot.label}
              </text>
            </g>
          );
        }
        return (
          <g key={key} data-position={key} className={`position position-${dot.kind}`} {...controlProps(dot)}>
            <circle
              cx={cx}
              cy={cy}
              r={DOT_RADIUS}
              fill={dot.kind === 'strong' ? color : dot.kind === 'weak' ? weak : undefined}
            />
            <text
              className={dot.label.length > 2 ? 'dot-label is-long' : 'dot-label'}
              x={cx}
              y={cy}
              fill={dot.kind === 'strong' ? strongInk : weakInk}
            >
              {dot.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
