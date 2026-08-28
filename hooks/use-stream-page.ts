"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError, listStreams, type ListStreamsParams } from "@/lib/api";
import type { StreamStatus, StreamView } from "@/types/stream";

// Rows per request. Kept under the backend's 50-row default so a large account
// arrives in visible increments instead of one long stall.
export const PAGE_SIZE = 25;

export type StreamRole = "sender" | "recipient";

export interface StreamPage {
  streams: StreamView[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

function pageQuery(
  role: StreamRole,
  address: string,
  offset: number,
  status?: StreamStatus | "all",
): ListStreamsParams {
  const party: ListStreamsParams =
    role === "sender" ? { sender: address } : { recipient: address };
  return { ...party, limit: PAGE_SIZE, offset, status };
}

// Loads the streams an address is party to one page at a time, appending each
// page to the rows already on screen. Incoming and outgoing page independently,
// so each call site owns its own copy of this state.
export function useStreamPage(
  role: StreamRole,
  address: string | null,
  status: StreamStatus | "all" = "all",
): StreamPage {
  const [streams, setStreams] = useState<StreamView[]>([]);
  const [total, setTotal] = useState(0);
  // Rows fetched so far, which is the offset of the next page. Tracked apart
  // from streams.length because duplicates are dropped on append but still
  // count against the offset the backend paginates by.
  const [fetched, setFetched] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped whenever the query changes. A request compares the generation it
  // started under against the current one before writing, so a slow page cannot
  // append its rows to a list that has since been reset for another address.
  const generation = useRef(0);

  // Controllers for requests that have not settled yet. The generation check
  // above already stops a stale response from being *written*; aborting stops
  // it from being *waited for* — switching accounts, changing the status
  // filter, or leaving the page drops the connection instead of holding a
  // socket open and decoding a body nobody will read. It also matters on a slow
  // link, where superseded page loads would otherwise queue up against the
  // browser's per-host connection limit and delay the one that counts.
  const inFlight = useRef<Set<AbortController>>(new Set());

  const startRequest = useCallback(() => {
    const controller = new AbortController();
    inFlight.current.add(controller);
    return controller;
  }, []);

  const endRequest = useCallback((controller: AbortController) => {
    inFlight.current.delete(controller);
  }, []);

  const abortInFlight = useCallback(() => {
    for (const controller of inFlight.current) controller.abort();
    inFlight.current.clear();
  }, []);

  // Loads page 0 from scratch, discarding whatever is on screen. Shared by the
  // query-change effect and the exposed refresh() so both cancel the same way.
  const loadFirstPage = useCallback(() => {
    abortInFlight();
    generation.current += 1;
    const gen = generation.current;

    setStreams([]);
    setTotal(0);
    setFetched(0);
    setError(null);
    if (!address) return;

    const controller = startRequest();
    setLoading(true);
    listStreams(pageQuery(role, address, 0, status), { signal: controller.signal })
      .then((page) => {
        if (generation.current !== gen) return;
        setStreams(page.streams);
        setTotal(page.total);
        setFetched(page.streams.length);
      })
      .catch((err: unknown) => {
        // A cancelled request is an expected outcome, not a failure to report.
        if (isAbortError(err) || generation.current !== gen) return;
        setError(err instanceof Error ? err.message : "Failed to load streams");
      })
      .finally(() => {
        endRequest(controller);
        if (generation.current === gen) setLoading(false);
      });
  }, [role, address, status, abortInFlight, startRequest, endRequest]);

  useEffect(() => {
    loadFirstPage();
    // Leaving the page, or changing the query, cancels everything still open
    // for the query being left behind.
    return () => abortInFlight();
  }, [loadFirstPage, abortInFlight]);

  const hasMore = fetched < total;

  const refresh = loadFirstPage;

  const silentRefresh = useCallback(() => {
    if (!address || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    const gen = generation.current;
    const controller = startRequest();
    listStreams(pageQuery(role, address, 0, status), { signal: controller.signal })
      .then((page) => {
        if (generation.current !== gen) return;
        setStreams(page.streams);
        setTotal(page.total);
        setFetched(page.streams.length);
      })
      .catch(() => {
        // Background refresh failure, or cancellation: retain existing on-screen rows
      })
      .finally(() => {
        endRequest(controller);
      });
  }, [role, address, status, startRequest, endRequest]);

  // Periodic and window-focus auto-refresh to reflect counterparty actions
  useEffect(() => {
    if (!address || typeof window === "undefined") return;

    const onFocus = () => {
      silentRefresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentRefresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = setInterval(silentRefresh, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [address, silentRefresh]);

  const loadMore = useCallback(() => {
    if (!address || loading || loadingMore || !hasMore) return;
    const gen = generation.current;
    const controller = startRequest();
    setLoadingMore(true);
    setError(null);

    listStreams(pageQuery(role, address, fetched, status), { signal: controller.signal })
      .then((page) => {
        if (generation.current !== gen) return;
        // A stream created since the first page shifts every later row by one,
        // so the same id can arrive twice. Drop the repeats to keep React keys
        // unique, but count every returned row against the offset.
        setStreams((previous) => {
          const seen = new Set(previous.map((stream) => stream.id));
          return [...previous, ...page.streams.filter((stream) => !seen.has(stream.id))];
        });
        setFetched(fetched + page.streams.length);
        // An empty page means the result set shrank between requests; trust the
        // rows in hand over the reported total so the button does not stick.
        setTotal(page.streams.length === 0 ? fetched : page.total);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || generation.current !== gen) return;
        setError(err instanceof Error ? err.message : "Failed to load more streams");
      })
      .finally(() => {
        endRequest(controller);
        if (generation.current === gen) setLoadingMore(false);
      });
  }, [
    address,
    role,
    fetched,
    hasMore,
    loading,
    loadingMore,
    status,
    startRequest,
    endRequest,
  ]);

  return { streams, total, loading, loadingMore, error, hasMore, loadMore, refresh };
}
