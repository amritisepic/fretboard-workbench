import { Fragment, memo, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Orientation } from '../state/workbench';
import { PITCH_CLASS_NAMES, pitchName, type FretPosition, type PitchClass, type Tuning } from '../theory';
import type { BoardDot, DotKind, FretWindow } from './boardModel';
import { labelInk, mapShade, mix } from './color';

/** Along the neck: space per fret and for the open strings. */
const FRET_LENGTH = 38;
const OPEN_LENGTH = 34;
/**
 * Across the neck. This is the hard cap on how big a note can be drawn — two notes a string apart
 * at the same fret are exactly this far from each other — so it and `DOT_RADIUS` move together.
 * Widening it widens a vertical board, and the canvas fits whole boards or none: at 1440px three
 * chords fit across with about 13px to spare, so two more pixels here costs a whole column. It
 * stays where it is, and the note grows into the daylight the old radius was leaving unused.
 */
const STRING_GAP = 26;
/**
 * 25 CSS px across at 1440×900, which clears the WCAG 2.2 minimum target of 24. It cannot go much
 * further without `STRING_GAP`: at 13 the notes on neighbouring strings would touch.
 */
const DOT_RADIUS = 12.5;
const PAD_END = 10;
/**
 * Along the neck before the first fret wire, when the window starts up the neck and there is no nut
 * or open-string run to fill that space. Enough that the wire and the focus ring on the first row
 * of notes are not drawn against the edge.
 */
const PAD_HEAD = 8;
const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27];
/** The inlay dots at the marker frets; octave frets get two. */
const INLAY_RADIUS = 5;

/** Space for the string names before the open strings, and for the fret numbers beside the neck. */
const MARGINS: Readonly<Record<Orientation, { readonly names: number; readonly numbers: number }>> = {
  horizontal: { names: 30, numbers: 24 },
  // A vertical board spends its numbers margin on width, which is the dimension the canvas rations,
  // so it is trimmed to what a two-digit fret number actually needs.
  vertical: { names: 22, numbers: 22 },
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
  /** Frets to draw. Defaults to the whole neck from the capo, which is what the scale wizard wants. */
  readonly window?: FretWindow;
}

/** Radius of the ring drawn around each clicked note. */
const RING_GAP = 2.5;

/**
 * What turns a position into a toggle button. Spelled out rather than taken from `SVGProps`,
 * because a position is a group on one cell and a rect on the next and the two element types share
 * no `SVGProps` shape — the `ref` on each is typed to its own element.
 */
