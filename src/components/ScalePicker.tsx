import { SCALE_FAMILIES } from '../data/scales';
import { useWorkbench, type Box } from '../state/workbench';
import {
  canonicalMode,
  chooseTonicSpelling,
  distinctModes,
  formatSpelled,
  getScaleFamily,
  modeName,
  pcOfSpelled,
  scaleRefContext,
  scaleRefIntervals,
  scaleRefName,
  spell,
} from '../theory';

const PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const THUMB_RADIUS = 8;

/** Reference scale: tonic and scale dropdowns, then the mode slider with one stop per degree. */
export function ScalePicker({ box }: { readonly box: Box }) {
  const setScaleTonic = useWorkbench((s) => s.setScaleTonic);
  const setScaleFamilyMode = useWorkbench((s) => s.setScaleFamilyMode);
  const setMode = useWorkbench((s) => s.setMode);

  const { scale } = box;
  const family = getScaleFamily(scale.familyId);
  const intervals = scaleRefIntervals(scale);
  const tonicPc = pcOfSpelled(scale.tonic);
  const stops = family.intervals.length;
  const ctx = scaleRefContext(scale);
  const parentRoot = tonicPc - family.intervals[scale.mode];
  const stopNames = family.intervals.map((iv) => spell(parentRoot + iv, ctx));
  const name = scaleRefName(scale);

  return (
    <div className="field">
      <span className="field-label">Reference scale</span>
      <div className="scale-picker">
        <select
          className="select"
          aria-label="Scale root"
          value={tonicPc}
          onChange={(event) => setScaleTonic(box.id, Number(event.target.value))}
        >
          {PITCH_CLASSES.map((pc) => (
            <option key={pc} value={pc}>
              {formatSpelled(pc === tonicPc ? scale.tonic : chooseTonicSpelling(pc, intervals))}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Scale"
          value={`${scale.familyId}:${canonicalMode(scale.familyId, scale.mode)}`}
          onChange={(event) => {
            const [familyId, mode] = event.target.value.split(':');
            setScaleFamilyMode(box.id, familyId, Number(mode));
          }}
        >
          {SCALE_FAMILIES.map((f) => (
            <optgroup key={f.id} label={f.name}>
              {distinctModes(f.id).map((m) => (
                <option key={m} value={`${f.id}:${m}`}>
                  {modeName(f.id, m)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

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
