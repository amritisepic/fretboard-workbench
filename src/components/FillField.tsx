import type { FillMode, FillState } from '../state/workbench';
import { Segmented, type SegmentedOption } from './Segmented';
import { Switch } from './Switch';

const FILL_OPTIONS: readonly SegmentedOption<FillMode>[] = [
  { value: 'inversion', label: 'Inversion' },
  { value: 'scale', label: 'Scale' },
];

/**
 * Whether the box is filled, and with what: two decisions, so two controls, each the one the app
 * uses everywhere for its kind of decision. On or off is a `Switch`; inversion or scale is a choice
 * between two named options, so it is a `Segmented`, as every other such choice is.
 *
 * It used to be one switch with a name on each side of the track, which reads as on/off to anyone
 * who has used a switch before and gives no hint which side is which.
 *
 * The fill type keeps its setting while the fill is off, and choosing one turns the fill back on
 * (see `setFillMode`), so the choice stays live rather than greyed out: it is not disabled, and
 * drawing it as though it were would say otherwise.
 */
export function FillField({
  fill,
  onSetOn,
  onSetMode,
}: {
  readonly fill: FillState;
  readonly onSetOn: (on: boolean) => void;
  readonly onSetMode: (mode: FillMode) => void;
}) {
  return (
    <div className="fill-field">
      <Switch label="Fill" labelClassName="field-label" checked={fill.on} onChange={onSetOn} keyShortcuts="Space">
        {/* The control carries `aria-keyshortcuts`, so the key shown here is decoration. */}
        <span className="shortcut" aria-hidden="true">
          <kbd>Space</kbd>
        </span>
      </Switch>
      <Segmented label="Fill type" options={FILL_OPTIONS} value={fill.mode} onChange={onSetMode} />
    </div>
  );
}
