import { signTransaction } from "@stellar/freighter-api";
import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUBMIT_MAX_ATTEMPTS, SUBMIT_RETRY_BASE_DELAY_MS } from "@/lib/contract-config";
import {
  parseSigningError,
  TX_NETWORK_REJECTED_MESSAGE,
  TX_RPC_BUSY_MESSAGE,
  TX_SIGNING_REJECTED_MESSAGE,
  TX_SIGNING_WALLET_ERROR_MESSAGE,
  TX_WALLET_LOCKED_MESSAGE,
  TX_WRONG_ACCOUNT_MESSAGE,
} from "@/lib/contract-messages";
import { signPreparedTransaction, submitSignedTransaction } from "@/lib/contract-transaction";

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

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

describe("signPreparedTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns signedTxXdr when Freighter succeeds", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: "GABC",
    });

    const result = await signPreparedTransaction("PREPARED_XDR", "GABC");
    expect(result).toBe("SIGNED_XDR");
  });

  it("maps user rejection to TX_SIGNING_REJECTED_MESSAGE", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "",
      signerAddress: "",
      error: "User declined access",
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    await expect(signPreparedTransaction("PREPARED_XDR", "GABC")).rejects.toThrow(
      TX_SIGNING_REJECTED_MESSAGE,
    );
  });

  it("maps locked wallet error to TX_WALLET_LOCKED_MESSAGE", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "",
      signerAddress: "",
      error: { code: -1, message: "Freighter is locked" },
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    await expect(signPreparedTransaction("PREPARED_XDR", "GABC")).rejects.toThrow(
      TX_WALLET_LOCKED_MESSAGE,
    );
  });

  it("maps wrong account error to TX_WRONG_ACCOUNT_MESSAGE", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "",
      signerAddress: "",
      error: { code: -1, message: "Selected account does not match" },
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    await expect(signPreparedTransaction("PREPARED_XDR", "GABC")).rejects.toThrow(
      TX_WRONG_ACCOUNT_MESSAGE,
    );
  });

  it("maps internal wallet errors to TX_SIGNING_WALLET_ERROR_MESSAGE", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "",
      signerAddress: "",
      error: { code: -1, message: "Internal error in Freighter" },
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    await expect(signPreparedTransaction("PREPARED_XDR", "GABC")).rejects.toThrow(
      TX_SIGNING_WALLET_ERROR_MESSAGE,
    );
  });

  it("surfaces the wallet's own message for unknown errors", async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: "",
      signerAddress: "",
      error: { code: 500, message: "Hardware device disconnected" },
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    await expect(signPreparedTransaction("PREPARED_XDR", "GABC")).rejects.toThrow(
      "Hardware device disconnected",
    );
  });
});

describe("parseSigningError", () => {
  it("handles code -4 without a message as rejection", () => {
    expect(parseSigningError({ code: -4 })).toBe(TX_SIGNING_REJECTED_MESSAGE);
  });

  it("handles empty or non-string error objects as other wallet error", () => {
    expect(parseSigningError({})).toBe(TX_SIGNING_WALLET_ERROR_MESSAGE);
    expect(parseSigningError("")).toBe(TX_SIGNING_WALLET_ERROR_MESSAGE);
  });

  it("returns unknown string errors verbatim", () => {
    expect(parseSigningError("Unexpected USB transport failure")).toBe(
      "Unexpected USB transport failure",
    );
  });
});
