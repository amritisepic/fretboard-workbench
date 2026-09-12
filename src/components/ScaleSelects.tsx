import { SCALE_FAMILIES } from '../data/scales';
import {
  canonicalMode,
  chooseTonicSpelling,
  distinctModes,
  formatSpelled,
  modeName,
  pcOfSpelled,
  scaleRefIntervals,
  withFamilyMode,
  withTonic,
  type ScaleRef,
} from '../theory';

const PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Tonic and scale dropdowns. Changing one keeps the other; tonics are respelled for the scale. */
export function ScaleSelects({
  scale,
  label,
  onChange,
}: {
  readonly scale: ScaleRef;
  /** Accessible name: "Scale" gives "Scale root" and "Scale". */
  readonly label: string;
  readonly onChange: (next: ScaleRef) => void;
}) {
  const intervals = scaleRefIntervals(scale);
  const tonicPc = pcOfSpelled(scale.tonic);

  return (
    <div className="scale-selects">
      <select
        className="select"
        aria-label={`${label} root`}
        value={tonicPc}
        onChange={(event) => onChange(withTonic(scale, Number(event.target.value)))}
      >
        {PITCH_CLASSES.map((pc) => (
          <option key={pc} value={pc}>
            {formatSpelled(pc === tonicPc ? scale.tonic : chooseTonicSpelling(pc, intervals))}
          </option>
        ))}
      </select>
      <select
        className="select"
        aria-label={label}
        value={`${scale.familyId}:${canonicalMode(scale.familyId, scale.mode)}`}
        onChange={(event) => {
          const [familyId, mode] = event.target.value.split(':');
          onChange(withFamilyMode(scale, familyId, Number(mode)));
        }}
      >
        {SCALE_FAMILIES.map((family) => (
          <optgroup key={family.id} label={family.name}>
            {distinctModes(family.id).map((m) => (
              <option key={m} value={`${family.id}:${m}`}>
                {modeName(family.id, m)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
