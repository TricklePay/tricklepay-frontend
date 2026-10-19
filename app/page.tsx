"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type JSX, Suspense, useCallback, useEffect, useState } from "react";

import { BrowserSupportNote } from "@/components/browser-support-note";
import { LoadingState } from "@/components/loading-state";
import { StreamList } from "@/components/stream-list";
import { StreamStatusLegend } from "@/components/stream-status-legend";
import { TransactionNotice } from "@/components/transaction-notice";
import { useWallet } from "@/components/wallet-provider";
import { useNow } from "@/hooks/use-now";
import { useStreamPage, type StreamPage } from "@/hooks/use-stream-page";
import { streamsToCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/csv-download";
import { timeAgo } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, isPageSize, PAGE_SIZE_OPTIONS, readPageSize, writePageSize, type PageSize } from "@/lib/page-size";
import { takePendingNotice } from "@/lib/pending-notice";
import { filterStreamsByAddress } from "@/lib/stream-search";
import { isStreamSortOption, sortStreams, STREAM_SORT_OPTIONS, type StreamSortOption } from "@/lib/stream-sort";
import { formatStreamsTotal } from "@/lib/stream-total";
import type { PendingNotice } from "@/types/notice";
import type { StreamStatus } from "@/types/stream";

const FILTERS: Array<{ label: string; value: StreamStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Streaming", value: "streaming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const FILTER_VALUES = FILTERS.map((f) => f.value);

function resolveFilter(rawParam: string | null): StreamStatus | "all" {
  return rawParam && (FILTER_VALUES as string[]).includes(rawParam)
    ? (rawParam as StreamStatus | "all")
    : "all";
}

function resolveSort(rawParam: string | null): StreamSortOption {
  return rawParam && isStreamSortOption(rawParam) ? rawParam : "default";
}

function StreamSection({
  title,
  page,
  filter,
  addressQuery,
  sort,
  emptyMessage,
  showCreateLink = false,
  className,
}: {
  title: string;
  page: StreamPage;
  filter: StreamStatus | "all";
  addressQuery: string;
  sort: StreamSortOption;
  emptyMessage: string;
  showCreateLink?: boolean;
  className?: string;
}) {
  // Client-side, over whatever page is already loaded — neither narrowing nor
  // reordering ever asks the backend for a different page, so both only ever
  // apply to what's already on screen.
  const visible = sortStreams(filterStreamsByAddress(page.streams, addressQuery), sort);
  // Summed over the streams currently shown, which the active status filter
  // and search have already narrowed, so the figure follows both.
  const total = formatStreamsTotal(visible);
  // Re-render on an interval so a pending stream's "starts in …" countdown
  // in the lists keeps advancing while the absolute schedule stays on the
  // detail page. Card/table rows themselves stay pure.
  useNow();
  // A second, faster tick just for the "Updated …" freshness label below —
  // the countdown tick above is intentionally coarse (30s; see useNow's own
  // comment), too slow to show a last-fetch time climbing second by second.
  const now = useNow(5_000);
  const emptyText =
    addressQuery.trim() && page.streams.length > 0
      ? `No streams match "${addressQuery.trim()}".`
      : filter === "all" || page.streams.length === 0
        ? (filter === "all" ? emptyMessage : `No ${filter} streams found.`)
        : emptyMessage;

  const showCreate = showCreateLink && page.streams.length === 0;

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          {page.total > 0 && (
            <p className="text-xs tabular-nums text-neutral-500">
              {page.streams.length} of {page.total}
            </p>
          )}
          {page.lastUpdated !== null && (
            <p role="status" aria-live="polite" className="text-xs text-neutral-500">
              Updated {timeAgo(page.lastUpdated, now)}
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
          <button
            onClick={() =>
              downloadCsv(
                `tricklepay-${title.toLowerCase()}-streams.csv`,
                streamsToCsv(page.streams),
              )
            }
            disabled={page.streams.length === 0}
            aria-label={`Export ${title.toLowerCase()} streams as CSV`}
            className="inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-0.5 text-xs text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 disabled:opacity-40"
          >
            {/* download icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className="h-3 w-3"
            >
              <path d="M8 1.75a.75.75 0 0 1 .75.75v6.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.5A.75.75 0 0 1 8 1.75Z" />
              <path d="M2.5 9.75A.75.75 0 0 1 3.25 9h.5a.75.75 0 0 1 0 1.5h-.25v2.5h9v-2.5h-.25a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-10.5a.75.75 0 0 1-.75-.75v-3.5Z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {!page.loading && (
        <p className="mb-3 text-xs text-neutral-500">
          <span className="sr-only">Total across visible streams. </span>
          Total:{" "}
          <span className="font-medium tabular-nums text-neutral-300">{total}</span>
        </p>
      )}

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
  const filter = resolveFilter(searchParams.get("filter"));
  // Read the sort the same way, so it survives a reload or a shared link the
  // same way the status filter does.
  const sort = resolveSort(searchParams.get("sort"));

  const setFilter = useCallback(
    (value: StreamStatus | "all") => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("filter");
      } else {
        params.set("filter", value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setSort = useCallback(
    (value: StreamSortOption) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "default") {
        params.delete("sort");
      } else {
        params.set("sort", value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Restored from localStorage once mounted (see the effect below) rather
  // than read eagerly, so the server-rendered markup and the first client
  // render agree before the stored choice is applied.
  const [pageSize, setPageSizeState] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  useEffect(() => {
    setPageSizeState(readPageSize());
  }, []);

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size);
    writePageSize(size);
  }, []);

  const incoming = useStreamPage("recipient", wallet.address, filter, pageSize);
  const outgoing = useStreamPage("sender", wallet.address, filter, pageSize);

  // Client-side only: narrows whichever page is already loaded, rather than
  // asking the backend for a different one. Local state, not the URL — it
  // doesn't need to survive navigation the way the status filter does.
  const [addressQuery, setAddressQuery] = useState("");

  // Picked up once per mount, e.g. after a redirect from a successful create.
  // takePendingNotice clears it from storage immediately, so a refresh never
  // repeats it. The functional update keeps the first read: StrictMode (dev)
  // runs this effect twice, and a plain re-read would overwrite the notice
  // with null once the storage entry is gone.
  const [notice, setNotice] = useState<PendingNotice | null>(null);
  useEffect(() => {
    setNotice((previous) => previous ?? takePendingNotice());
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
      {notice && (
        <TransactionNotice
          message={notice.message}
          hash={notice.hash}
          onDismiss={() => setNotice(null)}
        />
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Search by sender or recipient address</span>
          <input
            type="search"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Search by sender or recipient address…"
            className="w-full max-w-sm rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus-visible:outline-none"
          />
        </label>
        {addressQuery && (
          <button
            onClick={() => setAddressQuery("")}
            aria-label="Clear address search"
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter streams by status"
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
        {filter !== "all" && (
          <button
            onClick={() => setFilter("all")}
            aria-label="Clear filter"
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

      <div className="mb-8 flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              const value = e.target.value;
              if (isStreamSortOption(value)) setSort(value);
            }}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-neutral-500 focus-visible:outline-none"
          >
            {STREAM_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-neutral-500">(sorts only the streams currently loaded on the page)</span>
      </div>

      <div className="mb-8 flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Streams per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (isPageSize(value)) setPageSize(value);
            }}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-neutral-500 focus-visible:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6">
        <StreamStatusLegend />
      </div>

      <StreamSection
        title="Incoming"
        page={incoming}
        filter={filter}
        addressQuery={addressQuery}
        sort={sort}
        emptyMessage="No incoming streams."
        className="mb-10"
      />

      <StreamSection
        title="Outgoing"
        page={outgoing}
        addressQuery={addressQuery}
        filter={filter}
        sort={sort}
        emptyMessage="No outgoing streams."
        showCreateLink
      />
    </main>
  );
}
