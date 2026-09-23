import '../../styles/tour.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { exampleDocument } from '../../state/examples';
import { pauseSessionSaves } from '../../state/persistence';
import { usePreferences, type Screen } from '../../state/preferences';
import { useScaleWizard, type ScaleWizardSettings } from '../../state/scaleWizard';
import { useWorkbench, type LoadedDocument } from '../../state/workbench';
import { useModalLayer } from '../focusLayer';
import { TOUR_STEPS, type TourPanel, type TourStep } from './tourSteps';

/** Space between a highlighted element and its ring, and between the ring and the card. */
const RING_PAD = 6;
const CARD_GAP = 14;
const EDGE = 12;
const PHONE = '(max-width: 760px)';

const DEMO = { name: 'Guided tour demo', key: 'C major', chords: 'Cmaj7 A7 Dm7 G7 Cmaj7' };
const DEMO_FOLDER = { name: 'Guided tour', style: 'jazz', examples: [DEMO] } as const;

interface SavedWork {
  readonly document: LoadedDocument;
  readonly wizard: ScaleWizardSettings;
  readonly screen: Screen;
  readonly viewing: boolean;
}

function saveWork(): SavedWork {
  const { settings, key, strips, orientation, boxes, document, viewing } = useWorkbench.getState();
  const { scale, showScale, labelMode, orientation: wizardOrientation, notation, topVoice } = useScaleWizard.getState();
  return {
    document: { ...document, data: { settings, key, strips, orientation, boxes } },
    wizard: { scale, showScale, labelMode, orientation: wizardOrientation, notation, topVoice },
    screen: usePreferences.getState().screen,
    viewing,
  };
}

function restoreWork(saved: SavedWork): void {
  const workbench = useWorkbench.getState();
  workbench.loadDocument(saved.document);
  workbench.setViewing(saved.viewing);
  useScaleWizard.getState().restore(saved.wizard);
  usePreferences.getState().setScreen(saved.screen);
}

