import { config } from "@/lib/config";
import { TRANSACTION_BASE_FEE, TX_TIMEOUT_SECONDS } from "@/lib/contract-config";

export const DEFAULT_TOKEN_DECIMALS = 7;

export interface ReadTokenDecimalsOptions {
  /** Bypass any cached lookup failure and re-simulate against RPC immediately. */
  forceRefresh?: boolean;
}

/** How long a failed decimals lookup is cached before retrying RPC (5 minutes). */
export const FAILED_TOKEN_DECIMALS_TTL_MS = 5 * 60 * 1000;

/**
 * Thrown when `readTokenDecimals` skips an RPC call because a recent lookup
 * for the same contract failed within `FAILED_TOKEN_DECIMALS_TTL_MS`.
 */
export class CachedTokenDecimalsError extends Error {
  readonly tokenContractId: string;
  readonly retryAt: number;
  readonly originalError: Error;

  constructor(tokenContractId: string, retryAt: number, originalError: Error) {
    super(
      `Token decimals lookup for ${tokenContractId} recently failed; retry after ${new Date(retryAt).toISOString()}.`,
    );
    this.name = "CachedTokenDecimalsError";
    this.tokenContractId = tokenContractId;
    this.retryAt = retryAt;
    this.originalError = originalError;
  }
}

// A valid source account for unsigned read-only transaction simulations.
const READ_ONLY_SEQUENCE = "0";
const READ_ONLY_SOURCE_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

// In-memory cache for token decimals during the browser session.
const decimalsCache = new Map<string, number>();
const failedDecimalsCache = new Map<string, { expiresAt: number; error: Error }>();
const inFlightRequests = new Map<string, Promise<number>>();

/**
 * Returns the cached decimals for a token contract if already resolved during this session.
 */
export function getCachedTokenDecimals(tokenContractId: string): number | null {
  return decimalsCache.get(tokenContractId.trim()) ?? null;
}

/**
 * Caches token decimals for the session.
 */
export function setCachedTokenDecimals(tokenContractId: string, decimals: number): void {
  const address = tokenContractId.trim();
  failedDecimalsCache.delete(address);
  decimalsCache.set(address, decimals);
}

/**
 * Clears the session cache (primarily for tests).
 */
export function clearTokenDecimalsCache(): void {
  decimalsCache.clear();
  failedDecimalsCache.clear();
  inFlightRequests.clear();
}

/**
 * Reads `decimals()` from a SEP-41 token contract via read-only simulation.
 * Results are cached per token contract for the duration of the session.
 * Failed lookups are cached for `FAILED_TOKEN_DECIMALS_TTL_MS` unless
 * `options.forceRefresh` is set.
 *
 * @throws When the contract call fails or does not implement decimals().
 */
export async function readTokenDecimals(
  tokenContractId: string,
  options?: ReadTokenDecimalsOptions,
): Promise<number> {
  const address = tokenContractId.trim();
  if (!address) {
    throw new Error("Token contract address is required.");
  }

  if (options?.forceRefresh) {
    failedDecimalsCache.delete(address);
  } else {
    const cached = decimalsCache.get(address);
    if (cached !== undefined) {
      return cached;
    }

    const failed = failedDecimalsCache.get(address);
    if (failed) {
      if (Date.now() < failed.expiresAt) {
        throw new CachedTokenDecimalsError(address, failed.expiresAt, failed.error);
      }
      failedDecimalsCache.delete(address);
    }
  }

  const inFlight = inFlightRequests.get(address);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const [{ Account, Contract, rpc, scValToNative, TransactionBuilder }, { server }] =
        await Promise.all([import("@stellar/stellar-sdk"), import("@/lib/contract-network")]);

      const contract = new Contract(address);
      const tx = new TransactionBuilder(new Account(READ_ONLY_SOURCE_ACCOUNT, READ_ONLY_SEQUENCE), {
        fee: TRANSACTION_BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(contract.call("decimals"))
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build();

      const simulation = await server().simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(simulation.error);
      }
      if (!rpc.Api.isSimulationSuccess(simulation)) {
        throw new Error("Token decimals read did not complete.");
      }
      if (!simulation.result) {
        throw new Error("Token decimals read did not return a value.");
      }

      const nativeVal = scValToNative(simulation.result.retval);
      const decimals = Number(nativeVal);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error(`Invalid decimals returned by token contract: ${nativeVal}`);
      }

      failedDecimalsCache.delete(address);
      decimalsCache.set(address, decimals);
      return decimals;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      failedDecimalsCache.set(address, {
        expiresAt: Date.now() + FAILED_TOKEN_DECIMALS_TTL_MS,
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
