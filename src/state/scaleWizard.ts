import { create } from 'zustand';
import { TOP_VOICES, makeScaleRef, type ScaleRef, type TopVoice } from '../theory';
import { readStored, storedFields, writeStored } from './localSettings';
import { parseScaleRef } from './presetFormat';
import type { HarmonyNotation, LabelMode, Orientation } from './workbench';

/** What the scale wizard shows. Kept on this device; the tuning and frets come from the workbench. */
export interface ScaleWizardSettings {
  readonly scale: ScaleRef;
  /** The scale drawn on a fretboard. */
  readonly showScale: boolean;
  readonly labelMode: LabelMode;
  readonly orientation: Orientation;
  readonly notation: HarmonyNotation;
  /** The highest chord tone the chord table stacks up to. */
  readonly topVoice: TopVoice;
}

export interface ScaleWizardState extends ScaleWizardSettings {
  setScale(scale: ScaleRef): void;
  setShowScale(on: boolean): void;
  setLabelMode(mode: LabelMode): void;
  setOrientation(orientation: Orientation): void;
  setNotation(notation: HarmonyNotation): void;
  setTopVoice(topVoice: TopVoice): void;
  /** Replaces every setting at once (the guided tour puts them back afterwards). */
  restore(settings: ScaleWizardSettings): void;
}

export const SCALE_WIZARD_KEY = 'fretboard-workbench:scale-wizard';

export const DEFAULT_SCALE_WIZARD: ScaleWizardSettings = {
  scale: makeScaleRef('diatonic', 0, 'C'),
  showScale: true,
  labelMode: 'names',
  orientation: 'vertical',
  notation: 'jazz',
  topVoice: 7,
};

/** Stored wizard settings, with the default for anything missing or unreadable. */
export function parseScaleWizard(value: unknown): ScaleWizardSettings {
  const stored = storedFields(value);
  let scale = DEFAULT_SCALE_WIZARD.scale;
  try {
    if (stored.scale !== undefined) scale = parseScaleRef(stored.scale, 'scale');
  } catch {
    // An unknown scale family (from a newer version, say) keeps the default.
  }
  const topVoice = TOP_VOICES.find((voice) => voice === stored.topVoice);
  return {
    scale,
    showScale: typeof stored.showScale === 'boolean' ? stored.showScale : DEFAULT_SCALE_WIZARD.showScale,
    labelMode: stored.labelMode === 'degrees' ? 'degrees' : 'names',
    orientation: stored.orientation === 'horizontal' ? 'horizontal' : 'vertical',
    notation: stored.notation === 'classical' ? 'classical' : 'jazz',
    topVoice: topVoice ?? DEFAULT_SCALE_WIZARD.topVoice,
  };
}

export const useScaleWizard = create<ScaleWizardState>()((set, get) => {
  const update = (patch: Partial<ScaleWizardSettings>) => {
    set(patch);
    const { scale, showScale, labelMode, orientation, notation, topVoice } = get();
    writeStored(SCALE_WIZARD_KEY, { scale, showScale, labelMode, orientation, notation, topVoice });
  };
  return {
    ...parseScaleWizard(readStored(SCALE_WIZARD_KEY)),
    setScale: (scale) => update({ scale }),
    setShowScale: (showScale) => update({ showScale }),
    setLabelMode: (labelMode) => update({ labelMode }),
    setOrientation: (orientation) => update({ orientation }),
    setNotation: (notation) => update({ notation }),
    setTopVoice: (topVoice) => update({ topVoice }),
    restore: (settings) => update(settings),
  };
});
