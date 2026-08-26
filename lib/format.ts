const STROOP_DECIMALS = 7n;

// Formats a base-unit token amount (7 decimals, the Stellar standard) as a
// decimal string with trailing zeros trimmed.
export function formatAmount(raw: string): string {
  const value = BigInt(raw);
  const base = 10n ** STROOP_DECIMALS;
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Renders a Unix-second timestamp string as a local date and time.
export function formatTime(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

// A short human description of how long until a stream's end time, given a Unix
// second timestamp as a string. Returns "ended" once the time has passed.
export function timeRemaining(endTimeSeconds: string): string {
  const diffMs = Number(endTimeSeconds) * 1000 - Date.now();
  if (diffMs <= 0) return "ended";

  const seconds = Math.floor(diffMs / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `ends in ${days}d ${hours}h`;
  if (hours > 0) return `ends in ${hours}h ${minutes}m`;
  if (minutes > 0) return `ends in ${minutes}m`;
  return "ends in under a minute";
}

// Formats a maximum withdrawable amount hint string.
export function formatMaxWithdrawHint(rawWithdrawable: string): string {
  const formatted = formatAmount(rawWithdrawable);
  return `Maximum withdrawable amount: ${formatted}`;
}

// A short human description of a duration in seconds, matching timeRemaining's
// phrasing ("2d 3h", "45m", "under a minute"). Returns null for zero or
// negative spans so callers can hide the value instead of showing something
// misleading.
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
