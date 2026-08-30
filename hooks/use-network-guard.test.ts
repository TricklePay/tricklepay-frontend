import { describe, it, expect, vi, afterEach } from "vitest";

// Mock wallet-provider so useNetworkGuard can be exercised without a React
// tree. The mock is replaced per-test to simulate different wallet states.
vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

// Mock config so the expected network is stable and independent of the
// environment variables present when the test suite runs.
vi.mock("@/lib/config", () => ({
  config: { network: "testnet" },
}));

import { useNetworkGuard } from "./use-network-guard";
import { useWallet } from "@/components/wallet-provider";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useNetworkGuard — mismatch detection", () => {
  it("reports a mismatch when the wallet is on a different network", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      network: "mainnet",   // wallet says mainnet …
      connecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const guard = useNetworkGuard();

    expect(guard.mismatch).toBe(true);
    expect(guard.walletNetwork).toBe("mainnet");   // … but app expects testnet
    expect(guard.expectedNetwork).toBe("testnet");
  });

  it("includes both the wallet and expected network in the result when mismatched", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      network: "futurenet",
      connecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const guard = useNetworkGuard();

    expect(guard.mismatch).toBe(true);
    expect(guard.walletNetwork).toBe("futurenet");
    expect(guard.expectedNetwork).toBe("testnet");
  });
});

describe("useNetworkGuard — matching network", () => {
  it("reports no mismatch when the wallet is on the configured network", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      network: "testnet",   // matches the mocked config.network
      connecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const guard = useNetworkGuard();

    expect(guard.mismatch).toBe(false);
    expect(guard.walletNetwork).toBe("testnet");
    expect(guard.expectedNetwork).toBe("testnet");
  });

  it("reports no mismatch when the wallet is not connected (null network)", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      network: null,       // not connected — guard must not trigger
      connecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const guard = useNetworkGuard();

    expect(guard.mismatch).toBe(false);
    expect(guard.walletNetwork).toBeNull();
    expect(guard.expectedNetwork).toBe("testnet");
  });
});
