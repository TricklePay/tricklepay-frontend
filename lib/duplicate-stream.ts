// Builds a create-form draft from an existing stream, shifting the schedule
// to start from now while preserving the duration and cliff offset.
// Pure, so it can be tested without React.

import { EMPTY_FORM_DRAFT } from "@/lib/create-form-draft";
import { nowAsDatetimeLocal } from "@/lib/duration";
import { formatAmount } from "@/lib/format";
import type { FormDraft } from "@/types/form";
import type { StreamView } from "@/types/stream";

/**
 * Builds a create-form draft pre-filled from an existing stream.
 *
 * The recipient, token, and amount are copied directly. The schedule is
 * shifted so the new start is now, the duration is kept the same, and any
 * cliff offset from start is preserved proportionally.
 *
 * @param stream - The stream to duplicate.
 * @param now - Override for "now"; defaults to `new Date()`. Pass a fixed
 *   value in tests for deterministic output.
 * @returns A `FormDraft` ready to be written with `writeFormDraft`.
 */
export function buildDuplicateDraft(stream: StreamView, now: Date = new Date()): FormDraft {
  const start = nowAsDatetimeLocal(now);

  const originalStart = BigInt(stream.startTime);
  const originalEnd = BigInt(stream.endTime);
  const originalCliff = BigInt(stream.cliffTime);
  const durationSeconds = originalEnd - originalStart;

  // Compute end by adding the original duration in seconds to now.
  const durationMs = Number(durationSeconds) * 1000;
  const endDate = new Date(now.getTime() + durationMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const end =
    `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}` +
    `T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

  // Cliff: shift by the same offset from start as the original.
  let cliff = "";
  const cliffOffset = originalCliff - originalStart;
  if (cliffOffset > 0n) {
    const cliffDate = new Date(now.getTime() + Number(cliffOffset) * 1000);
    cliff =
      `${cliffDate.getFullYear()}-${pad(cliffDate.getMonth() + 1)}-${pad(cliffDate.getDate())}` +
      `T${pad(cliffDate.getHours())}:${pad(cliffDate.getMinutes())}`;
  }

  // Duration display in days (best-effort whole-day approximation for the shortcut field).
  const durationDays = Math.round(Number(durationSeconds) / 86400);
  const durationAmount = durationDays > 0 ? String(durationDays) : "";

  return {
    ...EMPTY_FORM_DRAFT,
    recipient: stream.recipient,
    token: stream.token,
    amount: formatAmount(stream.totalAmount),
    start,
    end,
    cliff,
    durationAmount,
    durationUnit: "days",
  };
}
