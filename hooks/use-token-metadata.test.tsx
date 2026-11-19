/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { simulateTransaction } = vi.hoisted(() => ({ simulateTransaction: vi.fn() }));

vi.mock("@/lib/contract-network", () => ({
  server: () => ({ simulateTransaction }),
}));

import {
  clearTokenMetadataCache,
  FAILED_TOKEN_METADATA_TTL_MS,
} from "@/lib/token-metadata";

import { useTokensMetadata } from "./use-token-metadata";

const NON_SEP41_TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const KNOWN_XLM_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function TokenListConsumer({ tokens }: { tokens: string[] }) {
  useTokensMetadata(tokens);
  return null;
}

describe("useTokensMetadata", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    clearTokenMetadataCache();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("does not repeat RPC calls for a failing token across several renders until the TTL expires", async () => {
    vi.useFakeTimers();
    simulateTransaction.mockResolvedValue({
      error: "HostError: symbol not implemented",
    });

    // Initial render with the non-SEP-41 token.
    await act(async () => {
      root.render(<TokenListConsumer tokens={[NON_SEP41_TOKEN]} />);
      await Promise.resolve();
    });
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    // Re-render with a changed list key (e.g. filter change or refresh adding another row).
    await act(async () => {
      root.render(<TokenListConsumer tokens={[NON_SEP41_TOKEN, KNOWN_XLM_TOKEN]} />);
      await Promise.resolve();
    });

    // Re-render back to the original list key.
    await act(async () => {
      root.render(<TokenListConsumer tokens={[NON_SEP41_TOKEN]} />);
      await Promise.resolve();
    });

    // Re-render with duplicate occurrences of the same failing token.
    await act(async () => {
      root.render(<TokenListConsumer tokens={[NON_SEP41_TOKEN, NON_SEP41_TOKEN]} />);
      await Promise.resolve();
    });

    // Still only 1 RPC call across all four renders while within the TTL.
    expect(simulateTransaction).toHaveBeenCalledTimes(1);

    // After the TTL elapses, a subsequent list change triggers a retry.
    vi.advanceTimersByTime(FAILED_TOKEN_METADATA_TTL_MS);
    await act(async () => {
      root.render(<TokenListConsumer tokens={[KNOWN_XLM_TOKEN, NON_SEP41_TOKEN]} />);
      await Promise.resolve();
    });
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });
});
