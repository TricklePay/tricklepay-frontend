// Client configuration, read from NEXT_PUBLIC_* variables at build time.
// Defaults target testnet against a local backend so the app runs with no setup
// in development.

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

const DEFAULT_RPC_URLS: Record<string, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

const network = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

export const config = {
  /** Base URL of the tricklepay-backend read API. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  /** Stellar network name: testnet or mainnet. */
  network,
  /** Passphrase for the selected network, used when signing transactions. */
  networkPassphrase: NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES.testnet,
  /** Soroban RPC endpoint, used to submit signed transactions. */
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URLS[network] ?? DEFAULT_RPC_URLS.testnet,
  /** Deployed stream contract id (starts with C). */
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? "",
};

export type AppConfig = typeof config;
