/** IndexedDB storage for the preset library and the working session. */

import { openDB, type DBSchema } from 'idb';
import type { FolderRecord, PresetRecord } from './libraryTree';
import type { PresetData } from './presetFormat';

export interface SessionRecord {
  readonly id: 'current';
  readonly presetId: string | null;
  readonly name: string;
  readonly savedSnapshot: string | null;
  readonly data: PresetData;
  readonly updatedAt: number;
}

export interface LibraryChange {
  readonly putFolders?: readonly FolderRecord[];
  readonly putPresets?: readonly PresetRecord[];
  readonly deleteFolderIds?: readonly string[];
  readonly deletePresetIds?: readonly string[];
}

export interface LibraryRepository {
  loadLibrary(): Promise<{ folders: FolderRecord[]; presets: PresetRecord[] }>;
  /** Applies every write and delete in one transaction. */
  apply(change: LibraryChange): Promise<void>;
  /** Returned unvalidated: it may predate the current format. */
  loadSession(): Promise<unknown>;
  saveSession(session: SessionRecord): Promise<void>;
}

interface WorkbenchDatabase extends DBSchema {
  folders: { key: string; value: FolderRecord };
  presets: { key: string; value: PresetRecord };
  session: { key: string; value: SessionRecord };
}

export const DATABASE_NAME = 'fretboard-workbench';
const DATABASE_VERSION = 1;

export async function openRepository(name: string = DATABASE_NAME): Promise<LibraryRepository> {
  const db = await openDB<WorkbenchDatabase>(name, DATABASE_VERSION, {
    upgrade(database) {
      database.createObjectStore('folders', { keyPath: 'id' });
      database.createObjectStore('presets', { keyPath: 'id' });
      database.createObjectStore('session', { keyPath: 'id' });
    },
  });

  return {
    async loadLibrary() {
      const [folders, presets] = await Promise.all([db.getAll('folders'), db.getAll('presets')]);
      return { folders, presets };
    },
    async apply(change) {
      const tx = db.transaction(['folders', 'presets'], 'readwrite');
      const folders = tx.objectStore('folders');
      const presets = tx.objectStore('presets');
      await Promise.all([
        ...(change.putFolders ?? []).map((folder) => folders.put(folder)),
        ...(change.putPresets ?? []).map((preset) => presets.put(preset)),
        ...(change.deleteFolderIds ?? []).map((id) => folders.delete(id)),
        ...(change.deletePresetIds ?? []).map((id) => presets.delete(id)),
        tx.done,
      ]);
    },
    loadSession: () => db.get('session', 'current'),
    async saveSession(session) {
      await db.put('session', session);
    },
  };
}