/** Puts the app in the state a step shows: its screen, its panel, and the demo's box selection and fill. */
function showStep(step: TourStep, onPanel: (panel: TourPanel) => void): void {
  usePreferences.getState().setScreen(step.screen);
  onPanel(step.panel ?? null);
  const workbench = useWorkbench.getState();
  if (workbench.viewing) workbench.setViewing(false);
  const box = workbench.boxes[1] ?? workbench.boxes[0];
  if (step.selectBox && box) {
    workbench.selectBox(box.id);
    if (step.fillScale) workbench.setFillMode(box.id, 'scale');
  } else {
    workbench.selectBox(null);
  }
  if (step.screen === 'scales') useScaleWizard.getState().setShowScale(true);
}

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** The viewport box around every element matching `selector`, or null when none is showing. */
function targetBox(selector: string | null): Box | null {
  if (!selector) return null;
  const rects = Array.from(document.querySelectorAll(selector), (el) => el.getBoundingClientRect()).filter(
    (r) => r.width > 0 && r.height > 0,
  );
  if (rects.length === 0) return null;
  const top = Math.max(0, Math.min(...rects.map((r) => r.top)) - RING_PAD);
  const left = Math.max(0, Math.min(...rects.map((r) => r.left)) - RING_PAD);
  const bottom = Math.min(window.innerHeight, Math.max(...rects.map((r) => r.bottom)) + RING_PAD);
  const right = Math.min(window.innerWidth, Math.max(...rects.map((r) => r.right)) + RING_PAD);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Below the highlight if the card fits, else above, else wherever it covers least; centred without one. */
function cardPlacement(box: Box | null, card: { width: number; height: number }): CSSProperties {
  const { innerWidth: vw, innerHeight: vh } = window;
  if (window.matchMedia(PHONE).matches) return { left: EDGE, right: EDGE, bottom: EDGE };
  if (!box) return { left: (vw - card.width) / 2, top: Math.max(EDGE, (vh - card.height) / 2) };
  const left = Math.min(Math.max(EDGE, box.left), vw - card.width - EDGE);
  if (box.top + box.height + CARD_GAP + card.height <= vh - EDGE) return { left, top: box.top + box.height + CARD_GAP };
  if (box.top - CARD_GAP - card.height >= EDGE) return { left, top: box.top - CARD_GAP - card.height };
  const besideLeft = box.left - CARD_GAP - card.width;
  const besideRight = box.left + box.width + CARD_GAP;
  const top = Math.min(Math.max(EDGE, box.top), vh - card.height - EDGE);
  if (besideRight + card.width <= vw - EDGE) return { left: besideRight, top };
  if (besideLeft >= EDGE) return { left: besideLeft, top };
  return { left, bottom: EDGE };
}

/**
 * The guided tour: a welcome card, then one step per feature with the feature outlined and the rest of
 * the screen dimmed. Starting the tour sets the user's work aside (and pauses session saving) and opens
 * a demo progression; ending it at any step puts everything back.
 */
export function GuidedTour({ onPanel, onClose }: { readonly onPanel: (panel: TourPanel) => void; readonly onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ visibility: 'hidden' });
  const saved = useRef<SavedWork | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  const finish = useCallback(() => {
    if (saved.current) {
      restoreWork(saved.current);
      saved.current = null;
    }
    pauseSessionSaves(false);
    onPanel(null);
    usePreferences.getState().setTourSeen(true);
    onClose();
  }, [onPanel, onClose]);

  // The tour blocks the app and asks to be finished, so it is modal in earnest: the page behind goes
  // inert and Tab stays on the card, even while the tour opens the app's own panels to point at them.
  const { ref, onKeyDown } = useModalLayer<HTMLDivElement>({ onClose: finish, initialFocus: cardRef });

  const go = (next: number) => {
    if (next < 0 || next >= TOUR_STEPS.length) return;
    if (!saved.current && next > 0) {
      saved.current = saveWork();
      pauseSessionSaves(true);
      useWorkbench.getState().loadDocument(exampleDocument(DEMO, DEMO_FOLDER));
    }
    if (next > 0) showStep(TOUR_STEPS[next], onPanel);
    setPlacement({ visibility: 'hidden' });
    setIndex(next);
  };

  const measure = useCallback(() => {
    const next = targetBox(step.target);
    setBox(next);
    const card = cardRef.current;
    if (card) setPlacement(cardPlacement(next, { width: card.offsetWidth, height: card.offsetHeight }));
  }, [step.target]);

  // Bring the target into view once the step's screen and panels have rendered, then measure it.
  useLayoutEffect(() => {
    const first = step.target ? document.querySelector(step.target) : null;
    first?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    const timer = setTimeout(measure, 120);
    return () => clearTimeout(timer);
  }, [index, measure, step.target]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [measure]);

  /**
   * Each step's card is the one thing to read, so focus follows the step rather than staying put.
   * It has to wait for the card to be placed: a step starts with the card hidden so it can be
   * measured against its target, and a hidden element cannot take focus, so focusing on the step
   * alone silently did nothing and left focus on the body — where the card's Escape handler, which
   * ends the tour, never saw the key.
   *
   * Once per step, not on every placement: the card is re-measured on resize and on scroll, and
   * taking focus back each time would pull it off a button the reader had tabbed to.
   */
  const focusedStep = useRef(-1);
  useEffect(() => {
    if (placement.visibility === 'hidden' || focusedStep.current === index) return;
    focusedStep.current = index;
    cardRef.current?.focus();
  }, [index, placement]);

  // Should the tour unmount some other way, never leave saving paused.
  useEffect(() => () => pauseSessionSaves(false), []);

  const shades: CSSProperties[] = box
    ? [
        { top: 0, left: 0, right: 0, height: box.top },
        { top: box.top + box.height, left: 0, right: 0, bottom: 0 },
        { top: box.top, left: 0, width: box.left, height: box.height },
        { top: box.top, left: box.left + box.width, right: 0, height: box.height },
      ]
    : [{ inset: 0 }];

  return (
    <div
      className="tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      ref={ref}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        // The dimmed page does nothing when pressed, and must not take focus off the card either:
        // the card is what answers Escape and what Tab is held inside. Cancelling the press is what
        // stops the browser moving focus to the body, since the shades take no focus of their own.
        if (event.target instanceof Node && !cardRef.current?.contains(event.target)) event.preventDefault();
      }}
    >
      {shades.map((style, i) => (
        <div key={i} className="tour-shade" style={style} />
      ))}
      {box && <div className="tour-ring" style={box} />}
      <div className="tour-card" ref={cardRef} tabIndex={-1} style={placement}>
        <p className="tour-count">{index === 0 ? 'Guided tour' : `${index} of ${TOUR_STEPS.length - 1}`}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body" className="tour-body">
          {step.body}
        </p>
        <div className="tour-actions">
          {index === 0 ? (
            <>
              <button type="button" className="button" onClick={finish}>
                Not now
              </button>
              <button type="button" className="button is-primary" onClick={() => go(1)}>
                Start the tour
              </button>
            </>
          ) : (
            <>
              {!last && (
                <button type="button" className="button is-tertiary tour-end" onClick={finish}>
                  End tour
                </button>
              )}
              <button type="button" className="button" disabled={index <= 1} onClick={() => go(index - 1)}>
                Back
              </button>
              <button type="button" className="button is-primary" onClick={last ? finish : () => go(index + 1)}>
                {last ? 'Finish' : 'Next'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
