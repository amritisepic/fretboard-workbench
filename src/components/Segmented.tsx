import { rovingRadioGroup } from './rovingRadioGroup';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const roving = rovingRadioGroup(
    options.map((option) => option.value),
    value,
    onChange,
  );

  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={roving.onKeyDown}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={roving.tabIndex(index)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
