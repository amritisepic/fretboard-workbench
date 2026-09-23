import { useId, type ReactNode } from 'react';

/**
 * The app's one on/off control, for a setting that is either on or off and takes effect the moment
 * it changes. A choice between two named options is not one of those, and is a `Segmented`.
 *
 * The name sits on the left and the track on the right, pushed apart when there is room, so a column
 * of switches lines its tracks up down the right-hand edge. The name is a real `<label>` for the
 * track, so pressing the words works as well as pressing the track; `aria-labelledby` says the same
 * thing again for the assistive technology that does not follow a label to a button.
 */
export function Switch({
  label,
  checked,
  onChange,
  labelClassName = 'switch-label',
  keyShortcuts,
  children,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /**
   * How the name is drawn. The default is ordinary text; a switch whose name is also the heading of
   * its section, as in the settings panel and the sidebar's Fill, passes `field-label` to match the
   * headings around it.
   */
  readonly labelClassName?: string;
  /** For `aria-keyshortcuts`, when a key elsewhere in the app flips the same setting. */
  readonly keyShortcuts?: string;
  /** Anything that belongs between the name and the track, such as a hint showing that key. */
  readonly children?: ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div className="switch">
      <label className={labelClassName} id={labelId} htmlFor={id}>
        {label}
      </label>
      {children}
      <button
        type="button"
        role="switch"
        id={id}
        className="switch-track"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-keyshortcuts={keyShortcuts}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}
