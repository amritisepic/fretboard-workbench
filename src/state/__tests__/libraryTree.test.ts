import { describe, expect, it } from 'vitest';
import {
  ancestorFolderIds,
  canMoveFolder,
  childFolders,
  exportFileName,
  folderOptions,
  subtreeContents,
  uniqueName,
  type FolderRecord,
} from '../libraryTree';

const folder = (id: string, parentId: string | null, name = id): FolderRecord => ({
  id,
  parentId,
  name,
  createdAt: 0,
  updatedAt: 0,
});

// a
// ├── b
// │   └── c
// └── d
// e
const FOLDERS = [folder('a', null), folder('b', 'a'), folder('c', 'b'), folder('d', 'a'), folder('e', null)];

describe('library tree', () => {
  it('lists children in natural name order', () => {
    const numbered = [folder('1', null, 'Song 10'), folder('2', null, 'song 2'), folder('3', null, 'Song 1')];
    expect(childFolders(numbered, null).map((f) => f.name)).toEqual(['Song 1', 'song 2', 'Song 10']);
  });

  it('collects a folder subtree with its presets', () => {
    const presets = [
      { id: 'p1', folderId: 'c', name: 'x', data: {} as never, createdAt: 0, updatedAt: 0 },
      { id: 'p2', folderId: 'e', name: 'y', data: {} as never, createdAt: 0, updatedAt: 0 },
    ];
    expect(subtreeContents(FOLDERS, presets, 'a')).toEqual({ folderIds: ['a', 'b', 'd', 'c'], presetIds: ['p1'] });
  });

  it('never moves a folder into itself or below itself', () => {
    expect(canMoveFolder(FOLDERS, 'a', 'c')).toBe(false);
    expect(canMoveFolder(FOLDERS, 'a', 'a')).toBe(false);
    expect(canMoveFolder(FOLDERS, 'b', 'd')).toBe(true);
    expect(canMoveFolder(FOLDERS, 'c', null)).toBe(true);
  });

  it('lists move targets in tree order and finds ancestors', () => {
    expect(folderOptions(FOLDERS).map((o) => `${'-'.repeat(o.depth)}${o.name}`)).toEqual(['Top level', '-a', '--b', '---c', '--d', '-e']);
    expect(ancestorFolderIds(FOLDERS, 'c')).toEqual(['a', 'b', 'c']);
    expect(ancestorFolderIds(FOLDERS, null)).toEqual([]);
  });

  it('keeps sibling names unique, ignoring case', () => {
    expect(uniqueName('Blues', [])).toBe('Blues');
    expect(uniqueName('Blues', ['blues', 'Blues 2'])).toBe('Blues 3');
    expect(uniqueName('   ', [])).toBe('Untitled');
  });

  it('makes safe export file names', () => {
    expect(exportFileName('Minor blues / take 2')).toBe('Minor blues - take 2.json');
    expect(exportFileName('ii–V–I in B♭')).toBe('ii–V–I in B♭.json');
    expect(exportFileName('???')).toBe('-.json');
    expect(exportFileName('   ')).toBe('preset.json');
  });
});
