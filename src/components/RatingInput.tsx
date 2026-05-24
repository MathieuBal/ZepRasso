type RatingInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export default function RatingInput({ label, value, onChange }: RatingInputProps) {
  return (
    <label className="rating-row">
      <span className="label">{label}</span>
      <span className="rating-control">
        <input
          className="range"
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="rating-value">{value}/10</span>
      </span>
    </label>
  );
}
