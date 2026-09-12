import { useWorkbench, type Box } from '../state/workbench';
import { getScaleFamily, pcOfSpelled, scaleRefContext, scaleRefName, spell } from '../theory';
import { ScaleSelects } from './ScaleSelects';

const THUMB_RADIUS = 8;

/** Reference scale: tonic and scale dropdowns, then the mode slider with one stop per degree. */
export function ScalePicker({ box }: { readonly box: Box }) {
  const setScale = useWorkbench((s) => s.setScale);
  const setMode = useWorkbench((s) => s.setMode);

  const { scale } = box;
  const family = getScaleFamily(scale.familyId);
  const stops = family.intervals.length;
  const ctx = scaleRefContext(scale);
  const parentRoot = pcOfSpelled(scale.tonic) - family.intervals[scale.mode];
  const stopNames = family.intervals.map((iv) => spell(parentRoot + iv, ctx));
  const name = scaleRefName(scale);

  return (
    <div className="field">
      <span className="field-label">Reference scale</span>
      <ScaleSelects scale={scale} label="Scale" onChange={(next) => setScale(box.id, next)} />

      <div className="mode-slider">
        <div className="mode-head">
          <span className="mode-label" id={`mode-label-${box.id}`}>
            Mode
          </span>
          <span className="mode-name">{name}</span>
        </div>
        <input
          className="mode-range"
          type="range"
          min={0}
          max={stops - 1}
          step={1}
          value={scale.mode}
          aria-labelledby={`mode-label-${box.id}`}
          aria-valuetext={name}
          onChange={(event) => setMode(box.id, Number(event.target.value))}
        />
        <div className="mode-stops" aria-hidden="true">
          {stopNames.map((stopName, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={i === scale.mode ? 'mode-stop is-current' : 'mode-stop'}
              style={{ left: `calc(${THUMB_RADIUS}px + (100% - ${2 * THUMB_RADIUS}px) * ${i / Math.max(1, stops - 1)})` }}
              onClick={() => setMode(box.id, i)}
            >
              {stopName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
