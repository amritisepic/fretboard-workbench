import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ExplorerPanel } from './components/ExplorerPanel';
import { ExportDialog } from './components/export/ExportDialog';
import { GuidedTour } from './components/tour/GuidedTour';
import type { TourPanel } from './components/tour/tourSteps';
import { useLibrary } from './state/library';
import { ScaleWizard } from './components/ScaleWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UpdateNotice } from './components/UpdateNotice';
import { useKeyboardShortcuts } from './components/useKeyboardShortcuts';
import { Workspace } from './components/Workspace';
import { usePreferences } from './state/preferences';
import { useWorkbench } from './state/workbench';

export function App() {
  const selectedBox = useWorkbench((s) => s.boxes.find((box) => box.id === s.selectedBoxId));
  const viewing = useWorkbench((s) => s.viewing);
  const removeBox = useWorkbench((s) => s.removeBox);
  const screen = usePreferences((s) => s.screen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // The tour offers itself on a first visit: nothing saved, nothing on the workbench, never seen before.
  const [tourOpen, setTourOpen] = useState(
    () =>
      !usePreferences.getState().tourSeen &&
      useWorkbench.getState().boxes.length === 0 &&
      useLibrary.getState().presets.length === 0 &&
      useLibrary.getState().folders.length === 0,
  );
  const closeTour = useCallback(() => setTourOpen(false), []);
  const showPanel = useCallback((panel: TourPanel) => {
    setSettingsOpen(panel === 'settings');
    setExplorerOpen(panel === 'explorer');
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeExplorer = useCallback(() => setExplorerOpen(false), []);
  const closeDialog = useCallback(() => {
    setPendingDelete(null);
    setExportOpen(false);
  }, []);
  /** Removing a box asks first, unless delete warnings are switched off in Settings. */
  const requestDelete = useCallback(
    (boxId: string) => {
      if (usePreferences.getState().deleteWarnings) setPendingDelete(boxId);
      else removeBox(boxId);
    },
    [removeBox],
  );

  // The presets panel belongs to the workbench.
  useEffect(() => {
    if (screen !== 'workbench') setExplorerOpen(false);
  }, [screen]);

  useKeyboardShortcuts({
    screen,
    settingsOpen,
    explorerOpen,
    dialogOpen: pendingDelete !== null || exportOpen || tourOpen,
    closeSettings,
    closeExplorer,
    closeDialog,
    requestDelete,
  });

  return (
    <div className={screen === 'workbench' ? 'app' : 'app is-scales'}>
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
        onOpenExport={() => {
          setExportOpen(true);
          setSettingsOpen(false);
          setExplorerOpen(false);
        }}
        onStartTour={() => {
          setExportOpen(false);
          setPendingDelete(null);
          setTourOpen(true);
        }}
      />
      <div className="main">
        {screen === 'workbench' ? (
          <>
            <Workspace onRequestRemove={requestDelete} />
            {selectedBox && !viewing && <Sidebar box={selectedBox} />}
          </>
        ) : (
          <ScaleWizard />
        )}
      </div>
      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
      {explorerOpen && <ExplorerPanel onClose={closeExplorer} />}
      <UpdateNotice />
      {exportOpen && <ExportDialog screen={screen} onClose={() => setExportOpen(false)} />}
      {tourOpen && <GuidedTour onPanel={showPanel} onClose={closeTour} />}
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
