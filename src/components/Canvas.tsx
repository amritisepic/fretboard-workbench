import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useWorkbench } from '../state/workbench';
import { keyName } from '../theory';
import { explainReading, functionLabel, patternsAcross, relationViews } from './analysisModel';
import { BoxCard } from './BoxCard';
import { buildCanvasModel, type CanvasEntry, type KeyChoice } from './canvasModel';
import { CanvasToolbar } from './CanvasToolbar';
import { KEY_REGION_COLORS, bandShade } from './color';
import { scrollBehavior } from './motion';
import { pinReading } from './readingChoice';
import { buildStripView } from './stripModel';
import { useFitToFrame } from './useFitToFrame';
import { useRowStarts } from './useRowStarts';
import { VoiceLeadingStrip } from './VoiceLeadingStrip';

/**
 * Boxes flow left to right and wrap. Each box after the first is grouped with the strip that leads
 * into it, so a wrap never separates a strip from the box it leads into. The group is a grid: the
 * strip takes the first column and the card the second, and one bar sits over the second column
 * alone, so the bar begins exactly where the card it names begins.
 *
 * That bar carries both the key the box is in and the box's reference scale. The two used to be
 * separate bands, one above the other, which in the common case printed the same name twice ("G
 * Mixolydian" over "G Mixolydian"); the scale is now shown beside the key only when it says
 * something the key does not. A box whose readings put it in different keys splits the bar
 * ("B♭ minor | B♭ major?") and, in edit mode, choosing one pins it. In view mode the whole canvas is
 * scaled to fit the screen and nothing can be edited.
 */
/**
 * What clicking one of a box's offered keys will do. The key bar shows only the key names, so this
 * is the only statement of the action anywhere and belongs in the button's accessible name.
 */
function keyChoiceAction(choice: KeyChoice, pinned: boolean, title: string): string {
  if (!choice.chosen) return `Read ${title} in ${choice.keyName}`;
  return pinned
    ? `Pinned to ${choice.keyName}. Choose again to let the analysis decide.`
    : `Pin ${title} to ${choice.keyName}`;
}

