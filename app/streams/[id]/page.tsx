"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getStream } from "@/lib/api";
import { useAccrual } from "@/hooks/use-accrual";
import { useWallet } from "@/components/wallet-provider";
import { StreamActions } from "@/components/stream-actions";
import { CopyButton } from "@/components/copy-button";
import { ProgressBar } from "@/components/progress-bar";
import { StreamDetailSkeleton } from "@/components/skeleton";
import { formatAmount, formatTime, truncateAddress } from "@/lib/format";
import type { StreamView } from "@/types/stream";

function Field({
  label,
  value,
  mono,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
}) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`flex items-center gap-2 text-neutral-200 ${mono ? "font-mono" : ""}`}>
        <span>{value}</span>
        {copyValue && <CopyButton value={copyValue} label={label} />}
      </dd>
    </div>
  );
}

function StreamDetail({ stream, onComplete }: { stream: StreamView; onComplete: () => void }) {
  const accrual = useAccrual(stream);
  const wallet = useWallet();
  const cliffDisplay =
    stream.cliffTime === stream.startTime ? "none" : formatTime(stream.cliffTime);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
        &larr; Back
      </Link>

      <div className="mb-6 mt-3 flex items-center justify-between">
        <h1 className="font-mono text-xl">Stream #{stream.id}</h1>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs capitalize text-neutral-300">
          {stream.status}
        </span>
      </div>

      <div className="mb-8 rounded-lg border border-neutral-800 p-6">
        <p className="text-sm text-neutral-500">Withdrawable now</p>
        <p className="mt-1 font-mono text-4xl tabular-nums text-neutral-100">
          {formatAmount(accrual.withdrawable.toString())}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatAmount(accrual.vested.toString())} vested of {formatAmount(stream.totalAmount)} total
        </p>
        <div className="mt-4">
          <ProgressBar value={stream.progress} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="From" value={truncateAddress(stream.sender)} mono copyValue={stream.sender} />
        <Field label="To" value={truncateAddress(stream.recipient)} mono copyValue={stream.recipient} />
        <Field label="Token" value={truncateAddress(stream.token)} mono copyValue={stream.token} />
        <Field label="Withdrawn" value={formatAmount(stream.withdrawn)} />
        <Field label="Start" value={formatTime(stream.startTime)} />
        <Field label="End" value={formatTime(stream.endTime)} />
        <Field label="Cliff" value={cliffDisplay} />
      </dl>

      <StreamActions stream={stream} walletAddress={wallet.address} onComplete={onComplete} />
    </main>
  );
}

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [stream, setStream] = useState<StreamView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getStream(id)
      .then((s) => {
        if (!cancelled) setStream(s);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stream");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Only the initial load gets the skeleton: a post-transaction refetch keeps
  // the current detail (and StreamActions' confirmation state, like the
  // explorer link for the tx just confirmed) on screen until fresh data lands.
  if (loading && !stream) {
    return <StreamDetailSkeleton />;
  }
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
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
      <main className="mx-auto max-w-2xl px-6 py-10">
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
