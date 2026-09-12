import { create } from 'zustand';
import { newId } from './ids';
import {
  canMoveFolder,
  childFolders,
  exportFileName,
  presetsIn,
  subtreeContents,
  uniqueName,
  type FolderRecord,
  type PresetRecord,
} from './libraryTree';
import {
  parseExportFile,
  parsePresetData,
  presetDataOf,
  serializeExportFile,
  snapshotOf,
  withFreshBoxIds,
  type ExportedFolder,
} from './presetFormat';
import type { LibraryChange, LibraryRepository } from './repository';
import { useWorkbench } from './workbench';

export type LibraryStatus = 'loading' | 'ready' | 'unavailable';
export type SaveFeedback = 'idle' | 'saving' | 'saved' | 'error';

export interface ExportedText {
  readonly fileName: string;
  readonly text: string;
}

export interface LibraryState {
  /** `unavailable`: IndexedDB could not be opened, so the library lives only in memory. */
  readonly status: LibraryStatus;
  readonly folders: readonly FolderRecord[];
  readonly presets: readonly PresetRecord[];
  readonly saveFeedback: SaveFeedback;
  connect(repository: LibraryRepository | null): Promise<void>;
  /** Overwrites the open preset, or saves the workbench as a new top-level preset. */
  saveCurrent(): Promise<PresetRecord>;
  /** `saveCurrent` with button feedback (saving → saved or error → idle). */
  requestSave(): Promise<void>;
  openPreset(id: string): void;
  createFolder(parentId: string | null, name?: string): Promise<FolderRecord>;
  renameFolder(id: string, name: string): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;
  /** Deletes the folder and everything inside it. */
  deleteFolder(id: string): Promise<void>;
  renamePreset(id: string, name: string): Promise<void>;
  movePreset(id: string, folderId: string | null): Promise<void>;
  deletePreset(id: string): Promise<void>;
  exportPreset(id: string): ExportedText;
  exportFolder(id: string): ExportedText;
  /** Imports an exported file into a folder and returns a summary. Throws PresetFormatError. */
  importFile(source: string, folderId: string | null): Promise<string>;
}

let repository: LibraryRepository | null = null;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

const presetNamesIn = (presets: readonly PresetRecord[], folderId: string | null, except?: string) =>
  presets.filter((p) => p.folderId === folderId && p.id !== except).map((p) => p.name);

const folderNamesIn = (folders: readonly FolderRecord[], parentId: string | null, except?: string) =>
  folders.filter((f) => f.parentId === parentId && f.id !== except).map((f) => f.name);

function found<T>(item: T | undefined, what: string): T {
  if (item === undefined) throw new Error(`${what} no longer exists.`);
  return item;
}

