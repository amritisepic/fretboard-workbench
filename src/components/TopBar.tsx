export function TopBar({
  settingsOpen,
  onToggleSettings,
}: {
  readonly settingsOpen: boolean;
  readonly onToggleSettings: () => void;
}) {
  return (
    <header className="topbar">
      <div className="wordmark">Fretboard Workbench</div>
      <button
        type="button"
        className={settingsOpen ? 'settings-tab is-open' : 'settings-tab'}
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
    </header>
  );
}
