"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `fn` immediately on mount and then every `intervalMs` while `enabled`
 * is true, passing an `AbortSignal` that is aborted before the next run or on
 * cleanup. Changing `fn` updates the callback without restarting the interval.
 */
export function usePolling(
  fn: (signal: AbortSignal) => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;

    let controller: AbortController | null = null;

    const run = () => {
      // Abort any still-pending request from the previous tick or cleanup.
      controller?.abort();
      const current = new AbortController();
      controller = current;
      void fnRef.current(current.signal);
    };

    run();
    const interval = setInterval(run, intervalMs);

    return () => {
      clearInterval(interval);
      controller?.abort();
    };
  }, [intervalMs, enabled]);
}
