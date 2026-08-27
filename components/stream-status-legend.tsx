import type { StreamStatus } from "@/types/stream";

const LEGEND_ITEMS: Array<{ status: StreamStatus; dot: string; label: string; description: string }> = [
  {
    status: "pending",
    dot: "bg-neutral-400",
    label: "Pending",
    description: "Start time not yet reached",
  },
  {
    status: "streaming",
    dot: "bg-green-400",
    label: "Streaming",
    description: "Tokens are actively vesting",
  },
  {
    status: "completed",
    dot: "bg-blue-400",
    label: "Completed",
    description: "Fully vested and ended",
  },
  {
    status: "cancelled",
    dot: "bg-red-400",
    label: "Cancelled",
    description: "Stopped before end time",
  },
];

/**
 * A compact, accessible legend explaining what each stream status badge means.
 * Renders as a horizontal wrapping list of colour-coded dot + label pairs.
 */
export function StreamStatusLegend() {
  return (
    <dl
      className="flex flex-wrap gap-x-5 gap-y-1"
      aria-label="Stream status legend"
    >
      {LEGEND_ITEMS.map(({ status, dot, label, description }) => (
        <div key={status} className="flex items-center gap-1.5">
          {/* Colour dot mirrors the badge hue used in StreamCard / StreamTable */}
          <span
            className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${dot}`}
            aria-hidden="true"
          />
          <dt className="text-xs font-medium text-neutral-300">{label}</dt>
          <dd className="sr-only">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
