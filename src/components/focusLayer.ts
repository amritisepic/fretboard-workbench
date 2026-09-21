import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

/**
 * Focus and Escape for the app's overlay surfaces, which are not all the same kind of thing.
 *
 * Three of them are modal: the confirmation, the export dialog and the guided tour block the app and
 * demand an answer. Two are not: the settings and preset panels hang off a top-bar tab with the
 * canvas behind them still live, still clickable and still worth reading, which is why they close on
 * a press outside. `useModalLayer` and `usePopoverLayer` differ over exactly that — one makes the
 * page behind inert and keeps Tab inside, the other leaves the page alone — and agree on what every
 * overlay owes the user either way: focus moves in when it opens, Escape closes it, and focus goes
 * back to whatever opened it when it does.
 *
 * Native `<dialog>.showModal()` would give the trap, the backdrop, Escape and the inertness for
 * nothing, and in a browser it is the better answer. It is not used here because jsdom 28 implements
 * none of `HTMLDialogElement` — `show`, `showModal`, `close` and `requestClose` are all undefined —
 * and no `HTMLElement.inert` and no sequential focus navigation either. Emulating that in
 * `src/test/setup.ts` would put a second implementation of modality in the test harness and leave
 * the suite asserting the harness rather than the app. What is hand-rolled below is only the Tab
 * trap; the inertness is the real `inert` attribute, which is what `showModal()` applies to the page
 * behind it anyway.
 */

/** The root of every modal layer currently open. */
const modalRoots = new Set<HTMLElement>();

/**
 * Whether a modal layer is open somewhere other than inside `panel`. A popover behind one must leave
 * focus and dismissal alone: the guided tour opens the settings and preset panels to point at them,
 * and while it does, the tour's card is what the user is reading and what answers Escape. A modal
 * layer the panel contains — a confirmation the preset panel raised itself — is the panel's own
 * business and does not count.
 */
function modalOutside(panel: HTMLElement): boolean {
  for (const root of modalRoots) if (!panel.contains(root)) return true;
  return false;
}

/**
 * A modal layer: the page behind it goes inert, Tab stays inside it, and closing it hands focus back
 * to whatever opened it. Put the returned `ref` and `onKeyDown` on the layer's outermost element —
 * the box itself, not the backdrop around it, so a press on the backdrop still reaches the backdrop.
 */
export function useModalLayer<T extends HTMLElement>({
  onClose,
  initialFocus,
}: {
  readonly onClose: () => void;
  /**
   * Where focus lands when the layer opens. The layer's own root by default, which needs
   * `tabIndex={-1}` and reads out the layer's name before its contents; name a control instead when
   * the first thing to do is obvious and one answer is safer than the other.
   */
  readonly initialFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<T>(null);
  const inerted = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = focusedControl();
    modalRoots.add(root);
    (initialFocus?.current ?? root).focus();
    return () => {
      modalRoots.delete(root);
      // Before focus moves: a browser will not focus an element that is still inert.
      for (const element of inerted.current) element.removeAttribute('inert');
      inerted.current = [];
      // Back to the control that opened the layer, not to the body. It has gone when the layer's own
      // answer removed it — a deleted preset's row, say — and the browser is left to its own devices.
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocus]);

  // After every render, not only the first: what is behind a layer changes while it is open, since
  // the guided tour opens the settings and preset panels as siblings of itself to point at them.
  useEffect(() => {
    const root = ref.current;
    if (root) hideBehind(root, inerted.current);
  });

  return {
    ref,
    /**
     * Belongs on the layer's root, where it catches the keys as they bubble from whatever holds
     * focus, so nothing inside needs key handling of its own.
     */
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        closeOneLayer(event, onClose);
        return;
      }
      if (event.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      // Read afresh on every press, because a layer's focusable set changes while it is open: the
      // export dialog's page and scaling options appear and disappear with the chosen format.
      const stops = focusables(root);
      if (stops.length === 0) {
        // Nothing in here can take focus, so the only place the press could go is out. It goes nowhere.
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const at = stops.indexOf(active as HTMLElement);
      // Both ends wrap. Backwards from the root itself counts as backwards from the first stop,
      // because that is where focus starts when the layer names no control to open on.
      const atEnd = event.shiftKey ? at === 0 || active === root : at === stops.length - 1;
      if (!atEnd) return;
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
    },
  };
}

