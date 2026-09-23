import { Fragment, useId } from 'react';
import type { AnalysisLane, RelationView } from './analysisModel';
import type { StripView, StripVoice } from './stripModel';

/** The relation mark spans the strip's content box; the strip is sized in the stylesheet. */
const MARK_WIDTH = 64;
const MARK_HEIGHT = 12;

/**
 * What the mark before a voice says about it. Direction is drawn as well as counted because the
 * slope is what a player reads first — "everything falls" is the shape of a good progression — and
 * the signed interval beside it is the exact amount.
 */
function moveGlyph(voice: StripVoice): string {
  if (voice.kind === 'dropped') return '×';
  if (voice.kind === 'added') return '+';
  return voice.semitones > 0 ? '↗' : '↘';
}

/**
 * The strip between two boxes: the chords (or scales) compared, the voices that move, a mark per
 * voice that is held, and with harmonic analysis a lane naming the relation between the chords.
 *
 * Only moving voices are drawn in full. A held voice is a dot: naming both ends of a note that did
 * not change spends a chord card's worth of width to say nothing, and in a transition like G7 → Gm7
 * three of four voices are held, so the one that moves was getting a quarter of the attention it
 * earns. The held voices' names are not lost — they are in the accessible description and in the
 * marks' tooltip.
 *
 * Every visual form here is `aria-hidden`, and one visually hidden paragraph carries the whole
 * description. That keeps the facts identical for a screen reader whichever form is on screen, and
 * it is why the phone form can be as terse as it likes.
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
  // An analysis lane with neither a pattern nor a relation has nothing to say, and saying it with a
  // dash reads as a rendering fault rather than as an absence.
  const hasLane = lane !== null && (lane.patterns.length > 0 || lane.relations.length > 0);
  const empty = strip.voices.length === 0;

  return (
    <div className="strip">
      {wrapped && <p className="strip-wrap">↩ from the row above</p>}
      <p className="strip-title" title={`${strip.fromTitle} → ${strip.toTitle}`}>
        <span>{strip.fromTitle}</span>
        <span aria-hidden="true">→</span>
        <span>{strip.toTitle}</span>
      </p>
      {hasLane && <AnalysisLaneView lane={lane} />}
      {voices && !empty && (
        <div className="strip-voices" aria-hidden="true">
          {strip.held.length > 0 && (
            <span className="strip-held" title={`${strip.heldLabels.join(', ')} held`}>
              {strip.held.map((_, i) => (
                <span key={i} className="strip-dot" />
              ))}
            </span>
          )}
          {strip.moves.length > 0 && (
            <ul className="strip-moves">
              {strip.moves.map((voice, i) => (
                <li key={i} className="strip-move">
                  {voice.from !== null && <span className="strip-note">{voice.from}</span>}
                  <span className="strip-glyph">{moveGlyph(voice)}</span>
                  {voice.to !== null && <span className="strip-note">{voice.to}</span>}
                  {voice.interval && <span className="strip-step">{voice.interval}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {voices && (
        <p className="strip-summary" aria-hidden="true">
          {empty
            ? strip.emptyText
            : strip.summaryParts.map((part, i) => (
                <Fragment key={part}>
                  {i > 0 && <span className="strip-sep"> · </span>}
                  <span className="strip-fact">{part}</span>
                </Fragment>
              ))}
        </p>
      )}
      {voices && <p className="visually-hidden">{strip.description}</p>}
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
      {lane.relations.map((relation) => (
        <div key={relation.id} className="strip-relation">
          {(relation.arrow || relation.bracket) && <RelationMark relation={relation} />}
          <span className="strip-relation-label">{relation.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A bracket over a ii–V pair, or an arrow for a resolution (dashed for a tritone substitute). */
function RelationMark({ relation }: { readonly relation: RelationView }) {
  const markerId = `mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      className="strip-mark"
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      width={MARK_WIDTH}
      height={MARK_HEIGHT}
      aria-hidden="true"
    >
      {relation.bracket ? (
        <path d={`M2 ${MARK_HEIGHT - 1} V3 H${MARK_WIDTH - 2} V${MARK_HEIGHT - 1}`} />
      ) : (
        <>
          <defs>
            <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path className="strip-arrowhead" d="M0 0.8 7.5 4 0 7.2z" />
            </marker>
          </defs>
          <line
            className={relation.arrow === 'dashed' ? 'is-dashed' : undefined}
            x1={2}
            y1={MARK_HEIGHT / 2}
            x2={MARK_WIDTH - 6}
            y2={MARK_HEIGHT / 2}
            markerEnd={`url(#${markerId})`}
          />
        </>
      )}
    </svg>
  );
}
