import {
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
} from "@/lib/constants";


const STROOP_DECIMALS = 7n;

export interface TokenMetadata {
  name: string;
  symbol: string;
}

const TOKEN_METADATA: Record<string, TokenMetadata> = {
  // Known token contracts used in the app and its fixtures.
  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: {
    name: "USD Coin",
    symbol: "USDC",
  },
};

/**
 * Resolves token metadata by contract address.
 *
 * @param tokenAddress - Stellar contract address of the token
 * @returns Token metadata (name and symbol) if known, otherwise null
 */
export function resolveTokenMetadata(tokenAddress: string): TokenMetadata | null {
  const candidate = tokenAddress.trim();
  if (!candidate) return null;

  return TOKEN_METADATA[candidate] ?? null;
}

/**
 * Formats a token contract address for display.
 *
 * @param tokenAddress - Stellar contract address of the token
 * @returns Token symbol if the address is recognized, otherwise a truncated
 *   address in the form "ABCD...WXYZ"
 */
export function formatTokenDisplay(tokenAddress: string): string {
  const metadata = resolveTokenMetadata(tokenAddress);
  if (metadata) {
    return metadata.symbol;
  }

  return truncateAddress(tokenAddress);
}

/**
 * Formats a base-unit token amount (7 decimals, the Stellar standard) as a
 * decimal string.
 *
 * @param raw - Token amount in base units (stroops), as a string
 * @returns Decimal string with trailing zeros trimmed (e.g., "1234567" → "0.1234567",
 *   "10000000" → "1"). Truncates fractional digits by division; no rounding applied.
 */
export function formatAmount(raw: string): string {
  const value = BigInt(raw);
  const base = 10n ** STROOP_DECIMALS;
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Truncates a Stellar address to a short display form.
 *
 * @param address - Full Stellar address string
 * @returns Truncated address in the form "ABCD...WXYZ" (first 4 and last 4 characters)
 */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Renders a Unix-second timestamp string as a local date and time.
 *
 * @param unixSeconds - Unix timestamp in seconds, as a string
 * @returns Localized date and time string (format depends on user's locale)
 */
export function formatTime(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * MS_PER_SECOND).toLocaleString();
}

/**
 * Returns a short human description of how long until a stream's end time.
 *
 * @param endTimeSeconds - Unix timestamp in seconds, as a string
 * @returns Relative time string (e.g., "ends in 2d 3h", "ends in 45m") or
 *   "ended" if the time has passed. Fractional seconds are truncated down.
 */
export function timeRemaining(endTimeSeconds: string): string {
  const diffMs = Number(endTimeSeconds) * MS_PER_SECOND - Date.now();
  if (diffMs <= 0) return "ended";

  const seconds = Math.floor(diffMs / MS_PER_SECOND);
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) return `ends in ${days}d ${hours}h`;
  if (hours > 0) return `ends in ${hours}h ${minutes}m`;
  if (minutes > 0) return `ends in ${minutes}m`;
  return "ends in under a minute";
}

/**
 * Formats a maximum withdrawable amount hint string.
 *
 * @param rawWithdrawable - Withdrawable amount in base units (stroops), as a string
 * @returns Formatted hint message (e.g., "Maximum withdrawable amount: 1.5")
 */
export function formatMaxWithdrawHint(rawWithdrawable: string): string {
  const formatted = formatAmount(rawWithdrawable);
  return `Maximum withdrawable amount: ${formatted}`;
}

/**
 * Returns a relative countdown string for any Unix-second timestamp, labelled
 * by the caller-supplied verb.
 *
 * @param unixSeconds - Unix timestamp in seconds, as a string
 * @param verb - Action verb to label the countdown (e.g., "starts", "ends", "cliff")
 * @returns Relative time string with verb (e.g., "starts in 2d 3h", "ended").
 *   For past times, derives past tense automatically: verbs ending in "s" become
 *   "started"/"ended"; others get " passed" appended. Fractional seconds are
 *   truncated down.
 *
 * @example
 *   relativeTime("1234567890", "starts") → "starts in 2d 3h"
 *   relativeTime("1234567890", "ends")   → "ended"   (past)
 *   relativeTime("1234567890", "cliff")  → "cliff in 45m"
 */
export function relativeTime(unixSeconds: string, verb: string): string {
  const diffMs = Number(unixSeconds) * MS_PER_SECOND - Date.now();
  const seconds = Math.floor(Math.abs(diffMs) / MS_PER_SECOND);
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (diffMs <= 0) {
    // Build a simple past-tense label.
    if (verb === "ends") return "ended";
    if (verb === "starts") return "started";
    return `${verb} passed`;
  }

  let span: string;
  if (days > 0) span = `${days}d ${hours}h`;
  else if (hours > 0) span = `${hours}h ${minutes}m`;
  else if (minutes > 0) span = `${minutes}m`;
  else span = "under a minute";

  return `${verb} in ${span}`;
}

/**
 * Returns a short human description of a duration in seconds.
 *
 * @param seconds - Duration in seconds, as a bigint
 * @returns Formatted duration string (e.g., "2d 3h", "45m", "under a minute") or
 *   null for zero or negative durations. Fractional units are truncated down.
 */
export function formatDuration(seconds: bigint): string | null {
  if (seconds <= 0n) return null;

  const days = seconds / 86_400n;
  const hours = (seconds % 86_400n) / 3_600n;
  const minutes = (seconds % 3_600n) / 60n;

  if (days > 0n) return `${days}d ${hours}h`;
  if (hours > 0n) return `${hours}h ${minutes}m`;
  if (minutes > 0n) return `${minutes}m`;
  return "under a minute";
}
