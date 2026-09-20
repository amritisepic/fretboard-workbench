import { Suspense, lazy, useCallback, useEffect, useState, type ComponentType } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import type { TourPanel } from './components/tour/tourSteps';
import { useLibrary } from './state/library';
import { TopBar } from './components/TopBar';
import { UpdateNotice } from './components/UpdateNotice';
import { useKeyboardShortcuts } from './components/useKeyboardShortcuts';
import { Workspace } from './components/Workspace';
import { usePreferences } from './state/preferences';
import { useWorkbench } from './state/workbench';

/*
 * Everything that opens on a click is split out of the first download, because none of it is needed
 * to draw a workbench: the presets panel (which carries the 88 built-in example progressions), the
 * export machinery (a PDF writer and two print sheets), the guided tour, the scale wizard, the
 * settings panel and a box's sidebar. What renders on load is not split, however heavy: anyone
 * reopening saved work would then watch their own canvas arrive a round trip late.
 *
 * The examples are not moved by hand. `src/data/examples.ts` reaches the app only through the
 * presets panel and the tour, so making those two lazy carries the data out of the first chunk on
 * its own, leaving `src/state/examples.ts` a plain synchronous module for the tests that import it.
 */

/**
 * One split component, together with the call that fetches its chunk ahead of time.
 *
 * `lazy` suspends on its first render even when the module is already in memory, and React holds the
 * Suspense fallback for a beat before replacing it — measured here at about a tenth of a second of
 * nothing after the first click on Presets or Settings, long enough that the guided tour outlined an
 * empty screen where the panel should have been. So a component whose chunk has already arrived is
 * rendered straight, and `lazy` inside its Suspense boundary stays as the cold path, for the click
 * that gets there first.
 *
 * Whichever of the two a mount starts on it stays on, so a warm-up landing mid-life cannot remount
 * an open panel and throw away what the reader had unfolded in it.
 */
function splitComponent<M, P extends object>(
  load: () => Promise<M>,
  pick: (module: M) => ComponentType<P>,
): readonly [ComponentType<P>, () => Promise<void>] {
  let warmed: ComponentType<P> | null = null;
  // A lazy component takes the props of the component it stands for, but through a conditional type
  // React's own definitions cannot resolve while P is still a parameter, so it is named here.
  const Lazy = lazy(() => load().then((module) => ({ default: pick(module) }))) as ComponentType<P>;
  const warm = () =>
    load().then(
      (module) => {
        warmed = pick(module);
      },
      // A warm-up that fails is not worth reporting: whatever went wrong will happen again, with
      // the error where the user can see it, when the component is actually opened.
      () => {},
    );
  function Split(props: P) {
    // Held in an object because `useState` would take a bare component for an initializer function.
    const [{ Component }] = useState(() => ({ Component: warmed ?? Lazy }));
    return <Component {...props} />;
  }
  return [Split, warm];
}

const [ExplorerPanel, warmExplorerPanel] = splitComponent(() => import('./components/ExplorerPanel'), (m) => m.ExplorerPanel);
const [ExportDialog, warmExportDialog] = splitComponent(() => import('./components/export/ExportDialog'), (m) => m.ExportDialog);
const [GuidedTour, warmGuidedTour] = splitComponent(() => import('./components/tour/GuidedTour'), (m) => m.GuidedTour);
const [ScaleWizard, warmScaleWizard] = splitComponent(() => import('./components/ScaleWizard'), (m) => m.ScaleWizard);
const [SettingsPanel, warmSettingsPanel] = splitComponent(() => import('./components/SettingsPanel'), (m) => m.SettingsPanel);
const [Sidebar, warmSidebar] = splitComponent(() => import('./components/Sidebar'), (m) => m.Sidebar);

// The scale wizard is the one split component that can render on load, because the tool in use is
// remembered. Its chunk is asked for here, while this module is still being evaluated, so it
// downloads alongside the session that persistence is already reading rather than after it.
if (usePreferences.getState().screen === 'scales') void warmScaleWizard();

/** How long to wait for an idle moment before warming the split chunks anyway. */
const WARM_TIMEOUT_MS = 2000;

/**
 * Fetches the split chunks in the background, so opening any of them costs no round trip at all.
 * This runs at the first idle moment after the workbench is on screen, which is what the split buys:
 * the first paint pays for none of it. Warming them early costs nothing either, since the service
 * worker precaches every chunk in any case.
 *
 * Intent would be a better trigger than idleness — hovering Presets, say — but the buttons that open
 * these live in the top bar and the canvas, and one warm-up here covers all of them.
 */
function warmSplitChunks(): void {
  void warmSidebar();
  void warmScaleWizard();
  void warmExplorerPanel();
  void warmSettingsPanel();
  void warmExportDialog();
  void warmGuidedTour();
}

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
  /** An empty workbench offers the examples, which live in the presets panel. */
  const openExplorer = useCallback(() => {
    setExplorerOpen(true);
    setSettingsOpen(false);
  }, []);
  /** Removing a box asks first, unless delete warnings are switched off in Settings. */
  const requestDelete = useCallback(
    (boxId: string) => {
      if (usePreferences.getState().deleteWarnings) setPendingDelete(boxId);
      else removeBox(boxId);
    },
    [removeBox],
  );

  useEffect(() => {
    if (typeof requestIdleCallback !== 'function') {
      const timer = setTimeout(warmSplitChunks, WARM_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
    const handle = requestIdleCallback(warmSplitChunks, { timeout: WARM_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }, []);

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
      {/* Every fallback below is nothing at all. These arrive over a screen that is already drawn,
          in well under the time it takes to let go of the mouse, and a spinner that appears and
          disappears inside a frame reads as a glitch where an empty moment reads as nothing. */}
      <div className="main">
        {screen === 'workbench' ? (
          <>
            <Workspace onRequestRemove={requestDelete} onOpenExamples={openExplorer} />
            {selectedBox && !viewing && (
              <Suspense fallback={null}>
                <Sidebar box={selectedBox} />
              </Suspense>
            )}
          </>
        ) : (
          <Suspense fallback={null}>
            <ScaleWizard />
          </Suspense>
        )}
      </div>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel onClose={closeSettings} />
        </Suspense>
      )}
      {explorerOpen && (
        <Suspense fallback={null}>
          <ExplorerPanel onClose={closeExplorer} />
        </Suspense>
      )}
      <UpdateNotice />
      {exportOpen && (
        <Suspense fallback={null}>
          <ExportDialog screen={screen} onClose={() => setExportOpen(false)} />
        </Suspense>
      )}
      {tourOpen && (
        <Suspense fallback={null}>
          <GuidedTour onPanel={showPanel} onClose={closeTour} />
        </Suspense>
      )}
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
