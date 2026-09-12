/** Folder and preset records, and pure helpers for working with the folder tree. */

import type { PresetData } from './presetFormat';

export interface FolderRecord {
  readonly id: string;
  /** null = top level. */
  readonly parentId: string | null;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface PresetRecord {
  readonly id: string;
  /** null = top level. */
  readonly folderId: string | null;
  readonly name: string;
  readonly data: PresetData;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const byName = (a: { readonly name: string }, b: { readonly name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export function childFolders(folders: readonly FolderRecord[], parentId: string | null): FolderRecord[] {
  return folders.filter((f) => f.parentId === parentId).sort(byName);
}

export function presetsIn(presets: readonly PresetRecord[], folderId: string | null): PresetRecord[] {
  return presets.filter((p) => p.folderId === folderId).sort(byName);
}

/** The folder and every folder and preset below it. */
export function subtreeContents(
  folders: readonly FolderRecord[],
  presets: readonly PresetRecord[],
  folderId: string,
): { readonly folderIds: string[]; readonly presetIds: string[] } {
  const folderIds = [folderId];
  for (let i = 0; i < folderIds.length; i++) {
    for (const folder of folders) if (folder.parentId === folderIds[i]) folderIds.push(folder.id);
  }
  const presetIds = presets.filter((p) => p.folderId !== null && folderIds.includes(p.folderId)).map((p) => p.id);
  return { folderIds, presetIds };
}

/** A folder may move to the top level or to any folder outside its own subtree. */
export function canMoveFolder(folders: readonly FolderRecord[], folderId: string, targetParentId: string | null): boolean {
  return targetParentId === null || !subtreeContents(folders, [], folderId).folderIds.includes(targetParentId);
}

/** `base`, or `base 2`, `base 3`… so no two siblings share a name (ignoring case). */
export function uniqueName(base: string, taken: readonly string[]): string {
  const names = new Set(taken.map((name) => name.toLocaleLowerCase()));
  const trimmed = base.trim() || 'Untitled';
  if (!names.has(trimmed.toLocaleLowerCase())) return trimmed;
  for (let n = 2; ; n++) {
    const candidate = `${trimmed} ${n}`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

export interface FolderOption {
  /** null = top level. */
  readonly id: string | null;
  readonly name: string;
  readonly depth: number;
}

/** Every place something can be moved to: the top level, then each folder in tree order. */
export function folderOptions(folders: readonly FolderRecord[]): FolderOption[] {
  const options: FolderOption[] = [{ id: null, name: 'Top level', depth: 0 }];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of childFolders(folders, parentId)) {
      options.push({ id: folder.id, name: folder.name, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 1);
  return options;
}

/** Ids of the folders containing `folderId`, outermost first. */
export function ancestorFolderIds(folders: readonly FolderRecord[], folderId: string | null): string[] {
  const chain: string[] = [];
  let current = folderId;
  while (current !== null && !chain.includes(current)) {
    chain.unshift(current);
    current = folders.find((f) => f.id === current)?.parentId ?? null;
  }
  return chain;
}

/** Characters that are unsafe in file names on common systems. */
const RESERVED_FILE_NAME_CHARACTERS = /[\\/:*?"<>|]+/g;

export function exportFileName(name: string): string {
  // Control characters are dropped by code point, so none have to appear in this source file.
  const printable = Array.from(name)
    .filter((character) => (character.codePointAt(0) ?? 0) >= 32)
    .join('');
  const safe = printable
    .replace(RESERVED_FILE_NAME_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${safe || 'preset'}.json`;
}
