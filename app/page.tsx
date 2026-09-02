"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { BrowserSupportNote } from "@/components/browser-support-note";
import { StreamListSkeleton } from "@/components/skeleton";
import { StreamList } from "@/components/stream-list";
import { StreamStatusLegend } from "@/components/stream-status-legend";
import { TransactionNotice } from "@/components/transaction-notice";
import { useWallet } from "@/components/wallet-provider";

import { useStreamPage, type StreamPage } from "@/hooks/use-stream-page";

import { takePendingNotice, type PendingNotice } from "@/lib/pending-notice";

import type { StreamStatus } from "@/types/stream";


const FILTERS: Array<{ label: string; value: StreamStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Streaming", value: "streaming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function StreamSection({
  title,
  page,
  filter,
  emptyMessage,
  showCreateLink = false,
  className,
}: {
  title: string;
  page: StreamPage;
  filter: StreamStatus | "all";
  emptyMessage: string;
  showCreateLink?: boolean;
  className?: string;
}) {
  const visible = page.streams;
  const emptyText =
    filter === "all" || page.streams.length === 0
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
        <StreamListSkeleton count={2} />
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
export default function Home() {
  return (
    <Suspense fallback={<StreamListSkeleton count={2} />}>
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
      {notice && (
        <TransactionNotice
          message={notice.message}
          hash={notice.hash}
          onDismiss={() => setNotice(null)}
        />
      )}

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

      <div className="mb-6">
        <StreamStatusLegend />
      </div>

      <StreamSection
        title="Incoming"
        page={incoming}
        filter={filter}
        emptyMessage="No incoming streams."
        className="mb-10"
      />

      <StreamSection
        title="Outgoing"
        page={outgoing}
        filter={filter}
        emptyMessage="No outgoing streams."
        showCreateLink
      />
    </main>
  );
}
