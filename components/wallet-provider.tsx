"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

export interface WalletState {
  address: string | null;
  network: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

import { normalizeNetwork } from "@/lib/wallet-utils";
export { normalizeNetwork };

const WalletContext = createContext<WalletState | null>(null);

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
export function WalletProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the session on mount if Freighter is already installed and has
  // authorized this app, so a returning user does not have to reconnect.
  useEffect(() => {
    let cancelled = false;
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
      setAddress(access.address);
      if (!net.error) setNetwork(normalizeNetwork(net.network));
    } catch {
      setError("Failed to connect to Freighter.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
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
