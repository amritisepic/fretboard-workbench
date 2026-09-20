import type { KeyboardEvent } from 'react';

/**
 * The keyboard half of the WAI-ARIA menu pattern, for the popup menus built out of buttons: the
 * arrow keys move focus between the items, Home and End jump to the ends, and Tab leaves. Declaring
 * `role="menu"` is a promise that these work, because a screen reader tells the user to press the
 * arrow keys the moment it reads the menu.
 *
 * This is a sibling of rovingRadioGroup rather than a use of it, because a menu's contract is the
 * other one: focus moves without choosing anything, the choice is a separate press, and leaving by
 * any route hands focus back to the button that opened the menu rather than abandoning it on an item
 * that is about to be unmounted. Escape is not here for that reason — it closes the menu the same
 * way, but the panel owns it, since the panel is what has to decide between closing the menu and
 * closing itself.
 *
 * Disabled items are skipped rather than focused: they are real `disabled` buttons, which no browser
 * will focus, so treating them as stops would strand the arrow keys on them.
 *
 * This is a plain function and not a hook: everything it returns is derived from the argument, so
 * there is no state to hold and a `use` prefix would promise one.
 */
export function rovingMenu(close: () => void) {
  return {
    /**
     * Belongs on the element carrying `role="menu"`, where it catches the keys as they bubble from
     * whichever item has focus, so the items need no key handling of their own.
     */
    onKeyDown: (event: KeyboardEvent<HTMLElement>): void => {
      // Shortcuts such as Ctrl+Home belong to the browser or the app, not to the menu.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Tab') {
        // The ARIA practices treat a menu as a detour: Tab shuts it and the tab order carries on
        // from the button that opened it, which `close` has just put focus back on. The browser
        // moves focus from there, so the key is deliberately left alone.
        close();
        return;
      }
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]:not([disabled])')];
      if (items.length === 0) return;
      const next = destination(event.key, items.indexOf(document.activeElement as HTMLElement), items.length);
      if (next === null) return;
      // Arrow keys would otherwise scroll the panel the menu sits in, and the app's own arrow-key
      // shortcut on the window would nudge the selected box's root at the same time. React's
      // handlers run at the root container, below the window, so stopping the event is what keeps it
      // from reaching that shortcut; preventing the default alone would not.
      event.preventDefault();
      event.stopPropagation();
      items[next].focus();
    },
  };
}

/** Where a key takes the menu from the item at `at`, or null for a key the menu does not claim. */
function destination(key: string, at: number, count: number): number | null {
  switch (key) {
    // A menu is one column, and the horizontal keys would belong to a menubar this app does not
    // have, so only the vertical ones move. Both ends wrap, as the ARIA practices describe.
    case 'ArrowDown':
      // A key pressed while focus is still on its way into the menu counts from outside either end.
      return at < 0 ? 0 : (at + 1) % count;
    case 'ArrowUp':
      return at < 0 ? count - 1 : (at + count - 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
