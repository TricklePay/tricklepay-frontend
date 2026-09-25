import type { JSX } from "react";

/**
 * The sender's two-step cancel: a "Cancel stream" button that opens an inline
 * confirmation, since cancelling is irreversible. Purely presentational; the
 * confirmation state and transaction come from useStreamActions.
 */
export function CancelStreamControl({
  confirming,
  busy,
  cancelling,
  onRequestCancel,
  onConfirm,
  onDismiss,
}: {
  confirming: boolean;
  busy: boolean;
  cancelling: boolean;
  onRequestCancel: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}): JSX.Element {
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={onRequestCancel}
        disabled={busy}
        className="self-start rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        Cancel stream
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="cancel-confirm-heading"
      className="flex flex-col gap-3 self-start rounded border border-red-900 bg-red-950/20 p-4"
    >
      <p id="cancel-confirm-heading" className="text-sm text-red-200">
        Cancel this stream? Streaming stops immediately and any unstreamed
        balance returns to the sender. This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Yes, cancel stream"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
        >
          Keep streaming
        </button>
      </div>
    </div>
  );
}
