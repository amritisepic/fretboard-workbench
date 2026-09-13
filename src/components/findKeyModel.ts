import { chordInUse, playablePositions } from '../state/boxChords';
import type { Box, BoxScaleUpdate, Settings } from '../state/workbench';
import {
  closestScale,
  findKey,
  identifyChord,
  pcOf,
  pcSet,
  pitchesAt,
  scaleRefPcSet,
  type Midi,
  type PcSet,
  type ScaleRef,
} from '../theory';

export interface FoundKey {
  /** The progression's key, which becomes the preset's key. */
  readonly key: ScaleRef;
  /** One entry per box, in order. */
  readonly boxes: readonly BoxScaleUpdate[];
}

/**
 * "Find key": the keys the progression moves through (see findKey), then for each box the reference
 * scale closest to the key at that box, with the chord root as the scale's tonic (see closestScale).
 * Returns null when no box has a chord.
 *
 * Chords are named without a scale for finding the keys, since the boxes' scales are what is being
 * replaced, then named again with the box's key as their scale. A box whose automatic name would
 * change under its new scale keeps the name it was given, as a chord pick. Boxes without a chord
 * take the key at that box as their scale.
 */
export function planFoundKey(boxes: readonly Box[], settings: Settings): FoundKey | null {
  const entries = boxes.map((box) => {
    const pitches = pitchesAt(settings.tuning, playablePositions(box, settings));
    return { box, pitches, pcs: pcSet(pitches.map(pcOf)) };
  });
  const nameChord = (box: Box, pitches: readonly Midi[], scale?: PcSet) =>
    chordInUse(identifyChord(pitches, scale === undefined ? {} : { scale }), box.chordOverride);

  const found = findKey(
    entries.map(({ box, pitches, pcs }) => {
      const chord = nameChord(box, pitches);
      return chord ? { chord, pcs } : null;
    }),
  );
  if (!found) return null;

  return {
    key: found.key,
    boxes: entries.map(({ box, pitches, pcs }, i): BoxScaleUpdate => {
      const keyHere = found.keys[i];
      const chord = nameChord(box, pitches, scaleRefPcSet(keyHere));
      if (!chord) return { id: box.id, scale: keyHere, chordOverride: box.chordOverride };
      const scale = closestScale(pcs, chord, keyHere);
      const automatic = identifyChord(pitches, { scale: scaleRefPcSet(scale) })[0];
      const keepsName = box.chordOverride === chord.key || automatic?.key === chord.key;
      return { id: box.id, scale, chordOverride: keepsName ? box.chordOverride : chord.key };
    }),
  };
}
