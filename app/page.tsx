"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { listStreams } from "@/lib/api";
import { StreamList } from "@/components/stream-list";
import type { StreamStatus, StreamView } from "@/types/stream";

const FILTERS: Array<{ label: string; value: StreamStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Streaming", value: "streaming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function Home() {
  const wallet = useWallet();
  const [incoming, setIncoming] = useState<StreamView[]>([]);
  const [outgoing, setOutgoing] = useState<StreamView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StreamStatus | "all">("all");

  const applyFilter = (streams: StreamView[]) =>
    filter === "all" ? streams : streams.filter((s) => s.status === filter);

  useEffect(() => {
    const address = wallet.address;
    if (!address) {
      setIncoming([]);
      setOutgoing([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([listStreams({ recipient: address }), listStreams({ sender: address })])
      .then(([incomingStreams, outgoingStreams]) => {
        if (cancelled) return;
        setIncoming(incomingStreams);
        setOutgoing(outgoingStreams);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load streams");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wallet.address]);

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
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mb-4 text-sm text-neutral-500">Loading...</p>}

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

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Incoming</h2>
        <StreamList streams={applyFilter(incoming)} emptyMessage="No incoming streams." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Outgoing</h2>
        <StreamList streams={applyFilter(outgoing)} emptyMessage="No outgoing streams." />
      </section>
    </main>
  );
}
