import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A short explanation attached to a control, opened by clicking it.
 *
 * This is a disclosure, not a tooltip. `role="tooltip"` describes something a pointer reveals by
 * hovering, which on a touch screen is nothing at all, and a tooltip that is always in the DOM and
 * always referenced by `aria-describedby` is read out whether or not the user asked for it. So the
 * trigger carries `aria-expanded`, the explanation is mounted only while it is open, and a tap works
 * the same way a click does.
 *
 * Hovering still opens it on a mouse, because that is the habit, but hovering is a convenience on
 * top of the real interaction rather than the only way in.
 */
export function InfoPopover({
  label,
  explanation,
  className,
  onToggle,
  children,
}: {
  /** What the trigger is, for a screen reader: "Chord function, V7 of IV". */
  readonly label: string;
  readonly explanation: string;
  /** Class for the trigger button. */
  readonly className?: string;
  /** Told when the popover opens or closes, so a parent can stop a click reaching the card behind. */
  readonly onToggle?: (open: boolean) => void;
  /** The trigger's visible content. */
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const explanationId = useId();

  const close = useCallback(() => {
    setOpen(false);
    onToggle?.(false);
  }, [onToggle]);

  // Escape closes this before anything else acts on it, and a press anywhere else dismisses it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const set = (next: boolean) => {
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <span className="info-popover" ref={wrapperRef}>
      <button
        type="button"
        className={className}
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? explanationId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          set(!open);
        }}
        // A mouse opens it on hover as well; a pen or a finger uses the click above, which fires
        // a pointerenter of its own that must not toggle it straight back shut.
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') set(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') set(false);
        }}
      >
        {children}
      </button>
      {open && (
        <span className="info-explanation" id={explanationId} role="note">
          {explanation}
        </span>
      )}
    </span>
  );
}
