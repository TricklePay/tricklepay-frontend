"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listStreams, type ListStreamsParams } from "@/lib/api";
import type { StreamView } from "@/types/stream";

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
}

function pageQuery(role: StreamRole, address: string, offset: number): ListStreamsParams {
  const party: ListStreamsParams =
    role === "sender" ? { sender: address } : { recipient: address };
  return { ...party, limit: PAGE_SIZE, offset };
}

// Loads the streams an address is party to one page at a time, appending each
// page to the rows already on screen. Incoming and outgoing page independently,
// so each call site owns its own copy of this state.
export function useStreamPage(role: StreamRole, address: string | null): StreamPage {
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

  useEffect(() => {
    generation.current += 1;
    const gen = generation.current;

    setStreams([]);
    setTotal(0);
    setFetched(0);
    setError(null);
    if (!address) return;

    setLoading(true);
    listStreams(pageQuery(role, address, 0))
      .then((page) => {
        if (generation.current !== gen) return;
        setStreams(page.streams);
        setTotal(page.total);
        setFetched(page.streams.length);
      })
      .catch((err: unknown) => {
        if (generation.current !== gen) return;
        setError(err instanceof Error ? err.message : "Failed to load streams");
      })
      .finally(() => {
        if (generation.current === gen) setLoading(false);
      });
  }, [role, address]);

  const hasMore = fetched < total;

  const loadMore = useCallback(() => {
    if (!address || loading || loadingMore || !hasMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    setError(null);

    listStreams(pageQuery(role, address, fetched))
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
        if (generation.current !== gen) return;
        setError(err instanceof Error ? err.message : "Failed to load more streams");
      })
      .finally(() => {
        if (generation.current === gen) setLoadingMore(false);
      });
  }, [address, role, fetched, hasMore, loading, loadingMore]);

  return { streams, total, loading, loadingMore, error, hasMore, loadMore };
}
