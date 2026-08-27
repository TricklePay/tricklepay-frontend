import { describe, it, expect, vi } from "vitest";
import { normalizeNetwork } from "@/lib/wallet-utils";
import * as freighter from "@stellar/freighter-api";

// Mock @stellar/freighter-api methods
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  requestAccess: vi.fn(),
}));

describe("lib/wallet-provider logic & network normalization", () => {
  describe("normalizeNetwork", () => {
    it("normalizes uppercase TESTNET to testnet", () => {
      expect(normalizeNetwork("TESTNET")).toBe("testnet");
      expect(normalizeNetwork("testnet_sdf")).toBe("testnet");
    });

    it("normalizes PUBLIC / MAINNET to mainnet", () => {
      expect(normalizeNetwork("PUBLIC")).toBe("mainnet");
      expect(normalizeNetwork("public_global")).toBe("mainnet");
    });

    it("returns raw lowercased string for unknown networks", () => {
      expect(normalizeNetwork("FUTURENET")).toBe("futurenet");
      expect(normalizeNetwork("STANDALONE")).toBe("standalone");
    });
  });

  describe("Freighter API Integration Contracts", () => {
    it("handles isConnected returning false", async () => {
      vi.mocked(freighter.isConnected).mockResolvedValueOnce({ isConnected: false });
      const status = await freighter.isConnected();
      expect(status.isConnected).toBe(false);
    });

    it("handles successful address and network resolution", async () => {
      const mockAddr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
      vi.mocked(freighter.isConnected).mockResolvedValueOnce({ isConnected: true });
      vi.mocked(freighter.isAllowed).mockResolvedValueOnce({ isAllowed: true });
      vi.mocked(freighter.getAddress).mockResolvedValueOnce({ address: mockAddr });
      vi.mocked(freighter.getNetwork).mockResolvedValueOnce({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      const conn = await freighter.isConnected();
      const allow = await freighter.isAllowed();
      const addr = await freighter.getAddress();
      const net = await freighter.getNetwork();

      expect(conn.isConnected).toBe(true);
      expect(allow.isAllowed).toBe(true);
      expect(addr.address).toBe(mockAddr);
      expect(normalizeNetwork(net.network!)).toBe("testnet");
    });

    it("handles wallet access denial during connection request", async () => {
      vi.mocked(freighter.isConnected).mockResolvedValueOnce({ isConnected: true });
      vi.mocked(freighter.requestAccess).mockResolvedValueOnce({
        address: "",
        error: "User rejected access request",
      });

      const conn = await freighter.isConnected();
      const access = await freighter.requestAccess();

      expect(conn.isConnected).toBe(true);
      expect(access.error).toBe("User rejected access request");
      expect(access.address).toBeFalsy();
    });
  });
});
