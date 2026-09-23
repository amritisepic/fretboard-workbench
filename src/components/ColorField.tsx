import { useWorkbench, type Box } from '../state/workbench';
import { rovingRadioGroup } from './rovingRadioGroup';

/**
 * The dot colors offered in the sidebar. Exported so the contrast tests can check them.
 *
 * Every one is dark enough to carry a white label at 5:1 or better. Orange, ochre, green and teal
 * used to be lighter, at the same hues: the first three sat where neither white nor the house ink
 * reaches 4.5:1, and teal cleared it by 0.03. They were darkened rather than given black labels,
 * which WCAG would have passed, because white reads better on a saturated mid-tone (APCA puts it
 * well ahead on all four) and one label ink across the palette keeps the dots looking like a set.
 * A box saved in one of the old values keeps it, shows as a custom color, and gets whichever label
 * `labelInk` finds readable on it.
 */
export const SWATCHES = [
  { name: 'Red', value: '#C8372D' },
  { name: 'Orange', value: '#B25417' },
  { name: 'Ochre', value: '#8A6A00' },
  { name: 'Green', value: '#347D47' },
  { name: 'Teal', value: '#187B83' },
  { name: 'Blue', value: '#2F5FB3' },
  { name: 'Violet', value: '#6D4AAE' },
  { name: 'Graphite', value: '#3A3A3A' },
];

export function ColorField({ box }: { readonly box: Box }) {
  const setColor = useWorkbench((s) => s.setColor);
  const current = box.color.toUpperCase();
  const isCustom = !SWATCHES.some((s) => s.value === current);
  const roving = rovingRadioGroup(
    SWATCHES.map((swatch) => swatch.value),
    current,
    (color) => setColor(box.id, color),
  );

  return (
    <div className="field">
      <span className="field-label" id={`color-label-${box.id}`}>
        Dot color
      </span>
      {/* The custom-color picker sits beside the radiogroup rather than in it. A radiogroup owns
          radios and nothing else, and the picker is not a ninth option but a way to name a color
          the eight do not offer: it has no checked state to move between and opening it hands the
          keyboard to the browser's color dialog. Keeping it out leaves it its own tab stop, so the
          route through the field is Tab to the swatches, arrow keys within them, Tab to the picker,
          rather than arrowing past every swatch to reach it. */}
      <div className="swatch-row">
        <div
          className="swatches"
          role="radiogroup"
          aria-labelledby={`color-label-${box.id}`}
          onKeyDown={roving.onKeyDown}
        >
          {SWATCHES.map((swatch, index) => (
            <button
              key={swatch.value}
              type="button"
              role="radio"
              className="swatch"
              aria-checked={swatch.value === current}
              aria-label={swatch.name}
              tabIndex={roving.tabIndex(index)}
              style={{ backgroundColor: swatch.value }}
              onClick={() => setColor(box.id, swatch.value)}
            />
          ))}
        </div>
        <label
          className={isCustom ? 'swatch swatch-custom is-active' : 'swatch swatch-custom'}
          style={isCustom ? { backgroundColor: current } : undefined}
          title="Custom color"
        >
          {!isCustom && <span aria-hidden="true">+</span>}
          <input
            type="color"
            aria-label="Custom color"
            value={box.color.toLowerCase()}
            onChange={(event) => setColor(box.id, event.target.value.toUpperCase())}
          />
        </label>
      </div>
    </div>
  );
}
