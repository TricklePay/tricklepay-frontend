// Linear vesting, mirroring the contract's `vesting.rs` and the backend. Kept
// client-side so a streaming balance can be recomputed every second without
// re-fetching. Amounts are base units and times are Unix seconds, both bigint
// to match the on-chain integer math exactly.

/**
 * Computes the vested amount for a linear vesting stream at a given time.
 * Mirrors the contract's vesting.rs arithmetic.
 *
 * @param totalAmount - Total stream amount in base units (stroops)
 * @param startTime - Stream start time, Unix seconds
 * @param endTime - Stream end time, Unix seconds
 * @param cliffTime - Cliff time, Unix seconds (no vesting occurs before this)
 * @param now - Current time, Unix seconds
 * @returns Vested amount in base units. Returns 0 before cliff/start, totalAmount
 *   after end, and a linearly interpolated value during the vesting period.
 *   Division truncates down (no rounding).
 */
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

/**
 * Computes the withdrawable balance from a vested amount.
 * Mirrors the contract's withdrawal arithmetic.
 *
 * @param vested - Total vested amount in base units (stroops)
 * @param withdrawn - Amount already withdrawn in base units (stroops)
 * @returns Withdrawable amount in base units, clamped to 0 if already fully withdrawn.
 *   No rounding; uses exact integer subtraction.
 */
export function withdrawableAmount(vested: bigint, withdrawn: bigint): bigint {
  const available = vested - withdrawn;
  return available < 0n ? 0n : available;
}

/**
 * Computes the average vesting rate per day for a stream.
 * Mirrors the contract's per-second linear vesting, scaled to per-day for display.
 *
 * @param totalAmount - Total stream amount in base units (stroops)
 * @param startTime - Stream start time, Unix seconds
 * @param endTime - Stream end time, Unix seconds
 * @returns Rate in base units per day, or null if the input defines an invalid or
 *   zero-duration range. Division truncates down (no rounding).
 */
export function vestingRatePerDay(
  totalAmount: bigint,
  startTime: bigint,
  endTime: bigint,
): bigint | null {
  if (totalAmount <= 0n || endTime <= startTime) return null;
  return (totalAmount * 86_400n) / (endTime - startTime);
}
