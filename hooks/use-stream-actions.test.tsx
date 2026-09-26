/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-accrual", () => ({
  useAccrual: vi.fn(),
}));

vi.mock("@/lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contract")>();
  return {
    ...actual,
    withdraw: vi.fn(),
    withdrawAmount: vi.fn(),
    cancel: vi.fn(),
    confirmTransaction: vi.fn(),
  };
});

import { useAccrual } from "@/hooks/use-accrual";
import { cancel, withdraw } from "@/lib/contract";
import type { StreamView } from "@/types/stream";

import { useStreamActions, type StreamActionsState } from "./use-stream-actions";

const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const STREAM: StreamView = {
  id: "1",
  sender: WALLET,
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  totalAmount: "1000000000",
  withdrawn: "0",
  vested: "0",
  withdrawable: "0",
  locked: "1000000000",
  startTime: "1000",
  endTime: "1100",
  cliffTime: "1000",
  cancelled: false,
  status: "streaming",
  progress: 0,
};

// One whole token withdrawable, so the default amount field ("1") is valid
// and the full-balance withdraw shortcut is exercised.
const WITHDRAWABLE = 10_000_000n;

describe("useStreamActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest!: StreamActionsState;

  function Probe() {
    latest = useStreamActions(STREAM, WALLET, vi.fn());
    return null;
  }

  beforeEach(async () => {
    vi.mocked(useAccrual).mockReturnValue({ vested: WITHDRAWABLE, withdrawable: WITHDRAWABLE });
    vi.mocked(withdraw).mockResolvedValue("hash123");
    vi.mocked(cancel).mockResolvedValue("hash456");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("reports an in-flight state during a withdraw", async () => {
    let release!: (hash: string) => void;
    vi.mocked(withdraw).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        release = resolve;
      }),
    );

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = latest.runWithdraw();
      // Let the synchronous setBusy("withdraw") flush while the mocked
      // transaction is still pending.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest.busy).toBe("withdraw");

    await act(async () => {
      release("hash123");
      await runPromise;
    });

    expect(latest.busy).toBeNull();
    expect(latest.lastTxHash).toBe("hash123");
    expect(latest.error).toBeNull();
  });

  it("surfaces an action failure", async () => {
    vi.mocked(cancel).mockRejectedValueOnce(new Error("Cancel rejected by wallet."));

    await act(async () => {
      await latest.runCancel();
    });

    expect(latest.error).toBe("Cancel rejected by wallet.");
    expect(latest.busy).toBeNull();
    expect(latest.lastTxHash).toBeNull();
  });
});
