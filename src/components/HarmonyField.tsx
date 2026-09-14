import { useWorkbench, type Box } from '../state/workbench';
import { keyName, type BoxAnalysis, type ScaleRef } from '../theory';
import { explainReading, functionLabel, type ExplanationContext } from './analysisModel';
import type { BoxView } from './boardModel';
import { FunctionText } from './FunctionText';
import { pinReading } from './readingChoice';
import { ScaleSelects } from './ScaleSelects';
import { Segmented, type SegmentedOption } from './Segmented';

type KeyPinMode = 'auto' | 'fixed';

const KEY_PIN_OPTIONS: readonly SegmentedOption<KeyPinMode>[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'fixed', label: 'Fixed' },
];

/**
 * The box's chord as harmonic analysis reads it: the reading in use and every other reading nearly as
 * likely, each with what it means. Choosing one pins it; choosing the pinned one again lets the
 * analysis decide. The key at the box can also be fixed by hand.
 */
export function HarmonyField({
  box,
  view,
  analysis,
  keyHere,
  context,
}: {
  readonly box: Box;
  readonly view: BoxView;
  readonly analysis: BoxAnalysis;
  /** The key the key bar shows at this box. */
  readonly keyHere: ScaleRef;
  readonly context: Omit<ExplanationContext, 'notation'>;
}) {
  const notation = useWorkbench((s) => s.strips.notation);
  const readings = analysis.facts ? [analysis.reading, ...analysis.alternatives] : [];

  return (
    <div className="field harmony-field">
      <span className="field-label">Harmony</span>
      {readings.length === 0 ? (
        <p className="field-note">Click notes to analyse the chord.</p>
      ) : (
        <>
          <ul className="reading-list" role="radiogroup" aria-label="Readings of the chord">
            {readings.map((reading) => {
              const chosen = reading === analysis.reading;
              const label = functionLabel(analysis, reading, notation);
              return (
                <li key={reading.pinId}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    className={chosen ? 'reading-option is-chosen' : 'reading-option'}
                    onClick={() => pinReading(box, view, analysis, chosen && analysis.pinned ? null : reading)}
                  >
                    <span className="reading-head">
                      <FunctionText label={label} />
                      <span className="reading-key">{keyName(reading.local.ref)}</span>
                    </span>
                    {label.note && <span className="function-note">{label.note}</span>}
                    <span className="reading-explanation">{explainReading(analysis, reading, { ...context, notation })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint">
            {analysis.pinned
              ? 'Your choice is pinned. Choose it again to let the analysis decide.'
              : analysis.ambiguous
                ? 'Tentative: these readings are nearly as likely. Choose one to pin it.'
                : 'No other reading comes close. Choose it to pin it anyway.'}
          </p>
        </>
      )}
      <div className="key-pin">
        <div className="key-pin-head">
          <span className="mode-label" id={`key-pin-${box.id}`}>
            Key at this box
          </span>
          <Segmented
            label="Key at this box"
            options={KEY_PIN_OPTIONS}
            value={box.keyPin ? 'fixed' : 'auto'}
            onChange={(mode) => {
              const { setKeyPin, setReadingPin } = useWorkbench.getState();
              setReadingPin(box.id, null);
              setKeyPin(box.id, mode === 'fixed' ? keyHere : null);
            }}
          />
        </div>
        {box.keyPin && (
          <ScaleSelects scale={box.keyPin} label="Key at this box" onChange={(key) => useWorkbench.getState().setKeyPin(box.id, key)} />
        )}
      </div>
    </div>
  );
}
