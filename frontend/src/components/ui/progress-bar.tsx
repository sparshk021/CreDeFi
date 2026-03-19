interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "bg-brand",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
