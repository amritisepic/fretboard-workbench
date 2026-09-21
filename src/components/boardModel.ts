import { boxChord, playablePositions } from '../state/boxChords';
import type { Box, Settings } from '../state/workbench';
import {
  chordName,
  chordSpellingHint,
  formatScaleDegree,
  hasPc,
  pcAt,
  pcsOf,
  positionKey,
  scaleRefContext,
  scaleRefName,
  scaleRefPcSet,
  setSize,
  spell,
  type ChordCandidate,
  type PcSet,
  type PitchClass,
  type ScaleContext,
  type ScaleRef,
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

/** An inclusive run of frets, as a chord chart shows: `first` and `last` are both drawn. */
export interface FretWindow {
  readonly first: number;
  readonly last: number;
}

/** How many frets a window covers when the shape it holds is shorter than that. */
const MIN_WINDOW_FRETS = 5;

/**
 * A position counts towards the window when something is drawn on it. That is wider than "the user
 * clicked it": a scale or arpeggio fill lights positions nobody clicked, and a window that cropped
 * them would hide most of the map the fill exists to show.
 */
const isDrawn = (dot: BoardDot) => dot.selected || dot.kind !== 'empty';

/**
 * The run of frets worth drawing for a set of dots — the 4-or-5-fret window a printed chord chart
 * uses, rather than the whole neck, nearly all of which is empty grid on a typical voicing.
 *
 * Where a short shape's window grows is a choice. It grows downwards, towards the capo, whenever
 * the whole of the growth fits in the gap between the shape and the capo, so an open-position chord
 * shows the nut instead of floating a fret or two above it; the nut is the landmark a player reads
 * the position from, and it is free to include when the shape is that close to it. Higher up there
 * is no landmark to reach for, so the growth is split and the shape sits centre-ish in its window.
 *
 * A note on an open string is at `capo`, which is the lowest fret there is, so it pins `first` to
 * the capo by itself and needs no rule of its own. A fill that lights the whole neck spans
 * everything, and the window is then the whole neck, which is the honest answer.
 */
/**
 * Frets of room a board keeps on each side of the shape while it can still be edited.
 *
 * A chart window hugs the notes, which is what makes it readable and is right for a board being
 * read. It is a dead end for a board being built on, though: an empty box opens on the first five
 * frets, the window is worked out from the notes, and so nothing the user can reach can ever push
 * it further up the neck.
 *
 * The room is asymmetric because the two directions are not alike. Going up needs it: without it
 * there is no way past the fifth fret at all. Going down needs less, because a window already
 * reaches the nut whenever the shape is near it, and because three frets of room in both directions
 * cost half the density the window was for — measured, it put a laptop back to three chords on
 * screen, which is where the whole neck had it.
 *
 * The board goes back to hugging the shape the moment it stops being edited, so what is read and
 * what is exported is always the tight window.
 */
export const EDIT_REACH_UP = 2;
export const EDIT_REACH_DOWN = 1;

/** `window` with somewhere to go, for a board that can be clicked. */
export function editableWindow(window: FretWindow, capo: number, fretCount: number): FretWindow {
  const lowest = Math.max(0, capo);
  const highest = Math.max(lowest, fretCount);
  // Both ends are clamped into the neck rather than trusted, and `last` is held at or above `first`,
  // so a window from somewhere else cannot come back backwards — a capo past the last fret would
  // otherwise push `first` up while `last` stayed where it was.
  const onNeck = (fret: number) => Math.min(Math.max(fret, lowest), highest);
  const first = onNeck(window.first - EDIT_REACH_DOWN);
  return { first, last: Math.max(first, onNeck(window.last + EDIT_REACH_UP)) };
}

export function fretWindow(
  dots: readonly BoardDot[],
  capo: number,
  fretCount: number,
  minFrets: number = MIN_WINDOW_FRETS,
): FretWindow {
  // Everything below is clamped to this range rather than trusting the arguments, which is what
  // makes `last < first` impossible however odd a neck it is handed.
  const lowest = capo;
  const highest = Math.max(capo, fretCount);
  const span = Math.max(1, Math.min(minFrets, highest - lowest + 1));

  let first = Infinity;
  let last = -Infinity;
  for (const dot of dots) {
    if (!isDrawn(dot)) continue;
    if (dot.fret < first) first = dot.fret;
    if (dot.fret > last) last = dot.fret;
  }

  // Nothing is drawn: an untouched box, or one whose notes all fall off this neck. The window then
  // starts where the playable neck does, so the first click lands in the open position.
  if (first > last) return { first: lowest, last: Math.min(highest, lowest + span - 1) };

  first = Math.min(Math.max(first, lowest), highest);
  last = Math.min(Math.max(last, lowest), highest);

  const short = span - (last - first + 1);
  if (short > 0) {
    const room = first - lowest;
    const down = room <= short ? room : Math.floor(short / 2);
    first -= down;
    last += short - down;
    // Growing upwards can run past the last fret. The window slides back down the neck rather than
    // handing back a window shorter than it was asked for.
    if (last > highest) {
      first = Math.max(lowest, first - (last - highest));
      last = highest;
    }
  }
  return { first, last };
}

export interface BoxView {
  /** One entry per string × playable fret: from the capo (or the open string) to the last fret. */
  readonly dots: readonly BoardDot[];
  /** The frets worth drawing: the run the board's notes occupy, widened to a readable minimum. */
  readonly window: FretWindow;
  /** Every plausible chord name, best first. */
  readonly candidates: readonly ChordCandidate[];
  /** The chord in use: the sidebar override while it matches, otherwise the best candidate. */
  readonly chord: ChordCandidate | null;
  /** Spelling context: the reference scale plus the chord in use. */
  readonly ctx: ScaleContext;
  /** What scale degrees count from: the key in effect or the reference scale (Box.degreeBasis), plus the chord. */
  readonly degreeCtx: ScaleContext;
  readonly chordPcs: PcSet;
  readonly scalePcs: PcSet;
  /** Chord name, a single note name, or "" when nothing is clicked. */
  readonly title: string;
  readonly scaleName: string;
}

/**
 * Everything a box renders, derived from its state, the global settings and the key in effect at the
 * box. Note names are spelled from the reference scale; degrees count from the key unless the box
 * counts them from its scale.
 */
export function buildBoxView(box: Box, settings: Settings, key: ScaleRef = box.scale): BoxView {
  const { tuning, fretCount, capo } = settings;
  const { pcs: chordPcs, candidates, chord } = boxChord(box, settings);
  const scalePcs = scaleRefPcSet(box.scale);
  const hint = chord ? chordSpellingHint(chord) : undefined;
  const ctx = scaleRefContext(box.scale, hint);
  const degreeCtx = box.degreeBasis === 'key' ? scaleRefContext(key, hint) : ctx;

  const labels = new Map<PitchClass, string>();
  const labelFor = (pc: PitchClass) => {
    let label = labels.get(pc);
    if (label === undefined) {
      label = box.labelMode === 'names' ? spell(pc, ctx) : formatScaleDegree(pc, degreeCtx);
      labels.set(pc, label);
    }
    return label;
  };

  const clicked = new Set(playablePositions(box, settings).map(positionKey));
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
  return {
    dots,
    window: fretWindow(dots, capo, fretCount),
    candidates,
    chord,
    ctx,
    degreeCtx,
    chordPcs,
    scalePcs,
    title,
    scaleName: scaleRefName(box.scale),
  };
}

function dotKind(box: Box, pc: PitchClass, selected: boolean, chordPcs: PcSet, scalePcs: PcSet): DotKind {
  if (selected) return 'strong';
  if (!box.fill.on) return 'empty';
  // Fill inversion is an arpeggio map; fill scale keeps chord tones at full strength.
  if (hasPc(chordPcs, pc)) return box.fill.mode === 'inversion' ? 'weak' : 'strong';
  return box.fill.mode === 'scale' && hasPc(scalePcs, pc) ? 'weak' : 'empty';
}

const keyIdentity = (key: ScaleRef) => `${key.familyId}:${key.mode}:${key.tonic.letter}:${key.tonic.accidental}`;

const viewCache = new WeakMap<Box, { readonly settings: Settings; readonly key: string; readonly view: BoxView }>();

/** Memoised `buildBoxView`, shared by the box and its sidebar. Store updates replace changed objects. */
export function getBoxView(box: Box, settings: Settings, key: ScaleRef = box.scale): BoxView {
  const identity = keyIdentity(key);
  const cached = viewCache.get(box);
  if (cached && cached.settings === settings && cached.key === identity) return cached.view;
  const view = buildBoxView(box, settings, key);
  viewCache.set(box, { settings, key: identity, view });
  return view;
}
