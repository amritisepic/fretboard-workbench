import type { StripSettings } from '../state/workbench';
import { formatScaleDegree, mod12, pcOfSpelled, spell, voiceLeading, type PitchClass } from '../theory';
import type { CanvasEntry } from './canvasModel';

export type StripCompare = 'chords' | 'scales';
export type StripVoiceKind = 'common' | 'step' | 'leap' | 'added' | 'dropped';

export interface StripVoice {
  readonly kind: StripVoiceKind;
  /** Label in the earlier box, or null for an added tone. */
  readonly from: string | null;
  /** Label in the later box, or null for a dropped tone. */
  readonly to: string | null;
  /** Shortest signed motion in semitones; 0 for common, added and dropped tones. */
  readonly semitones: number;
  /** "+1", "−2", or "" when nothing moves. */
  readonly interval: string;
}

export interface StripView {
  readonly compared: StripCompare;
  readonly fromTitle: string;
  readonly toTitle: string;
  /** Top to bottom: highest above the earlier box's chord root (or scale tonic) first. */
  readonly voices: readonly StripVoice[];
  readonly totalMotion: number;
  readonly commonTones: number;
  /** "3 semitones · 1 common", or just the part the strip settings show. */
  readonly summary: string;
  /** What to say when no voice is left to draw. */
  readonly emptyText: string;
  /** Plain-language summary for assistive technology. */
  readonly description: string;
}

const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/**
 * The strip between two adjacent boxes (spec §4.6). The boxes' fill switches choose what is compared:
 * scales when both are set to fill scale, chords otherwise. The strip settings choose what is drawn:
 * common tones, moving voices (with added and dropped tones), or both.
 */
export function buildStripView(from: CanvasEntry, to: CanvasEntry, strips: StripSettings): StripView {
  const compared: StripCompare = from.box.fill.mode === 'scale' && to.box.fill.mode === 'scale' ? 'scales' : 'chords';
  const setOf = (entry: CanvasEntry) => (compared === 'scales' ? entry.view.scalePcs : entry.view.chordPcs);
  const leading = voiceLeading(setOf(from), setOf(to));

  // Each side is labelled in its own box's context: names from its scale, degrees counted the way its
  // dots count them (from the key in effect or from its scale), so a common tone can read "1 → 5".
  const label = (entry: CanvasEntry, pc: PitchClass) =>
    strips.labelMode === 'names' ? spell(pc, entry.view.ctx) : formatScaleDegree(pc, entry.view.degreeCtx);
  const reference =
    compared === 'chords' && from.view.chord ? from.view.chord.root : pcOfSpelled(from.box.scale.tonic);
  const height = (pc: PitchClass) => mod12(pc - reference);

  const placed: { readonly height: number; readonly voice: StripVoice }[] = [
    ...leading.motions.map((m) => ({
      height: height(m.from),
      voice: {
        kind: m.kind,
        from: label(from, m.from),
        to: label(to, m.to),
        semitones: m.semitones,
        interval: m.distance === 0 ? '' : signed(m.semitones),
      },
    })),
    ...leading.dropped.map((pc) => ({
      height: height(pc),
      voice: { kind: 'dropped' as const, from: label(from, pc), to: null, semitones: 0, interval: '' },
    })),
    ...leading.added.map((pc) => ({
      height: height(pc),
      voice: { kind: 'added' as const, from: null, to: label(to, pc), semitones: 0, interval: '' },
    })),
  ];
  const shown = (voice: StripVoice) => (voice.kind === 'common' ? strips.commonTones : strips.voiceLeading);
  const voices = placed
    .filter((p) => shown(p.voice))
    .sort((a, b) => b.height - a.height)
    .map((p) => p.voice);
  const commonTones = leading.motions.filter((m) => m.distance === 0).length;
  const summary = [
    strips.voiceLeading ? `${leading.totalMotion} ${leading.totalMotion === 1 ? 'semitone' : 'semitones'}` : '',
    strips.commonTones ? `${commonTones} common` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const emptyText =
    placed.length === 0 ? 'No notes to compare' : strips.voiceLeading ? 'No voices move' : 'No common tones';

  const titleOf = (entry: CanvasEntry) =>
    compared === 'scales' ? entry.view.scaleName : entry.view.title || 'No notes';
  const fromTitle = titleOf(from);
  const toTitle = titleOf(to);
  const phrase = (v: StripVoice) =>
    v.kind === 'common'
      ? `${v.from} stays`
      : v.kind === 'dropped'
        ? `${v.from} drops`
        : v.kind === 'added'
          ? `${v.to} is added`
          : `${v.from} moves ${v.interval} to ${v.to}`;

  return {
    compared,
    fromTitle,
    toTitle,
    voices,
    totalMotion: leading.totalMotion,
    commonTones,
    summary,
    emptyText,
    description:
      voices.length === 0
        ? `${emptyText} between ${fromTitle} and ${toTitle}.`
        : `From ${fromTitle} to ${toTitle}: ${voices.map(phrase).join('; ')}. ${summary}.`,
  };
}