function requiredName(name: string, what: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error(`${what} needs a name.`);
  return trimmed;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const useLibrary = create<LibraryState>()((set, get) => {
  const persist = async (change: LibraryChange) => {
    if (repository) await repository.apply(change);
  };

  /** Keeps the open document's name and saved state in step with its record. */
  const syncOpenDocument = (record: PresetRecord) => {
    const workbench = useWorkbench.getState();
    if (workbench.document.presetId === record.id) {
      workbench.markSaved(record.id, record.name, snapshotOf(record.name, record.data));
    }
  };

  const replacePreset = (record: PresetRecord) =>
    set((state) => ({ presets: state.presets.map((p) => (p.id === record.id ? record : p)) }));

  const replaceFolder = (record: FolderRecord) =>
    set((state) => ({ folders: state.folders.map((f) => (f.id === record.id ? record : f)) }));

  return {
    status: 'loading',
    folders: [],
    presets: [],
    saveFeedback: 'idle',

    connect: async (repo) => {
      repository = repo;
      if (!repo) {
        set({ status: 'unavailable' });
        return;
      }
      const library = await repo.loadLibrary();
      const presets = library.presets.flatMap((record) => {
        try {
          return [{ ...record, data: parsePresetData(record.data) }];
        } catch (error) {
          console.warn(`Skipping the unreadable preset "${record.name}".`, error);
          return [];
        }
      });
      set({ status: 'ready', folders: library.folders, presets });
    },

    saveCurrent: async () => {
      const workbench = useWorkbench.getState();
      const { presets } = get();
      const data = presetDataOf(workbench);
      const existing = presets.find((p) => p.id === workbench.document.presetId);
      const folderId = existing ? existing.folderId : null;
      const name = uniqueName(workbench.document.name, presetNamesIn(presets, folderId, existing?.id));
      const now = Date.now();
      const record: PresetRecord = existing
        ? { ...existing, name, data, updatedAt: now }
        : { id: newId(), folderId, name, data, createdAt: now, updatedAt: now };
      await persist({ putPresets: [record] });
      set((state) => ({
        presets: existing ? state.presets.map((p) => (p.id === record.id ? record : p)) : [...state.presets, record],
      }));
      useWorkbench.getState().markSaved(record.id, record.name, snapshotOf(record.name, record.data));
      return record;
    },

    requestSave: async () => {
      if (get().saveFeedback === 'saving') return;
      clearTimeout(feedbackTimer);
      set({ saveFeedback: 'saving' });
      try {
        await get().saveCurrent();
        set({ saveFeedback: 'saved' });
      } catch (error) {
        console.error('Saving the preset failed.', error);
        set({ saveFeedback: 'error' });
      }
      feedbackTimer = setTimeout(() => set({ saveFeedback: 'idle' }), 1600);
    },

    openPreset: (id) => {
      const record = found(get().presets.find((p) => p.id === id), 'That preset');
      useWorkbench.getState().loadDocument({
        presetId: record.id,
        name: record.name,
        data: record.data,
        savedSnapshot: snapshotOf(record.name, record.data),
      });
    },

    createFolder: async (parentId, name = 'New folder') => {
      const now = Date.now();
      const record: FolderRecord = {
        id: newId(),
        parentId,
        name: uniqueName(requiredName(name, 'A folder'), folderNamesIn(get().folders, parentId)),
        createdAt: now,
        updatedAt: now,
      };
      await persist({ putFolders: [record] });
      set((state) => ({ folders: [...state.folders, record] }));
      return record;
    },

    renameFolder: async (id, name) => {
      const { folders } = get();
      const folder = found(folders.find((f) => f.id === id), 'That folder');
      const record = {
        ...folder,
        name: uniqueName(requiredName(name, 'A folder'), folderNamesIn(folders, folder.parentId, id)),
        updatedAt: Date.now(),
      };
      await persist({ putFolders: [record] });
      replaceFolder(record);
    },

    moveFolder: async (id, parentId) => {
      const { folders } = get();
      const folder = found(folders.find((f) => f.id === id), 'That folder');
      if (folder.parentId === parentId) return;
      if (!canMoveFolder(folders, id, parentId)) throw new Error('A folder can’t be moved into itself.');
      const record = {
        ...folder,
        parentId,
        name: uniqueName(folder.name, folderNamesIn(folders, parentId, id)),
        updatedAt: Date.now(),
      };
      await persist({ putFolders: [record] });
      replaceFolder(record);
    },

    deleteFolder: async (id) => {
      const { folders, presets } = get();
      const { folderIds, presetIds } = subtreeContents(folders, presets, id);
      await persist({ deleteFolderIds: folderIds, deletePresetIds: presetIds });
      set((state) => ({
        folders: state.folders.filter((f) => !folderIds.includes(f.id)),
        presets: state.presets.filter((p) => !presetIds.includes(p.id)),
      }));
      const open = useWorkbench.getState().document.presetId;
      if (open !== null && presetIds.includes(open)) useWorkbench.getState().detachDocument();
    },

    renamePreset: async (id, name) => {
      const { presets } = get();
      const preset = found(presets.find((p) => p.id === id), 'That preset');
      const record = {
        ...preset,
        name: uniqueName(requiredName(name, 'A preset'), presetNamesIn(presets, preset.folderId, id)),
        updatedAt: Date.now(),
      };
      await persist({ putPresets: [record] });
      replacePreset(record);
      syncOpenDocument(record);
    },

    movePreset: async (id, folderId) => {
      const { presets } = get();
      const preset = found(presets.find((p) => p.id === id), 'That preset');
      if (preset.folderId === folderId) return;
      const record = {
        ...preset,
        folderId,
        name: uniqueName(preset.name, presetNamesIn(presets, folderId, id)),
        updatedAt: Date.now(),
      };
      await persist({ putPresets: [record] });
      replacePreset(record);
      syncOpenDocument(record);
    },

    deletePreset: async (id) => {
      await persist({ deletePresetIds: [id] });
      set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }));
      if (useWorkbench.getState().document.presetId === id) useWorkbench.getState().detachDocument();
    },

    exportPreset: (id) => {
      const preset = found(get().presets.find((p) => p.id === id), 'That preset');
      return {
        fileName: exportFileName(preset.name),
        text: serializeExportFile({ kind: 'preset', preset: { name: preset.name, data: preset.data } }),
      };
    },

    exportFolder: (id) => {
      const { folders, presets } = get();
      const build = (folder: FolderRecord): ExportedFolder => ({
        name: folder.name,
        folders: childFolders(folders, folder.id).map(build),
        presets: presetsIn(presets, folder.id).map((p) => ({ name: p.name, data: p.data })),
      });
      const folder = found(folders.find((f) => f.id === id), 'That folder');
      return { fileName: exportFileName(folder.name), text: serializeExportFile({ kind: 'folder', folder: build(folder) }) };
    },

    importFile: async (source, folderId) => {
      const file = parseExportFile(source);
      const { folders, presets } = get();
      const now = Date.now();

      if (file.kind === 'preset') {
        const record: PresetRecord = {
          id: newId(),
          folderId,
          name: uniqueName(file.preset.name, presetNamesIn(presets, folderId)),
          data: withFreshBoxIds(file.preset.data),
          createdAt: now,
          updatedAt: now,
        };
        await persist({ putPresets: [record] });
        set((state) => ({ presets: [...state.presets, record] }));
        return `Imported preset “${record.name}”.`;
      }

      const newFolders: FolderRecord[] = [];
      const newPresets: PresetRecord[] = [];
      const add = (folder: ExportedFolder, parentId: string | null, siblingNames: readonly string[]): FolderRecord => {
        const record: FolderRecord = { id: newId(), parentId, name: uniqueName(folder.name, siblingNames), createdAt: now, updatedAt: now };
        newFolders.push(record);
        const childNames: string[] = [];
        for (const child of folder.folders) childNames.push(add(child, record.id, childNames).name);
        const presetNames: string[] = [];
        for (const preset of folder.presets) {
          const name = uniqueName(preset.name, presetNames);
          presetNames.push(name);
          newPresets.push({ id: newId(), folderId: record.id, name, data: withFreshBoxIds(preset.data), createdAt: now, updatedAt: now });
        }
        return record;
      };
      const top = add(file.folder, folderId, folderNamesIn(folders, folderId));
      await persist({ putFolders: newFolders, putPresets: newPresets });
      set((state) => ({ folders: [...state.folders, ...newFolders], presets: [...state.presets, ...newPresets] }));
      return `Imported folder “${top.name}” with ${plural(newPresets.length, 'preset')}.`;
    },
  };
});
