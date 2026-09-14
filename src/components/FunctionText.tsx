import type { FunctionLabel } from './analysisModel';

/** A function label as in print, with figured bass stacked: V⁶₅/V, V7/IV. */
export function FunctionText({ label }: { readonly label: FunctionLabel }) {
  return (
    <span className="function-text">
      <span className="visually-hidden">{label.text}</span>
      <span aria-hidden="true">
        {label.numeral}
        {label.suffix}
        {label.figures.length === 1 && <sup className="figure">{label.figures[0]}</sup>}
        {label.figures.length > 1 && (
          <span className="figures">
            {label.figures.map((figure, i) => (
              <span key={i}>{figure}</span>
            ))}
          </span>
        )}
        {label.target}
      </span>
    </span>
  );
}
