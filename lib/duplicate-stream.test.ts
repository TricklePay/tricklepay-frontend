import { describe, expect, it } from "vitest";

import { buildDuplicateDraft } from "@/lib/duplicate-stream";
import { setCachedTokenDecimals } from "@/lib/token-decimals";
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

  it("sets durationUnit to days when the duration divides evenly", () => {
    const draft = buildDuplicateDraft(STREAM, NOW);
    expect(draft.durationUnit).toBe("days");
    expect(draft.durationAmount).toBe("30");
  });

  it("uses hours when the duration is 36 hours", () => {
    const stream36h: StreamView = {
      ...STREAM,
      startTime: "1704067200", // 2024-01-01 00:00 UTC
      endTime: "1704196800",   // 2024-01-02 12:00 UTC (36 hours later)
    };
    const draft = buildDuplicateDraft(stream36h, NOW);
    expect(draft.durationUnit).toBe("hours");
    expect(draft.durationAmount).toBe("36");
  });

  it("uses minutes when the duration is 90 minutes", () => {
    const stream90m: StreamView = {
      ...STREAM,
      startTime: "1704067200", // 2024-01-01 00:00 UTC
      endTime: "1704072600",   // 2024-01-01 01:30 UTC (90 minutes later)
    };
    const draft = buildDuplicateDraft(stream90m, NOW);
    expect(draft.durationUnit).toBe("minutes");
    expect(draft.durationAmount).toBe("90");
  });

  it("uses days when the duration is 5 days", () => {
    const stream5d: StreamView = {
      ...STREAM,
      startTime: "1704067200", // 2024-01-01 00:00 UTC
      endTime: "1704499200",   // 2024-01-06 00:00 UTC (5 days later)
    };
    const draft = buildDuplicateDraft(stream5d, NOW);
    expect(draft.durationUnit).toBe("days");
    expect(draft.durationAmount).toBe("5");
  });

  it("leaves durationAmount empty when no unit divides evenly", () => {
    const streamOdd: StreamView = {
      ...STREAM,
      startTime: "1704067200", // 2024-01-01 00:00 UTC
      endTime: "1704067245",   // 2024-01-01 00:00:45 UTC (45 seconds later)
    };
    const draft = buildDuplicateDraft(streamOdd, NOW);
    expect(draft.durationAmount).toBe("");
    // The end field still holds the exact end time
    expect(draft.end).toBeTruthy();
  });

  it("formats amount with token decimals when cached", () => {
    const SIX_DECIMAL_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    setCachedTokenDecimals(SIX_DECIMAL_TOKEN, 6);
    
    const sixDecimalStream: StreamView = {
      ...STREAM,
      token: SIX_DECIMAL_TOKEN,
      totalAmount: "123456789", // 123.456789 with 6 decimals
    };
    
    const draft = buildDuplicateDraft(sixDecimalStream, NOW);
    // With 6 decimals: 123456789 / 10^6 = 123.456789
    expect(draft.amount).toBe("123.456789");
  });

  it("falls back to 7 decimals when token decimals are unknown", () => {
    const UNKNOWN_TOKEN = "CUNKNOWNTOKEN1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123";
    const unknownTokenStream: StreamView = {
      ...STREAM,
      token: UNKNOWN_TOKEN,
      totalAmount: "1000000000", // 100 tokens with 7 decimals
    };
    
    const draft = buildDuplicateDraft(unknownTokenStream, NOW);
    // Falls back to 7 decimals: 1000000000 / 10^7 = 100
    expect(draft.amount).toBe("100");
  });
});
