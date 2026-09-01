"use client";

import type { CreateStreamParams } from "@/lib/contract";
import { formatAmount, formatDuration, formatTime, truncateAddress } from "@/lib/format";
import { vestingRatePerDay } from "@/lib/vesting";
import { formatUtcFromUnixSeconds, resolvedTimeZoneLabel } from "@/lib/timezone";
import { CopyButton } from "@/components/copy-button";

interface Props {
  /** The exact parameters that will be submitted on confirm. */
  params: CreateStreamParams;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

// A row of the review summary. Addresses render truncated with a copy
// affordance so the full value stays one click away without dominating the
// layout on small screens.
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-neutral-400">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-all text-neutral-100">{children}</dd>
    </div>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <Row label={label}>
      <span className="inline-flex items-baseline gap-2">
        <span title={address}>{truncateAddress(address)}</span>
        <CopyButton value={address} label={label.toLowerCase()} />
      </span>
    </Row>
  );
}

// A Start/End/Cliff row, with the UTC equivalent echoed underneath in muted
// text — this is the last screen before signing, so it's the most
// consequential place to remove any doubt about which instant a local time
// actually resolves to.
function TimeRow({ label, unixSeconds }: { label: string; unixSeconds: bigint }) {
  return (
    <Row label={label}>
      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <span>{formatTime(unixSeconds.toString())}</span>
        <span className="text-xs font-normal text-neutral-500">
          {formatUtcFromUnixSeconds(unixSeconds.toString())}
        </span>
      </div>
    </Row>
  );
}

// The confirmation step between filling the create form and signing. Renders
// the same CreateStreamParams instance the confirm handler passes to
// createStream, so what the user reviews is exactly what goes on-chain.
export function StreamReview({ params, submitting, onBack, onConfirm }: Props): React.JSX.Element {
  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 id="review-heading" className="mb-1 text-base font-semibold">
          Review stream
        </h2>
        <p className="mb-1 text-xs text-neutral-500">
          Check the details below before signing. Nothing is submitted until you confirm.
        </p>
        <p className="mb-2 text-xs text-neutral-500">
          Start, end, and cliff are in your local timezone —{" "}
          <span className="text-neutral-400">{resolvedTimeZoneLabel()}</span>; the UTC equivalent
          is shown underneath each.
        </p>
        <dl className="divide-y divide-neutral-800">
          <AddressRow label="Sender" address={params.sender} />
          <AddressRow label="Recipient" address={params.recipient} />
          <AddressRow label="Token contract" address={params.token} />
          <Row label="Amount">
            {formatAmount(params.totalAmount.toString())}
          </Row>
          <Row label="Vesting rate">
            {`${formatAmount(vestingRatePerDay(params.totalAmount, params.startTime, params.endTime)?.toString() ?? "0")} tokens/day`}
          </Row>
          <Row label="Duration">
            {formatDuration(params.endTime - params.startTime) ?? "—"}
          </Row>
          <TimeRow label="Start" unixSeconds={params.startTime} />
          <TimeRow label="End" unixSeconds={params.endTime} />
          {params.cliffTime === params.startTime ? (
            <Row label="Cliff">None (streams from the start)</Row>
          ) : (
            <TimeRow label="Cliff" unixSeconds={params.cliffTime} />
          )}
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
        >
          Back to edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-50"
        >
          Confirm &amp; create
        </button>
      </div>
    </section>
  );
}
