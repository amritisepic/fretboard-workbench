import { create } from 'zustand';
import { TUNING_PRESETS } from '../data/tunings';
import {
  DEFAULT_FRET_COUNT,
  clampFretCount,
  makeScaleRef,
  planKeys,
  positionKey,
  resizeTuning,
  shiftStrings,
  transposeChordCandidateKey,
  transposePositions,
  transposeScaleRef,
  withMode,
  type FretPosition,
  type Midi,
  type ScaleRef,
} from '../theory';
import { newId } from './ids';
import type { PresetData } from './presetFormat';

export type LabelMode = 'names' | 'degrees';
export type FillMode = 'inversion' | 'scale';
export type StripCompare = 'chords' | 'scales';

export interface FillState {
  readonly on: boolean;
  /** Also the box's mode (inversion or scale) while the fill is off. */
  readonly mode: FillMode;
}

export interface Box {
  readonly id: string;
  /** Clicked positions in click order. */
  readonly positions: readonly FretPosition[];
  readonly scale: ScaleRef;
  readonly labelMode: LabelMode;
  readonly color: string;
  readonly fill: FillState;
  /**
   * Key of the chord name picked in the sidebar, or null for automatic. It stays stored when the
   * notes change, and applies again whenever it matches the clicked notes.
   */
  readonly chordOverride: string | null;
}

export interface Settings {
  /** Open-string MIDI pitches, lowest string first. */
  readonly tuning: readonly Midi[];
  readonly fretCount: number;
}

/** Voice-leading strips between adjacent boxes. Global to the preset. */
export interface StripSettings {
  readonly visible: boolean;
  /** Note names or scale degrees, independent of the boxes' own label modes. */
  readonly labelMode: LabelMode;
  /** Scales are compared only between two boxes that are both in scale mode; otherwise chords. */
  readonly compare: StripCompare;
}

/** Which preset the workbench is, and what it looked like when last saved. */
export interface DocumentState {
  /** null until the workbench is saved as a preset. */
  readonly presetId: string | null;
  readonly name: string;
  /** `snapshotOf` the saved preset, for spotting unsaved edits; null when never saved. */
  readonly savedSnapshot: string | null;
}

export interface LoadedDocument extends DocumentState {
  readonly data: PresetData;
}

export interface WorkbenchState {
  readonly settings: Settings;
  /** The preset's key; boxes can move away from it (see planKeys). */
  readonly key: ScaleRef;
  readonly strips: StripSettings;
  readonly boxes: readonly Box[];
  readonly selectedBoxId: string | null;
  readonly document: DocumentState;
  /** Appends a box in the key in effect after the last box and selects it. */
  addBox(): string;
  selectBox(id: string | null): void;
  removeBox(id: string): void;
  togglePosition(id: string, position: FretPosition): void;
  setLabelMode(id: string, mode: LabelMode): void;
  setFillOn(id: string, on: boolean): void;
  /** Moves the fill switch; choosing a fill also turns it on. */
  setFillMode(id: string, mode: FillMode): void;
  toggleFill(id: string): void;
  /** Root box: moves the clicked shape, the scale and the chord override together. */
  transposeBox(id: string, semitones: number): void;
  setScale(id: string, scale: ScaleRef): void;
  /** Mode slider: same pitch collection, another degree as the root. */
  setMode(id: string, mode: number): void;
  setChordOverride(id: string, key: string | null): void;
  setColor(id: string, color: string): void;
  setKey(key: ScaleRef): void;
  setStrips(patch: Partial<StripSettings>): void;
  /** Replaces the whole tuning; string-count changes are aligned at the high end. */
  applyTuning(tuning: readonly Midi[]): void;
  setStringCount(count: number): void;
  setStringPitch(string: number, midi: Midi): void;
  /** Clamps to 12–30 and drops clicked notes above the new last fret. */
  setFretCount(count: number): void;
  /** Ignores blank names. */
  setPresetName(name: string): void;
  /** Replaces everything the preset stores and deselects. */
  loadDocument(document: LoadedDocument): void;
  markSaved(presetId: string, name: string, snapshot: string): void;
  /** The preset behind the workbench is gone; keep the work as an unsaved document. */
  detachDocument(): void;
  newDocument(): void;
}

export const DEFAULT_BOX_COLOR = '#C8372D';
export const UNTITLED_PRESET = 'Untitled preset';

export function createBox(scale: ScaleRef = makeScaleRef('diatonic', 0, 'C')): Box {
  return {
    id: newId(),
    positions: [],
    scale,
    labelMode: 'names',
    color: DEFAULT_BOX_COLOR,
    fill: { on: false, mode: 'inversion' },
    chordOverride: null,
  };
}

