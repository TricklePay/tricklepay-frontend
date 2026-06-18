"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { listStreams } from "@/lib/api";
import { StreamList } from "@/components/stream-list";
import type { StreamView } from "@/types/stream";

export default function Home() {
  const wallet = useWallet();
  const [incoming, setIncoming] = useState<StreamView[]>([]);
  const [outgoing, setOutgoing] = useState<StreamView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Incoming</h2>
        <StreamList streams={incoming} emptyMessage="No incoming streams." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Outgoing</h2>
        <StreamList streams={outgoing} emptyMessage="No outgoing streams." />
      </section>
    </main>
  );
}
