// Characters kept from each end of a truncated address: enough to tell
// addresses apart at a glance while fitting cards and table cells.
const ADDRESS_EDGE_LENGTH = 4;

// Unit conversions for the countdowns. Timestamps are Unix seconds; Date works
// in milliseconds.
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

import { getCachedTokenDecimals } from "@/lib/token-decimals";
import {
  getCachedTokenMetadata,
  KNOWN_TOKEN_METADATA,
  type TokenMetadata,
} from "@/lib/token-metadata";

export type { TokenMetadata };

/**
 * Resolves token metadata by contract address.
 *
 * Checks dynamically cached metadata first, falling back to the hard-coded
 * table of known tokens.
 *
 * @param tokenAddress - Stellar contract address of the token
 * @returns Token metadata (name and symbol) if known or cached, otherwise null
 */
export function resolveTokenMetadata(tokenAddress: string): TokenMetadata | null {
  const candidate = tokenAddress.trim();
  if (!candidate) return null;

  const cached = getCachedTokenMetadata(candidate);
  if (cached) {
    return cached;
  }

  return KNOWN_TOKEN_METADATA[candidate] ?? null;
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
 * Formats a base-unit token amount as a decimal string using the token's decimals
 * (defaulting to 7, the Stellar standard).
 *
 * @param raw - Token amount in base units, as a string
 * @param decimals - Token decimal precision (defaults to 7)
 * @returns Decimal string with trailing zeros trimmed (e.g., "1234567" → "0.1234567",
 *   "10000000" → "1"). Truncates fractional digits by division; no rounding applied.
 */
export function formatAmount(raw: string, decimals: number = 7): string {
  const value = BigInt(raw);
  if (decimals === 0) return value.toString();
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Formats an amount with its token symbol when the contract is known. Unknown
 * contracts keep the compact numeric display so cards and table cells remain
 * easy to scan.
 */
export function formatTokenAmount(raw: string, tokenAddress: string, decimals?: number): string {
  const resolvedDecimals = decimals ?? getCachedTokenDecimals(tokenAddress) ?? 7;
  const amount = formatAmount(raw, resolvedDecimals);
  const metadata = resolveTokenMetadata(tokenAddress);
  return metadata ? `${amount} ${metadata.symbol}` : amount;
}

/** Formats a token amount over time, with a symbol whenever it is known. */
export function formatTokenRate(
  raw: string,
  tokenAddress: string,
  period = "day",
  decimals?: number,
): string {
  const resolvedDecimals = decimals ?? getCachedTokenDecimals(tokenAddress) ?? 7;
  const metadata = resolveTokenMetadata(tokenAddress);
  return `${formatAmount(raw, resolvedDecimals)} ${metadata ? metadata.symbol : "tokens"}/${period}`;
}


/**
 * Truncates a Stellar address to a short display form.
 *
 * @param address - Full Stellar address string
 * @returns Truncated address in the form "ABCD...WXYZ" (first 4 and last 4 characters)
 */
export function truncateAddress(address: string): string {
  return `${address.slice(0, ADDRESS_EDGE_LENGTH)}...${address.slice(-ADDRESS_EDGE_LENGTH)}`;
}

export const DEFAULT_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

/**
 * Renders a Unix-second timestamp string with explicit date, time, and timezone options.
 *
 * @param unixSeconds - Unix timestamp in seconds, as a string
 * @param options - Optional Intl.DateTimeFormatOptions to override defaults
 * @param locale - Optional BCP 47 language tag (e.g. "en-US")
 * @returns Formatted date and time string with visible timezone
 */
export function formatTime(
  unixSeconds: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const date = new Date(Number(unixSeconds) * MS_PER_SECOND);
  const opts = { ...DEFAULT_TIME_FORMAT_OPTIONS, ...options };
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

/**
 * The one place a span of time is turned into words, so a countdown and a
 * duration can never phrase the same length differently: days and hours, hours
 * and minutes, or minutes alone (seconds are dropped), and "under a minute"
 * below a minute.
 */
function formatSpan(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "under a minute";
}

/**
 * Returns a short human description of how long until a stream's end time.
 * Exactly `relativeTime(endTimeSeconds, "ends")`, so the list views and the
 * detail page's End countdown always agree.
 *
 * @param endTimeSeconds - Unix timestamp in seconds, as a string
 * @returns Relative time string (e.g., "ends in 2d 3h", "ends in 45m") or
 *   "ended" if the time has passed. Fractional seconds are truncated down.
 */
export function timeRemaining(endTimeSeconds: string): string {
  return relativeTime(endTimeSeconds, "ends");
}

/**
 * Formats a maximum withdrawable amount hint string.
 *
 * @param rawWithdrawable - Withdrawable amount in base units (stroops), as a string
 * @returns Formatted hint message (e.g., "Maximum withdrawable amount: 1.5")
 */
export function formatMaxWithdrawHint(
  rawWithdrawable: string,
  tokenAddress?: string,
  decimals?: number,
): string {
  const formatted = tokenAddress
    ? formatTokenAmount(rawWithdrawable, tokenAddress, decimals)
    : formatAmount(rawWithdrawable, decimals ?? 7);
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

  if (diffMs <= 0) {
    // Build a simple past-tense label.
    if (verb === "ends") return "ended";
    if (verb === "starts") return "started";
    return `${verb} passed`;
  }

  return `${verb} in ${formatSpan(Math.floor(diffMs / MS_PER_SECOND))}`;
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
  return formatSpan(Number(seconds));
}

/**
 * A short "time ago" label for a past instant, e.g. for "Updated {timeAgo(...)}"
 * next to a refresh action. Granularity coarsens with distance so the label
 * stays readable, and never goes negative (a clock briefly behind the
 * timestamp it is measuring reads as "just now", not "-1 seconds ago").
 *
 * @param pastMs - The instant to describe, in epoch milliseconds.
 * @param nowMs - The instant to measure from. Defaults to `Date.now()`; pass
 *   it explicitly to keep a caller's own render consistent with a ticking
 *   clock it already reads from elsewhere (e.g. useNow()).
 *
 * @example
 *   timeAgo(Date.now() - 2_000)       → "just now"
 *   timeAgo(Date.now() - 12_000)      → "12 seconds ago"
 *   timeAgo(Date.now() - 90_000)      → "1 minute ago"
 *   timeAgo(Date.now() - 2 * 3600_000) → "2 hours ago"
 */
export function timeAgo(pastMs: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((nowMs - pastMs) / MS_PER_SECOND));
  const plural = (n: number) => (n === 1 ? "" : "s");

  if (seconds < 5) return "just now";
  if (seconds < SECONDS_PER_MINUTE) return `${seconds} second${plural(seconds)} ago`;

  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < 60) return `${minutes} minute${plural(minutes)} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${plural(hours)} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${plural(days)} ago`;
}