/**
 * A non-modal popover hanging off a top-bar tab: focus moves in when it opens and back to the tab
 * when it closes, Escape closes it, and so does a press anywhere outside it. The page behind stays
 * live and stays in the accessibility tree, which is the whole difference from a modal layer, so
 * there is no trap here and no `aria-modal` to go with the `role="dialog"`.
 */
export function usePopoverLayer<T extends HTMLElement>({
  trigger,
  onClose,
  onEscape,
}: {
  /** A selector for the tab the panel hangs off: pressing that again is its own way to close. */
  readonly trigger: string;
  readonly onClose: () => void;
  /** Escape, for a panel with something of its own to dismiss first. Closes the panel by default. */
  readonly onEscape?: () => void;
}) {
  const ref = useRef<T>(null);
  // Whether closing should take focus back to the tab. A press outside says where focus goes itself.
  const returning = useRef(true);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const opener = focusedControl();
    if (!modalOutside(panel)) panel.focus();
    return () => {
      if (!returning.current || modalOutside(panel)) return;
      // The tab itself when the press that opened the panel left focus on it, and the tab found by
      // selector when it did not: a click does not focus a button everywhere, and a panel opened
      // from the guided tour was never pressed at all.
      const tab = opener?.isConnected ? opener : document.querySelector<HTMLElement>(trigger);
      tab?.focus();
    };
  }, [trigger]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const panel = ref.current;
      if (!panel || panel.contains(target) || target.closest(trigger)) return;
      // A modal layer over the panel is what the press is really landing on, and the panel is not
      // the user's to dismiss until that has been answered.
      if (modalOutside(panel)) return;
      // The user has aimed somewhere else, so the press decides where focus lands, not the panel.
      returning.current = false;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [trigger, onClose]);

  return {
    ref,
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.key !== 'Escape' || event.altKey || event.ctrlKey || event.metaKey) return;
      closeOneLayer(event, onEscape ?? onClose);
    },
  };
}

/**
 * Escape peels exactly one layer. `useKeyboardShortcuts` listens on the window and closes the
 * topmost layer it knows about, and it knows nothing of a confirmation opened from inside the preset
 * panel; React's handlers run at the root container, below the window, so stopping the event here
 * is what keeps the press from closing the panel as well. The innermost layer's root sees it first.
 */
function closeOneLayer(event: ReactKeyboardEvent<HTMLElement>, close: () => void): void {
  event.preventDefault();
  event.stopPropagation();
  close();
}

/**
 * Marks everything outside `root` inert, up to `<body>`, recording in `inerted` what it marked so it
 * can be put back. This is the half of modality that a screen reader notices: without it the page
 * behind stays in the accessibility tree and stays reachable, whatever `aria-modal` claims.
 */
function hideBehind(root: HTMLElement, inerted: HTMLElement[]): void {
  for (let node: HTMLElement | null = root; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      // Something a layer further out already made inert stays that layer's to undo, not this one's.
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      inerted.push(sibling);
    }
  }
}

/** What held focus when a layer opened, or null if nothing did: `<body>` is not a control. */
function focusedControl(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

const FOCUSABLE =
  'a[href],area[href],button,input,select,textarea,summary,iframe,object,embed,audio[controls],video[controls],[tabindex],[contenteditable]';

/**
 * Everything inside `root` that Tab can reach, in tab order. Document order is tab order here
 * because nothing in the app carries a positive tabindex.
 */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      // tabIndex reads both halves of the roving pattern: a segmented control's unselected options
      // carry tabindex="-1" and are arrow-key stops rather than tab stops.
      element.tabIndex >= 0 &&
      !element.hasAttribute('disabled') &&
      element.closest('[inert],[hidden],[aria-hidden="true"]') === null &&
      // jsdom has no layout engine and no checkVisibility, so under test everything counts as showing.
      (typeof element.checkVisibility !== 'function' || element.checkVisibility()),
  );
}
