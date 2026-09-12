import type { Box } from '../state/workbench';
import {
  chordRootSpelling,
  formatScaleDegree,
  formatSpelled,
  hasPc,
  modeIntervals,
  pcOfSpelled,
  rankScales,
  scaleRefPcSet,
  spellScale,
  type PcSet,
  type RankedScale,
  type ScaleContext,
  type ScaleRef,
} from '../theory';
import type { BoxView } from './boardModel';

export interface StripCell {
  readonly label: string;
  readonly chordTone: boolean;
}

export interface RankingRow {
  readonly key: string;
  readonly scale: RankedScale;
  /** One cell per scale degree. */
  readonly cells: readonly StripCell[];
  /** This row is the box's current reference scale. */
  readonly selected: boolean;
  /** "no ♭5" for scales missing chord tones, otherwise "". */
  readonly missingNote: string;
}

export type RankingSectionId = 'pinned' | 'tier0' | 'tier1' | 'tier2';

export interface RankingSection {
  readonly id: RankingSectionId;
  readonly title: string;
  readonly rows: readonly RankingRow[];
}

export interface RankingView {
  readonly chordName: string;
  /** Non-empty sections, in display order. */
  readonly sections: readonly RankingSection[];
  /** The collapsed "maximally distant" rows. */
  readonly distant: readonly RankingRow[];
  readonly comparedWithPrevious: boolean;
}

const SECTION_TITLES: Record<RankingSectionId, string> = {
  pinned: 'In the key',
  tier0: 'Contains the chord',
  tier1: 'Missing tones',
  tier2: 'Everything else',
};

/** The scale ranking list for a box in scale mode, or null when there is no chord to rank against. */
export function buildRankingView(
  box: Box,
  view: BoxView,
  previousScale: PcSet | undefined,
  key?: ScaleRef,
): RankingView | null {
  const { chord } = view;
  if (!chord) return null;

  const ranking = rankScales(view.chordPcs, chord, {
    rootSpelling: chordRootSpelling(chord, view.ctx),
    previousScale,
    key,
  });
  const currentPcs = scaleRefPcSet(box.scale);
  const currentTonic = pcOfSpelled(box.scale.tonic);

  const toRow = (scale: RankedScale): RankingRow => {
    const ctx: ScaleContext = { tonic: scale.ref.tonic, intervals: modeIntervals(scale.ref.familyId, scale.ref.mode) };
    const cells = spellScale(ctx.tonic, ctx.intervals).map((note) => {
      const pc = pcOfSpelled(note);
      return {
        label: box.labelMode === 'names' ? formatSpelled(note) : formatScaleDegree(pc, ctx),
        chordTone: hasPc(view.chordPcs, pc),
      };
    });
    return {
      key: `${scale.ref.familyId}:${scale.ref.mode}`,
      scale,
      cells,
      selected: scale.pcs === currentPcs && pcOfSpelled(scale.ref.tonic) === currentTonic,
      missingNote: scale.missing.length > 0 ? `no ${scale.missing.map((m) => m.label).join(', ')}` : '',
    };
  };

  const rows = ranking.rows.map(toRow);
  const sectionOf = (row: RankingRow): RankingSectionId =>
    row.scale.pinned ? 'pinned' : row.scale.tier === 0 ? 'tier0' : row.scale.tier === 1 ? 'tier1' : 'tier2';
  const sections = (Object.keys(SECTION_TITLES) as RankingSectionId[])
    .map((id) => ({ id, title: SECTION_TITLES[id], rows: rows.filter((row) => sectionOf(row) === id) }))
    .filter((section) => section.rows.length > 0);

  return {
    chordName: view.title,
    sections,
    distant: ranking.distant.map(toRow),
    comparedWithPrevious: previousScale !== undefined,
  };
}
