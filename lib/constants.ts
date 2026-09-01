// Shared numeric constants used across the TricklePay frontend.
// Keeping them in one place makes the tuning surface obvious and avoids
// magic numbers drifting out of sync between production code and tests.

/** Milliseconds per second. Used to convert between JS Date timestamps and Unix timestamps in seconds. */
export const MS_PER_SECOND = 1000;

/** Seconds per minute. */
export const SECONDS_PER_MINUTE = 60;

/** Seconds per hour. */
export const SECONDS_PER_HOUR = 3600;

/** Seconds per day. */
export const SECONDS_PER_DAY = 86400;

/** Background refresh interval for the stream list, in milliseconds. */
export const STREAM_LIST_REFRESH_INTERVAL_MS = 15000;

/** How many times to poll `getTransaction` before giving up on confirmation. */
export const MAX_CONFIRMATION_ATTEMPTS = 30;

/** Delay between transaction confirmation polls, in milliseconds. */
export const CONFIRMATION_POLL_INTERVAL_MS = 1000;

/** Soroban transaction timeout passed to `TransactionBuilder.setTimeout`, in seconds. */
export const TRANSACTION_BUILDER_TIMEOUT_SECONDS = 60;
