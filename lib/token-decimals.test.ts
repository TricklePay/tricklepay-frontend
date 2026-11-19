import { nativeToScVal } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { simulateTransaction } = vi.hoisted(() => ({ simulateTransaction: vi.fn() }));

vi.mock("@/lib/contract-network", () => ({
  server: () => ({ simulateTransaction }),
}));

import {
  CachedTokenDecimalsError,
  clearTokenDecimalsCache,
  FAILED_TOKEN_DECIMALS_TTL_MS,
  getCachedTokenDecimals,
  readTokenDecimals,
} from "@/lib/token-decimals";

const TOKEN_6 = "CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST";
const TOKEN_7 = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const TOKEN_18 = "CAJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBERTS";

describe("token decimals helper", () => {
  beforeEach(() => {
    clearTokenDecimalsCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads 6-decimal token correctly", async () => {
    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(6, { type: "u32" }) },
    });

    const decimals = await readTokenDecimals(TOKEN_6);
    expect(decimals).toBe(6);
  });

  it("reads 7-decimal token correctly", async () => {
    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(7, { type: "u32" }) },
    });

    const decimals = await readTokenDecimals(TOKEN_7);
    expect(decimals).toBe(7);
  });

  it("reads 18-decimal token correctly", async () => {
    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(18, { type: "u32" }) },
    });

    const decimals = await readTokenDecimals(TOKEN_18);
    expect(decimals).toBe(18);
  });

  it("caches decimals per token for the session", async () => {
    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(18, { type: "u32" }) },
    });

    const first = await readTokenDecimals(TOKEN_18);
    expect(first).toBe(18);
    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    expect(getCachedTokenDecimals(TOKEN_18)).toBe(18);

    // Second call should return from cache without calling simulation again
    const second = await readTokenDecimals(TOKEN_18);
    expect(second).toBe(18);
    expect(simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws when the decimals simulation fails", async () => {
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: contract not found",
    });

    await expect(readTokenDecimals(TOKEN_6)).rejects.toThrow();
  });

  it("caches failed lookups with a distinct error and retries after the TTL", async () => {
    vi.useFakeTimers();
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: decimals not implemented",
    });

    await expect(readTokenDecimals(TOKEN_6)).rejects.toThrow(
      "HostError: decimals not implemented",
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    await expect(readTokenDecimals(TOKEN_6)).rejects.toBeInstanceOf(
      CachedTokenDecimalsError,
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FAILED_TOKEN_DECIMALS_TTL_MS);
    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(6, { type: "u32" }) },
    });

    await expect(readTokenDecimals(TOKEN_6)).resolves.toBe(6);
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });

  it("bypasses a cached failure when forceRefresh is true", async () => {
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: transient error",
    });

    await expect(readTokenDecimals(TOKEN_6)).rejects.toThrow(
      "HostError: transient error",
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    simulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: { retval: nativeToScVal(6, { type: "u32" }) },
    });

    await expect(readTokenDecimals(TOKEN_6, { forceRefresh: true })).resolves.toBe(6);
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });
});
