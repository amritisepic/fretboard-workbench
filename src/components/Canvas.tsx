import { useEffect, useMemo, useRef } from 'react';
import { useWorkbench } from '../state/workbench';
import { BoxCard } from './BoxCard';
import { buildCanvasModel } from './canvasModel';
import { CanvasToolbar } from './CanvasToolbar';
import { KEY_REGION_COLORS, bandShade } from './color';
import { buildStripView } from './stripModel';
import { useFitToFrame } from './useFitToFrame';
import { useRowStarts } from './useRowStarts';
import { VoiceLeadingStrip } from './VoiceLeadingStrip';

/**
 * Boxes flow left to right and wrap. Each box after the first is grouped with the strip that leads
 * into it, so a wrap never separates a strip from the box it leads into. Two bars run above the
 * boxes: the key band across each group joins into one bar per key region, with a seam where the key
 * changes, and under it each box shows its own reference scale. In view mode the whole canvas is
 * scaled to fit the screen and nothing can be edited.
 */
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
  const showStrips = strips.commonTones || strips.voiceLeading;

  const boxCount = boxes.length;
  const previousCount = useRef(boxCount);
  useEffect(() => {
    if (boxCount > previousCount.current && !viewing) {
      const groups = canvasRef.current?.querySelectorAll('.box-group');
      groups?.[groups.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    previousCount.current = boxCount;
  }, [boxCount, viewing]);

  return (
    <>
      <CanvasToolbar />
      <div className={viewing ? 'canvas-frame is-viewing' : 'canvas-frame'} ref={frameRef}>
        <div className="canvas" ref={canvasRef}>
          {model.entries.map((entry, i) => {
            const previous = i > 0 ? model.entries[i - 1] : null;
            const rowStart = i === 0 || rowStarts[i] === true;
            const bandClass = [
              'key-band',
              i === 0 ? 'is-first' : '',
              rowStart ? 'is-row-start' : '',
              entry.regionStart ? 'is-region-start' : '',
              entry.regionEnd ? 'is-region-end' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={entry.box.id} className="box-group">
                <div
                  className={bandClass}
                  style={{ backgroundColor: KEY_REGION_COLORS[entry.colorIndex % KEY_REGION_COLORS.length] }}
                  title={`Key: ${entry.keyName}`}
                >
                  {(entry.regionStart || rowStart) && (
                    <span className={entry.regionStart ? 'key-band-label' : 'key-band-label is-continued'}>
                      {entry.keyName}
                    </span>
                  )}
                </div>
                <div className="box-group-body">
                  {previous &&
                    (showStrips ? (
                      <VoiceLeadingStrip strip={buildStripView(previous, entry, strips)} wrapped={rowStart} />
                    ) : (
                      <div className="box-spacer" />
                    ))}
                  <div className="box-column">
                    <div
                      className="scale-band"
                      style={{ backgroundColor: bandShade(entry.box.color) }}
                      title={`Reference scale: ${entry.view.scaleName}`}
                    >
                      <span>{entry.view.scaleName}</span>
                    </div>
                    <BoxCard
                      box={entry.box}
                      view={entry.view}
                      numeral={entry.numeral}
                      keyName={entry.keyName}
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
              <button type="button" className="add-button is-small" aria-label="Add a box" onClick={() => addBox()}>
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
