"use client";

import { useRouter } from "next/navigation";
import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";

import { CopyButton, ShareLinkButton } from "@/components/copy-button";
import { ProgressBar } from "@/components/progress-bar";
import { StreamActions } from "@/components/stream-actions";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { TokenDisplay } from "@/components/token-display";
import { useWallet } from "@/components/wallet-provider";
import { useAccrual } from "@/hooks/use-accrual";
import { useNow } from "@/hooks/use-now";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { formatSchedule, NO_CLIFF_LABEL } from "@/lib/schedule";
import { resolvedTimeZoneLabel } from "@/lib/timezone";
import type { StreamView } from "@/types/stream";

// Announce balance to assistive technology at most once per this interval.
// Frequent ticks would flood screen reader queues; 10 s is responsive enough.
const BALANCE_ANNOUNCE_MS = 10_000;

function Field({
  label,
  value,
  mono,
  copyValue,
  countdown,
  utc,
}: {
  label: string;
  value: ReactNode;
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

export function StreamDetail({ stream, onComplete }: { stream: StreamView; onComplete: () => void }): JSX.Element {
  const router = useRouter();
  const accrual = useAccrual(stream);
  const wallet = useWallet();
  // Forces a re-render on an interval so the Start/End/Cliff countdowns below
  // keep advancing even for statuses (pending, completed, cancelled) where
  // useAccrual never ticks.
  useNow();
  const schedule = formatSchedule(stream);

  // Keep a ref to the latest accrual so the announcement interval can read it
  // without being listed as a dependency (which would restart the timer every second).
  const accrualRef = useRef(accrual);
  useEffect(() => { accrualRef.current = accrual; }, [accrual]);

  const [announcedBalance, setAnnouncedBalance] = useState("");
  useEffect(() => {
    if (stream.status !== "streaming") return;
    const id = setInterval(() => {
      setAnnouncedBalance(
        `Withdrawable balance: ${formatTokenAmount(accrualRef.current.withdrawable.toString(), stream.token)}`,
      );
    }, BALANCE_ANNOUNCE_MS);
    return () => clearInterval(id);
  }, [stream.status, stream.token]);

  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          &larr; Back
        </button>
        <ShareLinkButton
          url={typeof window !== "undefined" ? window.location.href : ""}
          label={`stream #${stream.id}`}
        />
      </div>

      <div className="mb-6 mt-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-mono text-xl">
          <span>Stream #{stream.id}</span>
          <CopyButton value={stream.id} label="stream id" />
        </h1>
        <StreamStatusBadge status={stream.status} variant="plain" />
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
            <span className="tabular-nums text-neutral-200">{formatTokenAmount(stream.vested, stream.token)}</span>)
            is split between what was already withdrawn and what the recipient can still claim.
            {BigInt(stream.locked) > 0n && (
              <>
                {" "}The unvested balance (
                <span className="tabular-nums text-neutral-200">{formatTokenAmount(stream.locked, stream.token)}</span>)
                has been returned to the sender.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mb-8 rounded-lg border border-neutral-800 p-6">
        {/* Polite live region: announces the balance to AT on a throttled interval
            so screen reader users hear updates without being flooded every second. */}
        <span role="status" aria-live="polite" className="sr-only">
          {announcedBalance}
        </span>
        <p className="text-sm text-neutral-500">
          {stream.status === "cancelled" ? "Remaining withdrawable" : "Withdrawable now"}
        </p>
        <p className="mt-1 font-mono text-4xl tabular-nums text-neutral-100">
          {formatTokenAmount(accrual.withdrawable.toString(), stream.token)}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatTokenAmount(accrual.vested.toString(), stream.token)} vested of {formatTokenAmount(stream.totalAmount, stream.token)} total
        </p>
        {/* Locked amount — for active streams: not yet vested; for cancelled: returned to sender */}
        {BigInt(stream.locked) > 0n && stream.status !== "cancelled" && (
          <p className="mt-1 text-xs text-neutral-500">
            <span className="text-amber-400/80">{formatTokenAmount(stream.locked, stream.token)}</span>
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
        <Field label="Token" value={<TokenDisplay token={stream.token} />} mono copyValue={stream.token} />
        <Field label="Withdrawn" value={formatTokenAmount(stream.withdrawn, stream.token)} />
        <Field
          label={stream.status === "cancelled" ? "Returned to sender" : "Locked"}
          value={formatTokenAmount(stream.locked, stream.token)}
        />
        <Field
          label="Start"
          value={schedule.start.local}
          countdown={schedule.start.countdown}
          utc={schedule.start.utc}
        />
        <Field
          label="End"
          value={schedule.end.local}
          countdown={schedule.end.countdown}
          utc={schedule.end.utc}
        />
        <Field
          label="Cliff"
          value={schedule.cliff?.local ?? NO_CLIFF_LABEL}
          countdown={schedule.cliff?.countdown}
          utc={schedule.cliff?.utc}
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
