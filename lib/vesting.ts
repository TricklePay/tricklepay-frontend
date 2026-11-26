// Linear vesting, mirroring the contract's `vesting.rs` and the backend. Kept
// client-side so a streaming balance can be recomputed every second without
// re-fetching. Amounts are base units of the token and times are Unix seconds, both bigint
// to match the on-chain integer math exactly.

/**
 * Computes the vested amount for a linear vesting stream at a given time.
 * Mirrors the contract's vesting.rs arithmetic.
 *
 * @param totalAmount - Total stream amount in base units
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
 * @param vested - Total vested amount in base units
 * @param withdrawn - Amount already withdrawn in base units
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
 * @param totalAmount - Total stream amount in base units
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

/**
 * Where a stream's cliff falls along its schedule, for marking it on a progress
 * bar.
 *
 * @param startTime - Stream start time, Unix seconds
 * @param endTime - Stream end time, Unix seconds
 * @param cliffTime - Cliff time, Unix seconds
 * @returns The cliff's position in basis points (0 to 10000) of the way from
 *   start to end, truncated down, or null when the stream has no cliff to show:
 *   the cliff is not after the start, or the schedule has no duration. A cliff
 *   past the end is clamped to 10000.
 */
export function cliffPositionBps(
  startTime: bigint,
  endTime: bigint,
  cliffTime: bigint,
): number | null {
  if (cliffTime <= startTime || endTime <= startTime) return null;
  const bps = ((cliffTime - startTime) * 10_000n) / (endTime - startTime);
  return Number(bps > 10_000n ? 10_000n : bps);
}
