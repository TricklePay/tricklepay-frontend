// A thin progress bar. `value` is in basis points (0 to 10000), matching the
// contract's progress figure.
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value / 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full bg-neutral-300 transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
