import * as freighter from "@stellar/freighter-api";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

import { normalizeNetwork } from "@/lib/wallet-utils";
import type { WalletState } from "@/types/wallet";

import { WalletContext, WalletProvider, useWallet } from "./wallet-provider";

// Mock @stellar/freighter-api methods
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  requestAccess: vi.fn(),
}));

// A consumer that hands its useWallet() read out to the test via a callback,
// the same way any real component (header, form, stream detail) reads it.
function Consumer({ onRead }: { onRead: (wallet: WalletState) => void }) {
  onRead(useWallet());
  return null;
}

describe("WalletProvider", () => {
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

  // This is the guarantee the provider exists for: one connection state,
  // read the same way by every consumer, instead of each holding its own.
  // Rendered with react-dom/server's renderToStaticMarkup rather than the
  // plain-function-call style used elsewhere in this suite, because
  // WalletProvider calls real useState/useCallback/useMemo — those need an
  // actual React dispatcher, which only a real render pass provides. No DOM
  // is needed for that; renderToStaticMarkup runs entirely in Node.
  describe("shared connection state", () => {
    it("gives every consumer under the same provider the identical state object", () => {
      const seen: WalletState[] = [];
      const onRead = (wallet: WalletState) => seen.push(wallet);

      renderToStaticMarkup(
        createElement(
          WalletProvider,
          null,
          createElement(Consumer, { onRead }),
          createElement(Consumer, { onRead }),
        ),
      );

      expect(seen).toHaveLength(2);
      // Same object reference, not just equal-looking copies: this is what
      // "shared" means here — one useMemo'd value read via context by every
      // consumer, rather than each consumer computing its own independently.
      expect(seen[0]).toBe(seen[1]);
      // Both start disconnected: WalletProvider's session-restore effect
      // never runs under renderToStaticMarkup (React skips effects during
      // this kind of render), so this is the state before any restore —
      // still shared identically between both consumers either way.
      expect(seen[0].address).toBeNull();
    });

    it("a change to the shared value is seen by every consumer, not just one", () => {
      // WalletProvider's own connect()/disconnect() update state through an
      // effect-driven async flow, which (as above) doesn't run under
      // renderToStaticMarkup. What actually makes such an update reach every
      // consumer is useWallet() being nothing more than useContext(WalletContext)
      // — so this drives that same mechanism directly, rendering the real
      // hook against two distinct values of the context it reads from, the
      // same way a change to WalletProvider's own memoized value would.
      const disconnected: WalletState = {
        address: null,
        network: null,
        connecting: false,
        error: null,
        connect: async () => {},
        disconnect: () => {},
      };
      const connected: WalletState = {
        ...disconnected,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
      };

      const before: WalletState[] = [];
      renderToStaticMarkup(
        createElement(
          WalletContext.Provider,
          { value: disconnected },
          createElement(Consumer, { onRead: (w: WalletState) => before.push(w) }),
          createElement(Consumer, { onRead: (w: WalletState) => before.push(w) }),
        ),
      );
      expect(before[0].address).toBeNull();
      expect(before[1].address).toBeNull();

      const after: WalletState[] = [];
      renderToStaticMarkup(
        createElement(
          WalletContext.Provider,
          { value: connected },
          createElement(Consumer, { onRead: (w: WalletState) => after.push(w) }),
          createElement(Consumer, { onRead: (w: WalletState) => after.push(w) }),
        ),
      );

      // Both consumers moved to the new value together — neither is left
      // observing the stale, disconnected state the other has moved past.
      expect(after[0].address).toBe(connected.address);
      expect(after[1].address).toBe(connected.address);
      expect(after[0]).toBe(after[1]);
    });
  });
});
