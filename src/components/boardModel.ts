import type { Box, Settings } from '../state/workbench';
import {
  chordName,
  chordSpellingHint,
  formatScaleDegree,
  hasPc,
  identifyChord,
  pcAt,
  pcSetAt,
  pcsOf,
  pitchesAt,
  positionKey,
  scaleRefContext,
  scaleRefName,
  scaleRefPcSet,
  setSize,
  spell,
  type ChordCandidate,
  type FretPosition,
  type PcSet,
  type PitchClass,
  type ScaleContext,
} from '../theory';

/** `strong` = full-saturation dot, `weak` = the duller map shade, `empty` = clickable but undrawn. */
export type DotKind = 'empty' | 'weak' | 'strong';

export interface BoardDot {
  readonly string: number;
  readonly fret: number;
  readonly pc: PitchClass;
  readonly kind: DotKind;
  /** Clicked by the user, as opposed to filled in by the map. */
  readonly selected: boolean;
  readonly label: string;
}

export interface BoxView {
  /** One entry per string × playable fret: from the capo (or the open string) to the last fret. */
  readonly dots: readonly BoardDot[];
  /** Every plausible chord name, best first. */
  readonly candidates: readonly ChordCandidate[];
  /** The chord in use: the sidebar override while it matches, otherwise the best candidate. */
  readonly chord: ChordCandidate | null;
  /** Spelling context: the reference scale plus the chord in use. */
  readonly ctx: ScaleContext;
  readonly chordPcs: PcSet;
  readonly scalePcs: PcSet;
  /** Chord name, a single note name, or "" when nothing is clicked. */
  readonly title: string;
  readonly scaleName: string;
}

/** The clicked positions playable on the current board: an existing string, from the capo to the last fret. */
export function playablePositions(box: Box, settings: Settings): FretPosition[] {
  const { tuning, fretCount, capo } = settings;
  return box.positions.filter((p) => p.string < tuning.length && p.fret >= capo && p.fret <= fretCount);
}

/** The chord in use: the sidebar pick while it matches, otherwise the best reading. */
export function chordInUse(candidates: readonly ChordCandidate[], override: string | null): ChordCandidate | null {
  return candidates.find((c) => c.key === override) ?? candidates[0] ?? null;
}

/** Everything a box renders, derived from its state and the global settings. */
export function buildBoxView(box: Box, settings: Settings): BoxView {
  const { tuning, fretCount, capo } = settings;
  const positions = playablePositions(box, settings);
  const chordPcs = pcSetAt(tuning, positions);
  const scalePcs = scaleRefPcSet(box.scale);
  const candidates = identifyChord(pitchesAt(tuning, positions), { scale: scalePcs });
  const chord = chordInUse(candidates, box.chordOverride);
  const ctx = scaleRefContext(box.scale, chord ? chordSpellingHint(chord) : undefined);

  const labels = new Map<PitchClass, string>();
  const labelFor = (pc: PitchClass) => {
    let label = labels.get(pc);
    if (label === undefined) {
      label = box.labelMode === 'names' ? spell(pc, ctx) : formatScaleDegree(pc, ctx);
      labels.set(pc, label);
    }
    return label;
  };

  const clicked = new Set(positions.map(positionKey));
  const dots: BoardDot[] = [];
  for (let string = 0; string < tuning.length; string++) {
    for (let fret = capo; fret <= fretCount; fret++) {
      const pc = pcAt(tuning, string, fret);
      const selected = clicked.has(positionKey({ string, fret }));
      const kind = dotKind(box, pc, selected, chordPcs, scalePcs);
      dots.push({ string, fret, pc, kind, selected, label: kind === 'empty' ? '' : labelFor(pc) });
    }
  }

  let title = '';
  if (setSize(chordPcs) > 0) {
    title = chord ? chordName(chord, ctx) : pcsOf(chordPcs).map((pc) => spell(pc, ctx)).join(' ');
  }
  return { dots, candidates, chord, ctx, chordPcs, scalePcs, title, scaleName: scaleRefName(box.scale) };
}

function dotKind(box: Box, pc: PitchClass, selected: boolean, chordPcs: PcSet, scalePcs: PcSet): DotKind {
  if (selected) return 'strong';
  if (!box.fill.on) return 'empty';
  // Fill inversion is an arpeggio map; fill scale keeps chord tones at full strength.
  if (hasPc(chordPcs, pc)) return box.fill.mode === 'inversion' ? 'weak' : 'strong';
  return box.fill.mode === 'scale' && hasPc(scalePcs, pc) ? 'weak' : 'empty';
}

const viewCache = new WeakMap<Box, { readonly settings: Settings; readonly view: BoxView }>();

/** Memoised `buildBoxView`, shared by the box and its sidebar. Store updates replace changed objects. */
export function getBoxView(box: Box, settings: Settings): BoxView {
  const cached = viewCache.get(box);
  if (cached && cached.settings === settings) return cached.view;
  const view = buildBoxView(box, settings);
  viewCache.set(box, { settings, view });
  return view;
}
