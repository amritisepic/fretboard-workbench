import type { Box, BoxScaleUpdate, Settings } from '../state/workbench';
import {
  closestScale,
  findKey,
  identifyChord,
  pcOf,
  pcSet,
  pitchesAt,
  scaleRefPcSet,
  type ChordEvidence,
  type Midi,
  type PcSet,
  type ScaleRef,
} from '../theory';
import { chordInUse, playablePositions } from './boardModel';

export interface FoundKey {
  readonly key: ScaleRef;
  /** One entry per box, in order. */
  readonly boxes: readonly BoxScaleUpdate[];
}

/**
 * "Find key": the key of the whole progression, then for each box the reference scale closest to
 * that key for its chord (see findKey and closestScale). Returns null when no box has a chord.
 *
 * Chords are named without a scale for finding the key, since the boxes' scales are what is being
 * replaced, then named again with the key as their scale. A box whose automatic name would change
 * under its new scale keeps the name it was given, as a chord pick. Boxes without a chord take the
 * key as their scale.
 */
export function planFoundKey(boxes: readonly Box[], settings: Settings): FoundKey | null {
  const entries = boxes.map((box) => {
    const pitches = pitchesAt(settings.tuning, playablePositions(box, settings));
    return { box, pitches, pcs: pcSet(pitches.map(pcOf)) };
  });
  const nameChord = (box: Box, pitches: readonly Midi[], scale?: PcSet) =>
    chordInUse(identifyChord(pitches, scale === undefined ? {} : { scale }), box.chordOverride);

  const key = findKey(
    entries.flatMap(({ box, pitches, pcs }) => {
      const chord = nameChord(box, pitches);
      return chord ? [{ chord, pcs } satisfies ChordEvidence] : [];
    }),
  );
  if (!key) return null;

  const keyPcs = scaleRefPcSet(key);
  return {
    key,
    boxes: entries.map(({ box, pitches, pcs }): BoxScaleUpdate => {
      const chord = nameChord(box, pitches, keyPcs);
      if (!chord) return { id: box.id, scale: key, chordOverride: box.chordOverride };
      const scale = closestScale(pcs, chord, key);
      const automatic = identifyChord(pitches, { scale: scaleRefPcSet(scale) })[0];
      const keepsName = box.chordOverride === chord.key || automatic?.key === chord.key;
      return { id: box.id, scale, chordOverride: keepsName ? box.chordOverride : chord.key };
    }),
  };
}
