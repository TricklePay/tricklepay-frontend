"use client";

import { useWallet } from "@/components/wallet-provider";
import { useNetworkGuard } from "@/hooks/use-network-guard";

function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const wallet = useWallet();
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();

  if (wallet.address) {
    return (
      <div className="flex items-center gap-3">
        {mismatch && (
          <span
            role="alert"
            className="rounded border border-red-700 bg-red-950/60 px-2.5 py-1 text-xs font-medium text-red-300"
          >
            Wrong network: wallet is on{" "}
            <strong className="font-semibold">{walletNetwork}</strong>, app expects{" "}
            <strong className="font-semibold">{expectedNetwork}</strong>. Switch networks in
            Freighter to sign transactions.
          </span>
        )}
        {/* Address badge — read-only, shows the connected account */}
        <span className="rounded border border-neutral-700 px-3 py-1.5 font-mono text-xs text-neutral-400">
          {truncate(wallet.address)}
        </span>
        {/* Explicit disconnect button */}
        <button
          onClick={wallet.disconnect}
          title={`Disconnect ${truncate(wallet.address)}`}
          aria-label={`Disconnect wallet ${wallet.address}`}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-red-700 hover:bg-red-950/40 hover:text-red-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void wallet.connect()}
        disabled={wallet.connecting}
        className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 disabled:opacity-50"
      >
        {wallet.connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {wallet.error && <span className="text-xs text-red-400">{wallet.error}</span>}
    </div>
  );
}
