import { parsePitchName } from '../theory/fretboard';

export interface TuningPreset {
  readonly id: string;
  readonly name: string;
  /** Open-string MIDI pitches, lowest string first. */
  readonly tuning: readonly number[];
}

const preset = (id: string, name: string, notes: string): TuningPreset => ({
  id,
  name,
  tuning: notes.split(' ').map(parsePitchName),
});

export const TUNING_PRESETS: readonly TuningPreset[] = [
  preset('standard', 'Standard', 'E2 A2 D3 G3 B3 E4'),
  preset('dropD', 'Drop D', 'D2 A2 D3 G3 B3 E4'),
  preset('dropC', 'Drop C', 'C2 G2 C3 F3 A3 D4'),
  preset('sevenB', '7-string B standard', 'B1 E2 A2 D3 G3 B3 E4'),
  preset('eightFs', '8-string F♯ standard', 'F♯1 B1 E2 A2 D3 G3 B3 E4'),
  preset('bass4', '4-string bass', 'E1 A1 D2 G2'),
  preset('bass5', '5-string bass', 'B0 E1 A1 D2 G2'),
  preset('bass6', '6-string bass', 'B0 E1 A1 D2 G2 C3'),
  preset('dadgad', 'DADGAD', 'D2 A2 D3 G3 A3 D4'),
  preset('openG', 'Open G', 'D2 G2 D3 G3 B3 D4'),
  preset('openD', 'Open D', 'D2 A2 D3 F♯3 A3 D4'),
];
