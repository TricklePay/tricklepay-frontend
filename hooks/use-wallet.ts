"use client";

// Wallet state now lives in the provider mounted by the root layout. This
// re-export keeps existing import paths working; prefer importing from
// "@/components/wallet-provider" directly.
export { useWallet, type WalletState } from "@/components/wallet-provider";
