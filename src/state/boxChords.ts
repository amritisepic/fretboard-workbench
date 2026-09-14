/** The chord a box's clicked notes make, and the key in effect across the boxes. Shared by the store and the views. */

import {
  identifyChord,
  pcOf,
  pcSet,
  pitchesAt,
  planKeys,
  scaleRefPcSet,
  type ChordCandidate,
  type FretPosition,
  type KeyPlan,
  type Midi,
  type PcSet,
  type ScaleRef,
} from '../theory';
import type { Box, Settings } from './workbench';

/** The clicked positions playable on the current board: an existing string, from the capo to the last fret. */
export function playablePositions(box: Box, settings: Settings): FretPosition[] {
  const { tuning, fretCount, capo } = settings;
  return box.positions.filter((p) => p.string < tuning.length && p.fret >= capo && p.fret <= fretCount);
}

/** The chord in use: the sidebar pick while it matches, otherwise the best reading. */
export function chordInUse(candidates: readonly ChordCandidate[], override: string | null): ChordCandidate | null {
  return candidates.find((c) => c.key === override) ?? candidates[0] ?? null;
}

export interface BoxChord {
  /** Sounding pitches of the playable clicked notes. */
  readonly pitches: readonly Midi[];
  readonly pcs: PcSet;
  /** Every plausible name, best first; chords that fit the reference scale score higher. */
  readonly candidates: readonly ChordCandidate[];
  readonly chord: ChordCandidate | null;
}

const cache = new WeakMap<Box, { readonly settings: Settings; readonly value: BoxChord }>();

/** Memoised per box and settings. Store updates replace changed objects. */
export function boxChord(box: Box, settings: Settings): BoxChord {
  const cached = cache.get(box);
  if (cached && cached.settings === settings) return cached.value;
  const pitches = pitchesAt(settings.tuning, playablePositions(box, settings));
  const candidates = identifyChord(pitches, { scale: scaleRefPcSet(box.scale) });
  const value = { pitches, pcs: pcSet(pitches.map(pcOf)), candidates, chord: chordInUse(candidates, box.chordOverride) };
  cache.set(box, { settings, value });
  return value;
}

let lastPlan: {
  readonly key: ScaleRef;
  readonly boxes: readonly Box[];
  readonly settings: Settings;
  readonly plan: KeyPlan;
} | null = null;

/**
 * The key in effect at each box and the analysis behind it (see planKeys), from the preset's key and
 * each box's scale, chord and pins. The canvas, the sidebar and the store ask for the same plan
 * after each change, so the last one is kept.
 */
export function keyPlanOf(key: ScaleRef, boxes: readonly Box[], settings: Settings): KeyPlan {
  if (lastPlan && lastPlan.key === key && lastPlan.boxes === boxes && lastPlan.settings === settings) return lastPlan.plan;
  const plan = planKeys(
    key,
    boxes.map((box) => {
      const { chord, pcs } = boxChord(box, settings);
      return { scale: box.scale, chord: chord ? { chord, pcs } : null, keyPin: box.keyPin, readingPin: box.readingPin };
    }),
  );
  lastPlan = { key, boxes, settings, plan };
  return plan;
}
