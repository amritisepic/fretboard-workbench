/**
 * Pitch-class voice leading (spec §4.6): a minimum-cost matching between two pitch-class sets,
 * where the cost of moving a voice is its circular semitone distance (0–6). Members of the larger
 * set left unmatched are reported as added or dropped tones.
 */

import { circularDistance, mod12, pcsOf, type PcSet, type PitchClass } from './pitch';

export type MotionKind = 'common' | 'step' | 'leap';

export interface VoiceMotion {
  readonly from: PitchClass;
  readonly to: PitchClass;
  /** Shortest signed motion in semitones, −5…+6 (a tritone counts as +6). */
  readonly semitones: number;
  readonly distance: number;
  readonly kind: MotionKind;
}

export interface VoiceLeading {
  /** Matched voices, ordered by their starting pitch class. */
  readonly motions: readonly VoiceMotion[];
  /** Tones of the second set with no partner in the first. */
  readonly added: readonly PitchClass[];
  /** Tones of the first set with no partner in the second. */
  readonly dropped: readonly PitchClass[];
  readonly totalMotion: number;
}

export function motionKind(distance: number): MotionKind {
  if (distance === 0) return 'common';
  return distance <= 2 ? 'step' : 'leap';
}

export function signedMotion(from: PitchClass, to: PitchClass): number {
  const d = mod12(to - from);
  return d > 6 ? d - 12 : d;
}

/**
 * Integer cost for the matching. Total motion comes first. Ties go to fewer moving voices (more
 * common tones), then to smaller individual moves. Each weight dominates everything below it for
 * up to 12 voices.
 */
function matchingCost(distance: number): number {
  return distance * 100_000 + (distance > 0 ? 1_000 : 0) + distance * distance;
}

/**
 * Matches every member of `small` to a distinct member of `large` at minimum total cost.
 * Exhaustive search over (index, used-mask) with memoisation: at most 12 × 4096 states.
 * Returns, for each index of `small`, the chosen index into `large`.
 */
function assign(small: readonly PitchClass[], large: readonly PitchClass[]): number[] {
  const memo = new Map<number, number>();
  const best = (i: number, used: number): number => {
    if (i === small.length) return 0;
    const key = i * 4096 + used;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let min = Infinity;
    for (let j = 0; j < large.length; j++) {
      if (used & (1 << j)) continue;
      const cost = matchingCost(circularDistance(small[i], large[j])) + best(i + 1, used | (1 << j));
      if (cost < min) min = cost;
    }
    memo.set(key, min);
    return min;
  };

  const choice: number[] = [];
  let used = 0;
  for (let i = 0; i < small.length; i++) {
    const target = best(i, used);
    for (let j = 0; j < large.length; j++) {
      if (used & (1 << j)) continue;
      if (matchingCost(circularDistance(small[i], large[j])) + best(i + 1, used | (1 << j)) === target) {
        choice.push(j);
        used |= 1 << j;
        break;
      }
    }
  }
  return choice;
}

export function voiceLeading(from: PcSet, to: PcSet): VoiceLeading {
  const a = pcsOf(from);
  const b = pcsOf(to);
  const forward = a.length <= b.length;
  const small = forward ? a : b;
  const large = forward ? b : a;
  const choice = assign(small, large);

  const motions = small
    .map((pc, i): VoiceMotion => {
      const partner = large[choice[i]];
      const origin = forward ? pc : partner;
      const target = forward ? partner : pc;
      const distance = circularDistance(origin, target);
      return { from: origin, to: target, semitones: signedMotion(origin, target), distance, kind: motionKind(distance) };
    })
    .sort((x, y) => x.from - y.from);

  const matched = new Set(choice);
  const unmatched = large.filter((_, j) => !matched.has(j));
  return {
    motions,
    added: forward ? unmatched : [],
    dropped: forward ? [] : unmatched,
    totalMotion: motions.reduce((sum, m) => sum + m.distance, 0),
  };
}

export function minTotalMotion(a: PcSet, b: PcSet): number {
  return voiceLeading(a, b).totalMotion;
}
