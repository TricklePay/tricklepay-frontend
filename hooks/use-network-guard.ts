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
 * Checks whether the connected wallet's network matches the app's configured
 * network. This is the last line of defence before signing a transaction,
 * ensuring the user is on the correct network before the contract is invoked.
 * 
 * When the wallet is unreachable or not connected, walletNetwork is null and
 * mismatch is false, allowing the UI to distinguish "no wallet" from "wrong
 * network". Use this hook anywhere a transaction would be built so the UI can
 * refuse before touching the contract.
 * 
 * @returns {NetworkGuard} An object containing:
 *   - mismatch: true when the wallet is on a different network than expected
 *   - walletNetwork: the network the wallet is currently on, or null if unavailable
 *   - expectedNetwork: the network the app is configured for
 */
export function useNetworkGuard(): NetworkGuard {
  const { network: walletNetwork } = useWallet();
  const expectedNetwork = config.network;
  const mismatch = walletNetwork !== null && walletNetwork !== expectedNetwork;
  return { mismatch, walletNetwork, expectedNetwork };
}
