import { afterEach, describe, expect, it, vi } from "vitest";

describe("default RPC configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["testnet", "https://soroban-testnet.stellar.org"],
    ["mainnet", "https://mainnet.sorobanrpc.com"],
  ])("uses the documented %s RPC URL when none is configured", async (network, rpcUrl) => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", network);
    vi.stubEnv("NEXT_PUBLIC_RPC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ID", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM");

    const { config } = await import("./config");
    expect(config.rpcUrl).toBe(rpcUrl);
  });
});
