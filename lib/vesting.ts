// Linear vesting, mirroring the contract's `vesting.rs` and the backend. Kept
// client-side so a streaming balance can be recomputed every second without
// re-fetching. Amounts are base units and times are Unix seconds, both bigint
// to match the on-chain integer math exactly.

export function vestedAmount(
  totalAmount: bigint,
  startTime: bigint,
  endTime: bigint,
  cliffTime: bigint,
  now: bigint,
): bigint {
  if (now < cliffTime || now < startTime) return 0n;
  if (now >= endTime) return totalAmount;
  const elapsed = now - startTime;
  const duration = endTime - startTime;
  return (totalAmount * elapsed) / duration;
}

export function withdrawableAmount(vested: bigint, withdrawn: bigint): bigint {
  const available = vested - withdrawn;
  return available < 0n ? 0n : available;
}

// Average rate the stream releases at across its window, in 7-decimal base
// units per day — the same linear math the contract applies per second,
// scaled up so realistic rates stay human-readable instead of truncating to
// zero. Returns null unless [startTime, endTime) is a valid non-empty range,
// so previews can hide rather than mislead.
export function vestingRatePerDay(
  totalAmount: bigint,
  startTime: bigint,
  endTime: bigint,
): bigint | null {
  if (totalAmount <= 0n || endTime <= startTime) return null;
  return (totalAmount * 86_400n) / (endTime - startTime);
}
