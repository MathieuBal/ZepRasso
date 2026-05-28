type RatingInputProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
};

export default function RatingInput({ label, hint, value, onChange }: RatingInputProps) {
  const cells = Array.from({ length: 11 });
  return (
    <div className="rating-row">
      <div className="rating-head">
        <span className="label">{label}</span>
        <span className={`rating-value ${value >= 8 ? 'is-high' : ''}`}>
          {value}<small>/10</small>
        </span>
      </div>
      {hint && <p className="rating-hint">{hint}</p>}
      <div
        className="stepper"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            onChange(Math.min(10, value + 1));
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            onChange(Math.max(0, value - 1));
          }
        }}
      >
        {cells.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Note ${i} sur 10`}
            className={`stepper-cell ${i <= value ? 'is-on' : ''} ${value === 10 && i === 10 ? 'peak' : ''}`}
            onClick={() => onChange(i)}
          />
        ))}
      </div>
    </div>
  );
}
