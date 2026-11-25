"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAbortError, isApiError, listStreams, type ListStreamsParams } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/lib/page-size";
import type { StreamStatus, StreamView } from "@/types/stream";

// Rows per request. Kept under the backend's 50-row default so a large account
// arrives in visible increments instead of one long stall.
export const PAGE_SIZE = 25;

// How often the dashboard lists refetch in the background so counterparty
// changes show up without a reload, without polling the backend too hard.
const LIST_REFRESH_INTERVAL_MS = 15_000;

// Most list-fetch failures are a single transient blip (a dropped connection,
// a momentary 5xx) that a second attempt clears on its own. One silent retry
// absorbs that case before bothering the user with an error to act on.
const FIRST_PAGE_MAX_ATTEMPTS = 2;
const FIRST_PAGE_RETRY_DELAY_MS = 500;

/**
 * Number of consecutive failed background refreshes before warning the user
 * that displayed stream data may be out of date.
 */
export const CONSECUTIVE_REFRESH_FAILURES_THRESHOLD = 3;

// Maximum 32-bit signed integer delay accepted by setTimeout (~24.8 days);
// larger values overflow to 1ms in browsers and Node.
const MAX_TIMEOUT_MS = 2_147_483_647;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  const target = Date.now() + ms;
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer !== null) clearTimeout(timer);
      resolve();
    };
    const arm = () => {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        signal.removeEventListener("abort", onAbort);
        resolve();
        return;
      }
      timer = setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_MS));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    arm();
  });
}

function getRetryAfterMs(error: unknown): number | null {
  if (!isApiError(error) || error.retryAfterSeconds === undefined) return null;
  return Math.max(0, error.retryAfterSeconds * 1000);
}

export type StreamRole = "sender" | "recipient";

