import { useWorkbench, type Box } from '../state/workbench';

/** The dot colours offered in the sidebar. Exported so the contrast tests can check them. */
export const SWATCHES = [
  { name: 'Red', value: '#C8372D' },
  { name: 'Orange', value: '#C9672A' },
  { name: 'Ochre', value: '#B08A1E' },
  { name: 'Green', value: '#3E8750' },
  { name: 'Teal', value: '#23828A' },
  { name: 'Blue', value: '#2F5FB3' },
  { name: 'Violet', value: '#6D4AAE' },
  { name: 'Graphite', value: '#3A3A3A' },
];

export function ColorField({ box }: { readonly box: Box }) {
  const setColor = useWorkbench((s) => s.setColor);
  const current = box.color.toUpperCase();
  const isCustom = !SWATCHES.some((s) => s.value === current);

  return (
    <div className="field">
      <span className="field-label" id={`color-label-${box.id}`}>
        Dot color
      </span>
      <div className="swatches" role="radiogroup" aria-labelledby={`color-label-${box.id}`}>
        {SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            role="radio"
            className="swatch"
            aria-checked={swatch.value === current}
            aria-label={swatch.name}
            style={{ backgroundColor: swatch.value }}
            onClick={() => setColor(box.id, swatch.value)}
          />
        ))}
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
