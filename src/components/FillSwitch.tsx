import type { FillMode, FillState } from '../state/workbench';

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
  return (
    <div className={fill.on ? 'fill is-on' : 'fill'}>
      <div className="fill-head">
        <span className="field-label" id="fill-label">
          Fill
        </span>
        <button
          type="button"
          role="switch"
          className="toggle"
          aria-checked={fill.on}
          aria-labelledby="fill-label"
          onClick={() => onSetOn(!fill.on)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      <div className="fill-switch" role="radiogroup" aria-label="Fill type">
        <button
          type="button"
          role="radio"
          className="fill-option"
          aria-checked={fill.mode === 'inversion'}
          onClick={() => onSetMode('inversion')}
        >
          Fill inversion
        </button>
        <button
          type="button"
          className="fill-track"
          data-mode={fill.mode}
          aria-label={`Switch to fill ${other}`}
          onClick={() => onSetMode(other)}
        >
          <span className="fill-knob" />
        </button>
        <button
          type="button"
          role="radio"
          className="fill-option"
          aria-checked={fill.mode === 'scale'}
          onClick={() => onSetMode('scale')}
        >
          Fill scale
        </button>
      </div>
      <p className="hint">
        <kbd>Space</kbd> turns the fill on or off
      </p>
    </div>
  );
}
