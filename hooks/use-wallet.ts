"use client";

import { useCallback, useEffect, useState } from "react";
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

// Maps Freighter's network label ("TESTNET", "PUBLIC") to the app's lowercase
// names so it can be compared against the configured network.
function normalizeNetwork(network: string): string {
  const lower = network.toLowerCase();
  if (lower.includes("test")) return "testnet";
  if (lower.includes("public")) return "mainnet";
  return lower;
}

export function useWallet(): WalletState {
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

  return { address, network, connecting, error, connect, disconnect };
}
