"use client";

import { useEffect, useState } from "react";

// Relative-time labels are minute-granularity, so refreshing far faster than
// that would re-render for no visible change.
const DEFAULT_TICK_MS = 30_000;

/**
 * Ticks on an interval to force callers to re-render, independent of any
 * other state. Intended for components that derive a relative-time string
 * (e.g. "starts in 2h") from Date.now() at render time and need that string
 * to keep advancing on screen even when nothing else about the data changes.
 *
 * @param intervalMs - How often to re-render. Defaults to 30s.
 */
export function useNow(intervalMs: number = DEFAULT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
