import { useEffect, useRef, useState } from 'react';
import { TUNING_PRESETS } from '../data/tunings';
import { useWorkbench } from '../state/workbench';
import {
  MAX_CAPO,
  MAX_FRETS,
  MAX_STRINGS,
  MIN_FRETS,
  MIN_STRINGS,
  PITCH_CLASS_NAMES,
  clampFretCount,
  formatTuning,
  octaveOf,
  pcOf,
  toMidi,
} from '../theory';

const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7];

const sameTuning = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((midi, i) => midi === b[i]);

export function SettingsPanel({ onClose }: { readonly onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tuning = useWorkbench((s) => s.settings.tuning);
  const applyTuning = useWorkbench((s) => s.applyTuning);
  const setStringCount = useWorkbench((s) => s.setStringCount);
  const setStringPitch = useWorkbench((s) => s.setStringPitch);
  const preset = TUNING_PRESETS.find((p) => sameTuning(p.tuning, tuning));

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target) || target.closest('[data-settings-tab]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  // Listed highest string first, matching the fretboard.
  const stringsTopDown = tuning.map((_, i) => tuning.length - 1 - i);

  return (
    <div className="settings-panel" role="dialog" aria-label="Settings" ref={panelRef}>
      <section className="settings-section">
        <label className="field-label" htmlFor="tuning-preset">
          Tuning
        </label>
        <select
          id="tuning-preset"
          className="select"
          value={preset?.id ?? 'custom'}
          onChange={(event) => {
            const next = TUNING_PRESETS.find((p) => p.id === event.target.value);
            if (next) applyTuning(next.tuning);
          }}
        >
          {!preset && <option value="custom">Custom</option>}
          {TUNING_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="tuning-string">{formatTuning(tuning)}</p>
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <span className="field-label" id="string-count-label">
            Strings
          </span>
          <div className="stepper" role="group" aria-labelledby="string-count-label">
            <button
              type="button"
              aria-label="Remove the lowest string"
              disabled={tuning.length <= MIN_STRINGS}
              onClick={() => setStringCount(tuning.length - 1)}
            >
              −
            </button>
            <output aria-live="polite">{tuning.length}</output>
            <button
              type="button"
              aria-label="Add a lower string"
              disabled={tuning.length >= MAX_STRINGS}
              onClick={() => setStringCount(tuning.length + 1)}
            >
              +
            </button>
          </div>
        </div>
        <ol className="string-list">
          {stringsTopDown.map((string) => {
            const midi = tuning[string];
            const number = tuning.length - string;
            return (
              <li key={string} className="string-row">
                <span className="string-number">{number}</span>
                <select
                  className="select"
                  aria-label={`String ${number} note`}
                  value={pcOf(midi)}
                  onChange={(event) => setStringPitch(string, toMidi(Number(event.target.value), octaveOf(midi)))}
                >
                  {PITCH_CLASS_NAMES.map((name, pc) => (
                    <option key={name} value={pc}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  aria-label={`String ${number} octave`}
                  value={octaveOf(midi)}
                  onChange={(event) => setStringPitch(string, toMidi(pcOf(midi), Number(event.target.value)))}
                >
                  {OCTAVES.map((octave) => (
                    <option key={octave} value={octave}>
                      {octave}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ol>
      </section>

      <CapoField />
      <FretCountField />
    </div>
  );
}

/** The capo raises every open string without changing the tuning; see setCapo for what moves with it. */
function CapoField() {
  const capo = useWorkbench((s) => s.settings.capo);
  const setCapo = useWorkbench((s) => s.setCapo);

  return (
    <section className="settings-section">
      <div className="settings-row">
        <span className="field-label" id="capo-label">
          Capo
        </span>
        <div className="stepper" role="group" aria-labelledby="capo-label">
          <button type="button" aria-label="Move the capo down a fret" disabled={capo <= 0} onClick={() => setCapo(capo - 1)}>
            −
          </button>
          <output aria-live="polite">{capo === 0 ? 'None' : capo}</output>
          <button
            type="button"
            aria-label="Move the capo up a fret"
            disabled={capo >= MAX_CAPO}
            onClick={() => setCapo(capo + 1)}
          >
            +
          </button>
        </div>
      </div>
      <p className="hint">The tuning stays the same. Chord shapes move with the capo, so the chords, scales and key move with it.</p>
    </section>
  );
}

/** Valid values apply as you type; anything out of range is clamped on Enter or blur, with a note saying so. */
function FretCountField() {
  const fretCount = useWorkbench((s) => s.settings.fretCount);
  const setFretCount = useWorkbench((s) => s.setFretCount);
  const [draft, setDraft] = useState(String(fretCount));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(fretCount));
  }, [fretCount]);

  const apply = (raw: string, commit: boolean) => {
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) {
      setMessage(commit ? `Enter ${MIN_FRETS}–${MAX_FRETS}. Kept ${fretCount}.` : `Enter ${MIN_FRETS}–${MAX_FRETS}.`);
      if (commit) setDraft(String(fretCount));
      return;
    }
    const clamped = clampFretCount(value);
    if (clamped === value) {
      // Re-committing the value already applied (a blur right after Enter) keeps the clamp note visible.
      if (!commit || value !== fretCount) setMessage(null);
      setFretCount(value);
    } else if (commit) {
      setFretCount(clamped);
      setDraft(String(clamped));
      setMessage(`${value} is outside ${MIN_FRETS}–${MAX_FRETS}, so it was set to ${clamped}.`);
    } else {
      setMessage(`${MIN_FRETS}–${MAX_FRETS} frets. ${value} will be set to ${clamped}.`);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-row">
        <label className="field-label" htmlFor="fret-count">
          Frets
        </label>
        <input
          id="fret-count"
          className="number-input"
          type="number"
          inputMode="numeric"
          min={MIN_FRETS}
          max={MAX_FRETS}
          step={1}
          value={draft}
          aria-describedby={message ? 'fret-count-message' : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            apply(event.target.value, false);
          }}
          onBlur={(event) => apply(event.target.value, true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply(event.currentTarget.value, true);
          }}
        />
      </div>
      {message && (
        <p className="inline-message" id="fret-count-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
