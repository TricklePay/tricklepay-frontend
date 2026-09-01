"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getStream, isAbortError } from "@/lib/api";
import { StreamDetail } from "@/components/stream-detail";
import { StreamDetailSkeleton } from "@/components/skeleton";
import type { StreamView } from "@/types/stream";

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [stream, setStream] = useState<StreamView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Navigating away (or retrying) cancels the request outright rather than
    // just ignoring its result, so the browser drops the connection instead of
    // decoding a stream nobody is looking at any more.
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    getStream(id, { signal: controller.signal })
      .then((s) => {
        if (!cancelled) setStream(s);
      })
      .catch((err: unknown) => {
        // A cancelled request is an expected outcome, not a failure to report.
        if (cancelled || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load stream");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, reloadKey]);

  // Periodic and window-focus background refetch so counterparty actions (e.g. withdrawal or cancellation)
  // become immediately visible without a manual browser page reload.
  useEffect(() => {
    let cancelled = false;
    // Every background refetch still open, so leaving the page cancels them all
    // instead of letting a poll started seconds ago run to completion.
    const inFlight = new Set<AbortController>();

    const silentRefetch = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const controller = new AbortController();
      inFlight.add(controller);
      getStream(id, { signal: controller.signal })
        .then((s) => {
          if (!cancelled && s) setStream(s);
        })
        .catch(() => {
          // Ignore background fetch failures (and cancellations) and retain current data
        })
        .finally(() => {
          inFlight.delete(controller);
        });
    };

    const onFocus = () => silentRefetch();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") silentRefetch();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = setInterval(silentRefetch, 10000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    };
  }, [id]);

  // Only the initial load gets the skeleton: a post-transaction refetch keeps
  // the current detail (and StreamActions' confirmation state, like the
  // explorer link for the tx just confirmed) on screen until fresh data lands.
  if (loading && !stream) {
    return <StreamDetailSkeleton />;
  }
  if (error) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          &larr; Back
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }
  if (!stream) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          &larr; Back
        </Link>
        <div className="mt-3">
          <h1 className="text-xl font-semibold">Stream not found</h1>
          <p className="mt-2 text-sm text-neutral-400">
            We couldn&rsquo;t find a stream with id &ldquo;{id}&rdquo;. Double-check the
            link, or it may no longer exist.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
          >
            Go to your streams
          </Link>
        </div>
      </main>
    );
  }

  return <StreamDetail stream={stream} onComplete={() => setReloadKey((k) => k + 1)} />;
}
