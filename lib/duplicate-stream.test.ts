import { describe, expect, it } from "vitest";

import { buildDuplicateDraft } from "@/lib/duplicate-stream";
import type { StreamView } from "@/types/stream";

// A 100-token stream over 30 days with a 7-day cliff.
const NOW = new Date("2026-01-01T12:00:00.000Z");

const STREAM: StreamView = {
  id: "42",
  sender: "GABC1234SENDER",
  recipient: "GDEF5678RECIPIENT",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: "1000000000", // 100 tokens (7 decimals)
  withdrawn: "0",
  vested: "0",
  withdrawable: "0",
  locked: "1000000000",
  startTime: "1704067200", // 2024-01-01 00:00 UTC
  endTime:   "1706659200", // 2024-01-31 00:00 UTC  (30 days)
  cliffTime: "1704672000", // 2024-01-08 00:00 UTC  (7 days after start)
  cancelled: false,
  status: "completed",
  progress: 10000,
};

describe("buildDuplicateDraft", () => {
  it("copies recipient, token, and amount", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    expect(draft.recipient).toBe(STREAM.recipient);
    expect(draft.token).toBe(STREAM.token);
    expect(draft.amount).toBe("100"); // formatAmount of 1000000000
  });

  it("sets start to now", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    // Should start at NOW in local datetime-local format
    expect(draft.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // The start should correspond to NOW
    const startMs = new Date(draft.start).getTime();
    // Within a minute of now (local parse may vary by timezone offset)
    expect(Math.abs(startMs - NOW.getTime())).toBeLessThan(60_000);
  });

  it("preserves the original duration", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    const originalDurationSec =
      BigInt(STREAM.endTime) - BigInt(STREAM.startTime); // 30 days in seconds
    const newDurationSec =
      BigInt(Math.floor(new Date(draft.end).getTime() / 1000)) -
      BigInt(Math.floor(new Date(draft.start).getTime() / 1000));
    // Within 60 seconds (minute-truncation of datetime-local).
    expect(Math.abs(Number(newDurationSec - originalDurationSec))).toBeLessThan(60);
  });

  it("preserves the cliff offset from start", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    const originalOffset =
      BigInt(STREAM.cliffTime) - BigInt(STREAM.startTime); // 7 days
    const newOffset =
      BigInt(Math.floor(new Date(draft.cliff).getTime() / 1000)) -
      BigInt(Math.floor(new Date(draft.start).getTime() / 1000));
    expect(Math.abs(Number(newOffset - originalOffset))).toBeLessThan(60);
  });

  it("leaves cliff empty when the original has no cliff", () => {
    const noCliffStream: StreamView = {
      ...STREAM,
      cliffTime: STREAM.startTime, // no-cliff convention
    };
    const draft = buildDuplicateDraft(noCliffStream, NOW);
    expect(draft.cliff).toBe("");
  });

  it("sets durationUnit to days", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    expect(draft.durationUnit).toBe("days");
  });

  it("approximates duration in whole days", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    expect(draft.durationAmount).toBe("30");
  });
});
