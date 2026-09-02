"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CopyButton, ShareLinkButton } from "@/components/copy-button";
import { ProgressBar } from "@/components/progress-bar";
import { StreamDetailSkeleton } from "@/components/skeleton";
import { StreamActions } from "@/components/stream-actions";
import { useWallet } from "@/components/wallet-provider";

import { useAccrual } from "@/hooks/use-accrual";

import { getStream, isAbortError } from "@/lib/api";
import { formatAmount, formatTime, formatTokenDisplay, relativeTime, truncateAddress } from "@/lib/format";
import { formatUtcFromUnixSeconds, resolvedTimeZoneLabel } from "@/lib/timezone";

import type { StreamView } from "@/types/stream";


function Field({
  label,
  value,
  mono,
  copyValue,
  countdown,
  utc,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
  countdown?: string;
  /** UTC equivalent, shown on its own line — for Start/End/Cliff only. */
  utc?: string;
}) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`text-neutral-200 ${mono ? "font-mono" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span>{value}</span>
          {copyValue && <CopyButton value={copyValue} label={label} />}
          {countdown && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] leading-none text-neutral-400">
              {countdown}
            </span>
          )}
        </div>
        {utc && <span className="mt-0.5 block text-xs text-neutral-500">{utc}</span>}
      </dd>
    </div>
  );
}

export function StreamDetail({ stream, onComplete }: { stream: StreamView; onComplete: () => void }) {
  const accrual = useAccrual(stream);
  const wallet = useWallet();
  const cliffDisplay =
    stream.cliffTime === stream.startTime ? "none" : formatTime(stream.cliffTime);

  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          &larr; Back
        </Link>
        <ShareLinkButton
          url={typeof window !== "undefined" ? window.location.href : ""}
          label={`stream #${stream.id}`}
        />
      </div>

      <div className="mb-6 mt-3 flex items-center justify-between">
        <h1 className="font-mono text-xl">Stream #{stream.id}</h1>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs capitalize text-neutral-300">
          {stream.status}
        </span>
      </div>

      {/* Cancelled-stream balance explanation banner */}
      {stream.status === "cancelled" && (
        <div
          role="note"
          className="mb-6 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-200"
        >
          <p className="font-semibold text-red-300">Stream cancelled</p>
          <p className="mt-1 text-neutral-400">
            Streaming stopped early. The vested portion (
            <span className="tabular-nums text-neutral-200">{formatAmount(stream.vested)}</span>)
            is split between what was already withdrawn and what the recipient can still claim.
            {BigInt(stream.locked) > 0n && (
              <>
                {" "}The unvested balance (
                <span className="tabular-nums text-neutral-200">{formatAmount(stream.locked)}</span>)
                has been returned to the sender.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mb-8 rounded-lg border border-neutral-800 p-6">
        <p className="text-sm text-neutral-500">
          {stream.status === "cancelled" ? "Remaining withdrawable" : "Withdrawable now"}
        </p>
        <p className="mt-1 font-mono text-4xl tabular-nums text-neutral-100">
          {formatAmount(accrual.withdrawable.toString())}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatAmount(accrual.vested.toString())} vested of {formatAmount(stream.totalAmount)} total
        </p>
        {/* Locked amount — for active streams: not yet vested; for cancelled: returned to sender */}
        {BigInt(stream.locked) > 0n && stream.status !== "cancelled" && (
          <p className="mt-1 text-xs text-neutral-500">
            <span className="text-amber-400/80">{formatAmount(stream.locked)}</span>
            {" locked (not yet vested)"}
          </p>
        )}
        <div className="mt-4">
          <ProgressBar value={stream.progress} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="From" value={truncateAddress(stream.sender)} mono copyValue={stream.sender} />
        <Field label="To" value={truncateAddress(stream.recipient)} mono copyValue={stream.recipient} />
        <Field label="Token" value={formatTokenDisplay(stream.token)} mono copyValue={stream.token} />
        <Field label="Withdrawn" value={formatAmount(stream.withdrawn)} />
        <Field
          label={stream.status === "cancelled" ? "Returned to sender" : "Locked"}
          value={formatAmount(stream.locked)}
        />
        <Field
          label="Start"
          value={formatTime(stream.startTime)}
          countdown={relativeTime(stream.startTime, "starts")}
          utc={formatUtcFromUnixSeconds(stream.startTime)}
        />
        <Field
          label="End"
          value={formatTime(stream.endTime)}
          countdown={relativeTime(stream.endTime, "ends")}
          utc={formatUtcFromUnixSeconds(stream.endTime)}
        />
        <Field
          label="Cliff"
          value={cliffDisplay}
          countdown={
            stream.cliffTime !== stream.startTime
              ? relativeTime(stream.cliffTime, "cliff")
              : undefined
          }
          utc={
            stream.cliffTime !== stream.startTime
              ? formatUtcFromUnixSeconds(stream.cliffTime)
              : undefined
          }
        />
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        Times above are shown in your local timezone —{" "}
        <span className="text-neutral-400">{resolvedTimeZoneLabel()}</span>.
      </p>

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
