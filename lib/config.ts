// Client configuration, read from NEXT_PUBLIC_* variables at build time.
// Defaults target testnet against a local backend so the app runs with no setup
// in development.

import { StrKey } from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

const DEFAULT_RPC_URLS: Record<string, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

const network = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

// How long a backend read may run before it is aborted. Long enough that a
// cold backend or a slow connection still succeeds, short enough that an
// unreachable one surfaces as an actionable error instead of a skeleton that
// never resolves. Deployments behind a slower link can raise it; 0 disables
// the timeout entirely.
const DEFAULT_API_TIMEOUT_MS = 10_000;

// Parsed eagerly so a typo in the variable is a startup error naming the
// variable, not a silent fallback that quietly ignores the operator's intent.
function readApiTimeout(): number {
  const raw = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_API_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Configuration error: NEXT_PUBLIC_API_TIMEOUT_MS "${raw}" is not valid. ` +
      "It must be a whole number of milliseconds (0 disables the timeout).",
    );
  }
  return parsed;
}

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
  /**
   * Milliseconds a backend read API request may take before it is aborted.
   * 0 means no timeout. Applies to lib/api.ts only — on-chain transactions
   * have their own confirmation polling budget in lib/contract.ts.
   */
  apiTimeoutMs: readApiTimeout(),
};

// Validate contractId at module load so a missing or malformed value surfaces
// immediately as a clear configuration error rather than an opaque SDK error
// at the first transaction.
const contractId = config.contractId;
if (!contractId) {
  throw new Error(
    "Configuration error: NEXT_PUBLIC_CONTRACT_ID is not set. " +
    "Add it to your .env file (it starts with C).",
  );
}
if (!StrKey.isValidContract(contractId)) {
  throw new Error(
    `Configuration error: NEXT_PUBLIC_CONTRACT_ID "${contractId}" is not a valid Stellar contract address. ` +
    "It must be a 56-character string starting with C.",
  );
}

export type AppConfig = typeof config;
