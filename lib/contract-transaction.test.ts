import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUBMIT_MAX_ATTEMPTS, SUBMIT_RETRY_BASE_DELAY_MS } from "@/lib/contract-config";
import { TX_NETWORK_REJECTED_MESSAGE, TX_RPC_BUSY_MESSAGE } from "@/lib/contract-messages";
import { submitSignedTransaction } from "@/lib/contract-transaction";

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      fromXDR: vi.fn(() => ({}) as ReturnType<typeof actual.TransactionBuilder.fromXDR>),
    },
  };
});

describe("submitSignedTransaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockServer(sendTransaction: ReturnType<typeof vi.fn>): rpc.Server {
    return { sendTransaction } as unknown as rpc.Server;
  }

  it("returns the hash immediately when status is PENDING", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: "PENDING",
      hash: "0xpending",
    });

    const hash = await submitSignedTransaction(mockServer(sendTransaction), "AAAA");

    expect(hash).toBe("0xpending");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(TransactionBuilder.fromXDR).toHaveBeenCalledTimes(1);
  });

  it("returns the hash to continue to confirmation when status is DUPLICATE", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: "DUPLICATE",
      hash: "0xduplicate",
    });

    const hash = await submitSignedTransaction(mockServer(sendTransaction), "AAAA");

    expect(hash).toBe("0xduplicate");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws TX_NETWORK_REJECTED_MESSAGE without retrying when status is ERROR", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: "ERROR",
      hash: "0xerror",
    });

    await expect(submitSignedTransaction(mockServer(sendTransaction), "AAAA")).rejects.toThrow(
      TX_NETWORK_REJECTED_MESSAGE,
    );
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("retries TRY_AGAIN_LATER with exponential backoff and succeeds on PENDING", async () => {
    const sendTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: "TRY_AGAIN_LATER", hash: "" })
      .mockResolvedValueOnce({ status: "TRY_AGAIN_LATER", hash: "" })
      .mockResolvedValueOnce({ status: "PENDING", hash: "0xrecovered" });

    const promise = submitSignedTransaction(mockServer(sendTransaction), "AAAA");

    await vi.advanceTimersByTimeAsync(SUBMIT_RETRY_BASE_DELAY_MS);
    await vi.advanceTimersByTimeAsync(SUBMIT_RETRY_BASE_DELAY_MS * 2);

    await expect(promise).resolves.toBe("0xrecovered");
    expect(sendTransaction).toHaveBeenCalledTimes(3);
  });

  it("throws TX_RPC_BUSY_MESSAGE after exhausting retries on TRY_AGAIN_LATER", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: "TRY_AGAIN_LATER",
      hash: "",
    });

    const promise = submitSignedTransaction(mockServer(sendTransaction), "AAAA");
    const assertion = expect(promise).rejects.toThrow(TX_RPC_BUSY_MESSAGE);

    for (let attempt = 0; attempt < SUBMIT_MAX_ATTEMPTS - 1; attempt++) {
      await vi.advanceTimersByTimeAsync(SUBMIT_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }

    await assertion;
    expect(sendTransaction).toHaveBeenCalledTimes(SUBMIT_MAX_ATTEMPTS);
  });
});
