import { useEffect, useRef } from 'react';
import { useLibrary } from '../state/library';
import { useWorkbench } from '../state/workbench';

interface ShortcutOptions {
  readonly settingsOpen: boolean;
  readonly explorerOpen: boolean;
  readonly dialogOpen: boolean;
  readonly closeSettings: () => void;
  readonly closeExplorer: () => void;
  readonly closeDialog: () => void;
  readonly requestDelete: (boxId: string) => void;
}

const isTextEntry = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));

const isControl = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, [role="switch"], [role="radio"]') !== null;

/** Arrow keys nudge the selected box's root by a semitone. */
const ROOT_NUDGES: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
};

/**
 * Ctrl/Cmd+S saves. Esc closes the topmost layer (dialog, explorer, settings), otherwise it
 * deselects the box. With the explorer closed: Space turns the selected box's fill on or off,
 * arrow keys nudge its root, and Delete or Backspace asks to remove it. Keys typed into form
 * fields (including the mode slider and dropdowns) are left alone.
 */
export function useKeyboardShortcuts({
  settingsOpen,
  explorerOpen,
  dialogOpen,
  closeSettings,
  closeExplorer,
  closeDialog,
  requestDelete,
}: ShortcutOptions) {
  // Space on a control reached with the keyboard stays with that control. On a control that was
  // just clicked, Space means fill. Focus modality is tracked here rather than read from
  // :focus-visible, whose heuristics vary between browsers.
  const lastInput = useRef<'pointer' | 'keyboard'>('pointer');
  const keyboardFocused = useRef<EventTarget | null>(null);

  useEffect(() => {
    const onPointerDown = () => {
      lastInput.current = 'pointer';
    };
    const onFocusIn = (event: FocusEvent) => {
      keyboardFocused.current = lastInput.current === 'keyboard' ? event.target : null;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('focusin', onFocusIn, true);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const reachedByKeyboard = event.target === keyboardFocused.current;
      lastInput.current = 'keyboard';

      if (dialogOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDialog();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void useLibrary.getState().requestSave();
        return;
      }
      if (event.key === 'Escape') {
        if (explorerOpen) closeExplorer();
        else if (settingsOpen) closeSettings();
        else if (isTextEntry(event.target)) event.target.blur();
        else useWorkbench.getState().selectBox(null);
        return;
      }
      if (explorerOpen || event.metaKey || event.ctrlKey || event.altKey || isTextEntry(event.target)) return;

      const { selectedBoxId, viewing, toggleFill, transposeBox } = useWorkbench.getState();
      if (viewing || selectedBoxId === null) return;

      if (event.key === ' ') {
        if (isControl(event.target) && reachedByKeyboard) return;
        event.preventDefault();
        toggleFill(selectedBoxId);
      } else if (event.key in ROOT_NUDGES) {
        event.preventDefault();
        transposeBox(selectedBoxId, ROOT_NUDGES[event.key]);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        requestDelete(selectedBoxId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, explorerOpen, dialogOpen, closeSettings, closeExplorer, closeDialog, requestDelete]);
}
