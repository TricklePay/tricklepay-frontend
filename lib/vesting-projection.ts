// Projection calculator: given a stream and a chosen datetime, compute the
// vested and withdrawable amounts at that instant. Pure, so it can be tested
// without React. Uses the same integer arithmetic as lib/vesting.ts.

import { vestedAmount, withdrawableAmount } from "@/lib/vesting";
import type { StreamView } from "@/types/stream";

export interface VestingProjection {
  /** Chosen time as Unix seconds. */
  atTime: bigint;
  /** Vested amount in base units at that time. */
  vested: bigint;
  /** Withdrawable amount (vested − withdrawn) in base units at that time. */
  withdrawable: bigint;
}

/**
 * Projects a stream's vested and withdrawable amounts at a chosen instant.
 *
 * Handles all edge cases the same way the contract does:
 * - Before start (or before cliff): vested = 0.
 * - After end: vested = totalAmount.
 * - During the stream: linearly interpolated.
 * - Cancelled stream: never above the frozen `vested` amount, since a
 *   cancelled stream stops vesting at cancellation.
 *
 * @param stream  The stream to project.
 * @param atTime  The chosen instant as Unix seconds (bigint).
 * @returns Projected vested and withdrawable amounts.
 */
export function projectVesting(stream: StreamView, atTime: bigint): VestingProjection {
  const totalAmount = BigInt(stream.totalAmount);
  const startTime = BigInt(stream.startTime);
  const endTime = BigInt(stream.endTime);
  const cliffTime = BigInt(stream.cliffTime);
  const withdrawn = BigInt(stream.withdrawn);

  let vested = vestedAmount(totalAmount, startTime, endTime, cliffTime, atTime);
  if (stream.status === "cancelled" || stream.cancelled) {
    const frozen = BigInt(stream.vested);
    if (vested > frozen) vested = frozen;
  }
  const withdrawable = withdrawableAmount(vested, withdrawn);

  return { atTime, vested, withdrawable };
}

/**
 * Parses a `datetime-local` string into Unix seconds, or returns null when
 * the input is empty or unparseable.
 */
export function parseDatetimeLocal(local: string): bigint | null {
  if (!local) return null;
  const ms = new Date(local).getTime();
  if (Number.isNaN(ms)) return null;
  return BigInt(Math.floor(ms / 1000));
}
