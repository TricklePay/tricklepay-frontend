"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useWallet } from "@/components/wallet-provider";
import { useStreamPage, type StreamPage } from "@/hooks/use-stream-page";
import { StreamList } from "@/components/stream-list";
import { StreamListSkeleton } from "@/components/skeleton";
import { TransactionNotice } from "@/components/transaction-notice";
import { takePendingNotice, type PendingNotice } from "@/lib/pending-notice";
import type { StreamStatus } from "@/types/stream";

const FILTERS: Array<{ label: string; value: StreamStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Streaming", value: "streaming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

// Returns per-status counts aggregated across two pages (incoming + outgoing).
// "all" is the total number of loaded streams across both pages.
function useStatusCounts(
  incoming: StreamPage,
  outgoing: StreamPage,
): Record<StreamStatus | "all", number> {
  const all = [...incoming.streams, ...outgoing.streams];
  return {
    all: all.length,
    streaming: all.filter((s) => s.status === "streaming").length,
    pending: all.filter((s) => s.status === "pending").length,
    completed: all.filter((s) => s.status === "completed").length,
    cancelled: all.filter((s) => s.status === "cancelled").length,
  };
}

function StreamSection({
  title,
  page,
  filter,
  emptyMessage,
  className,
}: {
  title: string;
  page: StreamPage;
  filter: StreamStatus | "all";
  emptyMessage: string;
  className?: string;
}) {
  // The status filter runs over the rows fetched so far, so say so rather than
  // implying the account has no streams of that status at all.
  const visible = filter === "all" ? page.streams : page.streams.filter((s) => s.status === filter);
  const emptyText =
    filter === "all" || page.streams.length === 0
      ? emptyMessage
      : `No ${filter} streams among the ${page.streams.length} loaded.`;

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
            className="inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-0.5 text-xs text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 disabled:opacity-40"
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
            className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
          >
            Retry
          </button>
        </div>
      )}

      {page.loading ? (
        <StreamListSkeleton count={2} />
      ) : (
        <StreamList streams={visible} emptyMessage={emptyText} />
      )}

      {page.hasMore && (
        <button
          onClick={page.loadMore}
          disabled={page.loadingMore}
          className="mt-4 rounded-full border border-neutral-800 px-4 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
        >
          {page.loadingMore
            ? "Loading more…"
            : `Load more (${page.total - page.streams.length} remaining)`}
        </button>
      )}
    </section>
  );
}

export default function Home() {
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

  const incoming = useStreamPage("recipient", wallet.address);
  const outgoing = useStreamPage("sender", wallet.address);
  const counts = useStatusCounts(incoming, outgoing);

  // Picked up once per mount, e.g. after a redirect from a successful create.
  // takePendingNotice clears it from storage immediately, so a refresh never
  // repeats it.
  useEffect(() => {
    setNotice(takePendingNotice());
  }, []);

  if (!wallet.address) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Your streams</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Connect your wallet to view incoming and outgoing streams.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              filter === option.value
                ? "border-neutral-400 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {option.label}
            {counts[option.value] > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 tabular-nums text-[10px] leading-none ${
                  filter === option.value
                    ? "bg-neutral-700 text-neutral-200"
                    : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {counts[option.value]}
              </span>
            )}
          </button>
        ))}
        {filter !== "all" && (
          <button
            onClick={() => setFilter("all")}
            aria-label="Clear filter"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-300"
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
      />
    </main>
  );
}
