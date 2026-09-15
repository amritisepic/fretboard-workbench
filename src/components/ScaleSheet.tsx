import { useMemo } from 'react';
import { DEFAULT_BOX_COLOR, type HarmonyNotation, type LabelMode, type Orientation, type Settings } from '../state/workbench';
import {
  chromaticOctave,
  harmonizeScale,
  scaleNotes,
  scaleRefName,
  type ScaleChord,
  type ScaleRef,
  type TopVoice,
} from '../theory';
import { Fretboard } from './Fretboard';
import { scaleBoardDots } from './scaleWizardModel';

/** The parts of the scale wizard, shared by the screen and its export. None of them edit anything. */

const NO_TOGGLE = () => {};

export const TOP_VOICE_NAMES: Readonly<Record<TopVoice, string>> = {
  5: 'Triads',
  7: '7th chords',
  9: '9th chords',
  11: '11th chords',
  13: '13th chords',
};

export function ScaleHeading({ scale }: { readonly scale: ScaleRef }) {
  const notes = scaleNotes(scale);
  return (
    <div className="scale-heading">
      <h2 className="scale-title">{scaleRefName(scale)}</h2>
      <p className="scale-summary">
        {notes.length} notes: {notes.map((n) => n.name).join(' ')}
      </p>
    </div>
  );
}

/** The chromatic octave from the tonic with the scale's notes lit, and each scale note's degree under it. */
export function ChromaticGrid({
  scale,
  showNotes = true,
  showDegrees = true,
}: {
  readonly scale: ScaleRef;
  readonly showNotes?: boolean;
  readonly showDegrees?: boolean;
}) {
  const steps = chromaticOctave(scale);
  return (
    <div className="chromatic-scroll">
      <table className="chromatic" aria-label={`${scaleRefName(scale)} against the chromatic octave`}>
        <tbody>
          {showNotes && (
            <tr>
              <th scope="row">Notes</th>
              {steps.map((step) => (
                <td
                  key={step.semitones}
                  className={['note-cell', step.note ? 'is-in' : '', step.pc === steps[0].pc ? 'is-tonic' : ''].filter(Boolean).join(' ')}
                >
                  {step.name}
                </td>
              ))}
            </tr>
          )}
          {showDegrees && (
            <tr>
              <th scope="row">Degrees</th>
              {steps.map((step) => (
                <td key={step.semitones} className={step.note ? 'degree-cell is-in' : 'degree-cell'}>
                  {step.note?.label ?? ''}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ScaleBoard({
  scale,
  settings,
  labelMode,
  orientation,
}: {
  readonly scale: ScaleRef;
  readonly settings: Settings;
  readonly labelMode: LabelMode;
  readonly orientation: Orientation;
}) {
  const dots = useMemo(() => scaleBoardDots(scale, settings, labelMode), [scale, settings, labelMode]);
  return (
    <div className="fretboard-scroll scale-board">
      <Fretboard
        tuning={settings.tuning}
        fretCount={settings.fretCount}
        capo={settings.capo}
        orientation={orientation}
        fretMarkers={settings.fretMarkers}
        dots={dots}
        color={DEFAULT_BOX_COLOR}
        interactive={false}
        onToggle={NO_TOGGLE}
      />
    </div>
  );
}

function Numeral({ chord, notation }: { readonly chord: ScaleChord; readonly notation: HarmonyNotation }) {
  if (notation === 'jazz') return <>{chord.jazz}</>;
  const { numeral, figure } = chord.classical;
  return (
    <span className="function-text">
      {numeral}
      {figure && <sup className="figure">{figure}</sup>}
    </span>
  );
}

/** The chord on each scale degree: numeral, symbol, notes and the degrees they sit on. */
export function ChordTable({
  scale,
  topVoice,
  notation,
}: {
  readonly scale: ScaleRef;
  readonly topVoice: TopVoice;
  readonly notation: HarmonyNotation;
}) {
  const chords = useMemo(() => harmonizeScale(scale, topVoice), [scale, topVoice]);
  return (
    <div className="chord-table-scroll">
      <table className="chord-table">
        <thead>
          <tr>
            <th scope="col">Numeral</th>
            <th scope="col">Chord</th>
            <th scope="col">Notes</th>
            <th scope="col">Degrees</th>
          </tr>
        </thead>
        <tbody>
          {chords.map((chord) => (
            <tr key={chord.root.pc}>
              <td className="chord-numeral">
                <Numeral chord={chord} notation={notation} />
              </td>
              <th scope="row" className="chord-name">
                {chord.name}
              </th>
              <td>
                <span className="chord-tones">
                  {chord.tones.map((tone) => (
                    <span key={tone.chordDegree} className="chord-tone">
                      {tone.note.name}
                    </span>
                  ))}
                </span>
              </td>
              <td>
                <span className="chord-tones">
                  {chord.tones.map((tone) => (
                    <span key={tone.chordDegree} className="chord-tone">
                      {tone.note.label}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
