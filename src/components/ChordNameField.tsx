import { useWorkbench, type Box } from '../state/workbench';
import { chordName } from '../theory';
import type { BoxView } from './boardModel';

const AUTO = 'auto';

/** Every plausible name for the clicked notes; the pick is kept per box and sets the chord root. */
export function ChordNameField({ box, view }: { readonly box: Box; readonly view: BoxView }) {
  const setChordOverride = useWorkbench((s) => s.setChordOverride);
  const [best] = view.candidates;

  if (!best) {
    return (
      <div className="field">
        <span className="field-label">Chord name</span>
        <p className="field-note">{view.title ? 'Add another note to name a chord.' : 'Click notes to name a chord.'}</p>
      </div>
    );
  }

  const override = view.candidates.find((c) => c.key === box.chordOverride);
  return (
    <div className="field">
      <label className="field-label" htmlFor={`chord-name-${box.id}`}>
        Chord name
      </label>
      <select
        id={`chord-name-${box.id}`}
        className="select full"
        value={override ? override.key : AUTO}
        onChange={(event) => setChordOverride(box.id, event.target.value === AUTO ? null : event.target.value)}
      >
        <option value={AUTO}>Automatic: {chordName(best, view.ctx)}</option>
        <optgroup label={`All readings (${view.candidates.length})`}>
          {view.candidates.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {chordName(candidate, view.ctx)}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
