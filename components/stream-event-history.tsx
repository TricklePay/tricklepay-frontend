import type { JSX } from "react";

import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { formatTime, formatTokenAmount, truncateAddress } from "@/lib/format";
import type { StreamEvent, StreamEventKind } from "@/types/stream";

const EVENT_LABELS: Record<StreamEventKind, string> = {
  created: "Created",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

function formatEventAmounts(event: StreamEvent, streamToken: string): string | null {
  const token = event.token ?? streamToken;

  if (event.kind === "created") {
    if (event.totalAmount != null) {
      return formatTokenAmount(event.totalAmount, token);
    }
    return null;
  }

  if (event.kind === "withdrawn") {
    if (event.amount != null) {
      return formatTokenAmount(event.amount, token);
    }
    return null;
  }

  const parts: string[] = [];
  if (event.recipientAmount != null) {
    parts.push(
      `${formatTokenAmount(event.recipientAmount, token)} claimable by recipient`,
    );
  }
  if (event.senderRefund != null) {
    parts.push(`${formatTokenAmount(event.senderRefund, token)} refunded to sender`);
  }
  if (parts.length === 0 && event.amount != null) {
    parts.push(formatTokenAmount(event.amount, token));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface StreamEventHistoryProps {
  events: StreamEvent[];
  token: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Renders the chronological event history of a stream (created, withdrawn,
 * cancelled) with formatted amounts, timestamp/ledger, and an explorer link
 * to each transaction.
 */
export function StreamEventHistory({
  events,
  token,
  loading = false,
  error = null,
  onRetry,
}: StreamEventHistoryProps): JSX.Element {
  return (
    <section
      aria-labelledby="event-history-heading"
      className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-4"
    >
      <h2 id="event-history-heading" className="mb-3 text-sm font-semibold text-neutral-200">
        Event history
      </h2>

      {loading && (
        <p role="status" aria-live="polite" className="text-xs text-neutral-500">
          Loading event history…
        </p>
      )}

      {!loading && error && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-neutral-500">No events recorded for this stream yet.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <ol className="divide-y divide-neutral-800/80 text-sm">
          {events.map((event) => {
            const amountSummary = formatEventAmounts(event, token);
            const timeLabel = event.closedAt != null ? formatTime(event.closedAt) : null;

            return (
              <li
                key={event.eventId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-neutral-200">{EVENT_LABELS[event.kind]}</span>
                  {amountSummary && (
                    <span className="font-mono tabular-nums text-neutral-300">{amountSummary}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-3 text-xs text-neutral-500">
                  {timeLabel && <span>{timeLabel}</span>}
                  <span className="font-mono">Ledger #{event.ledger}</span>
                  <a
                    href={txExplorerUrl(event.txHash, config.network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-neutral-400 underline hover:text-neutral-200"
                  >
                    {truncateAddress(event.txHash)}
                    <span className="sr-only">
                      {" "}
                      (view transaction on Stellar Expert, opens in a new tab)
                    </span>
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
