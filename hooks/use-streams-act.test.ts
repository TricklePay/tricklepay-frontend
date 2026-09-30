/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStreamActions } from "@/hooks/use-stream-actions";
import type { StreamView } from "@/types/stream";

vi.mock("@/hooks/use-accrual", () => ({
  useAccrual: vi.fn((stream: StreamView) => ({
    withdrawable: BigInt(stream.withdrawable),
    progress: 0.5,
  })),
}));

vi.mock("@/lib/contract", () => ({
  cancel: vi.fn(),
  withdraw: vi.fn(),
  withdrawAmount: vi.fn(),
  confirmTransaction: vi.fn(),
  TransactionTimeoutError: class TransactionTimeoutError extends Error {
    constructor(public txHash: string, message = "Timeout") {
      super(message);
      this.name = "TransactionTimeoutError";
    }
  },
}));

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const STREAM_WITH_FUNDS: StreamView = {
  id: "1",
  sender: SENDER,
  recipient: RECIPIENT,
  token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  totalAmount: "1000000000",
  withdrawn: "0",
  vested: "500000000",
  withdrawable: "500000000",
  locked: "500000000",
  startTime: "1000",
  endTime: "2000",
  cliffTime: "1000",
  cancelled: false,
  status: "streaming",
  progress: 0.5,
};

const STREAM_ZERO_FUNDS: StreamView = {
  ...STREAM_WITH_FUNDS,
  id: "2",
  vested: "0",
  withdrawable: "0",
  progress: 0,
};

describe("useStreamActions state and input handling", () => {
  it("initializes with default withdrawable amount and correct nothingToWithdraw flag", () => {
    const { result: withFunds } = renderHook(() =>
      useStreamActions(STREAM_WITH_FUNDS, RECIPIENT, vi.fn()),
    );
    expect(withFunds.current.nothingToWithdraw).toBe(false);
    expect(withFunds.current.withdrawable).toBe(500000000n);
    expect(withFunds.current.amountInput).toBe("50");
    expect(withFunds.current.amountError).toBeNull();
    expect(withFunds.current.busy).toBeNull();
    expect(withFunds.current.confirmingCancel).toBe(false);

    const { result: zeroFunds } = renderHook(() =>
      useStreamActions(STREAM_ZERO_FUNDS, RECIPIENT, vi.fn()),
    );
    expect(zeroFunds.current.nothingToWithdraw).toBe(true);
    expect(zeroFunds.current.withdrawable).toBe(0n);
  });

  it("updates amountInput and validates on changeAmount", () => {
    const { result } = renderHook(() =>
      useStreamActions(STREAM_WITH_FUNDS, RECIPIENT, vi.fn()),
    );

    act(() => {
      result.current.changeAmount("10");
    });
    expect(result.current.amountInput).toBe("10");
    expect(result.current.amountError).toBeNull();

    // Exceeds available balance
    act(() => {
      result.current.changeAmount("100");
    });
    expect(result.current.amountInput).toBe("100");
    expect(result.current.amountError).toBeTruthy();
  });

  it("resets amount to maximum on setMaxAmount", () => {
    const { result } = renderHook(() =>
      useStreamActions(STREAM_WITH_FUNDS, RECIPIENT, vi.fn()),
    );

    act(() => {
      result.current.changeAmount("5");
    });
    expect(result.current.amountInput).toBe("5");

    act(() => {
      result.current.setMaxAmount();
    });
    expect(result.current.amountInput).toBe("50");
    expect(result.current.amountError).toBeNull();
  });

  it("toggles cancel confirmation modal state", () => {
    const { result } = renderHook(() =>
      useStreamActions(STREAM_WITH_FUNDS, SENDER, vi.fn()),
    );

    expect(result.current.confirmingCancel).toBe(false);

    act(() => {
      result.current.openCancelConfirm();
    });
    expect(result.current.confirmingCancel).toBe(true);

    act(() => {
      result.current.closeCancelConfirm();
    });
    expect(result.current.confirmingCancel).toBe(false);
  });
});
