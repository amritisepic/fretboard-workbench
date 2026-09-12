import { useLibrary } from './library';
import { parsePresetData, presetDataOf } from './presetFormat';
import { openRepository, type LibraryRepository, type SessionRecord } from './repository';
import { UNTITLED_PRESET, useWorkbench, type WorkbenchState } from './workbench';

const SAVE_DELAY_MS = 300;

const sessionChanged = (a: WorkbenchState, b: WorkbenchState) =>
  a.settings !== b.settings || a.key !== b.key || a.strips !== b.strips || a.boxes !== b.boxes || a.document !== b.document;

const sessionOf = (state: WorkbenchState): SessionRecord => ({
  id: 'current',
  presetId: state.document.presetId,
  name: state.document.name,
  savedSnapshot: state.document.savedSnapshot,
  data: presetDataOf(state),
  updatedAt: Date.now(),
});

function restoreSession(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  const session = Object.fromEntries(Object.entries(value));
  useWorkbench.getState().loadDocument({
    presetId: typeof session.presetId === 'string' ? session.presetId : null,
    name: typeof session.name === 'string' && session.name.trim() ? session.name.trim() : UNTITLED_PRESET,
    data: parsePresetData(session.data, 'session.data'),
    savedSnapshot: typeof session.savedSnapshot === 'string' ? session.savedSnapshot : null,
  });
}

/**
 * Opens IndexedDB, restores the last working session and the preset library, then saves the
 * session shortly after every change. It resolves once the app can render. Without IndexedDB
 * everything still works, in memory only. The returned function stops saving and waits for the
 * last write.
 */
export async function startPersistence(
  open: () => Promise<LibraryRepository> = () => openRepository(),
): Promise<() => Promise<void>> {
  let repo: LibraryRepository | null = null;
  try {
    repo = await open();
  } catch (error) {
    console.warn('IndexedDB is unavailable, so presets will not be kept after this tab closes.', error);
  }

  if (repo) {
    try {
      restoreSession(await repo.loadSession());
    } catch (error) {
      console.warn('The last session could not be restored.', error);
    }
    try {
      await useLibrary.getState().connect(repo);
    } catch (error) {
      console.warn('The preset library could not be loaded.', error);
      repo = null;
    }
  }
  if (!repo) await useLibrary.getState().connect(null);

  // The session may point at a preset that was deleted elsewhere.
  const { document } = useWorkbench.getState();
  if (document.presetId !== null && !useLibrary.getState().presets.some((p) => p.id === document.presetId)) {
    useWorkbench.getState().detachDocument();
  }
  if (!repo) return async () => {};

  const repository = repo;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> = Promise.resolve();
  const write = () => {
    timer = undefined;
    pending = repository.saveSession(sessionOf(useWorkbench.getState())).catch((error: unknown) => {
      console.warn('The session could not be saved.', error);
    });
  };
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    write();
  };

  const unsubscribe = useWorkbench.subscribe((state, previous) => {
    if (!sessionChanged(state, previous)) return;
    clearTimeout(timer);
    timer = setTimeout(write, SAVE_DELAY_MS);
  });
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) window.addEventListener('pagehide', flush);

  return async () => {
    unsubscribe();
    if (hasWindow) window.removeEventListener('pagehide', flush);
    flush();
    await pending;
  };
}
