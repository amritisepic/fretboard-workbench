import type { ScaleRef } from '../theory';
import { labelInk } from './color';
import type { RankingRow, RankingView } from './rankingModel';

export function RankingList({
  ranking,
  color,
  onSelect,
}: {
  readonly ranking: RankingView;
  readonly color: string;
  readonly onSelect: (scale: ScaleRef) => void;
}) {
  return (
    <div className="ranking">
      {ranking.comparedWithPrevious && <p className="hint">Also weighted by voice leading from the previous box.</p>}
      {ranking.sections.map((section) => (
        <section key={section.id} className="rank-section" aria-label={section.title}>
          <h4 className="rank-section-title">
            {section.title}
            <span className="rank-count">{section.rows.length}</span>
          </h4>
          <RankRows rows={section.rows} color={color} onSelect={onSelect} />
        </section>
      ))}
      {ranking.distant.length > 0 && (
        <details className="rank-distant">
          <summary className="rank-section-title">
            Maximally distant
            <span className="rank-count">{ranking.distant.length}</span>
          </summary>
          <p className="hint">The fewest shared tones. Starting points for chromatic substitution.</p>
          <RankRows rows={ranking.distant} color={color} onSelect={onSelect} />
        </details>
      )}
    </div>
  );
}

function RankRows({
  rows,
  color,
  onSelect,
}: {
  readonly rows: readonly RankingRow[];
  readonly color: string;
  readonly onSelect: (scale: ScaleRef) => void;
}) {
  const chordInk = labelInk(color);
  return (
    <ol className="rank-rows">
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            className={row.selected ? 'rank-row is-selected' : 'rank-row'}
            aria-pressed={row.selected}
            aria-label={`${row.scale.name}${row.missingNote ? `, ${row.missingNote}` : ''}: ${row.cells.map((c) => c.label).join(' ')}`}
            onClick={() => onSelect(row.scale.ref)}
          >
            <span className="rank-name">
              {row.scale.name}
              {row.missingNote && <span className="rank-missing">{row.missingNote}</span>}
            </span>
            <span className="rank-strip" aria-hidden="true">
              {row.cells.map((cell, i) => (
                <span
                  key={i}
                  className={cell.chordTone ? 'rank-cell is-chord' : 'rank-cell'}
                  style={cell.chordTone ? { backgroundColor: color, borderColor: color, color: chordInk } : undefined}
                >
                  {cell.label}
                </span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
