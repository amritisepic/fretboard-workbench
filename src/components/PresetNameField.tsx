import { useEffect, useRef, useState } from 'react';
import { documentStatus } from '../state/documentStatus';
import { useWorkbench } from '../state/workbench';

/**
 * The preset's name, edited in place at the top centre. Every keystroke goes straight to the
 * store, so Save and Ctrl+S always use what's typed. Blur restores a blank field. Esc reverts
 * to the name from before the current edit.
 */
export function PresetNameField() {
  const name = useWorkbench((s) => s.document.name);
  const savedSnapshot = useWorkbench((s) => s.document.savedSnapshot);
  const status = useWorkbench(documentStatus);
  const setPresetName = useWorkbench((s) => s.setPresetName);
  const [draft, setDraft] = useState(name);
  /** The name when the current edit began (its first keystroke), or null when not editing. */
  const nameBeforeEdit = useRef<string | null>(null);

  // Follow renames made elsewhere (the explorer, opening a preset). Skip when the store already holds
  // the typed name, so a trailing space mid-word isn't trimmed away while typing.
  useEffect(() => {
    setDraft((current) => (current.trim() === name ? current : name));
  }, [name]);

  // A save (Ctrl+S mid-edit) commits the typed name, so Esc afterwards goes back no further than that.
  useEffect(() => {
    nameBeforeEdit.current = null;
  }, [savedSnapshot]);

  const endEdit = () => {
    nameBeforeEdit.current = null;
  };

  return (
    <div className="preset-name">
      <input
        className="preset-name-input"
        aria-label="Preset name"
        value={draft}
        maxLength={120}
        size={Math.max(10, Math.min(40, draft.length + 2))}
        onChange={(event) => {
          if (nameBeforeEdit.current === null) nameBeforeEdit.current = name;
          setDraft(event.target.value);
          if (event.target.value.trim()) setPresetName(event.target.value);
        }}
        onBlur={() => {
          if (!draft.trim()) setDraft(name);
          endEdit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            endEdit();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            const original = nameBeforeEdit.current;
            if (original !== null) {
              setPresetName(original);
              setDraft(original);
            }
            endEdit();
            event.currentTarget.blur();
          }
        }}
      />
      {status !== 'saved' && (
        <span className={status === 'edited' ? 'preset-status is-edited' : 'preset-status'}>
          {status === 'edited' ? 'Edited' : 'Not saved'}
        </span>
      )}
    </div>
  );
}
