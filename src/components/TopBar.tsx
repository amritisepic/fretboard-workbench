import { useId } from 'react';
import { documentStatus } from '../state/documentStatus';
import { useLibrary } from '../state/library';
import { usePreferences, type Screen } from '../state/preferences';
import { useWorkbench } from '../state/workbench';
import { PresetNameField } from './PresetNameField';
import { Segmented, type SegmentedOption } from './Segmented';

type WorkbenchMode = 'edit' | 'view';

const MODE_OPTIONS: readonly SegmentedOption<WorkbenchMode>[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'view', label: 'View' },
];

const SCREEN_OPTIONS: readonly SegmentedOption<Screen>[] = [
  { value: 'workbench', label: 'Workbench' },
  { value: 'scales', label: 'Scale wizard' },
];

export function TopBar({
  settingsOpen,
  explorerOpen,
  onToggleSettings,
  onToggleExplorer,
  onOpenExport,
  onStartTour,
}: {
  readonly settingsOpen: boolean;
  readonly explorerOpen: boolean;
  readonly onToggleSettings: () => void;
  readonly onToggleExplorer: () => void;
  readonly onOpenExport: () => void;
  readonly onStartTour: () => void;
}) {
  const screen = usePreferences((s) => s.screen);
  const setScreen = usePreferences((s) => s.setScreen);
  const hasBoxes = useWorkbench((s) => s.boxes.length > 0);
  const workbench = screen === 'workbench';
  const canExport = !workbench || hasBoxes;
  const exportReasonId = useId();

  return (
    <header className={workbench ? 'topbar' : 'topbar is-scales'}>
      <div className="topbar-left">
        <div className="app-switch" data-tour="app-switch">
          <Segmented label="Tool" options={SCREEN_OPTIONS} value={screen} onChange={setScreen} />
        </div>
        {workbench && (
          <>
            <SaveButton />
            <button
              type="button"
              className={explorerOpen ? 'topbar-tab is-open' : 'topbar-tab'}
              aria-expanded={explorerOpen}
              aria-haspopup="dialog"
              data-explorer-tab=""
              data-tour="presets"
              onClick={onToggleExplorer}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 4.5v8h12V6H7.5L6 4.5z" />
              </svg>
              <span className="topbar-tab-label">Presets</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 4l2.5 2.5L7.5 4" />
              </svg>
            </button>
          </>
        )}
      </div>
      {workbench ? <PresetNameField /> : <h1 className="topbar-title">Scale wizard</h1>}
      <div className="topbar-right">
        {workbench && <ModeSwitch />}
        <div className="topbar-tools">
          <button type="button" className="topbar-button" data-tour="guide" title="Take the guided tour" onClick={onStartTour}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" />
              <path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4" />
              <circle cx="8" cy="11.6" r="0.4" fill="currentColor" />
            </svg>
            <span className="topbar-tab-label">Guide</span>
          </button>
          <button
            type="button"
            className="topbar-button"
            data-tour="export"
            // `aria-disabled` rather than `disabled`, so the button keeps its place in the tab order
            // and the reason below can reach a keyboard or screen-reader user. A `disabled` button
            // is unfocusable and unhoverable, so its title reaches nobody on a touch screen.
            aria-disabled={!canExport}
            aria-describedby={canExport ? undefined : exportReasonId}
            title={canExport ? `Export the ${workbench ? 'preset' : 'scale'} as a PDF or an image` : undefined}
            onClick={canExport ? onOpenExport : undefined}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2.5v8M4.8 7.5L8 10.7l3.2-3.2M3 13.5h10" />
            </svg>
            <span className="topbar-tab-label">Export</span>
          </button>
          {!canExport && (
            <span className="visually-hidden" id={exportReasonId}>
              Add a chord to export.
            </span>
          )}
        </div>
        <button
          type="button"
          className={settingsOpen ? 'topbar-tab topbar-settings is-open' : 'topbar-tab topbar-settings'}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          data-settings-tab=""
          data-tour="settings"
          onClick={onToggleSettings}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
            <circle cx="10.5" cy="4" r="1.5" />
            <circle cx="5.5" cy="12" r="1.5" />
          </svg>
          <span className="topbar-tab-label">Settings</span>
        </button>
      </div>
    </header>
  );
}

/** Edit, or view: the canvas scaled to fit the screen with the editing controls put away. */
function ModeSwitch() {
  const viewing = useWorkbench((s) => s.viewing);
  const setViewing = useWorkbench((s) => s.setViewing);
  return (
    <div className="mode-switch" data-tour="view-mode">
      <Segmented
        label="Mode"
        options={MODE_OPTIONS}
        value={viewing ? 'view' : 'edit'}
        onChange={(mode) => setViewing(mode === 'view')}
      />
    </div>
  );
}

function SaveButton() {
  const requestSave = useLibrary((s) => s.requestSave);
  const feedback = useLibrary((s) => s.saveFeedback);
  const status = useWorkbench(documentStatus);

  const label =
    feedback === 'saving'
      ? 'Saving…'
      : feedback === 'saved'
        ? 'Saved'
        : feedback === 'error'
          ? 'Couldn’t save'
          : status === 'saved'
            ? 'Saved'
            : 'Save';

  return (
    <button
      type="button"
      className={feedback === 'idle' && status !== 'saved' ? 'save-button has-changes' : 'save-button'}
      disabled={feedback === 'saving'}
      aria-keyshortcuts="Control+S Meta+S"
      title="Save preset (Ctrl+S)"
      onClick={() => void requestSave()}
    >
      {label}
    </button>
  );
}
