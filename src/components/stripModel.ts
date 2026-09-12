import type { StripCompare, StripSettings } from '../state/workbench';
import { formatScaleDegree, mod12, pcOfSpelled, spell, voiceLeading, type PitchClass } from '../theory';
import type { CanvasEntry } from './canvasModel';

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
  /** Plain-language summary for assistive technology. */
  readonly description: string;
}

const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** The voice-leading strip between two adjacent boxes (spec §4.6). */
export function buildStripView(from: CanvasEntry, to: CanvasEntry, strips: StripSettings): StripView {
  const compared: StripCompare =
    strips.compare === 'scales' && from.box.fill.mode === 'scale' && to.box.fill.mode === 'scale' ? 'scales' : 'chords';
  const setOf = (entry: CanvasEntry) => (compared === 'scales' ? entry.view.scalePcs : entry.view.chordPcs);
  const leading = voiceLeading(setOf(from), setOf(to));

  // Each row is labelled in its own box's context, so a common tone can read "1 → 5".
  const label = (entry: CanvasEntry, pc: PitchClass) =>
    strips.labelMode === 'names' ? spell(pc, entry.view.ctx) : formatScaleDegree(pc, entry.view.ctx);
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
  const voices = placed.sort((a, b) => b.height - a.height).map((p) => p.voice);

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
    commonTones: leading.motions.filter((m) => m.distance === 0).length,
    description:
      voices.length === 0
        ? `No notes to compare between ${fromTitle} and ${toTitle}.`
        : `Voice leading from ${fromTitle} to ${toTitle}: ${voices.map(phrase).join('; ')}. Total motion ${leading.totalMotion} semitones.`,
  };
}
