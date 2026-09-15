import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keyName, makeScaleRef } from '../../theory';
import { documentStatus, hasUnsavedWork } from '../documentStatus';
import { EXAMPLE_FOLDERS, exampleDocument } from '../examples';
import { useLibrary } from '../library';
import { startPersistence } from '../persistence';
import { openRepository } from '../repository';
import { useWorkbench } from '../workbench';

const initialWorkbench = useWorkbench.getState();
const initialLibrary = useLibrary.getState();
const workbench = () => useWorkbench.getState();
const library = () => useLibrary.getState();
/** Names of the folders and presets directly inside a folder (null = top level), sorted. */
const childNames = (parentId: string | null) =>
  [
    ...library().folders.filter((f) => f.parentId === parentId).map((f) => f.name),
    ...library().presets.filter((p) => p.folderId === parentId).map((p) => p.name),
  ].sort();

let databaseCount = 0;
let databaseName = '';

function resetStores() {
  useWorkbench.setState(initialWorkbench, true);
  useLibrary.setState(initialLibrary, true);
}

/** A fresh, empty database. */
async function connectFresh() {
  resetStores();
  databaseName = `workbench-test-${++databaseCount}`;
  await library().connect(await openRepository(databaseName));
}

/** Simulates a reload: empty stores, same database. */
async function reconnect() {
  resetStores();
  await library().connect(await openRepository(databaseName));
}

beforeEach(connectFresh);

