import { useCallback, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ExplorerPanel } from './components/ExplorerPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useKeyboardShortcuts } from './components/useKeyboardShortcuts';
import { Workspace } from './components/Workspace';
import { useWorkbench } from './state/workbench';

export function App() {
  const selectedBox = useWorkbench((s) => s.boxes.find((box) => box.id === s.selectedBoxId));
  const removeBox = useWorkbench((s) => s.removeBox);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeExplorer = useCallback(() => setExplorerOpen(false), []);
  const closeDialog = useCallback(() => setPendingDelete(null), []);

  useKeyboardShortcuts({
    settingsOpen,
    explorerOpen,
    dialogOpen: pendingDelete !== null,
    closeSettings,
    closeExplorer,
    closeDialog,
    requestDelete: setPendingDelete,
  });

  return (
    <div className="app">
      <TopBar
        settingsOpen={settingsOpen}
        explorerOpen={explorerOpen}
        onToggleSettings={() => {
          setSettingsOpen((open) => !open);
          setExplorerOpen(false);
        }}
        onToggleExplorer={() => {
          setExplorerOpen((open) => !open);
          setSettingsOpen(false);
        }}
      />
      <div className="main">
        <Workspace />
        {selectedBox && <Sidebar box={selectedBox} />}
      </div>
      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
      {explorerOpen && <ExplorerPanel onClose={closeExplorer} />}
      {pendingDelete !== null && (
        <ConfirmDialog
          title="Delete this box?"
          body="Its notes and settings will be removed. This can't be undone."
          confirmLabel="Delete box"
          onCancel={closeDialog}
          onConfirm={() => {
            removeBox(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
