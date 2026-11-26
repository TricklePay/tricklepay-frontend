"use client";

import { useEffect, useRef } from "react";

function canPoll(): boolean {
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return !hidden && !offline;
}

/**
 * Calls `fn` immediately on mount and then every `intervalMs` while `enabled`
 * is true, passing an `AbortSignal` that is aborted before the next run or on
 * cleanup. Changing `fn` updates the callback without restarting the interval.
 *
 * Pauses polling while the document is hidden (`visibilityState === "hidden"`)
 * or the browser is offline (`navigator.onLine === false`). Becoming hidden or
 * going offline aborts any in-flight probe so an offline failure cannot
 * overwrite the last known state; becoming visible or coming back online
 * triggers one immediate probe and restarts the interval from that point.
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
    let interval: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      // Abort any still-pending request from the previous tick or cleanup.
      controller?.abort();
      const current = new AbortController();
      controller = current;
      void fnRef.current(current.signal);
    };

    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      controller?.abort();
      controller = null;
    };

    const start = () => {
      if (interval !== null || !canPoll()) return;
      run();
      interval = setInterval(run, intervalMs);
    };

    const sync = () => {
      if (canPoll()) start();
      else stop();
    };

    sync();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", sync);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", sync);
      window.addEventListener("offline", sync);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", sync);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", sync);
        window.removeEventListener("offline", sync);
      }
    };
  }, [intervalMs, enabled]);
}
