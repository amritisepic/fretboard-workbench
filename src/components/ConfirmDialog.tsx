import { useId, useRef } from 'react';
import { useModalLayer } from './focusLayer';

/**
 * A question that has to be answered before anything else can happen, so it is modal in earnest:
 * the page behind it goes inert and Tab stays inside. Cancel is what opens focused, which is what
 * makes Enter safe — the destructive answer is never the one a stray press gives.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { ref, onKeyDown } = useModalLayer<HTMLDivElement>({ onClose: onCancel, initialFocus: cancelRef });
  // Two confirmations can be on screen at once — the preset panel raises its own over the app's —
  // and a fixed id would have them both claiming the same title and the same description.
  const id = useId();
  const titleId = `${id}title`;
  const bodyId = `${id}body`;

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        ref={ref}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button is-primary is-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
