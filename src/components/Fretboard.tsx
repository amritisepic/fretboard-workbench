import { memo } from 'react';
import { pitchName, type FretPosition, type Tuning } from '../theory';
import type { BoardDot } from './boardModel';
import { labelInk, mapShade } from './color';

const FRET_WIDTH = 38;
const STRING_GAP = 26;
const OPEN_WIDTH = 34;
const NAME_WIDTH = 30;
const DOT_RADIUS = 11;
const PAD_RIGHT = 10;
const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27];

export interface FretboardProps {
  readonly tuning: Tuning;
  readonly fretCount: number;
  readonly dots: readonly BoardDot[];
  readonly color: string;
  /** Outline clicked notes so they stay distinguishable from filled-in map notes. */
  readonly ringSelected: boolean;
  readonly onToggle: (position: FretPosition) => void;
}

export const Fretboard = memo(function Fretboard({
  tuning,
  fretCount,
  dots,
  color,
  ringSelected,
  onToggle,
}: FretboardProps) {
  const stringCount = tuning.length;
  const nutX = NAME_WIDTH + OPEN_WIDTH;
  const top = DOT_RADIUS + 3;
  const bottom = top + (stringCount - 1) * STRING_GAP;
  const width = nutX + fretCount * FRET_WIDTH + PAD_RIGHT;
  const height = bottom + DOT_RADIUS + 24;

  const xOf = (fret: number) => (fret === 0 ? nutX - OPEN_WIDTH / 2 : nutX + (fret - 0.5) * FRET_WIDTH);
  // Highest string on top, as in tab.
  const yOf = (string: number) => top + (stringCount - 1 - string) * STRING_GAP;

  const weak = mapShade(color);
  const strongInk = labelInk(color);
  const weakInk = labelInk(weak);

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label={`Fretboard, ${stringCount} strings, ${fretCount} frets`}
    >
      {tuning.map((midi, string) => {
        const y = yOf(string);
        const weight = 1 + 0.8 * (1 - string / Math.max(1, stringCount - 1));
        return (
          <g key={`string-${string}`}>
            <text className="string-name" x={NAME_WIDTH - 4} y={y} textAnchor="end" dominantBaseline="central">
              {pitchName(midi)}
            </text>
            <line className="string-stub" x1={NAME_WIDTH + 2} x2={nutX} y1={y} y2={y} strokeWidth={weight} />
            <line className="string" x1={nutX} x2={nutX + fretCount * FRET_WIDTH} y1={y} y2={y} strokeWidth={weight} />
          </g>
        );
      })}

      {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => (
        <line key={`wire-${fret}`} className="wire" x1={nutX + fret * FRET_WIDTH} x2={nutX + fret * FRET_WIDTH} y1={top} y2={bottom} />
      ))}
      <line className="nut" x1={nutX} x2={nutX} y1={top} y2={bottom} />

      {MARKER_FRETS.filter((fret) => fret <= fretCount).map((fret) => (
        <text
          key={`marker-${fret}`}
          className={fret % 12 === 0 ? 'fret-number is-octave' : 'fret-number'}
          x={xOf(fret)}
          y={bottom + DOT_RADIUS + 14}
          textAnchor="middle"
        >
          {fret}
        </text>
      ))}

      {dots.map((dot) => {
        const cx = xOf(dot.fret);
        const cy = yOf(dot.string);
        return (
          <g key={`${dot.string}:${dot.fret}`} className={`position position-${dot.kind}`}>
            <circle
              cx={cx}
              cy={cy}
              r={DOT_RADIUS}
              fill={dot.kind === 'strong' ? color : dot.kind === 'weak' ? weak : undefined}
              data-ring={ringSelected && dot.selected ? '' : undefined}
              onClick={() => onToggle({ string: dot.string, fret: dot.fret })}
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
