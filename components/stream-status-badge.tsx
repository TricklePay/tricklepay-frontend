import type { JSX } from "react";

import { STREAM_STATUS_META } from "@/lib/stream-status";
import type { StreamStatus } from "@/types/stream";

/**
 * The stream status pill, shared by the card, table, and detail views so a
 * change to its color, icon, or wording is a single edit instead of three.
 *
 * @param status - The stream's status.
 * @param variant - "colored" (default) is the icon + per-status color pill
 *   used in the card and table. "plain" is the flat neutral pill used next
 *   to the heading on the detail page — kept as its own variant rather than
 *   silently restyled to match, so existing output stays unchanged.
 * @param className - Additional classes merged onto the pill.
 */
export function StreamStatusBadge({
  status,
  variant = "colored",
  className = "",
}: {
  status: StreamStatus;
  variant?: "colored" | "plain";
  className?: string;
}): JSX.Element {
  if (variant === "plain") {
    return (
      <span
        className={[
          "rounded bg-neutral-800 px-2 py-0.5 text-xs capitalize text-neutral-300",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {status}
      </span>
    );
  }

  const meta = STREAM_STATUS_META[status];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium capitalize",
        meta.style,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true" className="text-[10px]">
        {meta.icon}
      </span>
      <span>{status}</span>
    </span>
  );
}
