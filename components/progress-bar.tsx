// A thin progress bar. `value` is in basis points (0 to 10000), matching the
// contract's progress figure.
export function ProgressBar({
  value,
  label = "Stream vesting progress",
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, value / 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-800"
    >
      <div className="h-full bg-neutral-300 transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