const defaultContent = (): Pick<WorkbenchState, 'settings' | 'key' | 'strips' | 'boxes'> => ({
  settings: { tuning: TUNING_PRESETS[0].tuning, fretCount: DEFAULT_FRET_COUNT },
  key: makeScaleRef('diatonic', 0, 'C'),
  strips: { visible: true, labelMode: 'names', compare: 'chords' },
  boxes: [],
});

export const useWorkbench = create<WorkbenchState>()((set) => {
  const updateBox = (id: string, update: (box: Box) => Partial<Box>) =>
    set((state) => ({ boxes: state.boxes.map((box) => (box.id === id ? { ...box, ...update(box) } : box)) }));

  const retune = (state: WorkbenchState, tuning: readonly Midi[]) => {
    const delta = tuning.length - state.settings.tuning.length;
    return {
      settings: { ...state.settings, tuning },
      boxes:
        delta === 0
          ? state.boxes
          : state.boxes.map((box) => ({ ...box, positions: shiftStrings(box.positions, delta, tuning.length) })),
    };
  };

  return {
    ...defaultContent(),
    selectedBoxId: null,
    document: { presetId: null, name: UNTITLED_PRESET, savedSnapshot: null },

    addBox: () => {
      let id = '';
      set((state) => {
        const { keys } = planKeys(state.key, state.boxes.map((box) => box.scale));
        const box = createBox(keys.length > 0 ? keys[keys.length - 1] : state.key);
        id = box.id;
        return { boxes: [...state.boxes, box], selectedBoxId: box.id };
      });
      return id;
    },
    selectBox: (id) => set({ selectedBoxId: id }),
    removeBox: (id) =>
      set((state) => ({
        boxes: state.boxes.filter((box) => box.id !== id),
        selectedBoxId: state.selectedBoxId === id ? null : state.selectedBoxId,
      })),
    togglePosition: (id, position) =>
      updateBox(id, (box) => {
        const key = positionKey(position);
        const present = box.positions.some((p) => positionKey(p) === key);
        return {
          positions: present ? box.positions.filter((p) => positionKey(p) !== key) : [...box.positions, position],
        };
      }),
    setLabelMode: (id, labelMode) => updateBox(id, () => ({ labelMode })),
    setFillOn: (id, on) => updateBox(id, (box) => ({ fill: { ...box.fill, on } })),
    setFillMode: (id, mode) => updateBox(id, () => ({ fill: { on: true, mode } })),
    toggleFill: (id) => updateBox(id, (box) => ({ fill: { ...box.fill, on: !box.fill.on } })),

    transposeBox: (id, semitones) =>
      set((state) => ({
        boxes: state.boxes.map((box) =>
          box.id === id
            ? {
                ...box,
                positions: transposePositions(box.positions, semitones, state.settings.fretCount),
                scale: transposeScaleRef(box.scale, semitones),
                chordOverride:
                  box.chordOverride === null ? null : transposeChordCandidateKey(box.chordOverride, semitones),
              }
            : box,
        ),
      })),
    setScale: (id, scale) => updateBox(id, () => ({ scale })),
    setMode: (id, mode) => updateBox(id, (box) => ({ scale: withMode(box.scale, mode) })),
    setChordOverride: (id, chordOverride) => updateBox(id, () => ({ chordOverride })),
    setColor: (id, color) => updateBox(id, () => ({ color })),

    setKey: (key) => set({ key }),
    setStrips: (patch) => set((state) => ({ strips: { ...state.strips, ...patch } })),

    applyTuning: (tuning) => set((state) => retune(state, tuning)),
    setStringCount: (count) => set((state) => retune(state, resizeTuning(state.settings.tuning, count))),
    setStringPitch: (string, midi) =>
      set((state) => ({
        settings: { ...state.settings, tuning: state.settings.tuning.map((m, i) => (i === string ? midi : m)) },
      })),
    setFretCount: (count) =>
      set((state) => {
        const fretCount = clampFretCount(count);
        return {
          settings: { ...state.settings, fretCount },
          boxes: state.boxes.map((box) => ({ ...box, positions: box.positions.filter((p) => p.fret <= fretCount) })),
        };
      }),

    setPresetName: (name) =>
      set((state) => {
        const trimmed = name.trim();
        return trimmed && trimmed !== state.document.name ? { document: { ...state.document, name: trimmed } } : {};
      }),
    loadDocument: ({ presetId, name, savedSnapshot, data }) =>
      set({
        settings: data.settings,
        key: data.key,
        strips: data.strips,
        boxes: data.boxes,
        selectedBoxId: null,
        document: { presetId, name, savedSnapshot },
      }),
    markSaved: (presetId, name, snapshot) => set({ document: { presetId, name, savedSnapshot: snapshot } }),
    detachDocument: () => set((state) => ({ document: { ...state.document, presetId: null, savedSnapshot: null } })),
    newDocument: () =>
      set({
        ...defaultContent(),
        selectedBoxId: null,
        document: { presetId: null, name: UNTITLED_PRESET, savedSnapshot: null },
      }),
  };
});
