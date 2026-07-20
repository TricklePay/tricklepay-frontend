"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getStream } from "@/lib/api";
import { useAccrual } from "@/hooks/use-accrual";
import { useWallet } from "@/hooks/use-wallet";
import { StreamActions } from "@/components/stream-actions";
import { CopyButton } from "@/components/copy-button";
import { ProgressBar } from "@/components/progress-bar";
import { formatAmount, truncateAddress } from "@/lib/format";
import type { StreamView } from "@/types/stream";

function formatTime(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

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

  const total = BigInt(stream.totalAmount);
  const progress = total === 0n ? 10000 : Number((accrual.vested * 10000n) / total);

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
          <ProgressBar value={progress} />
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

  if (loading) {
    return <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-neutral-500">Loading...</main>;
  }
  if (error) {
    return <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-red-400">{error}</main>;
  }
  if (!stream) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-neutral-500">Stream not found.</main>
    );
  }

  return <StreamDetail stream={stream} onComplete={() => setReloadKey((k) => k + 1)} />;
}
