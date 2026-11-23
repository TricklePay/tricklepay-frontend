"use client";

import type { JSX } from "react";

import { useOnline } from "@/hooks/use-online";

/**
 * Displays a non-dismissible banner when the browser loses internet
 * connectivity and removes it automatically when the connection returns.
 *
 * `aria-live="polite"` announces the message to screen readers without
 * interrupting the current reading flow. The region is always rendered in
 * the DOM (empty when online) so the live region is already registered before
 * it needs to announce anything — inserting a live region and populating it
 * simultaneously is not reliably announced by all assistive technologies.
 */
export function OfflineBanner(): JSX.Element {
  const online = useOnline();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={online ? "" : "You are offline"}
    >
      {!online && (
        <div className="border-b border-amber-800/60 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          You are offline. Check your connection — data will refresh when connectivity returns.
        </div>
      )}
    </div>
  );
}
