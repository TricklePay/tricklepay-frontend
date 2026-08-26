"use client";

import type { CreateStreamParams } from "@/lib/contract";
import { formatAmount, formatTime, truncateAddress } from "@/lib/format";
import { vestingRatePerDay } from "@/lib/vesting";
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

// The confirmation step between filling the create form and signing. Renders
// the same CreateStreamParams instance the confirm handler passes to
// createStream, so what the user reviews is exactly what goes on-chain.
export function StreamReview({ params, submitting, onBack, onConfirm }: Props) {
  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 id="review-heading" className="mb-1 text-base font-semibold">
          Review stream
        </h2>
        <p className="mb-2 text-xs text-neutral-500">
          Check the details below before signing. Nothing is submitted until you confirm.
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
          <Row label="Start">{formatTime(params.startTime.toString())}</Row>
          <Row label="End">{formatTime(params.endTime.toString())}</Row>
          <Row label="Cliff">
            {params.cliffTime === params.startTime
              ? "None (streams from the start)"
              : formatTime(params.cliffTime.toString())}
          </Row>
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
