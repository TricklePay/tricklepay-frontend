
import { config } from "@/lib/config";
import { simulateRead } from "@/lib/contract-read";
import { nativeAssetContractId } from "@/lib/native-asset";

export interface TokenMetadata {
  name: string;
  symbol: string;
}

export interface ReadTokenMetadataOptions {
  /** Bypass any cached lookup failure and re-simulate against RPC immediately. */
  forceRefresh?: boolean;
}

/** How long a failed metadata lookup is cached before retrying RPC (5 minutes). */
export const FAILED_TOKEN_METADATA_TTL_MS = 5 * 60 * 1000;

/**
 * Thrown when `readTokenMetadata` skips an RPC call because a recent lookup
 * for the same contract failed within `FAILED_TOKEN_METADATA_TTL_MS`.
 */
export class CachedTokenMetadataError extends Error {
  readonly tokenContractId: string;
  readonly retryAt: number;
  readonly originalError: Error;

  constructor(tokenContractId: string, retryAt: number, originalError: Error) {
    super(
      `Token metadata lookup for ${tokenContractId} recently failed; retry after ${new Date(retryAt).toISOString()}.`,
    );
    this.name = "CachedTokenMetadataError";
    this.tokenContractId = tokenContractId;
    this.retryAt = retryAt;
    this.originalError = originalError;
  }
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

// In-memory cache for token metadata during the browser session.
const metadataCache = new Map<string, TokenMetadata>();
const failedMetadataCache = new Map<string, { expiresAt: number; error: Error }>();
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
 * Returns whether a recent failed lookup for this token is still within its TTL.
 */
export function isTokenMetadataFailureCached(tokenContractId: string): boolean {
  const address = tokenContractId.trim();
  const entry = failedMetadataCache.get(address);
  if (!entry) return false;
  if (Date.now() >= entry.expiresAt) {
    failedMetadataCache.delete(address);
    return false;
  }
  return true;
}

/**
 * Caches token metadata for the session.
 */
export function setCachedTokenMetadata(
  tokenContractId: string,
  metadata: TokenMetadata,
): void {
  const address = tokenContractId.trim();
  failedMetadataCache.delete(address);
  metadataCache.set(address, metadata);
  notifyListeners();
}

/**
 * Clears the session cache (primarily for tests).
 */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
  failedMetadataCache.clear();
  inFlightRequests.clear();
  notifyListeners();
}

async function simulateTokenCall(
  address: string,
  method: "symbol" | "name",
): Promise<string> {
  const nativeVal = await simulateRead(address, method);
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
  options?: ReadTokenMetadataOptions,
): Promise<TokenMetadata> {
  const address = tokenContractId.trim();

  if (!address) {
    throw new Error("Token contract address is required.");
  }

  if (options?.forceRefresh) {
    failedMetadataCache.delete(address);
  } else {
    const cached = metadataCache.get(address);
    if (cached) {
      return cached;
    }

    const failed = failedMetadataCache.get(address);
    if (failed) {
      if (Date.now() < failed.expiresAt) {
        throw new CachedTokenMetadataError(address, failed.expiresAt, failed.error);
      }
      failedMetadataCache.delete(address);
    }
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
      failedMetadataCache.delete(address);
      metadataCache.set(address, result);
      notifyListeners();

      return result;
    } catch (err) {
      // The table of known tokens remains as a fallback.
      const fallback = KNOWN_TOKEN_METADATA[address];

      if (fallback) {
        return fallback;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      failedMetadataCache.set(address, {
        expiresAt: Date.now() + FAILED_TOKEN_METADATA_TTL_MS,
        error,
      });

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
