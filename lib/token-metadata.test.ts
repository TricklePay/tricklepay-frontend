import { nativeToScVal } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { simulateTransaction } = vi.hoisted(() => ({ simulateTransaction: vi.fn() }));

vi.mock("@/lib/contract-network", () => ({
  server: () => ({ simulateTransaction }),
}));

import { nativeAssetContractId } from "@/lib/native-asset";
import {
  CachedTokenMetadataError,
  clearTokenMetadataCache,
  FAILED_TOKEN_METADATA_TTL_MS,
  getCachedTokenMetadata,
  KNOWN_TOKEN_METADATA,
  readTokenMetadata,
  setCachedTokenMetadata,
} from "@/lib/token-metadata";

const KNOWN_TOKEN = nativeAssetContractId();
const UNKNOWN_TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const ANOTHER_UNKNOWN_TOKEN = "CAJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBERTS";

describe("token metadata helper", () => {
  beforeEach(() => {
    clearTokenMetadataCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves unknown tokens once through read-only simulation and caches them", async () => {
    // First call simulates symbol() then name()
    simulateTransaction
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("EURC", { type: "string" }) },
      })
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("Euro Coin", { type: "string" }) },
      });

    const meta = await readTokenMetadata(UNKNOWN_TOKEN);
    expect(meta).toEqual({ symbol: "EURC", name: "Euro Coin" });
    expect(simulateTransaction).toHaveBeenCalledTimes(2);

    // Dynamic cache now contains the resolved metadata
    expect(getCachedTokenMetadata(UNKNOWN_TOKEN)).toEqual({
      symbol: "EURC",
      name: "Euro Coin",
    });

    // Second call must return directly from cache without re-simulating
    const cached = await readTokenMetadata(UNKNOWN_TOKEN);
    expect(cached).toEqual({ symbol: "EURC", name: "Euro Coin" });
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });

  it("deduplicates in-flight simulation requests for the same token", async () => {
    simulateTransaction
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("TEST", { type: "string" }) },
      })
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("Test Token", { type: "string" }) },
      });

    const [first, second] = await Promise.all([
      readTokenMetadata(ANOTHER_UNKNOWN_TOKEN),
      readTokenMetadata(ANOTHER_UNKNOWN_TOKEN),
    ]);

    expect(first).toEqual({ symbol: "TEST", name: "Test Token" });
    expect(second).toEqual({ symbol: "TEST", name: "Test Token" });
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });

  it("falls back to symbol when name() call fails", async () => {
    simulateTransaction
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("BTC", { type: "string" }) },
      })
      .mockResolvedValueOnce({
        error: "HostError: method name not found",
      });

    const meta = await readTokenMetadata(UNKNOWN_TOKEN);
    expect(meta).toEqual({ symbol: "BTC", name: "BTC" });
  });

  it("keeps the table of known tokens as a fallback when simulation fails", async () => {
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: contract simulation failed",
    });

    const meta = await readTokenMetadata(KNOWN_TOKEN);
    expect(meta).toEqual(KNOWN_TOKEN_METADATA[KNOWN_TOKEN]);
  });

  it("throws when simulation fails and token is not in the fallback table", async () => {
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: contract not found",
    });

    await expect(readTokenMetadata(UNKNOWN_TOKEN)).rejects.toThrow();
  });

  it("allows setting and clearing cached metadata", () => {
    setCachedTokenMetadata(UNKNOWN_TOKEN, { symbol: "CUSTOM", name: "Custom Token" });
    expect(getCachedTokenMetadata(UNKNOWN_TOKEN)).toEqual({
      symbol: "CUSTOM",
      name: "Custom Token",
    });

    clearTokenMetadataCache();
    expect(getCachedTokenMetadata(UNKNOWN_TOKEN)).toBeNull();
  });

  it("caches failed lookups with a distinct error and retries after the TTL", async () => {
    vi.useFakeTimers();
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: symbol not implemented",
    });

    await expect(readTokenMetadata(UNKNOWN_TOKEN)).rejects.toThrow(
      "HostError: symbol not implemented",
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    // Within the TTL, subsequent calls throw CachedTokenMetadataError without hitting RPC.
    await expect(readTokenMetadata(UNKNOWN_TOKEN)).rejects.toBeInstanceOf(
      CachedTokenMetadataError,
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    // Once the TTL elapses, the next lookup retries RPC.
    vi.advanceTimersByTime(FAILED_TOKEN_METADATA_TTL_MS);
    simulateTransaction
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("USDC", { type: "string" }) },
      })
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("USD Coin", { type: "string" }) },
      });

    const meta = await readTokenMetadata(UNKNOWN_TOKEN);
    expect(meta).toEqual({ symbol: "USDC", name: "USD Coin" });
    expect(simulateTransaction).toHaveBeenCalledTimes(3);
  });

  it("bypasses a cached failure when forceRefresh is true", async () => {
    simulateTransaction.mockResolvedValueOnce({
      error: "HostError: transient failure",
    });

    await expect(readTokenMetadata(UNKNOWN_TOKEN)).rejects.toThrow(
      "HostError: transient failure",
    );
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    simulateTransaction
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("EURC", { type: "string" }) },
      })
      .mockResolvedValueOnce({
        transactionData: {},
        result: { retval: nativeToScVal("Euro Coin", { type: "string" }) },
      });

    const meta = await readTokenMetadata(UNKNOWN_TOKEN, { forceRefresh: true });
    expect(meta).toEqual({ symbol: "EURC", name: "Euro Coin" });
    expect(simulateTransaction).toHaveBeenCalledTimes(3);
  });
});
