import type { FillMode, FillState } from '../state/workbench';
import { rovingRadioGroup } from './rovingRadioGroup';

/**
 * An on/off toggle plus a two-position switch between "Fill inversion" and "Fill scale". The
 * switch keeps its position while the fill is off, because it also sets the box's mode.
 */
export function FillSwitch({
  fill,
  onSetOn,
  onSetMode,
}: {
  readonly fill: FillState;
  readonly onSetOn: (on: boolean) => void;
  readonly onSetMode: (mode: FillMode) => void;
}) {
  const other: FillMode = fill.mode === 'inversion' ? 'scale' : 'inversion';
  const roving = rovingRadioGroup<FillMode>(['inversion', 'scale'], fill.mode, onSetMode);
  return (
    <div className={fill.on ? 'fill is-on' : 'fill'}>
      <div className="fill-head">
        <span className="field-label" id="fill-label">
          Fill
        </span>
        <span className="shortcut" aria-hidden="true">
          <kbd>Space</kbd>
        </span>
        <button
          type="button"
          role="switch"
          className="toggle"
          aria-checked={fill.on}
          aria-labelledby="fill-label"
          aria-keyshortcuts="Space"
          onClick={() => onSetOn(!fill.on)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      <div className="fill-switch" role="radiogroup" aria-label="Fill type" onKeyDown={roving.onKeyDown}>
        <button
          type="button"
          role="radio"
          className="fill-option"
          aria-checked={fill.mode === 'inversion'}
          tabIndex={roving.tabIndex(0)}
          onClick={() => onSetMode('inversion')}
        >
          Fill inversion
        </button>
        {/* The sliding track is a second way to do what the two options already do, so it is a
            pointer affordance and not a third control: as a button it was a focusable non-radio
            inside a radiogroup, which owns radios and nothing else. Hidden from assistive
            technology it is no longer owned by the group, and the keyboard route is the options. */}
        <span
          className="fill-track"
          data-mode={fill.mode}
          aria-hidden="true"
          onClick={() => onSetMode(other)}
        >
          <span className="fill-knob" />
        </span>
        <button
          type="button"
          role="radio"
          className="fill-option"
          aria-checked={fill.mode === 'scale'}
          tabIndex={roving.tabIndex(1)}
          onClick={() => onSetMode('scale')}
        >
          Fill scale
        </button>
      </div>
    </div>
  );
}
