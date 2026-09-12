import { create } from 'zustand';
import { TUNING_PRESETS } from '../data/tunings';
import {
  DEFAULT_FRET_COUNT,
  clampFretCount,
  makeScaleRef,
  positionKey,
  resizeTuning,
  shiftStrings,
  type FretPosition,
  type Midi,
  type ScaleRef,
} from '../theory';

export type LabelMode = 'names' | 'degrees';
export type FillMode = 'inversion' | 'scale';

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
}

export interface Settings {
  /** Open-string MIDI pitches, lowest string first. */
  readonly tuning: readonly Midi[];
  readonly fretCount: number;
}

export interface WorkbenchState {
  readonly settings: Settings;
  readonly boxes: readonly Box[];
  readonly selectedBoxId: string | null;
  addBox(): string;
  selectBox(id: string | null): void;
  removeBox(id: string): void;
  togglePosition(id: string, position: FretPosition): void;
  setLabelMode(id: string, mode: LabelMode): void;
  setFillOn(id: string, on: boolean): void;
  /** Moves the fill switch; choosing a fill also turns it on. */
  setFillMode(id: string, mode: FillMode): void;
  toggleFill(id: string): void;
  /** Replaces the whole tuning; string-count changes are aligned at the high end. */
  applyTuning(tuning: readonly Midi[]): void;
  setStringCount(count: number): void;
  setStringPitch(string: number, midi: Midi): void;
  /** Clamps to 12–30 and drops clicked notes above the new last fret. */
  setFretCount(count: number): void;
}

export const DEFAULT_BOX_COLOR = '#C8372D';

let fallbackId = 0;
const newId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `box-${++fallbackId}`;

export function createBox(): Box {
  return {
    id: newId(),
    positions: [],
    scale: makeScaleRef('diatonic', 0, 'C'),
    labelMode: 'names',
    color: DEFAULT_BOX_COLOR,
    fill: { on: false, mode: 'inversion' },
  };
}

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
    settings: { tuning: TUNING_PRESETS[0].tuning, fretCount: DEFAULT_FRET_COUNT },
    boxes: [],
    selectedBoxId: null,

    addBox: () => {
      const box = createBox();
      set((state) => ({ boxes: [...state.boxes, box], selectedBoxId: box.id }));
      return box.id;
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
  };
});
