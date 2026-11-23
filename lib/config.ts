// Client configuration, read from NEXT_PUBLIC_* variables at build time.
// Next.js inlines those values into the client bundle when the app is built,
// so they are fixed at build time: changing .env.local and restarting a running
// server without rebuilding has no effect. Defaults target testnet against a
// local backend so the app runs with no setup in development.

import { isValidContract } from "@/lib/strkey";

const NETWORK_PASSPHRASES: Record<"testnet" | "mainnet", string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

const DEFAULT_RPC_URLS: Record<"testnet" | "mainnet", string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

type SupportedNetwork = "testnet" | "mainnet";

function readNetwork(): SupportedNetwork {
  const raw = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";
  if (raw !== "testnet" && raw !== "mainnet") {
    throw new Error(
      `Configuration error: NEXT_PUBLIC_NETWORK "${raw}" is not supported. ` +
        'Accepted values are "testnet" and "mainnet".',
    );
  }
  return raw;
}

const network = readNetwork();

// Mock mode serves fixture data from lib/mock-api.ts instead of calling the
// backend, for interface work without the API or a database running.
const mockApi = process.env.NEXT_PUBLIC_MOCK_API === "true";

// Stands in for NEXT_PUBLIC_CONTRACT_ID in mock mode, so the app boots without
// a deployment. It is a well-formed address that no real contract lives at;
// on-chain writes still need a real id.
const MOCK_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

// How long a backend read may run before it is aborted. Long enough that a
// cold backend or a slow connection still succeeds, short enough that an
// unreachable one surfaces as an actionable error instead of a skeleton that
// never resolves. Deployments behind a slower link can raise it; 0 disables
// the timeout entirely.
const DEFAULT_API_TIMEOUT_MS = 10_000;

/**
 * Throws a configuration error if `value` is not a well-formed absolute URL, or
 * if it uses plain http:// for a non-local host. Called once per URL variable at
 * module load so a bad value surfaces as a startup error rather than a runtime
 * TypeError thrown during the first request.
 */
function validateConfigUrl(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Configuration error: ${name} "${value}" is not a valid URL. ` +
      "It must be an absolute URL (for example https://api.example.com).",
    );
  }
  const { hostname, protocol } = parsed;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  if (protocol === "http:" && !isLocal) {
    throw new Error(
      `Configuration error: ${name} "${value}" uses plain http:// for a non-local host. ` +
      "Use https:// for non-local deployments (http:// is accepted only for localhost).",
    );
  }
}

function readApiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  validateConfigUrl(value, "NEXT_PUBLIC_API_URL");
  return value;
}

function readRpcUrl(): string {
  const raw = process.env.NEXT_PUBLIC_RPC_URL;
  if (raw && raw.trim() !== "") {
    const trimmed = raw.trim();
    validateConfigUrl(trimmed, "NEXT_PUBLIC_RPC_URL");
    return trimmed;
  }
  return DEFAULT_RPC_URLS[network];
}

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

function readContractId(): string {
  const raw = process.env.NEXT_PUBLIC_CONTRACT_ID;
  if (raw !== undefined) {
    const trimmed = raw.trim();
    if (trimmed !== "") return trimmed;
  }
  return mockApi ? MOCK_CONTRACT_ID : "";
}

export const config = {
  /** Base URL of the tricklepay-backend read API. */
  apiUrl: readApiUrl(),
  /**
   * Stellar network name: `"testnet"` or `"mainnet"`.
   *
   * Used as the second argument to `txExplorerUrl()` in `lib/explorer.ts`,
   * which maps it to the correct Stellar Expert path segment. See that file
   * for the full mapping and instructions for adding a new network.
   */
  network,
  /** Passphrase for the selected network, used when signing transactions. */
  networkPassphrase: NETWORK_PASSPHRASES[network],
  /** Soroban RPC endpoint, used to submit signed transactions. */
  rpcUrl: readRpcUrl(),
  /** Deployed stream contract id (starts with C). */
  contractId: readContractId(),
  /** Serve fixture data instead of calling the backend (NEXT_PUBLIC_MOCK_API=true). */
  mockApi,
  /**
   * Milliseconds a backend read API request may take before it is aborted.
   * 0 means no timeout. Applies to lib/api.ts only — on-chain transactions
   * have their own confirmation polling budget in lib/contract-config.ts.
   */
  apiTimeoutMs: readApiTimeout(),
};

// Validate contractId at module load so a missing or malformed value surfaces
// immediately as a clear configuration error rather than an opaque SDK error
// at the first transaction. During static prerendering / build, a missing variable
// is handled safely without throwing so page prerendering succeeds.
const contractId = config.contractId;
const isBuildWorker = Boolean(
  process.env.NEXT_PRIVATE_BUILD_WORKER ||
  process.env.IS_NEXT_WORKER ||
  process.env.NEXT_PHASE === "phase-production-build"
);

if (!contractId) {
  if (!isBuildWorker) {
    throw new Error(
      "Configuration error: NEXT_PUBLIC_CONTRACT_ID is not set. " +
      "Add it to your .env file (it starts with C).",
    );
  }
} else if (!isValidContract(contractId)) {
  throw new Error(
    `Configuration error: NEXT_PUBLIC_CONTRACT_ID "${contractId}" is not a valid Stellar contract address. ` +
    "It must be a 56-character string starting with C.",
  );
}

export type AppConfig = typeof config;
