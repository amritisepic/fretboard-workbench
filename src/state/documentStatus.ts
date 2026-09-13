import { presetDataOf, snapshotOf } from './presetFormat';
import type { WorkbenchState } from './workbench';

/** `unsaved`: not linked to a preset. `edited`: differs from the saved preset. */
export type DocumentStatus = 'unsaved' | 'edited' | 'saved';

let memo: {
  readonly settings: WorkbenchState['settings'];
  readonly key: WorkbenchState['key'];
  readonly strips: WorkbenchState['strips'];
  readonly orientation: WorkbenchState['orientation'];
  readonly boxes: WorkbenchState['boxes'];
  readonly name: string;
  readonly snapshot: string;
} | null = null;

/** Serialised only when the content actually changed, since selectors run on every store update. */
function currentSnapshot(state: WorkbenchState): string {
  if (
    memo &&
    memo.settings === state.settings &&
    memo.key === state.key &&
    memo.strips === state.strips &&
    memo.orientation === state.orientation &&
    memo.boxes === state.boxes &&
    memo.name === state.document.name
  ) {
    return memo.snapshot;
  }
  const snapshot = snapshotOf(state.document.name, presetDataOf(state));
  memo = {
    settings: state.settings,
    key: state.key,
    strips: state.strips,
    orientation: state.orientation,
    boxes: state.boxes,
    name: state.document.name,
    snapshot,
  };
  return snapshot;
}

export function isDirty(state: WorkbenchState): boolean {
  return state.document.savedSnapshot !== currentSnapshot(state);
}

export function documentStatus(state: WorkbenchState): DocumentStatus {
  if (state.document.presetId === null) return 'unsaved';
  return isDirty(state) ? 'edited' : 'saved';
}

/** Work that opening another preset would throw away: edits to a saved preset, or any boxes in an unsaved one. */
export function hasUnsavedWork(state: WorkbenchState): boolean {
  return state.document.presetId === null ? state.boxes.length > 0 : isDirty(state);
}
