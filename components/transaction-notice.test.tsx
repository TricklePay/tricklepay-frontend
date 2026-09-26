import { describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";

import { TransactionNotice } from "./transaction-notice";

// The notice's `<p>` renders `{message}{" "}<a>...</a>`, i.e. three children:
// the message text, a space, then the explorer link.
function explorerLink(el: ReturnType<typeof TransactionNotice>) {
  const [paragraph] = el.props.children;
  return paragraph.props.children[2];
}

// The dismiss `<button>` is the notice's second top-level child.
function dismissButton(el: ReturnType<typeof TransactionNotice>) {
  const [, button] = el.props.children;
  return button;
}

describe("TransactionNotice", () => {
  it("announces itself politely without interrupting the user", () => {
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss: vi.fn(),
    });

    expect(el.props.role).toBe("status");
    expect(el.props["aria-live"]).toBe("polite");
  });

  it("renders the confirmation message", () => {
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss: vi.fn(),
    });

    expect(JSON.stringify(el)).toContain("Withdrawal confirmed.");
  });

  it("links to the explorer for the given hash on the configured network", () => {
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss: vi.fn(),
    });

    expect(explorerLink(el).props.href).toBe(
      txExplorerUrl("abc123", config.network),
    );
  });

  it("opens the explorer link in a new tab safely", () => {
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss: vi.fn(),
    });

    const link = explorerLink(el);

    expect(link.props.target).toBe("_blank");
    expect(link.props.rel).toBe("noopener noreferrer");
  });

  it("builds a distinct link per transaction hash", () => {
    const first = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "hash-one",
      onDismiss: vi.fn(),
    });
    const second = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "hash-two",
      onDismiss: vi.fn(),
    });

    expect(explorerLink(first).props.href).not.toBe(
      explorerLink(second).props.href,
    );
  });

  it("calls onDismiss when the dismiss control is activated", () => {
    const onDismiss = vi.fn();
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss,
    });

    dismissButton(el).props.onClick();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("labels the dismiss control for assistive technology", () => {
    const el = TransactionNotice({
      message: "Withdrawal confirmed.",
      hash: "abc123",
      onDismiss: vi.fn(),
    });

    expect(dismissButton(el).props["aria-label"]).toBe("Dismiss notice");
  });
});
