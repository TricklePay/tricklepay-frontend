import type { StreamStatus } from "@/types/stream";
import { STREAM_STATUS_META } from "@/lib/stream-status";

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
      {(Object.keys(STREAM_STATUS_META) as StreamStatus[]).map((status) => {
        const { dot, label, description } = STREAM_STATUS_META[status];
        return (
        <div key={status} className="flex items-center gap-1.5">
          {/* Colour dot mirrors the badge hue used in StreamCard / StreamTable */}
          <span
            className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${dot}`}
            aria-hidden="true"
          />
          <dt className="text-xs font-medium text-neutral-300">{label}</dt>
          <dd className="sr-only">{description}</dd>
        </div>
        );
      })}
    </dl>
  );
}
