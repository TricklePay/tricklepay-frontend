import { getNetwork } from "@stellar/freighter-api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import { WALLET_NETWORK_UNAVAILABLE_MESSAGE, wrongNetworkMessage } from "@/lib/contract-messages";
import { ensureWalletNetwork } from "@/lib/contract-network";

vi.mock("@stellar/freighter-api", () => ({
  getNetwork: vi.fn(),
}));

describe("ensureWalletNetwork", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("resolves when Freighter is on the configured network", async () => {
    vi.mocked(getNetwork).mockResolvedValueOnce({
      network: config.network === "testnet" ? "TESTNET" : "PUBLIC",
      networkPassphrase: config.networkPassphrase,
    } as Awaited<ReturnType<typeof getNetwork>>);

    await expect(ensureWalletNetwork()).resolves.toBeUndefined();
  });

  it("throws wrongNetworkMessage when Freighter is on a different network", async () => {
    const otherNetwork = config.network === "testnet" ? "PUBLIC" : "TESTNET";
    const expectedWalletNetwork = config.network === "testnet" ? "mainnet" : "testnet";
    vi.mocked(getNetwork).mockResolvedValueOnce({
      network: otherNetwork,
      networkPassphrase: "",
    } as Awaited<ReturnType<typeof getNetwork>>);

    await expect(ensureWalletNetwork()).rejects.toThrow(
      wrongNetworkMessage(expectedWalletNetwork, config.network),
    );
  });

  it("fails closed when getNetwork returns an error result", async () => {
    vi.mocked(getNetwork).mockResolvedValueOnce({
      network: "",
      networkPassphrase: "",
      error: "Freighter is locked",
    } as unknown as Awaited<ReturnType<typeof getNetwork>>);

    await expect(ensureWalletNetwork()).rejects.toThrow(WALLET_NETWORK_UNAVAILABLE_MESSAGE);
  });

  it("fails closed when getNetwork rejects", async () => {
    vi.mocked(getNetwork).mockRejectedValueOnce(new Error("wallet unreachable"));

    await expect(ensureWalletNetwork()).rejects.toThrow(WALLET_NETWORK_UNAVAILABLE_MESSAGE);
  });
});