export interface StreamPage {
  streams: StreamView[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  requestId: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  /**
   * Epoch milliseconds of the most recent successful fetch (first page,
   * background refresh, or load-more), or `null` before the first one
   * completes. Not reset on a failed refresh — a failure means the data on
   * screen is stale, which is exactly when its last-known age matters most.
   */
  lastUpdated: number | null;
  /**
   * Number of consecutive failed background refreshes since the last successful fetch.
   */
  consecutiveRefreshFailures: number;
  /**
   * Status warning shown when consecutive background refreshes exceed threshold, or `null`.
   */
  refreshWarning: string | null;
}

function pageQuery(
  role: StreamRole,
  address: string,
  status: StreamStatus | "all" | undefined,
  pageSize: number,
  cursor?: string,
): ListStreamsParams {
  const party: ListStreamsParams =
    role === "sender" ? { sender: address } : { recipient: address };
  return {
    ...party,
    limit: pageSize,
    ...(cursor !== undefined ? { cursor } : {}),
    status,
    includeTotal: true,
  };
}

/**
 * Coordinates fetching, refreshing, and error state for the stream detail view.
 * Loads the streams an address is party to one page at a time, appending each
 * page to the rows already on screen. Incoming and outgoing streams page
 * independently, so each call site owns its own copy of this state.
 * 
 * Refresh is triggered manually via the exposed refresh() function or automatically
 * on window focus, visibility change, and every 15 seconds. Background refreshes
 * fail silently to avoid disrupting the user experience, and back off for at least
 * any `Retry-After` delay returned by the backend. Manual refresh resets
 * the list to page 0 and surfaces errors.
 * 
 * Error state is set when a request fails due to a network or API issue, but not
 * when a request is cancelled (e.g., when switching accounts or leaving the page).
 * The first page load retries once, silently, before surfacing an error — most
 * failures are a transient blip that a second attempt clears on its own.
 * 
 * @param role - Whether to fetch streams where the address is "sender" or "recipient"
 * @param address - The wallet address to fetch streams for, or null if no wallet connected
 * @param status - Filter streams by status, or "all" to fetch streams of any status
 * @param pageSize - Rows requested per page; defaults to PAGE_SIZE
 *
 * @returns {StreamPage} An object containing:
 *   - streams: the list of streams loaded so far
 *   - total: total number of streams matching the query
 *   - loading: true during the initial page load
 *   - loadingMore: true when fetching additional pages
 *   - error: error message from the most recent failed request, or null
 *   - hasMore: true if there are more streams to load
 *   - loadMore: function to fetch the next page
 *   - refresh: function to reload from page 0
 *   - lastUpdated: epoch ms of the most recent successful fetch, or null
 *     before the first one completes
 */
export function useStreamPage(
  role: StreamRole,
  address: string | null,
  status: StreamStatus | "all" = "all",
  pageSize: number = PAGE_SIZE,
): StreamPage {
  const [streams, setStreams] = useState<StreamView[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [consecutiveRefreshFailures, setConsecutiveRefreshFailures] = useState(0);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Mirrors the streams state so silentRefresh callbacks can read the current
  // row count without declaring streams as a dependency (which would recreate
  // the callback on every render and retrigger the interval effect).
  const streamsRef = useRef<StreamView[]>([]);
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);

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

  // Epoch ms until which automatic refreshes and retries must back off after
  // receiving a Retry-After header from the backend.
  const retryAfterUntilRef = useRef(0);
  // Active scheduled timer for the next background list refresh.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while the periodic auto-refresh effect is active.
  const autoRefreshActiveRef = useRef(false);
  // True while loadFirstPage (including any retry wait) is actively running,
  // so background refreshes do not overlap with an in-progress first-page load.
  const firstPageActiveRef = useRef(false);
  // Always points to the latest silentRefresh callback so scheduled timers and
  // window listeners invoke it without restarting the auto-refresh effect.
  const silentRefreshRef = useRef<() => void>(() => {});

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

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const recordRetryAfter = useCallback((error: unknown): number => {
    const retryAfterMs = getRetryAfterMs(error);
    if (retryAfterMs === null) return 0;
    const retryAt = Date.now() + retryAfterMs;
    if (retryAt > retryAfterUntilRef.current) {
      retryAfterUntilRef.current = retryAt;
    }
    return retryAfterMs;
  }, []);

  const scheduleNextRefresh = useCallback(
    (minDelayMs: number = LIST_REFRESH_INTERVAL_MS) => {
      clearRefreshTimer();
      if (!autoRefreshActiveRef.current) return;
      const remainingRetryMs = Math.max(0, retryAfterUntilRef.current - Date.now());
      const delayMs = Math.max(minDelayMs, remainingRetryMs);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        silentRefreshRef.current();
      }, Math.min(delayMs, MAX_TIMEOUT_MS));
    },
    [clearRefreshTimer],
  );

  // Loads page 0 from scratch, discarding whatever is on screen. Shared by the
  // query-change effect and the exposed refresh() so both cancel the same way.
  const loadFirstPage = useCallback(() => {
    abortInFlight();
    clearRefreshTimer();
    generation.current += 1;
    const gen = generation.current;

    setStreams([]);
    setTotal(0);
    setNextCursor(null);
    setError(null);
    setRequestId(null);
    setConsecutiveRefreshFailures(0);
    setRefreshWarning(null);
    if (!address) {
      firstPageActiveRef.current = false;
      return;
    }

    firstPageActiveRef.current = true;
    setLoading(true);

    const run = async () => {
      for (let attempt = 1; attempt <= FIRST_PAGE_MAX_ATTEMPTS; attempt += 1) {
        const controller = startRequest();
        try {
          const page = await listStreams(pageQuery(role, address, status, pageSize), {
            signal: controller.signal,
          });
          endRequest(controller);
          if (generation.current !== gen) return;
          retryAfterUntilRef.current = 0;
          setStreams(page.streams);
          setTotal(page.total ?? page.streams.length);
          setNextCursor(page.nextCursor ?? null);
          setLastUpdated(Date.now());
          setConsecutiveRefreshFailures(0);
          setRefreshWarning(null);
          return;
        } catch (err) {
          endRequest(controller);
          // A cancelled request is an expected outcome, not a failure to report.
          if (isAbortError(err) || generation.current !== gen) return;
          recordRetryAfter(err);
          if (attempt === FIRST_PAGE_MAX_ATTEMPTS) {
            setError(err instanceof Error ? err.message : "Failed to load streams");
            const reqId =
              typeof err === "object" &&
              err !== null &&
              "requestId" in err &&
              typeof (err as { requestId: unknown }).requestId === "string"
                ? (err as { requestId: string }).requestId
                : null;
            setRequestId(reqId);
            return;
          }
          const remainingRetryMs = Math.max(0, retryAfterUntilRef.current - Date.now());
          const retryDelayMs = Math.max(FIRST_PAGE_RETRY_DELAY_MS, remainingRetryMs);
          const retryController = startRequest();
          await wait(retryDelayMs, retryController.signal);
          endRequest(retryController);
          if (generation.current !== gen) return;
        }
      }
    };

    run().finally(() => {
      if (generation.current === gen) {
        firstPageActiveRef.current = false;
        setLoading(false);
        scheduleNextRefresh();
      }
    });
  }, [
    role,
    address,
    status,
    pageSize,
    abortInFlight,
    clearRefreshTimer,
    startRequest,
    endRequest,
    recordRetryAfter,
    scheduleNextRefresh,
  ]);

  useEffect(() => {
    loadFirstPage();
    // Leaving the page, or changing the query, cancels everything still open
    // for the query being left behind.
    return () => {
      generation.current += 1;
      firstPageActiveRef.current = false;
      abortInFlight();
    };
  }, [loadFirstPage, abortInFlight]);

  const hasMore = nextCursor !== null;

  const refresh = loadFirstPage;

  const silentRefresh = useCallback(() => {
    if (!address || firstPageActiveRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      if (refreshTimerRef.current === null) {
        scheduleNextRefresh();
      }
      return;
    }
    const remainingRetryMs = retryAfterUntilRef.current - Date.now();
    if (remainingRetryMs > 0) {
      if (refreshTimerRef.current === null) {
        scheduleNextRefresh(remainingRetryMs);
      }
      return;
    }

    clearRefreshTimer();
    const gen = generation.current;
    // Fetch enough rows to cover everything currently on screen, up to the
    // backend's page ceiling. This way a user who has loaded 75 rows still
    // sees 75 rows after a background refresh, rather than being silently
    // reset to the default page size.
    const refreshLimit = Math.min(MAX_PAGE_SIZE, Math.max(pageSize, streamsRef.current.length));
    const controller = startRequest();
    listStreams(pageQuery(role, address, status, refreshLimit), { signal: controller.signal })
      .then((page) => {
        if (generation.current !== gen) return;
        retryAfterUntilRef.current = 0;
        // Past the page ceiling the refresh can only cover the first rows.
        // Swap those in and keep the loaded tail and its cursor, so the list
        // keeps updating instead of discarding the response.
        if (
          streamsRef.current.length > MAX_PAGE_SIZE &&
          page.streams.length >= refreshLimit
        ) {
          const head = page.streams.length;
          setStreams((previous) => [...page.streams, ...previous.slice(head)]);
          setTotal(page.total ?? streamsRef.current.length);
          setLastUpdated(Date.now());
          setConsecutiveRefreshFailures(0);
          setRefreshWarning(null);
          return;
        }
        // If loadMore ran while this request was in flight, it has appended
        // rows beyond what we fetched. Applying a shorter list would silently
        // drop them, so skip this refresh result; the next interval will cover
        // the full set.
        if (page.streams.length < streamsRef.current.length) return;
        setStreams(page.streams);
        setTotal(page.total ?? page.streams.length);
        setNextCursor(page.nextCursor ?? null);
        setLastUpdated(Date.now());
        setConsecutiveRefreshFailures(0);
        setRefreshWarning(null);
      })
      .catch((err: unknown) => {
        // Background refresh failure, or cancellation: retain existing on-screen rows
        if (isAbortError(err) || generation.current !== gen) return;
        recordRetryAfter(err);
        setConsecutiveRefreshFailures((prev) => {
          const next = prev + 1;
          if (next >= CONSECUTIVE_REFRESH_FAILURES_THRESHOLD) {
            setRefreshWarning("Data may be out of date.");
          }
          return next;
        });
      })
      .finally(() => {
        endRequest(controller);
        if (generation.current === gen) {
          scheduleNextRefresh();
        }
      });
  }, [
    role,
    address,
    status,
    pageSize,
    clearRefreshTimer,
    startRequest,
    endRequest,
    recordRetryAfter,
    scheduleNextRefresh,
  ]);

  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
  }, [silentRefresh]);

  // Periodic and window-focus auto-refresh to reflect counterparty actions
  useEffect(() => {
    if (!address || typeof window === "undefined") return;

    autoRefreshActiveRef.current = true;

    const onFocus = () => {
      silentRefreshRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentRefreshRef.current();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!firstPageActiveRef.current) {
      scheduleNextRefresh();
    }

    return () => {
      autoRefreshActiveRef.current = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearRefreshTimer();
    };
  }, [address, scheduleNextRefresh, clearRefreshTimer]);

  const loadMore = useCallback(() => {
    if (!address || loading || loadingMore || !nextCursor) return;
    const gen = generation.current;
    const controller = startRequest();
    setLoadingMore(true);
    setError(null);

    listStreams(pageQuery(role, address, status, pageSize, nextCursor), {
      signal: controller.signal,
    })
      .then((page) => {
        if (generation.current !== gen) return;
        retryAfterUntilRef.current = 0;
        setStreams((previous) => {
          const combined = [...previous, ...page.streams];
          setTotal(
            page.streams.length === 0
              ? combined.length
              : (page.total ?? combined.length),
          );
          return combined;
        });
        setNextCursor(page.nextCursor ?? null);
        setLastUpdated(Date.now());
        setConsecutiveRefreshFailures(0);
        setRefreshWarning(null);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || generation.current !== gen) return;
        const retryAfterMs = recordRetryAfter(err);
        if (retryAfterMs > 0) {
          scheduleNextRefresh();
        }
        setError(err instanceof Error ? err.message : "Failed to load more streams");
        const reqId =
          typeof err === "object" &&
          err !== null &&
          "requestId" in err &&
          typeof (err as { requestId: unknown }).requestId === "string"
            ? (err as { requestId: string }).requestId
            : null;
        setRequestId(reqId);
      })
      .finally(() => {
        endRequest(controller);
        if (generation.current === gen) setLoadingMore(false);
      });
  }, [
    address,
    role,
    nextCursor,
    loading,
    loadingMore,
    status,
    pageSize,
    startRequest,
    endRequest,
    recordRetryAfter,
    scheduleNextRefresh,
  ]);

  return {
    streams,
    total,
    loading,
    loadingMore,
    error,
    requestId,
    hasMore,
    loadMore,
    refresh,
    lastUpdated,
    consecutiveRefreshFailures,
    refreshWarning,
  };
}
