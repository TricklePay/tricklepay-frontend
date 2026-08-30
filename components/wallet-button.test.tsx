import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/hooks/use-network-guard", () => ({
  useNetworkGuard: vi.fn(),
}));

import { useWallet } from "@/components/wallet-provider";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { WalletButton } from "./wallet-button";

function mockDisconnected() {
  vi.mocked(useWallet).mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  vi.mocked(useNetworkGuard).mockReturnValue({
    mismatch: false,
    walletNetwork: null,
    expectedNetwork: "testnet",
  });
}

function mockConnected(address: string) {
  vi.mocked(useWallet).mockReturnValue({
    address,
    network: "testnet",
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  vi.mocked(useNetworkGuard).mockReturnValue({
    mismatch: false,
    walletNetwork: "testnet",
    expectedNetwork: "testnet",
  });
}

describe("WalletButton", () => {
  describe("disconnected state (#136)", () => {
    it("prompts the user to connect", () => {
      mockDisconnected();
      const el = WalletButton();
      expect(JSON.stringify(el)).toContain("Connect Wallet");
    });

    it("renders an enabled connect button", () => {
      mockDisconnected();
      const el = WalletButton();
      const json = JSON.stringify(el);
      expect(json).toContain("Connect Wallet");
      expect(json).not.toMatch(/"disabled":\s*true/);
    });
  });

  describe("connected state (#137)", () => {
    it("shows the truncated address", () => {
      const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
      mockConnected(addr);
      const el = WalletButton();
      expect(JSON.stringify(el)).toContain("GAAA...CCWN7");
    });

    it("truncates to first 4 and last 4 characters with ellipsis", () => {
      const addr = "GBBBI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
      mockConnected(addr);
      const el = WalletButton();
      const json = JSON.stringify(el);
      expect(json).toContain("GBBB...CCWN7");
      expect(json).not.toContain(addr);
    });
  });
});
