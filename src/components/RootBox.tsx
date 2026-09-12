export function RootBox({ root, onStep }: { readonly root: string; readonly onStep: (semitones: number) => void }) {
  return (
    <div className="field">
      <div className="root-box">
        <button type="button" className="root-step" aria-label="Transpose the box down a semitone" onClick={() => onStep(-1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <div className="root-value">
          <span className="root-label">Root</span>
          <output className="root-name" aria-live="polite">
            {root}
          </output>
        </div>
        <button type="button" className="root-step" aria-label="Transpose the box up a semitone" onClick={() => onStep(1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8h9M8 3.5v9" />
          </svg>
        </button>
      </div>
      <p className="hint">
        Moves the notes and scale together. <kbd>←</kbd> <kbd>→</kbd> also work.
      </p>
    </div>
  );
}
