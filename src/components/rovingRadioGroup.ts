import type { KeyboardEvent } from 'react';

/**
 * The keyboard half of the WAI-ARIA radiogroup pattern, for the groups built out of buttons rather
 * than `<input type="radio">`: one tab stop for the whole group, and arrow keys that move focus and
 * the selection together. Declaring `role="radiogroup"` is a promise that these work, because a
 * screen reader tells the user to press the arrow keys the moment it reads the group.
 *
 * Selection follows focus here, as it does in a native radio group, so there is one position to
 * track rather than two: the checked option is both the tab stop and where an arrow key counts
 * from. Arrow keys wrap at the ends, which is what the ARIA practices describe and what a native
 * group does.
 *
 * This is a plain function and not a hook: everything it returns is derived from the arguments, so
 * there is no state to hold and a `use` prefix would promise one.
 */
export function rovingRadioGroup<T>(values: readonly T[], value: T, onChange: (value: T) => void) {
  // A value that is none of the options — ColorField's custom color — leaves nothing checked, and
  // the pattern then puts the group's single tab stop on the first option.
  const anchor = Math.max(values.indexOf(value), 0);

  return {
    /** 0 for the option holding the group's tab stop, -1 for the rest, so Tab enters the group once. */
    tabIndex: (index: number): 0 | -1 => (index === anchor ? 0 : -1),

    /**
     * Belongs on the group itself, where it catches the keys as they bubble from whichever option
     * has focus, so the options need no key handling of their own.
     */
    onKeyDown: (event: KeyboardEvent<HTMLElement>): void => {
      // Shortcuts such as Ctrl+Home belong to the browser or the app, not to the group.
      if (event.altKey || event.ctrlKey || event.metaKey || values.length === 0) return;
      const next = destination(event.key, anchor, values.length);
      if (next === null) return;
      // Arrow keys would otherwise scroll the panel the group sits in, and the app's own arrow-key
      // shortcut on the window would nudge the selected box's root at the same time; a key the
      // group claims is the group's alone.
      event.preventDefault();
      event.stopPropagation();
      onChange(values[next]);
      // Focus has to follow, or the one tab stop moves out from under the user and the next Tab
      // starts from somewhere they never went. The options are rendered in the order of `values`,
      // and changing the selection re-renders them in place rather than moving them, so the button
      // to focus is there already.
      event.currentTarget.querySelectorAll<HTMLElement>(':scope > [role="radio"]')[next]?.focus();
    },
  };
}

/** Where a key takes the group from `anchor`, or null for a key the group does not claim. */
function destination(key: string, anchor: number, count: number): number | null {
  switch (key) {
    // The pattern treats a radiogroup as one line whichever way it is laid out, so both axes move,
    // and the horizontal keys stay useful in ColorField's grid where a row break is only wrapping.
    case 'ArrowRight':
    case 'ArrowDown':
      return (anchor + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (anchor + count - 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