export function Canvas({ onRequestRemove }: { readonly onRequestRemove: (boxId: string) => void }) {
  const boxes = useWorkbench((s) => s.boxes);
  const settings = useWorkbench((s) => s.settings);
  const globalKey = useWorkbench((s) => s.key);
  const strips = useWorkbench((s) => s.strips);
  const selectedBoxId = useWorkbench((s) => s.selectedBoxId);
  const viewing = useWorkbench((s) => s.viewing);
  const addBox = useWorkbench((s) => s.addBox);

  const model = useMemo(() => buildCanvasModel(boxes, settings, globalKey), [boxes, settings, globalKey]);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rowStarts = useRowStarts(canvasRef);
  useFitToFrame(frameRef, canvasRef, viewing);
  const voices = strips.commonTones || strips.voiceLeading;
  const showStrips = voices || strips.analysis;

  const boxCount = boxes.length;
  const previousCount = useRef(boxCount);
  useEffect(() => {
    if (boxCount > previousCount.current && !viewing) {
      const groups = canvasRef.current?.querySelectorAll('.box-group');
      groups?.[groups.length - 1]?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    }
    previousCount.current = boxCount;
  }, [boxCount, viewing]);

  const choose = (entry: CanvasEntry, choice: KeyChoice) => {
    const { analysis } = entry;
    if (choice.chosen && analysis.pinned) {
      pinReading(entry.box, entry.view, analysis, null);
      return;
    }
    const reading = [analysis.reading, ...analysis.alternatives].find((r) => r.pinId === choice.pinId) ?? null;
    pinReading(entry.box, entry.view, analysis, reading);
  };

  return (
    <>
      <CanvasToolbar />
      <div className={viewing ? 'canvas-frame is-viewing' : 'canvas-frame'} ref={frameRef}>
        <div className="canvas" ref={canvasRef}>
          {model.entries.map((entry, i) => {
            const previous = i > 0 ? model.entries[i - 1] : null;
            const next = i + 1 < model.entries.length ? model.entries[i + 1] : null;
            const rowStart = i === 0 || rowStarts[i] === true;
            const { analysis, keyChoices } = entry;
            const tentative = analysis.ambiguous && (strips.analysis || keyChoices.length > 0);
            const tag =
              strips.analysis && analysis.facts
                ? {
                    label: functionLabel(analysis, analysis.reading, strips.notation),
                    explanation: explainReading(analysis, analysis.reading, {
                      title: entry.view.title,
                      previousTitle: previous?.view.title || null,
                      nextTitle: next?.view.title || null,
                      nextRoot: next?.analysis.facts?.root ?? null,
                      notation: strips.notation,
                    }),
                  }
                : null;
            const otherScales = keyChoices.filter((c) => !c.chosen && c.scaleName && c.scaleName !== entry.view.scaleName);
            // The reference scale earns its place in the bar only when it is not simply the key
            // said again, or when a rival reading suggests a different one.
            const showScale = entry.view.scaleName !== entry.keyName || otherScales.length > 0;
            const scaleTitle = `Reference scale: ${entry.view.scaleName}${otherScales.map((c) => ` (or ${c.scaleName} in ${c.keyName})`).join('')}`;
            return (
              <div key={entry.box.id} className="box-group">
                {previous &&
                  (showStrips ? (
                    <VoiceLeadingStrip
                      strip={buildStripView(previous, entry, strips)}
                      voices={voices}
                      lane={
                        strips.analysis
                          ? {
                              relations: relationViews(entry.relationsIn, strips.notation, keyName(analysis.reading.home.ref)),
                              patterns: patternsAcross(model.patterns, i),
                            }
                          : null
                      }
                      wrapped={rowStart}
                    />
                  ) : (
                    <div className="box-spacer" />
                  ))}
                <div
                  className="key-band"
                  style={{ backgroundColor: KEY_REGION_COLORS[entry.colorIndex % KEY_REGION_COLORS.length] }}
                  // Redundant with the text in the bar, which is where the information actually
                  // lives: a native tooltip never appears on a touch screen.
                  title={keyChoices.length > 0 ? `Key: ${keyChoices.map((c) => c.keyName).join(' or ')}` : `Key: ${entry.keyName}`}
                >
                  {keyChoices.length > 0 ? (
                    <span className="key-band-label is-split" role="group" aria-label={`Possible keys for ${entry.view.title}`}>
                      {keyChoices.map((choice, k) => {
                        const text = `${choice.keyName}${choice.chosen || analysis.pinned ? '' : '?'}`;
                        const className = ['key-choice', choice.chosen ? 'is-chosen' : '', choice.chosen && analysis.pinned ? 'is-pinned' : '']
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <Fragment key={choice.pinId}>
                            {k > 0 && (
                              <span className="key-split-bar" aria-hidden="true">
                                |
                              </span>
                            )}
                            {viewing ? (
                              <span className={className}>{text}</span>
                            ) : (
                              <button
                                type="button"
                                className={className}
                                aria-pressed={choice.chosen}
                                // What the click does exists nowhere else on screen, so it has to be
                                // the button's name rather than a title: a native tooltip never
                                // appears on a touch screen, which is where this app is often used.
                                aria-label={keyChoiceAction(choice, analysis.pinned, entry.view.title)}
                                title={keyChoiceAction(choice, analysis.pinned, entry.view.title)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  choose(entry, choice);
                                }}
                              >
                                {text}
                              </button>
                            )}
                          </Fragment>
                        );
                      })}
                    </span>
                  ) : (
                    // Every bar names its key now that each one covers a single chord. A bar
                    // continuing a key region says so in a lighter weight, which is what the joined
                    // bar used to say by simply running on.
                    <>
                      {/* The names alone say which is which to anyone who can see the two colors,
                          so the words that tell them apart are carried for screen readers only. */}
                      <span className="visually-hidden">Key: </span>
                      <span className={entry.regionStart ? 'key-band-label' : 'key-band-label is-continued'}>
                        {entry.keyName}
                      </span>
                    </>
                  )}
                  {showScale && (
                    <>
                      <span className="visually-hidden">Reference scale: </span>
                      <span
                        className="key-band-scale"
                        style={{ backgroundColor: bandShade(entry.box.color) }}
                        title={scaleTitle}
                      >
                        {entry.view.scaleName}
                        {otherScales.map((c) => (
                          <span key={c.pinId} className="scale-alternative">
                            {' | '}
                            {c.scaleName}
                            {/* Which key that rival scale belongs to is in the bar's title only,
                                and a title is nothing on a touch screen. */}
                            <span className="visually-hidden">{` in ${c.keyName}`}</span>?
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
                <div className="box-group-body">
                  <div className="box-column">
                    <BoxCard
                      box={entry.box}
                      view={entry.view}
                      numeral={entry.numeral}
                      keyName={entry.keyName}
                      tentative={tentative}
                      tag={tag}
                      selected={entry.box.id === selectedBoxId}
                      viewing={viewing}
                      onRequestRemove={onRequestRemove}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {!viewing && (
            <div className="add-slot">
              <button type="button" className="add-button" aria-label="Add a box" onClick={() => addBox()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
