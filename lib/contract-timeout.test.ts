import { rpc } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionTimeoutError, confirmTransaction } from "@/lib/contract";

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(),
    },
  };
});

describe("TransactionTimeoutError", () => {
  it("stores transaction hash and descriptive timeout message", () => {
    const dummyHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const err = new TransactionTimeoutError(dummyHash);

    expect(err.name).toBe("TransactionTimeoutError");
    expect(err.txHash).toBe(dummyHash);
    expect(err.message).toBe("Timed out waiting for confirmation.");
  });

  it("allows custom message overrides", () => {
    const dummyHash = "0xabc123";
    const customMsg = "Custom timeout message";
    const err = new TransactionTimeoutError(dummyHash, customMsg);

    expect(err.txHash).toBe(dummyHash);
    expect(err.message).toBe(customMsg);
  });
});

describe("confirmation poll bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("stops polling at the timeout and throws a TransactionTimeoutError carrying the hash", async () => {
    const mockGetTransaction = vi.fn().mockResolvedValue({
      status: "PENDING",
    });
    vi.mocked(rpc.Server).mockImplementation(
      class {
        getTransaction = mockGetTransaction;
      } as unknown as typeof rpc.Server,
    );

    const hash = "0xtimedout";
    const promise = confirmTransaction(hash);
    const assertion = expect(promise).rejects.toThrowError(TransactionTimeoutError);

    // Fast-forward 30 seconds (30 attempts * 1_000ms)
    // We await advanceTimersByTimeAsync to yield the event loop so the sleep resolves.
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    await assertion;
    await expect(promise).rejects.toMatchObject({ txHash: hash });
    expect(mockGetTransaction).toHaveBeenCalledTimes(30);
  });
});
