
import { config } from "@/lib/config";
import { TRANSACTION_BASE_FEE, TX_TIMEOUT_SECONDS } from "@/lib/contract-config";
import { nativeAssetContractId } from "@/lib/native-asset";

export interface TokenMetadata {
  name: string;
  symbol: string;
}

// Known token contracts used in the app and its fixtures as fallback.
export const KNOWN_TOKEN_METADATA: Record<string, TokenMetadata> = {
  // Native XLM token, derived from network passphrase.
  // This ensures the native asset displays correctly as XLM.
  [nativeAssetContractId(config.networkPassphrase)]: {
    name: "Stellar Lumen",
    symbol: "XLM",
  },
};

// A valid source account for unsigned read-only transaction simulations.
const READ_ONLY_SEQUENCE = "0";
const READ_ONLY_SOURCE_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

// In-memory cache for token metadata during the browser session.
const metadataCache = new Map<string, TokenMetadata>();
const inFlightRequests = new Map<string, Promise<TokenMetadata>>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Subscribes a listener to cache updates.
 */
export function subscribeTokenMetadata(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns the cached metadata for a token contract if already resolved during this session.
 */
export function getCachedTokenMetadata(tokenContractId: string): TokenMetadata | null {
  return metadataCache.get(tokenContractId.trim()) ?? null;
}

/**
 * Caches token metadata for the session.
 */
export function setCachedTokenMetadata(
  tokenContractId: string,
  metadata: TokenMetadata,
): void {
  metadataCache.set(tokenContractId.trim(), metadata);
  notifyListeners();
}

/**
 * Clears the session cache (primarily for tests).
 */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
  inFlightRequests.clear();
  notifyListeners();
}

async function simulateTokenCall(
  address: string,
  method: "symbol" | "name",
): Promise<string> {
  const [{ Account, Contract, rpc, scValToNative, TransactionBuilder }, { server }] =
    await Promise.all([import("@stellar/stellar-sdk"), import("@/lib/contract-network")]);

  const contract = new Contract(address);
  const tx = new TransactionBuilder(
    new Account(READ_ONLY_SOURCE_ACCOUNT, READ_ONLY_SEQUENCE),
    {
      fee: TRANSACTION_BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    },
  )
    .addOperation(contract.call(method))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const simulation = await server().simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error(`Token ${method} read did not complete.`);
  }

  if (!simulation.result) {
    throw new Error(`Token ${method} read did not return a value.`);
  }

  const nativeVal = scValToNative(simulation.result.retval);
  return typeof nativeVal === "string" ? nativeVal : String(nativeVal ?? "");
}

/**
 * Reads `symbol()` and `name()` from a SEP-41 token contract via read-only simulation.
 * Results are cached per token contract for the duration of the session.
 *
 * Unknown tokens are resolved once through read-only simulation.
 * The table of known tokens remains as a fallback.
 *
 * @throws When the contract call fails and is not in the fallback table.
 */
export async function readTokenMetadata(
  tokenContractId: string,
): Promise<TokenMetadata> {
  const address = tokenContractId.trim();

  if (!address) {
    throw new Error("Token contract address is required.");
  }

  const cached = metadataCache.get(address);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightRequests.get(address);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const symbol = await simulateTokenCall(address, "symbol");

      if (!symbol) {
        throw new Error("Token did not return a valid symbol.");
      }

      let name = symbol;

      try {
        const nameVal = await simulateTokenCall(address, "name");
        if (nameVal) name = nameVal;
      } catch {
        // SEP-41 tokens may omit name or fail name(), fallback to symbol.
      }

      const result: TokenMetadata = { symbol, name };
      metadataCache.set(address, result);
      notifyListeners();

      return result;
    } catch (err) {
      // The table of known tokens remains as a fallback.
      const fallback = KNOWN_TOKEN_METADATA[address];

      if (fallback) {
        return fallback;
      }

      throw err;
    }
  })();

  inFlightRequests.set(address, promise);

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(address);
  }
}
