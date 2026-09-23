import type { FunctionLabel } from './analysisModel';

/** A function label as in print, with figured bass stacked: V⁶₅/V, V7/IV. */
export function FunctionText({ label, context }: { readonly label: FunctionLabel; readonly context?: string }) {
  return (
    <span className="function-text">
      {/*
        The printed label is built out of superscripts and stacked figures that a screen reader would
        read as loose digits, so the plain text is what is actually announced. `context` is spoken
        with it: a numeral means nothing without the key it is counted from, and where the chip has
        no explanation to open, this hidden copy is the only place that can say so.
      */}
      <span className="visually-hidden">{context ? `${label.text} ${context}` : label.text}</span>
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
