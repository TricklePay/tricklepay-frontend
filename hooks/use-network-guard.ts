"use client";

import { useWallet } from "@/components/wallet-provider";
import { config } from "@/lib/config";

export interface NetworkGuard {
  /** True when the wallet is connected on the wrong network. */
  mismatch: boolean;
  /** The network the wallet is currently on, or null when not connected. */
  walletNetwork: string | null;
  /** The network the app is configured for. */
  expectedNetwork: string;
}

/**
 * Returns whether the connected wallet's network matches the app's configured
 * network. Use this hook anywhere a transaction would be built so the UI can
 * refuse before touching the contract.
 */
export function useNetworkGuard(): NetworkGuard {
  const { network: walletNetwork } = useWallet();
  const expectedNetwork = config.network;
  const mismatch = walletNetwork !== null && walletNetwork !== expectedNetwork;
  return { mismatch, walletNetwork, expectedNetwork };
}
