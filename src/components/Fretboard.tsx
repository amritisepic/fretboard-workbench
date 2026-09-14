import { memo, useId, type CSSProperties } from 'react';
import type { Orientation } from '../state/workbench';
import { pitchName, type FretPosition, type Tuning } from '../theory';
import type { BoardDot } from './boardModel';
import { labelInk, mapShade, mix } from './color';

/** Along the neck: space per fret and for the open strings. */
const FRET_LENGTH = 38;
const OPEN_LENGTH = 34;
/** Across the neck. */
const STRING_GAP = 26;
const DOT_RADIUS = 11;
const PAD_END = 10;
const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27];

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
  readonly dots: readonly BoardDot[];
  readonly color: string;
  /** False in view mode: nothing responds to clicks. */
  readonly interactive: boolean;
  readonly onToggle: (position: FretPosition) => void;
}

/** Radius of the ring drawn around each clicked note. */
const RING_GAP = 3;
/** Length of the travelling highlight on that ring, as a share of its circumference. */
const ORBIT_SHARE = 0.26;

/**
 * Horizontal boards run the frets across the page with the highest string on top, as in tab.
 * Vertical boards run them down the page with the lowest string on the left, as in a chord chart.
 * Geometry is worked out along and across the neck, then mapped to x and y.
 *
 * Clicked notes stand apart from map notes: a lit gradient in the box color, a crisp ring, a slow
 * pulse and a highlight travelling round the ring. Each note's animation starts at its own point in
 * the cycle, so a chord shimmers rather than blinking in unison.
 */
export const Fretboard = memo(function Fretboard({
  tuning,
  fretCount,
  capo,
  orientation,
  dots,
  color,
  interactive,
  onToggle,
}: FretboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const coreFill = `dot-core-${uid}`;
  const orbitStroke = `dot-orbit-${uid}`;
  const ringRadius = DOT_RADIUS + RING_GAP;
  const ringLength = 2 * Math.PI * ringRadius;
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

  return (
    <svg
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
        <linearGradient id={orbitStroke} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(color, '#FFFFFF', 0.2)} stopOpacity="0" />
          <stop offset="1" stopColor={mix(color, '#FFFFFF', 0.2)} stopOpacity="1" />
        </linearGradient>
      </defs>
      {capo > 0 && (
        <rect
          className="capo-covered"
          {...area(nut - OPEN_LENGTH, capoWire - FRET_LENGTH, firstString - DOT_RADIUS, lastString + DOT_RADIUS)}
          rx={6}
        />
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

      {MARKER_FRETS.filter((fret) => fret <= fretCount).map((fret) => {
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
        const toggle = interactive ? () => onToggle({ string: dot.string, fret: dot.fret }) : undefined;
        if (dot.selected) {
          // A negative delay starts each note part-way through the cycle.
          const phase: CSSProperties = { ['--dot-delay' as string]: `${-((dot.string * 0.61 + dot.fret * 0.23) % 3).toFixed(2)}s` };
          return (
            <g key={`${dot.string}:${dot.fret}`} className="position position-strong is-clicked" style={phase}>
              <circle className="dot-halo" cx={cx} cy={cy} r={DOT_RADIUS} fill={color} />
              <circle className="dot-ring" cx={cx} cy={cy} r={ringRadius} stroke={color} />
              <circle
                className="dot-orbit"
                cx={cx}
                cy={cy}
                r={ringRadius}
                stroke={`url(#${orbitStroke})`}
                strokeDasharray={`${(ringLength * ORBIT_SHARE).toFixed(1)} ${(ringLength * (1 - ORBIT_SHARE)).toFixed(1)}`}
              />
              <circle className="dot-core" cx={cx} cy={cy} r={DOT_RADIUS} fill={`url(#${coreFill})`} onClick={toggle} />
              <text className={dot.label.length > 2 ? 'dot-label is-long' : 'dot-label'} x={cx} y={cy} fill={strongInk}>
                {dot.label}
              </text>
            </g>
          );
        }
        return (
          <g key={`${dot.string}:${dot.fret}`} className={`position position-${dot.kind}`}>
            <circle
              cx={cx}
              cy={cy}
              r={DOT_RADIUS}
              fill={dot.kind === 'strong' ? color : dot.kind === 'weak' ? weak : undefined}
              onClick={toggle}
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
