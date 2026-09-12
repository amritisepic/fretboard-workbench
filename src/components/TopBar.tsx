import { documentStatus } from '../state/documentStatus';
import { useLibrary } from '../state/library';
import { useWorkbench } from '../state/workbench';
import { PresetNameField } from './PresetNameField';

export function TopBar({
  settingsOpen,
  explorerOpen,
  onToggleSettings,
  onToggleExplorer,
}: {
  readonly settingsOpen: boolean;
  readonly explorerOpen: boolean;
  readonly onToggleSettings: () => void;
  readonly onToggleExplorer: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <SaveButton />
        <button
          type="button"
          className={explorerOpen ? 'topbar-tab is-open' : 'topbar-tab'}
          aria-expanded={explorerOpen}
          aria-haspopup="dialog"
          data-explorer-tab=""
          onClick={onToggleExplorer}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4.5v8h12V6H7.5L6 4.5z" />
          </svg>
          Presets
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 4l2.5 2.5L7.5 4" />
          </svg>
        </button>
      </div>
      <PresetNameField />
      <div className="topbar-right">
        <button
          type="button"
          className={settingsOpen ? 'topbar-tab is-open' : 'topbar-tab'}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          data-settings-tab=""
          onClick={onToggleSettings}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
            <circle cx="10.5" cy="4" r="1.5" />
            <circle cx="5.5" cy="12" r="1.5" />
          </svg>
          Settings
        </button>
      </div>
    </header>
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