describe('preset library', () => {
  it('saves the workbench as a new preset, tracks edits, and overwrites on the next save', async () => {
    expect(documentStatus(workbench())).toBe('unsaved');
    const id = workbench().addBox();
    workbench().togglePosition(id, { string: 1, fret: 3 });
    workbench().setPresetName('Progression A');

    const saved = await library().saveCurrent();
    expect(saved.name).toBe('Progression A');
    expect(documentStatus(workbench())).toBe('saved');

    workbench().togglePosition(id, { string: 2, fret: 2 });
    expect(documentStatus(workbench())).toBe('edited');
    expect(hasUnsavedWork(workbench())).toBe(true);

    const again = await library().saveCurrent();
    expect(again.id).toBe(saved.id);
    expect(library().presets).toHaveLength(1);
    expect(documentStatus(workbench())).toBe('saved');
  });

  it('keeps presets and folders across a reload and opens a preset into the workbench', async () => {
    const jazz = await library().createFolder(null, 'Jazz');
    workbench().setKey(makeScaleRef('diatonic', 5, 'A'));
    workbench().addBox();
    workbench().setPresetName('Minor blues');
    const saved = await library().saveCurrent();
    await library().movePreset(saved.id, jazz.id);

    await reconnect();
    expect(library().folders.map((f) => f.name)).toEqual(['Jazz']);
    expect(library().presets.map((p) => [p.name, p.folderId])).toEqual([['Minor blues', jazz.id]]);
    expect(workbench().boxes).toHaveLength(0);

    library().openPreset(saved.id);
    expect(workbench().boxes).toHaveLength(1);
    expect(keyName(workbench().key)).toBe('A minor');
    expect(workbench().document).toMatchObject({ presetId: saved.id, name: 'Minor blues' });
    expect(documentStatus(workbench())).toBe('saved');
  });

  it('keeps names unique within a folder and requires a name', async () => {
    const first = await library().createFolder(null);
    const second = await library().createFolder(null);
    expect([first.name, second.name]).toEqual(['New folder', 'New folder 2']);
    await library().renameFolder(second.id, 'new folder');
    expect(library().folders.find((f) => f.id === second.id)?.name).toBe('new folder 2');
    await expect(library().renameFolder(first.id, '   ')).rejects.toThrow('A folder needs a name.');
  });

  it('moves folders but never into themselves, and deletes a folder with everything in it', async () => {
    const outer = await library().createFolder(null, 'Outer');
    const inner = await library().createFolder(outer.id, 'Inner');
    await expect(library().moveFolder(outer.id, inner.id)).rejects.toThrow('can’t be moved into itself');

    workbench().setPresetName('Tune');
    const tune = await library().saveCurrent();
    await library().movePreset(tune.id, inner.id);
    await library().moveFolder(inner.id, null);
    expect(library().folders.find((f) => f.id === inner.id)?.parentId).toBeNull();
    await library().moveFolder(inner.id, outer.id);

    await library().deleteFolder(outer.id);
    expect(library().folders).toEqual([]);
    expect(library().presets).toEqual([]);
    expect(workbench().document.presetId).toBeNull();
    expect(documentStatus(workbench())).toBe('unsaved');

    await reconnect();
    expect(library().folders).toEqual([]);
    expect(library().presets).toEqual([]);
  });

  it('renames the open preset without losing unsaved edits', async () => {
    workbench().setPresetName('Sketch');
    const saved = await library().saveCurrent();
    workbench().addBox();
    await library().renamePreset(saved.id, 'Sketch 1');
    expect(workbench().document.name).toBe('Sketch 1');
    expect(documentStatus(workbench())).toBe('edited');
  });

  it('exports and imports a preset with a fresh name and box ids', async () => {
    const boxId = workbench().addBox();
    workbench().setPresetName('Voicings');
    const saved = await library().saveCurrent();

    const file = library().exportPreset(saved.id);
    expect(file.fileName).toBe('Voicings.json');
    expect(await library().importFile(file.text, null)).toBe('Imported preset “Voicings 2”.');
    const imported = library().presets.find((p) => p.name === 'Voicings 2');
    expect(imported?.data.boxes).toHaveLength(1);
    expect(imported?.data.boxes[0].id).not.toBe(boxId);
  });

  it('exports a folder tree and imports it into another library', async () => {
    const setList = await library().createFolder(null, 'Set list');
    const encore = await library().createFolder(setList.id, 'Encore');
    workbench().setPresetName('Opener');
    const opener = await library().saveCurrent();
    await library().movePreset(opener.id, setList.id);
    workbench().newDocument();
    workbench().setPresetName('Closer');
    const closer = await library().saveCurrent();
    await library().movePreset(closer.id, encore.id);
    const file = library().exportFolder(setList.id);

    await connectFresh();
    const target = await library().createFolder(null, 'Imported');
    expect(await library().importFile(file.text, target.id)).toBe('Imported folder “Set list” with 2 presets.');
    const importedSetList = library().folders.find((f) => f.name === 'Set list');
    const importedEncore = library().folders.find((f) => f.name === 'Encore');
    expect(importedSetList?.parentId).toBe(target.id);
    expect(importedEncore?.parentId).toBe(importedSetList?.id);
    expect(library().presets.find((p) => p.name === 'Opener')?.folderId).toBe(importedSetList?.id);
    expect(library().presets.find((p) => p.name === 'Closer')?.folderId).toBe(importedEncore?.id);

    await reconnect();
    expect(library().folders).toHaveLength(3);
    expect(library().presets).toHaveLength(2);
  });

  it('exports every folder and preset in one file and restores them in another library', async () => {
    expect(() => library().exportLibrary()).toThrow('There are no presets to export yet.');
    const setList = await library().createFolder(null, 'Set list');
    const encore = await library().createFolder(setList.id, 'Encore');
    workbench().setPresetName('Opener');
    const opener = await library().saveCurrent();
    await library().movePreset(opener.id, encore.id);
    workbench().newDocument();
    workbench().setPresetName('Loose idea');
    await library().saveCurrent();

    const file = library().exportLibrary();
    expect(file.fileName).toMatch(/^Fretboard Workbench presets \d{4}-\d{2}-\d{2}\.json$/);

    await connectFresh();
    expect(await library().importFile(file.text, null)).toBe('Imported 2 folders and 2 presets.');
    const importedSetList = library().folders.find((f) => f.name === 'Set list');
    const importedEncore = library().folders.find((f) => f.name === 'Encore');
    expect(importedSetList?.parentId).toBeNull();
    expect(importedEncore?.parentId).toBe(importedSetList?.id);
    expect(library().presets.map((p) => [p.name, p.folderId])).toEqual(
      expect.arrayContaining([
        ['Opener', importedEncore?.id],
        ['Loose idea', null],
      ]),
    );

    // Importing the same backup again keeps both copies side by side.
    expect(await library().importFile(file.text, null)).toBe('Imported 2 folders and 2 presets.');
    expect(childNames(null)).toEqual(['Loose idea', 'Loose idea 2', 'Set list', 'Set list 2']);
    await reconnect();
    expect(library().folders).toHaveLength(4);
    expect(library().presets).toHaveLength(4);
  });

  it('opens an example as an unsaved copy that only counts as unsaved work once edited, and saves it', async () => {
    const standards = EXAMPLE_FOLDERS.find((f) => f.name === 'Jazz standards');
    const blueBossa = standards?.examples.find((e) => e.name === 'Blue Bossa');
    if (!standards || !blueBossa) throw new Error('missing example');
    workbench().loadDocument(exampleDocument(blueBossa, standards));
    expect(workbench().document.presetId).toBeNull();
    expect(documentStatus(workbench())).toBe('unsaved');
    expect(hasUnsavedWork(workbench())).toBe(false);
    workbench().setOrientation('horizontal');
    expect(hasUnsavedWork(workbench())).toBe(true);

    const saved = await library().saveCurrent();
    expect(saved.name).toBe('Blue Bossa');
    expect(documentStatus(workbench())).toBe('saved');
  });

  it('rejects a broken import without changing the library', async () => {
    await expect(library().importFile('{"format":"something-else"}', null)).rejects.toThrow('not a Fretboard Workbench export');
    expect(library().presets).toEqual([]);
  });
});

describe('session persistence', () => {
  it('restores the working state after a reload, including unsaved edits and the open preset', async () => {
    const stop = await startPersistence(() => openRepository(databaseName));
    workbench().setPresetName('Draft');
    const saved = await library().saveCurrent();
    const id = workbench().addBox();
    workbench().togglePosition(id, { string: 3, fret: 5 });
    workbench().setStrips({ labelMode: 'degrees' });
    await stop();

    resetStores();
    const stopAgain = await startPersistence(() => openRepository(databaseName));
    expect(workbench().document).toMatchObject({ presetId: saved.id, name: 'Draft' });
    expect(workbench().boxes[0].positions).toEqual([{ string: 3, fret: 5 }]);
    expect(workbench().strips.labelMode).toBe('degrees');
    expect(documentStatus(workbench())).toBe('edited');
    await stopAgain();
  });

  it('works in memory when IndexedDB cannot be opened', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetStores();
    const stop = await startPersistence(() => Promise.reject(new Error('blocked')));
    expect(library().status).toBe('unavailable');
    workbench().setPresetName('Scratch');
    await library().saveCurrent();
    expect(library().presets.map((p) => p.name)).toEqual(['Scratch']);
    await stop();
    warn.mockRestore();
  });
});
