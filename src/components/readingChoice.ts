import { useWorkbench, type Box } from '../state/workbench';
import { functionScale, sameScale, type BoxAnalysis, type Reading, type ScaleRef } from '../theory';
import type { BoxView } from './boardModel';

/**
 * Pins a reading of a box's chord, or with null lets the analysis choose again; either clears the
 * box's key pin. While the box's scale is still the one the old reading suggests, the scale follows
 * to the one the new reading suggests, so choosing B♭ major for F7 also gives it F Mixolydian. A
 * scale the user picked stays.
 */
export function pinReading(box: Box, view: BoxView, analysis: BoxAnalysis, reading: Reading | null): void {
  const { setReadingPin, setKeyPin, setScale } = useWorkbench.getState();
  const suggested = (r: Reading): ScaleRef | null =>
    view.chord ? functionScale(view.chordPcs, view.chord, { ...analysis, reading: r }) : null;
  setKeyPin(box.id, null);
  setReadingPin(box.id, reading?.pinId ?? null);
  if (!reading) return;
  const before = suggested(analysis.reading);
  const after = suggested(reading);
  if (before && after && sameScale(box.scale, before) && !sameScale(box.scale, after)) setScale(box.id, after);
}
