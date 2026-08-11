"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import { useStreamPage, type StreamPage } from "@/hooks/use-stream-page";
import { StreamList } from "@/components/stream-list";
import { StreamListSkeleton } from "@/components/skeleton";
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
        {page.total > 0 && (
          <p className="text-xs tabular-nums text-neutral-500">
            {page.streams.length} of {page.total}
          </p>
        )}
      </div>

      {page.error && <p className="mb-3 text-sm text-red-400">{page.error}</p>}

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
  const [filter, setFilter] = useState<StreamStatus | "all">("all");
  const incoming = useStreamPage("recipient", wallet.address);
  const outgoing = useStreamPage("sender", wallet.address);

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
      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === option.value
                ? "border-neutral-400 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {option.label}
          </button>
        ))}
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
