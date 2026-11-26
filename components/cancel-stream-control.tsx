import type { JSX, KeyboardEvent } from "react";

const TRIGGER_ID = "cancel-stream-trigger";

function focusFirstButton(node: HTMLDivElement | null): void {
  node?.querySelector("button")?.focus();
}

function returnFocusToTrigger(): void {
  // the trigger button is only re-rendered after the dialog closes
  setTimeout(() => document.getElementById(TRIGGER_ID)?.focus(), 0);
}

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
  const dismiss = (): void => {
    onDismiss();
    returnFocusToTrigger();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    if (e.key !== "Tab") return;
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (buttons.length === 0) {
      e.preventDefault();
      return;
    }
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!confirming) {
    return (
      <button
        id={TRIGGER_ID}
        type="button"
        onClick={onRequestCancel}
        disabled={busy}
        className="inline-flex items-center justify-center min-h-[44px] self-start rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        Cancel stream
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="cancel-confirm-heading"
      ref={focusFirstButton}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 self-start rounded border border-red-900 bg-red-950/20 p-4"
    >
      <p id="cancel-confirm-heading" className="text-sm text-red-200">
        Cancel this stream? Streaming stops immediately. The vested balance is
        claimable by the recipient, and any unstreamed balance returns to the
        sender. This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center justify-center min-h-[44px] rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Yes, cancel stream"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="inline-flex items-center justify-center min-h-[44px] rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
        >
          Keep streaming
        </button>
      </div>
    </div>
  );
}
