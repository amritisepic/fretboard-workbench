import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExampleFolder, ExampleProgression } from '../data/examples';
import { hasUnsavedWork } from '../state/documentStatus';
import { EXAMPLE_FOLDERS, exampleDocument } from '../state/examples';
import { useLibrary } from '../state/library';
import {
  ancestorFolderIds,
  childFolders,
  folderOptions,
  presetsIn,
  subtreeContents,
  type FolderRecord,
  type PresetRecord,
} from '../state/libraryTree';
import { useWorkbench } from '../state/workbench';
import { ConfirmDialog } from './ConfirmDialog';
import { downloadText } from './download';

interface Target {
  readonly kind: 'folder' | 'preset';
  readonly id: string;
}

interface Confirmation {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}

interface Notice {
  readonly tone: 'info' | 'error';
  readonly text: string;
}

interface MenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
}

const sameTarget = (a: Target | null, b: Target) => a !== null && a.kind === b.kind && a.id === b.id;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');

/** The preset explorer: saved presets in nested folders, with create, rename, move, delete, export and import. */
export function ExplorerPanel({ onClose }: { readonly onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFolderId = useRef<string | null>(null);
  const library = useLibrary();
  const openPresetId = useWorkbench((s) => s.document.presetId);
  const newDocument = useWorkbench((s) => s.newDocument);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
    const open = library.presets.find((p) => p.id === openPresetId);
    return new Set(open ? ancestorFolderIds(library.folders, open.folderId) : []);
  });
  const [menu, setMenu] = useState<Target | null>(null);
  const [moving, setMoving] = useState<Target | null>(null);
  const [renaming, setRenaming] = useState<Target | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target) || target.closest('[data-explorer-tab]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const expand = (folderId: string | null) => {
    if (folderId !== null) setExpanded((previous) => new Set([...previous, ...ancestorFolderIds(library.folders, folderId), folderId]));
  };
  const toggle = (folderId: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  const closeMenus = () => {
    setMenu(null);
    setMoving(null);
  };

  /** Runs an action, showing its returned message or its error. */
  const run = async (action: () => Promise<string | void> | string | void) => {
    try {
      const message = await action();
      setNotice(typeof message === 'string' ? { tone: 'info', text: message } : null);
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error) });
    }
  };

  const guardUnsavedWork = (proceed: () => void, question: string) => {
    const workbench = useWorkbench.getState();
    if (!hasUnsavedWork(workbench)) {
      proceed();
      return;
    }
    setConfirmation({
      title: 'Discard unsaved changes?',
      body: `“${workbench.document.name}” has changes that haven’t been saved. ${question}`,
      confirmLabel: 'Discard changes',
      onConfirm: proceed,
    });
  };

  const openPreset = (preset: PresetRecord) => {
    closeMenus();
    if (preset.id === openPresetId) {
      onClose();
      return;
    }
    guardUnsavedWork(() => {
      library.openPreset(preset.id);
      onClose();
    }, `Open “${preset.name}” anyway?`);
  };

  const startNewPreset = () =>
    guardUnsavedWork(() => {
      newDocument();
      onClose();
    }, 'Start a new preset anyway?');

  /** Examples open as unsaved copies; Save puts one in the library. */
  const openExample = (folder: ExampleFolder, example: ExampleProgression) => {
    closeMenus();
    guardUnsavedWork(
      () =>
        void run(() => {
          useWorkbench.getState().loadDocument(exampleDocument(example, folder));
          onClose();
        }),
      `Open the example “${example.name}” anyway?`,
    );
  };

  const createFolder = (parentId: string | null) =>
    run(async () => {
      closeMenus();
      const folder = await library.createFolder(parentId);
      expand(parentId);
      setRenaming({ kind: 'folder', id: folder.id });
    });

  const startImport = (folderId: string | null) => {
    closeMenus();
    importFolderId.current = folderId;
    fileRef.current?.click();
  };

  const importChosenFile = async (file: File | undefined) => {
    if (!file) return;
    const folderId = importFolderId.current;
    await run(async () => {
      const message = await library.importFile(await file.text(), folderId);
      expand(folderId);
      return message;
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportAll = () =>
    run(() => {
      closeMenus();
      const file = library.exportLibrary();
      downloadText(file.fileName, file.text);
      return `Exported every folder and preset to ${file.fileName}.`;
    });

  const exportTarget = (target: Target) =>
    run(() => {
      closeMenus();
      const file = target.kind === 'preset' ? library.exportPreset(target.id) : library.exportFolder(target.id);
      downloadText(file.fileName, file.text);
      return `Exported ${file.fileName}.`;
    });

  const moveTarget = (target: Target, folderId: string | null) =>
    run(async () => {
      closeMenus();
      if (target.kind === 'folder') await library.moveFolder(target.id, folderId);
      else await library.movePreset(target.id, folderId);
      expand(folderId);
    });

  const commitRename = (target: Target, name: string) => {
    setRenaming(null);
    void run(() => (target.kind === 'folder' ? library.renameFolder(target.id, name) : library.renamePreset(target.id, name)));
  };

  const confirmDelete = (target: Target) => {
    closeMenus();
    if (target.kind === 'preset') {
      const preset = library.presets.find((p) => p.id === target.id);
      if (!preset) return;
      setConfirmation({
        title: `Delete preset “${preset.name}”?`,
        body: 'This can’t be undone. Export it first if you want to keep a copy.',
        confirmLabel: 'Delete preset',
        onConfirm: () => void run(() => library.deletePreset(preset.id)),
      });
      return;
    }
    const folder = library.folders.find((f) => f.id === target.id);
    if (!folder) return;
    const { folderIds, presetIds } = subtreeContents(library.folders, library.presets, folder.id);
    const inner = [folderIds.length > 1 ? plural(folderIds.length - 1, 'folder') : '', presetIds.length > 0 ? plural(presetIds.length, 'preset') : '']
      .filter(Boolean)
      .join(' and ');
    setConfirmation({
      title: `Delete folder “${folder.name}”?`,
      body: inner
        ? `Everything inside goes with it: ${inner}. This can’t be undone.`
        : 'The folder is empty. This can’t be undone.',
      confirmLabel: 'Delete folder',
      onConfirm: () => void run(() => library.deleteFolder(folder.id)),
    });
  };

  const renderMenus = (target: Target, items: readonly MenuItem[], name: string, currentParent: string | null) => (
    <>
      {sameTarget(menu, target) && (
        <div className="explorer-menu" role="menu" aria-label={`Actions for ${name}`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'explorer-menu-item is-danger' : 'explorer-menu-item'}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {sameTarget(moving, target) && (
        <div className="explorer-menu" role="menu" aria-label={`Move ${name} to`}>
          <p className="explorer-menu-title">Move to</p>
          {folderOptions(library.folders).map((option) => {
            const insideItself =
              target.kind === 'folder' &&
              option.id !== null &&
              subtreeContents(library.folders, [], target.id).folderIds.includes(option.id);
            return (
              <button
                key={option.id ?? 'top'}
                type="button"
                role="menuitem"
                className="explorer-menu-item"
                style={{ paddingLeft: 10 + option.depth * 14 }}
                disabled={option.id === currentParent || insideItself}
                onClick={() => void moveTarget(target, option.id)}
              >
                {option.name}
                {option.id === currentParent ? ' (here)' : ''}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const actionsButton = (target: Target, name: string) => (
    <button
      type="button"
      className="explorer-more"
      aria-label={`Actions for ${name}`}
      aria-expanded={sameTarget(menu, target) || sameTarget(moving, target)}
      onClick={() => {
        const open = sameTarget(menu, target) || sameTarget(moving, target);
        setMoving(null);
        setMenu(open ? null : target);
      }}
    >
      ⋯
    </button>
  );

  const renderLevel = (parentId: string | null, depth: number): ReactNode[] => {
    const folders = childFolders(library.folders, parentId);
    const presets = presetsIn(library.presets, parentId);
    const indent = { paddingLeft: 6 + depth * 18 };

    const folderItems = folders.map((folder: FolderRecord) => {
      const target: Target = { kind: 'folder', id: folder.id };
      const isExpanded = expanded.has(folder.id);
      const count = childFolders(library.folders, folder.id).length + presetsIn(library.presets, folder.id).length;
      return (
        <li key={folder.id}>
          <div className="explorer-row" style={indent}>
            <button
              type="button"
              className="explorer-caret"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
              aria-expanded={isExpanded}
              onClick={() => toggle(folder.id)}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
            {sameTarget(renaming, target) ? (
              <RenameInput initial={folder.name} onCommit={(name) => commitRename(target, name)} onCancel={() => setRenaming(null)} />
            ) : (
              <button type="button" className="explorer-name" onClick={() => toggle(folder.id)}>
                <FolderIcon />
                <span>{folder.name}</span>
              </button>
            )}
            <span className="explorer-meta">{count}</span>
            {actionsButton(target, folder.name)}
          </div>
          {renderMenus(
            target,
            [
              { label: 'New folder inside', onSelect: () => void createFolder(folder.id) },
              { label: 'Import into folder…', onSelect: () => startImport(folder.id) },
              { label: 'Rename', onSelect: () => { closeMenus(); setRenaming(target); } },
              { label: 'Move to…', onSelect: () => { setMenu(null); setMoving(target); } },
              { label: 'Export', onSelect: () => void exportTarget(target) },
              { label: 'Delete', onSelect: () => confirmDelete(target), danger: true },
            ],
            folder.name,
            folder.parentId,
          )}
          {isExpanded && (
            <ul className="explorer-list">
              {count === 0 ? (
                <li className="explorer-empty-folder" style={{ paddingLeft: 30 + (depth + 1) * 18 }}>
                  Empty
                </li>
              ) : (
                renderLevel(folder.id, depth + 1)
              )}
            </ul>
          )}
        </li>
      );
    });

    const presetItems = presets.map((preset) => {
      const target: Target = { kind: 'preset', id: preset.id };
      const isOpen = preset.id === openPresetId;
      return (
        <li key={preset.id}>
          <div className={isOpen ? 'explorer-row is-open' : 'explorer-row'} style={indent}>
            <span className="explorer-caret" aria-hidden="true" />
            {sameTarget(renaming, target) ? (
              <RenameInput initial={preset.name} onCommit={(name) => commitRename(target, name)} onCancel={() => setRenaming(null)} />
            ) : (
              <button type="button" className="explorer-name" aria-current={isOpen ? 'true' : undefined} onClick={() => openPreset(preset)}>
                <PresetIcon />
                <span>{preset.name}</span>
              </button>
            )}
            <span className="explorer-meta">
              {isOpen ? 'Open' : new Date(preset.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            {actionsButton(target, preset.name)}
          </div>
          {renderMenus(
            target,
            [
              { label: 'Open', onSelect: () => openPreset(preset) },
              { label: 'Rename', onSelect: () => { closeMenus(); setRenaming(target); } },
              { label: 'Move to…', onSelect: () => { setMenu(null); setMoving(target); } },
              { label: 'Export', onSelect: () => void exportTarget(target) },
              { label: 'Delete', onSelect: () => confirmDelete(target), danger: true },
            ],
            preset.name,
            preset.folderId,
          )}
        </li>
      );
    });

    return [...folderItems, ...presetItems];
  };

  const isEmpty = library.folders.length === 0 && library.presets.length === 0;

  return (
    <div
      className="explorer-panel"
      role="dialog"
      aria-label="Presets"
      ref={panelRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (menu || moving)) {
          event.stopPropagation();
          closeMenus();
        }
      }}
    >
      <div className="explorer-head">
        <h2 className="explorer-title">Presets</h2>
        <div className="explorer-actions">
          <button type="button" className="button is-compact" onClick={startNewPreset}>
            New preset
          </button>
          <button type="button" className="button is-compact" onClick={() => void createFolder(null)}>
            New folder
          </button>
          <button
            type="button"
            className="button is-compact"
            title="Import a preset, a folder or a full export"
            onClick={() => startImport(null)}
          >
            Import…
          </button>
          <button
            type="button"
            className="button is-compact"
            disabled={isEmpty}
            title="Save every folder and preset in one file, to back them up or move them to another browser"
            onClick={() => void exportAll()}
          >
            Export all
          </button>
        </div>
      </div>

      {library.status === 'unavailable' && (
        <p className="explorer-notice is-error">
          This browser won’t let the app store data, so presets last only until the tab closes.
        </p>
      )}
      {library.status === 'loading' && <p className="explorer-notice">Loading presets…</p>}
      {notice && (
        <p className={notice.tone === 'error' ? 'explorer-notice is-error' : 'explorer-notice'} role="status">
          {notice.text}
        </p>
      )}

      {isEmpty && library.status !== 'loading' ? (
        <p className="explorer-empty">
          No saved presets yet. Save the workbench to add one, import an export, or start from an example below.
        </p>
      ) : (
        <ul className="explorer-list">{renderLevel(null, 0)}</ul>
      )}

      <section className="explorer-examples" aria-label="Examples" data-tour="examples">
        <h3 className="explorer-section-title">Examples</h3>
        <p className="explorer-section-note">Each opens as an unsaved copy. Save it to keep your changes.</p>
        <ul className="explorer-list">
          {EXAMPLE_FOLDERS.map((folder) => {
            const id = `example:${folder.name}`;
            const isExpanded = expanded.has(id);
            return (
              <li key={id}>
                <div className="explorer-row" style={{ paddingLeft: 6 }}>
                  <button
                    type="button"
                    className="explorer-caret"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggle(id)}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <button type="button" className="explorer-name" onClick={() => toggle(id)}>
                    <FolderIcon />
                    <span>{folder.name}</span>
                  </button>
                  <span className="explorer-meta">{folder.examples.length}</span>
                </div>
                {isExpanded && (
                  <ul className="explorer-list">
                    {folder.examples.map((example) => (
                      <li key={example.name}>
                        <div className="explorer-row" style={{ paddingLeft: 24 }}>
                          <span className="explorer-caret" aria-hidden="true" />
                          <button type="button" className="explorer-name" onClick={() => openExample(folder, example)}>
                            <PresetIcon />
                            <span>{example.name}</span>
                          </button>
                          <span className="explorer-meta">{example.key}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void importChosenFile(event.target.files?.[0])}
      />

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          body={confirmation.body}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const { onConfirm } = confirmation;
            setConfirmation(null);
            onConfirm();
          }}
        />
      )}
    </div>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  readonly initial: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = (commit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const name = value.trim();
    if (commit && name && name !== initial) onCommit(name);
    else onCancel();
  };
  return (
    <input
      className="explorer-rename"
      aria-label="New name"
      autoFocus
      value={value}
      maxLength={120}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
    />
  );
}

function FolderIcon() {
  return (
    <svg className="explorer-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4.5v8h12V6H7.5L6 4.5z" />
    </svg>
  );
}

function PresetIcon() {
  return (
    <svg className="explorer-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M9.5 2.5V5H12" />
    </svg>
  );
}
