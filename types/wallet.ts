// The connected wallet's public state, as exposed by useWallet()
// (components/wallet-provider.tsx).

export interface WalletState {
  address: string | null;
  network: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}
