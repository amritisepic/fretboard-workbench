import type { LabelMode, Settings } from '../state/workbench';
import { pcAt, pcOfSpelled, scaleNotes, type ScaleRef } from '../theory';
import type { BoardDot } from './boardModel';

/**
 * The scale on the fretboard, as the workbench fills a scale: every playable position of a scale note,
 * the tonic at full strength and the other notes in the map shade. Labels are note names, or degrees
 * counted from major with the tonic as R, matching the wizard's degree boxes.
 */
export function scaleBoardDots(
  scale: ScaleRef,
  settings: Pick<Settings, 'tuning' | 'fretCount' | 'capo'>,
  labelMode: LabelMode,
): BoardDot[] {
  const { tuning, fretCount, capo } = settings;
  const notes = scaleNotes(scale);
  const tonic = pcOfSpelled(scale.tonic);
  const dots: BoardDot[] = [];
  for (let string = 0; string < tuning.length; string++) {
    for (let fret = capo; fret <= fretCount; fret++) {
      const pc = pcAt(tuning, string, fret);
      const note = notes.find((n) => n.pc === pc);
      dots.push({
        string,
        fret,
        pc,
        selected: false,
        kind: note ? (pc === tonic ? 'strong' : 'weak') : 'empty',
        label: note ? (labelMode === 'names' ? note.name : note.label) : '',
      });
    }
  }
  return dots;
}
