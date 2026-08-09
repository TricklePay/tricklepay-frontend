"use client";

import { useWallet } from "@/components/wallet-provider";
import { config } from "@/lib/config";

function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const wallet = useWallet();

  if (wallet.address) {
    const wrongNetwork = wallet.network !== null && wallet.network !== config.network;
    return (
      <div className="flex items-center gap-3">
        {wrongNetwork && (
          <span className="text-xs text-yellow-400">on {wallet.network}, not {config.network}</span>
        )}
        <button
          onClick={wallet.disconnect}
          title="Disconnect"
          className="rounded border border-neutral-700 px-3 py-1.5 font-mono text-xs text-neutral-200 hover:border-neutral-500"
        >
          {truncate(wallet.address)}
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
