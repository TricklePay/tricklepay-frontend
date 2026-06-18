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
