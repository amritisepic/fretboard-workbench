import { useEffect, useRef } from 'react';
import { useWorkbench } from '../state/workbench';

interface ShortcutOptions {
  readonly settingsOpen: boolean;
  readonly dialogOpen: boolean;
  readonly closeSettings: () => void;
  readonly closeDialog: () => void;
  readonly requestDelete: (boxId: string) => void;
}

const isTextEntry = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));

const isControl = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, [role="switch"], [role="radio"]') !== null;

/**
 * Esc closes the topmost layer (dialog, then settings), otherwise deselects the box.
 * Space turns the selected box's fill on or off. Delete or Backspace asks to remove the box.
 */
export function useKeyboardShortcuts({
  settingsOpen,
  dialogOpen,
  closeSettings,
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
      if (event.key === 'Escape') {
        if (settingsOpen) closeSettings();
        else if (isTextEntry(event.target)) event.target.blur();
        else useWorkbench.getState().selectBox(null);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTextEntry(event.target)) return;

      const { selectedBoxId, toggleFill } = useWorkbench.getState();
      if (selectedBoxId === null) return;

      if (event.key === ' ') {
        if (isControl(event.target) && reachedByKeyboard) return;
        event.preventDefault();
        toggleFill(selectedBoxId);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        requestDelete(selectedBoxId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, dialogOpen, closeSettings, closeDialog, requestDelete]);
}
