/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamEventHistory } from "@/components/stream-event-history";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { formatTime, formatTokenAmount } from "@/lib/format";
import type { StreamEvent } from "@/types/stream";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const EVENTS: StreamEvent[] = [
  {
    eventId: "0000000100000000-0001",
    kind: "created",
    streamId: "123",
    ledger: 1000,
    txHash: "111111111111111111111111111111111111111111111111111111111111aaaa",
    totalAmount: "100000000",
    closedAt: "1700000000",
  },
  {
    eventId: "0000000100000500-0001",
    kind: "withdrawn",
    streamId: "123",
    ledger: 1500,
    txHash: "222222222222222222222222222222222222222222222222222222222222bbbb",
    amount: "30000000",
    closedAt: "1700001800",
  },
  {
    eventId: "0000000100000900-0001",
    kind: "cancelled",
    streamId: "123",
    ledger: 1900,
    txHash: "333333333333333333333333333333333333333333333333333333333333cccc",
    recipientAmount: "20000000",
    senderRefund: "50000000",
    closedAt: "1700003000",
  },
];

describe("StreamEventHistory", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the loading state", async () => {
    await act(async () => {
      root.render(<StreamEventHistory events={[]} token={TOKEN} loading />);
    });

    expect(container.textContent).toContain("Loading event history…");
  });

  it("renders the empty state when there are no events", async () => {
    await act(async () => {
      root.render(<StreamEventHistory events={[]} token={TOKEN} />);
    });

    expect(container.textContent).toContain("No events recorded for this stream yet.");
  });

  it("renders the error state and invokes onRetry when clicked", async () => {
    const onRetry = vi.fn();
    await act(async () => {
      root.render(
        <StreamEventHistory
          events={[]}
          token={TOKEN}
          error="Failed to load events for stream 123 (500)"
          onRetry={onRetry}
        />,
      );
    });

    expect(container.textContent).toContain("Failed to load events for stream 123 (500)");
    const retryBtn = container.querySelector("button");
    expect(retryBtn).not.toBeNull();
    act(() => {
      retryBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("lists events in order with amounts, time, ledger, and transaction explorer links", async () => {
    await act(async () => {
      root.render(<StreamEventHistory events={EVENTS} token={TOKEN} />);
    });

    const items = Array.from(container.querySelectorAll("li"));
    expect(items).toHaveLength(3);

    expect(items[0].textContent).toContain("Created");
    expect(items[0].textContent).toContain(formatTokenAmount("100000000", TOKEN));
    expect(items[0].textContent).toContain(formatTime("1700000000"));
    expect(items[0].textContent).toContain("Ledger #1000");

    expect(items[1].textContent).toContain("Withdrawn");
    expect(items[1].textContent).toContain(formatTokenAmount("30000000", TOKEN));
    expect(items[1].textContent).toContain(formatTime("1700001800"));
    expect(items[1].textContent).toContain("Ledger #1500");

    expect(items[2].textContent).toContain("Cancelled");
    expect(items[2].textContent).toContain(
      `${formatTokenAmount("20000000", TOKEN)} claimable by recipient`,
    );
    expect(items[2].textContent).toContain(
      `${formatTokenAmount("50000000", TOKEN)} refunded to sender`,
    );
    expect(items[2].textContent).toContain(formatTime("1700003000"));
    expect(items[2].textContent).toContain("Ledger #1900");

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      EVENTS.map((e) => txExplorerUrl(e.txHash, config.network)),
    );
  });
});
