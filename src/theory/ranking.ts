/**
 * Scale ranking for a box's chord (spec §4.5, as amended).
 *
 * - Every row starts on the chord root: each scale family × mode, rooted there, appears once.
 *   Symmetric scales that repeat an interval structure are listed only once.
 * - Rows that are modes of the current key's own collection and contain the whole chord are
 *   pinned above everything else.
 * - Then tier 0 (contains the chord), tier 1 (light misses), tier 2 (everything else, by
 *   intersection size), with the weighted score deciding within a tier.
 */

import { RANKING_WEIGHTS, SCALE_COMMONNESS } from '../data/rankingWeights';
import { SCALE_FAMILIES } from '../data/scales';
import type { ChordCandidate, ChordTone } from './chords';
import { hasPc, intersect, mod12, pcSetFromIntervals, setSize, union, type PcSet, type PitchClass } from './pitch';
import { modeIntervals, modeName, scaleRefPcSet, type ScaleRef } from './scales';
import { chooseTonicSpelling, formatSpelled, type SpelledPc } from './spelling';
import { minTotalMotion } from './voiceleading';

export type ToneRole = keyof typeof RANKING_WEIGHTS.missingTone;

export function toneRole(tone: ChordTone): ToneRole {
  switch (tone.degree) {
    case 1:
      return 'root';
    case 2:
    case 3:
    case 4:
      return 'third';
    case 5:
      return tone.interval === 7 ? 'fifth' : 'alteredFifth';
    case 6:
    case 7:
      return 'seventh';
    default:
      return 'extension';
  }
}

export interface MissingTone {
  readonly pc: PitchClass;
  readonly label: string;
  readonly role: ToneRole;
  readonly weight: number;
}

export type RankTier = 0 | 1 | 2;

export interface RankedScale {
  readonly ref: ScaleRef;
  readonly name: string;
  readonly pcs: PcSet;
  readonly size: number;
  readonly tier: RankTier;
  /** A mode of the key's own collection that contains the whole chord. */
  readonly pinned: boolean;
  readonly intersection: number;
  readonly missing: readonly MissingTone[];
  readonly missingPenalty: number;
  readonly fitTerm: number;
  readonly commonness: number;
  readonly voiceLeadingTerm: number;
  readonly score: number;
}

export interface RankScalesOptions {
  /** Pitch classes of the previous box's chosen scale. */
  readonly previousScale?: PcSet;
  /** Key in effect at this box. */
  readonly key?: ScaleRef;
  /** Spelling of the chord root, shared by every row's tonic. Defaults to a per-scale choice. */
  readonly rootSpelling?: SpelledPc;
}

export interface ScaleRanking {
  readonly rows: readonly RankedScale[];
  /** The smallest non-zero intersections, for the collapsed chromatic-substitution section. */
  readonly distant: readonly RankedScale[];
}

export function scaleCommonness(familyId: string, mode: number): number {
  return SCALE_COMMONNESS[familyId]?.[mode] ?? 0;
}

export function voiceLeadingTerm(scale: PcSet, previous: PcSet): number {
  const combined = setSize(union(scale, previous));
  const size = setSize(scale);
  if (combined === 0 || size === 0) return 0;
  const w = RANKING_WEIGHTS;
  return (
    (w.sharedToneRatio * setSize(intersect(scale, previous))) / combined -
    (w.motionPerVoice * minTotalMotion(scale, previous)) / size
  );
}

/** Ranks scales for a chord: `chordPcs` is the clicked set, `chord` the box's chosen name for it. */
export function rankScales(chordPcs: PcSet, chord: ChordCandidate, options: RankScalesOptions = {}): ScaleRanking {
  const w = RANKING_WEIGHTS;
  const root = chord.root;
  const chordSize = setSize(chordPcs);
  const tones = chord.type.tones.filter((t) => hasPc(chordPcs, root + t.interval));
  const keyPcs = options.key ? scaleRefPcSet(options.key) : null;
  const seen = new Set<string>();
  const rows: RankedScale[] = [];

  for (const family of SCALE_FAMILIES) {
    for (let mode = 0; mode < family.intervals.length; mode++) {
      const intervals = modeIntervals(family.id, mode);
      const signature = intervals.join(',');
      if (seen.has(signature)) continue;
      seen.add(signature);

      const pcs = pcSetFromIntervals(intervals, root);
      const missing = tones
        .filter((t) => !hasPc(pcs, root + t.interval))
        .map((t): MissingTone => {
          const role = toneRole(t);
          return { pc: mod12(root + t.interval), label: t.label, role, weight: w.missingTone[role] };
        });
      const missingPenalty = missing.reduce((sum, m) => sum + m.weight, 0);
      const tier: RankTier = missing.length === 0 ? 0 : missingPenalty <= w.tier1MaxMissingPenalty ? 1 : 2;
      const intersection = setSize(intersect(pcs, chordPcs));
      const fitTerm =
        chordSize === 0 ? 0 : intersection / chordSize - (w.fitSizePenalty * (intervals.length - chordSize)) / 12;
      const commonness = scaleCommonness(family.id, mode);
      const vl = options.previousScale === undefined ? 0 : voiceLeadingTerm(pcs, options.previousScale);
      const score = w.fit * fitTerm - w.missing * missingPenalty + w.common * commonness + w.voiceLeading * vl;
      const tonic = options.rootSpelling ?? chooseTonicSpelling(root, intervals);

      rows.push({
        ref: { familyId: family.id, mode, tonic },
        name: `${formatSpelled(tonic)} ${modeName(family.id, mode)}`,
        pcs,
        size: intervals.length,
        tier,
        pinned: keyPcs !== null && tier === 0 && pcs === keyPcs,
        intersection,
        missing,
        missingPenalty,
        fitTerm,
        commonness,
        voiceLeadingTerm: vl,
        score,
      });
    }
  }

  rows.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      a.tier - b.tier ||
      (a.tier === 2 ? b.intersection - a.intersection : 0) ||
      b.score - a.score ||
      b.commonness - a.commonness,
  );
  const distant = rows
    .filter((r) => r.intersection > 0)
    .sort((a, b) => a.intersection - b.intersection || b.score - a.score)
    .slice(0, w.distantCount);
  return { rows, distant };
}
