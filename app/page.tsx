"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type JSX, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { BrowserSupportNote } from "@/components/browser-support-note";
import { LoadingState } from "@/components/loading-state";
import { StreamList } from "@/components/stream-list";
import { StreamStatusLegend } from "@/components/stream-status-legend";
import { TransactionNotice } from "@/components/transaction-notice";
import { useWallet } from "@/components/wallet-provider";
import { useNow } from "@/hooks/use-now";
import { useStreamPage, type StreamPage } from "@/hooks/use-stream-page";
import { takePendingNotice } from "@/lib/pending-notice";
import {
  clearReturningFromStream,
  getSavedDashboardScroll,
  isReturningFromStream,
  markNavigatingToStream,
  saveDashboardScroll,
} from "@/lib/scroll";
import { formatStreamsTotal } from "@/lib/stream-total";
import type { PendingNotice } from "@/types/notice";
import type { StreamStatus, StreamView } from "@/types/stream";

const FILTERS: Array<{ label: string; value: StreamStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Streaming", value: "streaming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function hasWithdrawableBalance(stream: StreamView): boolean {
  try {
    return Boolean(stream.withdrawable && BigInt(stream.withdrawable) > 0n);
  } catch {
    return false;
  }
}

function StreamSection({
  title,
  page,
  filter,
  withdrawableOnly = false,
  emptyMessage,
  showCreateLink = false,
  className,
}: {
  title: string;
  page: StreamPage;
  filter: StreamStatus | "all";
  withdrawableOnly?: boolean;
  emptyMessage: string;
  showCreateLink?: boolean;
  className?: string;
}) {
  const visible = withdrawableOnly
    ? page.streams.filter(hasWithdrawableBalance)
    : page.streams;

  // Re-render on an interval so a pending stream's "starts in …" countdown
  // in the lists keeps advancing while the absolute schedule stays on the
  // detail page. Card/table rows themselves stay pure.
  useNow();

  const emptyText = (() => {
    if (visible.length > 0) return emptyMessage;
    if (withdrawableOnly) {
      return filter === "all"
        ? "No streams ready to withdraw."
        : `No ${filter} streams ready to withdraw.`;
    }
    return filter === "all" ? emptyMessage : `No ${filter} streams found.`;
  })();

  const showCreate = showCreateLink && page.streams.length === 0;

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {visible.length > 0 && (
            <p className="text-xs text-neutral-400">
              Total:{" "}
              <span className="tabular-nums font-medium text-neutral-200">
                {formatStreamsTotal(visible)}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {page.total > 0 && (
            <p className="text-xs tabular-nums text-neutral-500">
              {visible.length} of {page.total}
            </p>
          )}
          <button
            onClick={page.refresh}
            disabled={page.loading || page.loadingMore}
            aria-label={`Refresh ${title.toLowerCase()} streams`}
            className="inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-0.5 text-xs text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 disabled:opacity-40"
          >
            {/* refresh / rotate icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className={`h-3 w-3 ${page.loading ? "animate-spin" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.01.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.348l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.348l-.842-.841v1.564a.75.75 0 0 1-1.5 0V9.89a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.84.841a4.5 4.5 0 0 0 7.08-1.01.75.75 0 0 1 1.025-.274Z"
                clipRule="evenodd"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {page.error && (
        <div className="mb-3 flex items-center gap-3">
          <p className="text-sm text-red-400">{page.error}</p>
          <button
            onClick={page.refresh}
            disabled={page.loading}
            className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 disabled:opacity-40"
          >
            Retry
          </button>
        </div>
      )}

      {page.loading ? (
        <LoadingState variant="stream-list" label={`Loading ${title.toLowerCase()} streams`} />
      ) : (
        <StreamList streams={visible} emptyMessage={emptyText} showCreateLink={showCreate} />
      )}

      {page.hasMore && (
        <button
          onClick={page.loadMore}
          disabled={page.loadingMore}
          className="mt-4 rounded-full border border-neutral-800 px-4 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {page.loadingMore
            ? "Loading more…"
            : `Load more (${page.total - page.streams.length} remaining)`}
        </button>
      )}
    </section>
  );
}

// useSearchParams needs a Suspense boundary so the dashboard can prerender;
// without one the static export bails and the build fails.
export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
          <LoadingState variant="stream-list" />
        </main>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const wallet = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read the filter from the URL; fall back to "all" if absent or unrecognised.
  const rawParam = searchParams.get("filter");
  const validValues = FILTERS.map((f) => f.value);
  const filter: StreamStatus | "all" =
    rawParam && (validValues as string[]).includes(rawParam)
      ? (rawParam as StreamStatus | "all")
      : "all";

  const rawWithdrawable = searchParams.get("withdrawable");
  const withdrawableOnly = rawWithdrawable === "true" || rawWithdrawable === "1";

  const setFilter = useCallback(
    (value: StreamStatus | "all") => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("filter");
      } else {
        params.set("filter", value);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  const toggleWithdrawable = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (withdrawableOnly) {
      params.delete("withdrawable");
    } else {
      params.set("withdrawable", "true");
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [router, searchParams, withdrawableOnly]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("filter");
    params.delete("withdrawable");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [router, searchParams]);

  const incoming = useStreamPage("recipient", wallet.address, filter);
  const outgoing = useStreamPage("sender", wallet.address, filter);

  // Picked up once per mount, e.g. after a redirect from a successful create.
  // takePendingNotice clears it from storage immediately, so a refresh never
  // repeats it. The functional update keeps the first read: StrictMode (dev)
  // runs this effect twice, and a plain re-read would overwrite the notice
  // with null once the storage entry is gone.
  const [notice, setNotice] = useState<PendingNotice | null>(null);
  useEffect(() => {
    setNotice((previous) => previous ?? takePendingNotice());
  }, []);

  const [announcement, setAnnouncement] = useState("");
  const prevFilterState = useRef({ filter, withdrawableOnly });


  // Track whether we arrived back from a stream detail page
  const wasFromStreamRef = useRef(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const fromStream = isReturningFromStream();
    wasFromStreamRef.current = fromStream;
    clearReturningFromStream();

    if (!fromStream) {
      // Fresh visit starts at the top
      window.scrollTo(0, 0);
      restoredRef.current = true;
    }
  }, []);

  const isInitialLoading = !wallet.address ? false : (incoming.loading || outgoing.loading);

  useEffect(() => {
    if (typeof window === "undefined" || restoredRef.current) return;

    if (!isInitialLoading && wasFromStreamRef.current) {
      const saved = getSavedDashboardScroll(window.location.search);
      if (saved !== null && saved > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: saved, behavior: "instant" });
          });
        });
      }
      restoredRef.current = true;
    }
  }, [isInitialLoading]);

  useEffect(() => {
    if (!wallet.address || isInitialLoading) return;

    if (
      prevFilterState.current.filter !== filter ||
      prevFilterState.current.withdrawableOnly !== withdrawableOnly
    ) {
      prevFilterState.current = { filter, withdrawableOnly };

      const visibleIncoming = withdrawableOnly
        ? incoming.streams.filter(hasWithdrawableBalance)
        : incoming.streams;
      const visibleOutgoing = withdrawableOnly
        ? outgoing.streams.filter(hasWithdrawableBalance)
        : outgoing.streams;

      const totalResults = withdrawableOnly
        ? visibleIncoming.length + visibleOutgoing.length
        : incoming.total + outgoing.total;

      const filterNames = [];
      if (filter !== "all") {
        const option = FILTERS.find((f) => f.value === filter);
        if (option) filterNames.push(option.label);
      }
      if (withdrawableOnly) {
        filterNames.push("Ready to withdraw");
      }
      const filterStr = filterNames.length > 0 ? filterNames.join(" and ") : "All streams";

      setAnnouncement(`${filterStr} filter applied. ${totalResults} results found.`);
    }
  }, [
    filter,
    withdrawableOnly,
    isInitialLoading,
    wallet.address,
    incoming.streams,
    outgoing.streams,
    incoming.total,
    outgoing.total,
  ]);

  // Continuously record scroll position on the dashboard so navigations keep latest position
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          saveDashboardScroll(window.location.search);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      saveDashboardScroll(window.location.search);
    };
  }, [searchParams]);

  // Save scroll position when any link to a stream is clicked
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && href.startsWith("/streams/")) {
          markNavigatingToStream(window.location.search);
        }
      }
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!wallet.address) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Your streams</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Connect your wallet to view incoming and outgoing streams.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Once connected you can also{" "}
          <a
            href="/create"
            className="text-neutral-300 underline underline-offset-2 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
          >
            create a new stream
          </a>
          .
        </p>
        <BrowserSupportNote className="mt-8" />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="sr-only">Your streams</h1>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {notice && (
        <TransactionNotice
          message={notice.message}
          hash={notice.hash}
          onDismiss={() => setNotice(null)}
        />
      )}

      <div
        role="group"
        aria-label="Filter streams"
        className="mb-8 flex flex-wrap items-center gap-2"
      >
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${
              filter === option.value
                ? "border-neutral-400 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {option.label}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-neutral-800" aria-hidden="true" />

        <button
          onClick={toggleWithdrawable}
          aria-pressed={withdrawableOnly}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${
            withdrawableOnly
              ? "border-neutral-400 bg-neutral-800 text-neutral-100"
              : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
          }`}
        >
          {withdrawableOnly && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className="h-3 w-3 text-emerald-400"
            >
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          Ready to withdraw
        </button>

        {(filter !== "all" || withdrawableOnly) && (
          <button
            onClick={clearAllFilters}
            aria-label="Clear filters"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
          >
            {/* × icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className="h-3 w-3"
            >
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
            Clear
          </button>
        )}
      </div>

      <div className="mb-6">
        <StreamStatusLegend />
      </div>

      <div
        aria-label="Streams total summary"
        className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Total across visible streams
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-100">
              {formatStreamsTotal([...incoming.streams, ...outgoing.streams])}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-neutral-400">
            <div>
              <span className="text-neutral-500">Incoming total: </span>
              <span className="tabular-nums font-medium text-neutral-200">
                {formatStreamsTotal(incoming.streams)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Outgoing total: </span>
              <span className="tabular-nums font-medium text-neutral-200">
                {formatStreamsTotal(outgoing.streams)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <StreamSection
        title="Incoming"
        page={incoming}
        filter={filter}
        withdrawableOnly={withdrawableOnly}
        emptyMessage="No incoming streams."
        className="mb-10"
      />

      <StreamSection
        title="Outgoing"
        page={outgoing}
        filter={filter}
        withdrawableOnly={withdrawableOnly}
        emptyMessage="No outgoing streams."
        showCreateLink
      />
    </main>
  );
}
