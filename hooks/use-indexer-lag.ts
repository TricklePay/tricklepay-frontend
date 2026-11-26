"use client";

import { useState } from "react";

import { usePolling } from "@/hooks/use-polling";
import { getIndexerLag, isAbortError } from "@/lib/api";

// How often the indexer's lag is re-read. Lag drifts over minutes, and the
// banner it drives is advisory, so a slow poll keeps the load negligible.
export const INDEXER_LAG_INTERVAL_MS = 60_000;

/**
 * Reads how many ledgers the backend's indexer is behind the chain.
 *
 * Returns null while unknown: before the first read, after a failed request,
 * or when the backend does not report a figure. A failure never surfaces as an
 * error, and a later successful read replaces the stale value. Reads once on
 * mount and then every INDEXER_LAG_INTERVAL_MS; unmounting stops the timer and
 * aborts a read in flight. With `enabled` false (mock mode) nothing is
 * requested.
 */
export function useIndexerLag(enabled = true): number | null {
  const [lag, setLag] = useState<number | null>(null);

  usePolling(
    (signal) => {
      getIndexerLag({ signal })
        .then((value) => {
          if (!signal.aborted) setLag(value);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) setLag(null);
        });
    },
    INDEXER_LAG_INTERVAL_MS,
    enabled,
  );

  return lag;
}
