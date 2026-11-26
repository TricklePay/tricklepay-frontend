"use client";

import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { type JSX, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { normalizeNetwork } from "@/lib/wallet-utils";
import type { WalletState } from "@/types/wallet";

// Exported so a test can render `<WalletContext.Provider>` directly and
// confirm useWallet() reads through it — see wallet-provider.test.tsx.
export const WalletContext = createContext<WalletState | null>(null);

// How often Freighter is polled for an account or network switch while a
// session is open. Freighter emits no events, so polling is the only option.
export const WALLET_WATCH_INTERVAL_MS = 3000;

// Set when the user disconnects in the app, so the restore step on the next
// load does not quietly reconnect. Cleared by an explicit connect.
export const WALLET_DISCONNECTED_KEY = "tricklepay:wallet-disconnected";

function readDisconnectedFlag(): boolean {
  try {
    return window.localStorage.getItem(WALLET_DISCONNECTED_KEY) === "1";
  } catch {
    // Storage unavailable: behave as before and allow the restore.
    return false;
  }
}

function writeDisconnectedFlag(disconnected: boolean): void {
  try {
    if (disconnected) window.localStorage.setItem(WALLET_DISCONNECTED_KEY, "1");
    else window.localStorage.removeItem(WALLET_DISCONNECTED_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Owns the single wallet session for the whole app. This provider centralizes
 * connection state so that every component reads the same address, sees
 * disconnects immediately, and benefits from automatic session restoration.
 * 
 * The state is shared rather than per-component because:
 * - Wallet connection is inherently global — only one address is active at a time
 * - Multiple components need the address (header, forms, stream details)
 * - Disconnecting in one place should update the whole UI instantly
 * - Freighter should be probed once per page load, not once per consumer
 * 
 * On mount, the provider attempts to restore an existing session if Freighter
 * has already authorized this app, so returning users remain connected across
 * page refreshes without re-prompting.
 * 
 * Consumers receive:
 * - address: the connected wallet's public key, or null when disconnected
 * - network: the network the wallet is on (normalized to lowercase), or null
 * - connecting: true during the connect flow
 * - error: most recent connection error message, or null
 * - connect(): prompts the user to authorize via Freighter
 * - disconnect(): clears the session and resets all state
 * 
 * Mount this once in the root layout and access it anywhere via useWallet().
 * 
 * @param children - The app tree that needs wallet state.
 */
export function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the session on mount if Freighter is already installed and has
  // authorized this app, so a returning user does not have to reconnect.
  useEffect(() => {
    let cancelled = false;
    if (readDisconnectedFlag()) return;
    void (async () => {
      try {
        const connected = await isConnected();
        if (!connected.isConnected) return;
        const allowed = await isAllowed();
        if (!allowed.isAllowed) return;
        const addr = await getAddress();
        if (cancelled || addr.error || !addr.address) return;
        const net = await getNetwork();
        setAddress(addr.address);
        if (!net.error) setNetwork(normalizeNetwork(net.network));
      } catch {
        // Freighter not available; remain disconnected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow account and network switches made in Freighter while connected, so
  // every consumer moves to the new account without a reload. Only runs while
  // a session is open: after an in-app disconnect the app stays disconnected
  // even though Freighter itself still reports the account. An empty address
  // (a locked wallet) or an error is ignored rather than treated as a switch.
  useEffect(() => {
    if (!address) return;
    const watcher = new WatchWalletChanges(WALLET_WATCH_INTERVAL_MS);
    watcher.watch(({ address: next, network: net, error: watchError }) => {
      if (watchError || !next) return;
      // Keeps the connected address current so every consumer (badge, role-based
      // controls, stream lists) moves to the new account immediately after a
      // Freighter account switch, instead of acting on the previous one (#403).
      setAddress(next);
      if (net) setNetwork(normalizeNetwork(net));
    });
    return () => watcher.stop();
  }, [address]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setError("Freighter is not installed.");
        return;
      }
      const access = await requestAccess();
      if (access.error || !access.address) {
        setError("Wallet access was denied.");
        return;
      }
      const net = await getNetwork();
      writeDisconnectedFlag(false);
      setAddress(access.address);
      if (!net.error) setNetwork(normalizeNetwork(net.network));
    } catch {
      setError("Failed to connect to Freighter.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    writeDisconnectedFlag(true);
    setAddress(null);
    setNetwork(null);
    setError(null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({ address, network, connecting, error, connect, disconnect }),
    [address, network, connecting, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside a WalletProvider.");
  return wallet;
}