interface PositionControl {
  readonly role: 'button';
  readonly tabIndex: 0 | -1;
  readonly 'aria-label': string;
  readonly 'aria-pressed': boolean;
  readonly onClick: () => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<SVGElement>) => void;
}

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
 * Only the frets in `window` are drawn. A window that starts at the capo shows the nut, the string
 * names and the open strings, as the whole neck always did; one that starts further up has no nut
 * to orient by and gets a position marker instead — the number of its first fret beside the neck,
 * the way a printed chord chart does. Nothing outside the window is rendered at all, so a board is
 * the size of the shape on it rather than the size of the instrument.
 *
 * Clicked notes stand apart from map notes: a lit gradient in the box color inside a crisp ring.
 *
 * Each position is a toggle button: the whole board is one tab stop, the arrow keys walk the grid
 * of strings and frets, and Enter or Space clicks the note under the cursor. A position with
 * nothing drawn on it is a single rect covering its cell, which is both the cheapest element that
 * can carry all of that and a far bigger target than the note it stands in for.
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
  window: drawn,
}: FretboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const coreFill = `dot-core-${uid}`;
  const ringRadius = DOT_RADIUS + RING_GAP;
  const vertical = orientation === 'vertical';
  const stringCount = tuning.length;
  const margins = MARGINS[orientation];

  // Clamped rather than trusted: a window from somewhere else must not be able to draw a board with
  // no frets on it, or frets the dots do not cover.
  const firstFret = Math.min(Math.max(drawn?.first ?? capo, capo), Math.max(capo, fretCount));
  const lastFret = Math.min(Math.max(drawn?.last ?? fretCount, firstFret), Math.max(capo, fretCount));
  /** The window shows the open strings, so the board is drawn with a nut and the string names. */
  const atNut = firstFret === capo;
  /**
   * The wire that heads the drawing: the nut itself when the open strings are on show, otherwise
   * the wire below the window's first fret, which bounds its first row of cells.
   */
  const headFret = atNut ? 0 : firstFret - 1;

  /**
   * Where fret 0's wire sits. With the open strings on show that is the head of the board, after
   * the string names and the open-string run; with the window further up the neck the head is the
   * wire below it instead, so fret 0 falls off the front and this goes negative. `alongOf` is the
   * same either way — nothing before `headFret` is drawn.
   */
  const nut = atNut ? margins.names + OPEN_LENGTH : PAD_HEAD - headFret * FRET_LENGTH;
  const neckStart = nut + headFret * FRET_LENGTH;
  const neckEnd = nut + lastFret * FRET_LENGTH;
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
  /** The cell a position owns: one fret along the neck by one string gap across it. */
  const cellOf = (dot: BoardDot) => {
    const across = acrossOf(dot.string);
    const start = dot.fret === 0 ? nut - OPEN_LENGTH : nut + (dot.fret - 1) * FRET_LENGTH;
    const end = dot.fret === 0 ? nut : nut + dot.fret * FRET_LENGTH;
    return area(start, end, across - STRING_GAP / 2, across + STRING_GAP / 2);
  };

  const weak = mapShade(color);
  const strongInk = labelInk(color);
  const weakInk = labelInk(weak);
  const capoWire = nut + capo * FRET_LENGTH;
  const markerFrets = MARKER_FRETS.filter((fret) => fret >= (atNut ? 0 : firstFret) && fret <= lastFret);
  /**
   * Centred across the neck; an octave fret's pair straddles that centre, about a quarter and three
   * quarters of the way across, as the pair on a real neck does.
   *
   * Each of the pair is snapped to the middle of a string gap, because an inlay belongs between the
   * strings and not under one. A whole string gap either side of the centre — what this used to be
   * — lands both of them exactly on a string whenever the neck has an odd number of strings, which
   * the 7-string and the 5-string bass both do; so does a plain quarter of the width.
   */
  const gaps = Math.max(1, stringCount - 1);
  const inlayGap = Math.min(gaps - 1, Math.max(0, Math.round(gaps / 4 - 0.5)));
  const neckMiddle = (firstString + lastString) / 2;
  const inlayOffset = (gaps / 2 - inlayGap - 0.5) * STRING_GAP;

  const boardRef = useRef<SVGSVGElement>(null);
  /** Where the roving tabindex sits once the user has moved or clicked, as `string:fret`. */
  const [cursor, setCursor] = useState<string | null>(null);
  const keyOf = (position: FretPosition) => `${position.string}:${position.fret}`;

  /**
   * Only the positions inside the window exist as far as the rest of this component is concerned:
   * they are what is drawn, what the tab stop may sit on, and where the arrow keys can go.
   */
  const shown = dots.filter((dot) => dot.fret >= firstFret && dot.fret <= lastFret);

  /**
   * The board is one tab stop. Tabbing in lands on the position the user last worked on; before
   * that on the first note of the chord, so a board with a chord on it opens on the chord rather
   * than in the empty corner by the nut; and on a bare board on the first position. A cursor left
   * over from a board that has since changed shape — a shorter neck, a capo, a different tuning,
   * a window that has moved — is dropped rather than leaving the board with no tab stop at all.
   */
  const landing = shown.find((dot) => dot.selected) ?? shown.at(0);
  const tabStop =
    cursor !== null && shown.some((dot) => keyOf(dot) === cursor) ? cursor : landing ? keyOf(landing) : null;

  /** Moves the cursor, unless the move runs off the board: then it stays where it is. */
  const moveTo = (position: FretPosition) => {
    const key = keyOf(position);
    const target = boardRef.current?.querySelector<SVGGraphicsElement>(`[data-position="${key}"]`);
    if (!target) return;
    setCursor(key);
    target.focus();
  };

  /** The fret at one end of a string, for Home and End. The drawn frets start at the window. */
  const endFret = (string: number, last: boolean) => {
    let found: number | null = null;
    for (const dot of shown) {
      if (dot.string === string && (found === null || (last ? dot.fret > found : dot.fret < found))) found = dot.fret;
    }
    return found;
  };

  const onPositionKeyDown = (event: ReactKeyboardEvent<SVGElement>, dot: BoardDot) => {
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
   * What makes a position a control, whichever element it is drawn as. In view mode it is
   * undefined: a position is then a drawing, with no role, no tab stop and no handlers, exactly as
   * nothing there is clickable. The board's own aria-label still says what is on show.
   *
   * Strings are numbered as players number them, 1 being the highest-sounding, which is the reverse
   * of the index the board draws from.
   */
  const controlProps = (dot: BoardDot): PositionControl | undefined => {
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

  // A board showing the whole neck says so by saying nothing; a windowed one names the frets it
  // holds, which is the only place a screen reader can learn that the rest of the neck is missing.
  const cropped = firstFret !== capo || lastFret !== fretCount;
  const showing = atNut ? `, showing up to fret ${lastFret}` : `, showing frets ${firstFret} to ${lastFret}`;

  return (
    <svg
      ref={boardRef}
      className={interactive ? 'fretboard' : 'fretboard is-static'}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label={`Fretboard, ${stringCount} strings, ${fretCount} frets${capo > 0 ? `, capo at fret ${capo}` : ''}${cropped ? showing : ''}`}
    >
      <defs>
        <radialGradient id={coreFill} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={mix(color, '#FFFFFF', 0.45)} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={mix(color, '#1E1E1E', 0.7)} />
        </radialGradient>
      </defs>
      {capo > 0 && atNut && (
        <rect
          className="capo-covered"
          {...area(nut - OPEN_LENGTH, capoWire - FRET_LENGTH, firstString - DOT_RADIUS, lastString + DOT_RADIUS)}
          rx={6}
        />
      )}

      {fretMarkers &&
        markerFrets.flatMap((fret) =>
          (fret % 12 === 0 ? [neckMiddle - inlayOffset, neckMiddle + inlayOffset] : [neckMiddle]).map((across, i) => {
            const at = point(alongOf(fret), across);
            return <circle key={`inlay-${fret}-${i}`} className="inlay" cx={at.x} cy={at.y} r={INLAY_RADIUS} />;
          }),
        )}

      {tuning.map((midi, string) => {
        const across = acrossOf(string);
        const weight = 1 + 0.8 * (1 - string / Math.max(1, stringCount - 1));
        const name = vertical ? point(margins.names / 2 - 1, across) : point(margins.names - 4, across);
        return (
          // A Fragment rather than a group: the parts of a string are only grouped so React can key
          // them, and a board is mostly strings and positions, so a wrapper per string is a node
          // per string spent on nothing.
          <Fragment key={`string-${string}`}>
            {atNut && (
              <>
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
              </>
            )}
            <line className="string" {...segment(neckStart, across, neckEnd, across)} strokeWidth={weight} />
          </Fragment>
        );
      })}

      {Array.from({ length: lastFret - headFret }, (_, i) => headFret + 1 + i).map((fret) => {
        const along = nut + fret * FRET_LENGTH;
        return <line key={`wire-${fret}`} className="wire" {...segment(along, firstString, along, lastString)} />;
      })}
      {atNut ? (
        <line className="nut" {...segment(nut, firstString, nut, lastString)} />
      ) : (
        <line className="wire" {...segment(neckStart, firstString, neckStart, lastString)} />
      )}

      {/* The numbers beside the neck. A window that starts up the neck has no nut to read its
          position from, so its first fret is always numbered, even though the neck would only
          number 3, 5, 7, 9, 12 and their fellows on their own account. */}
      {(atNut ? markerFrets : [firstFret, ...markerFrets.filter((fret) => fret !== firstFret)]).map((fret) => {
        const at = vertical
          ? point(alongOf(fret), margins.numbers - 5)
          : point(alongOf(fret), lastString + DOT_RADIUS + 14);
        const marker = !atNut && fret === firstFret;
        return (
          <text
            key={`marker-${fret}`}
            className={`fret-number${marker ? ' is-position' : fret % 12 === 0 ? ' is-octave' : ''}`}
            x={at.x}
            y={at.y}
            textAnchor={vertical ? 'end' : 'middle'}
            dominantBaseline={vertical ? 'central' : undefined}
          >
            {fret}
          </text>
        );
      })}

      {capo > 0 && atNut && (
        <rect className="capo" {...area(capoWire - 8, capoWire - 2, firstString - 8, lastString + 8)} rx={3} />
      )}

      {shown.map((dot) => {
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
        if (dot.kind === 'empty') {
          // Nothing is drawn here, so the position is the cell itself rather than a group holding
          // an invisible circle and an empty label. One node instead of three, and the pointer gets
          // the whole cell to aim at rather than a dot that is not there to see.
          return (
            <rect
              key={key}
              data-position={key}
              className="position position-empty"
              {...cellOf(dot)}
              rx={4}
              {...controlProps(dot)}
            />
          );
        }
        return (
          <g key={key} data-position={key} className={`position position-${dot.kind}`} {...controlProps(dot)}>
            <circle cx={cx} cy={cy} r={DOT_RADIUS} fill={dot.kind === 'strong' ? color : weak} />
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
