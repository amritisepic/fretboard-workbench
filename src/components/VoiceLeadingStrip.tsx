import { useId } from 'react';
import type { AnalysisLane, RelationView } from './analysisModel';
import type { StripView } from './stripModel';

const WIDTH = 168;
const PILL_WIDTH = 36;
const PILL_HEIGHT = 20;
const LANE = 30;
/** Vertical offset per semitone of motion, so steps slant gently and leaps steeply. */
const STEP = 4;
const MAX_SHIFT = 6 * STEP;
const EDGE = 4;
const MARK_HEIGHT = 12;

/**
 * The strip between two boxes: the chords (or scales) compared, lines for common tones and moving
 * voices when those switches are on, and with harmonic analysis a lane naming the relation between
 * the chords and any pattern running through.
 */
export function VoiceLeadingStrip({
  strip,
  voices,
  lane,
  wrapped,
}: {
  readonly strip: StripView;
  /** Common tones or voice leading is on. */
  readonly voices: boolean;
  readonly lane: AnalysisLane | null;
  readonly wrapped: boolean;
}) {
  const markerId = `arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const lanes = Math.max(1, strip.voices.length);
  const top = MAX_SHIFT + PILL_HEIGHT / 2 + 2;
  const height = top + (lanes - 1) * LANE + PILL_HEIGHT / 2 + MAX_SHIFT + 2;
  const leftX = EDGE + PILL_WIDTH / 2;
  const rightX = WIDTH - EDGE - PILL_WIDTH / 2;
  const lineStart = EDGE + PILL_WIDTH + 5;
  const lineEnd = WIDTH - EDGE - PILL_WIDTH - 6;

  return (
    <div className="strip">
      {wrapped && <p className="strip-wrap">↩ from the row above</p>}
      <p className="strip-title" title={`${strip.fromTitle} → ${strip.toTitle}`}>
        <span>{strip.fromTitle}</span>
        <span aria-hidden="true">→</span>
        <span>{strip.toTitle}</span>
      </p>
      {lane && <AnalysisLaneView lane={lane} />}
      {voices &&
        (strip.voices.length === 0 ? (
          <p className="strip-empty">{strip.emptyText}</p>
        ) : (
          <svg
            className="strip-svg"
            viewBox={`0 0 ${WIDTH} ${height}`}
            width={WIDTH}
            height={height}
            role="img"
            aria-label={strip.description}
          >
            <defs>
              <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path className="strip-arrowhead" d="M0 0.8 7.5 4 0 7.2z" />
              </marker>
            </defs>
            {strip.voices.map((voice, i) => {
              const y1 = top + i * LANE;
              const y2 = y1 - voice.semitones * STEP;
              const moves = voice.kind === 'common' || voice.kind === 'step' || voice.kind === 'leap';
              return (
                <g key={i} className={`strip-voice strip-${voice.kind}`}>
                  {voice.from !== null && <Pill x={leftX} y={y1} label={voice.from} dashed={voice.kind === 'dropped'} />}
                  {voice.to !== null && <Pill x={rightX} y={y2} label={voice.to} dashed={voice.kind === 'added'} />}
                  {moves && <line x1={lineStart} y1={y1} x2={lineEnd} y2={y2} markerEnd={`url(#${markerId})`} />}
                  {moves && voice.interval && (
                    <text className="strip-interval" x={(lineStart + lineEnd) / 2} y={(y1 + y2) / 2 - 6}>
                      {voice.interval}
                    </text>
                  )}
                  {voice.kind === 'dropped' && (
                    <text className="strip-marker" x={lineStart + 2} y={y1}>
                      × dropped
                    </text>
                  )}
                  {voice.kind === 'added' && (
                    <text className="strip-marker is-end" x={lineEnd + 2} y={y1}>
                      added +
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ))}
      {voices && <p className="strip-summary">{strip.summary}</p>}
    </div>
  );
}

function AnalysisLaneView({ lane }: { readonly lane: AnalysisLane }) {
  return (
    <div className="strip-analysis">
      {lane.patterns.map((pattern) => (
        <p key={pattern.name} className={pattern.starts ? 'strip-pattern' : 'strip-pattern is-continued'}>
          {pattern.name}
        </p>
      ))}
      {lane.relations.length === 0 ? (
        <p className="strip-relation-label is-none" aria-label="No functional relation">
          —
        </p>
      ) : (
        lane.relations.map((relation) => (
          <div key={relation.id} className="strip-relation">
            {(relation.arrow || relation.bracket) && <RelationMark relation={relation} />}
            <span className="strip-relation-label">{relation.label}</span>
          </div>
        ))
      )}
    </div>
  );
}

/** A bracket over a ii–V pair, or an arrow for a resolution (dashed for a tritone substitute). */
function RelationMark({ relation }: { readonly relation: RelationView }) {
  const markerId = `mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="strip-mark" viewBox={`0 0 ${WIDTH} ${MARK_HEIGHT}`} width={WIDTH} height={MARK_HEIGHT} aria-hidden="true">
      {relation.bracket ? (
        <path d={`M${EDGE + 2} ${MARK_HEIGHT - 1} V3 H${WIDTH - EDGE - 2} V${MARK_HEIGHT - 1}`} />
      ) : (
        <>
          <defs>
            <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path className="strip-arrowhead" d="M0 0.8 7.5 4 0 7.2z" />
            </marker>
          </defs>
          <line
            className={relation.arrow === 'dashed' ? 'is-dashed' : undefined}
            x1={EDGE + 6}
            y1={MARK_HEIGHT / 2}
            x2={WIDTH - EDGE - 8}
            y2={MARK_HEIGHT / 2}
            markerEnd={`url(#${markerId})`}
          />
        </>
      )}
    </svg>
  );
}

function Pill({ x, y, label, dashed }: { readonly x: number; readonly y: number; readonly label: string; readonly dashed: boolean }) {
  return (
    <g className={dashed ? 'strip-pill is-dashed' : 'strip-pill'}>
      <rect x={x - PILL_WIDTH / 2} y={y - PILL_HEIGHT / 2} width={PILL_WIDTH} height={PILL_HEIGHT} rx={6} />
      <text x={x} y={y}>
        {label}
      </text>
    </g>
  );
}
