"use client";

import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";

interface Props {
  /** Confirmation message to display in the banner. */
  message: string;
  /** Transaction hash to link to the explorer. */
  hash: string;
  /** Callback invoked when the user dismisses the notice. */
  onDismiss: () => void;
}

/**
 * A dismissible banner confirming a transaction landed, with a link out to
 * the explorer. `role="status"` + `aria-live="polite"` so screen readers
 * announce it without the interruption an alert would cause.
 */
export function TransactionNotice({ message, hash, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"
    >
      <p>
        {message}{" "}
        <a
          href={txExplorerUrl(hash, config.network)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-emerald-100"
        >
          View transaction on Stellar Expert
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notice"
        className="text-emerald-300 hover:text-emerald-100"
      >
        &times;
      </button>
    </div>
  );
}
