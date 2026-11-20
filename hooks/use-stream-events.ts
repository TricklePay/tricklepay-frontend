"use client";

import { useCallback, useEffect, useState } from "react";

import { getStreamEvents, isAbortError } from "@/lib/api";
import type { StreamEvent } from "@/types/stream";

export interface StreamEventsState {
  events: StreamEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads the indexed event history for a stream (`GET /streams/:id/events`).
 * Aborts any in-flight request when the stream id changes, a refresh is
 * triggered, or the page unmounts.
 */
export function useStreamEvents(id: string | null, reloadTrigger = 0): StreamEventsState {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const refresh = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    getStreamEvents(id, { signal: controller.signal })
      .then((items) => {
        if (!cancelled) setEvents(items);
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load stream events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, reloadTrigger, retryCount]);

  return { events, loading, error, refresh };
}
