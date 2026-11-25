import { describe, expect, it } from "vitest";

import { parseDatetimeLocal, projectVesting } from "@/lib/vesting-projection";
import type { StreamView } from "@/types/stream";

// 100-token stream over 100 seconds, no cliff (matching lib/vesting.test.ts).
const TOTAL = 1_000_000_000n; // 100 tokens × 7 decimals
const START = 1_000n;
const END = 1_100n;

function makeStream(overrides: Partial<StreamView> = {}): StreamView {
  return {
    id: "1",
    sender: "GABC",
    recipient: "GDEF",
    token: "CDLZ",
    totalAmount: TOTAL.toString(),
    withdrawn: "0",
    vested: "0",
    withdrawable: "0",
    locked: TOTAL.toString(),
    startTime: START.toString(),
    endTime: END.toString(),
    cliffTime: START.toString(),
    cancelled: false,
    status: "streaming",
    progress: 0,
    ...overrides,
  };
}

describe("projectVesting", () => {
  describe("before the stream starts", () => {
    it("vests nothing before start", () => {
      const result = projectVesting(makeStream(), START - 1n);
      expect(result.vested).toBe(0n);
      expect(result.withdrawable).toBe(0n);
    });

    it("vests nothing at start", () => {
      const result = projectVesting(makeStream(), START);
      expect(result.vested).toBe(0n);
    });
  });

  describe("during the stream", () => {
    it("vests proportionally at midpoint", () => {
      const result = projectVesting(makeStream(), START + 50n);
      expect(result.vested).toBe(TOTAL / 2n);
    });

    it("withdrawable equals vested when nothing withdrawn", () => {
      const result = projectVesting(makeStream(), START + 25n);
      expect(result.withdrawable).toBe(result.vested);
    });

    it("withdrawable is vested minus already withdrawn", () => {
      const stream = makeStream({ withdrawn: "250000000" }); // 25 tokens
      const result = projectVesting(stream, START + 50n);
      expect(result.withdrawable).toBe(result.vested - 250_000_000n);
    });
  });

  describe("after the stream ends", () => {
    it("vests the full amount at end", () => {
      const result = projectVesting(makeStream(), END);
      expect(result.vested).toBe(TOTAL);
    });

    it("vests the full amount well after end", () => {
      const result = projectVesting(makeStream(), END + 1_000_000n);
      expect(result.vested).toBe(TOTAL);
    });
  });

  describe("cliff", () => {
    const CLIFF = START + 30n;
    const streamWithCliff = makeStream({ cliffTime: CLIFF.toString() });

    it("vests nothing before the cliff", () => {
      const result = projectVesting(streamWithCliff, CLIFF - 1n);
      expect(result.vested).toBe(0n);
    });

    it("releases elapsed vesting at the cliff", () => {
      const result = projectVesting(streamWithCliff, CLIFF);
      // 30/100 of total vested immediately at cliff
      expect(result.vested).toBe((TOTAL * 30n) / 100n);
    });

    it("continues linearly after the cliff", () => {
      const result = projectVesting(streamWithCliff, START + 50n);
      expect(result.vested).toBe(TOTAL / 2n);
    });
  });

  describe("mirrors contract examples from vesting.test.ts", () => {
    it("truncates rather than rounds — 10 base units over 3 seconds", () => {
      const stream = makeStream({
        totalAmount: "10",
        startTime: "0",
        endTime: "3",
        cliffTime: "0",
      });
      expect(projectVesting(stream, 1n).vested).toBe(3n);
      expect(projectVesting(stream, 2n).vested).toBe(6n);
      expect(projectVesting(stream, 3n).vested).toBe(10n);
    });

    it("handles amounts beyond Number.MAX_SAFE_INTEGER", () => {
      const huge = 2n ** 90n;
      const stream = makeStream({
        totalAmount: huge.toString(),
        startTime: "0",
        endTime: "100",
        cliffTime: "0",
      });
      expect(projectVesting(stream, 50n).vested).toBe(huge / 2n);
    });
  });
});

describe("projectVesting for a cancelled stream", () => {
  // Cancelled when 30 of the 100 tokens had vested.
  const FROZEN = 300_000_000n;
  const cancelled = makeStream({
    cancelled: true,
    status: "cancelled",
    vested: FROZEN.toString(),
  });

  it("vests nothing before the start", () => {
    expect(projectVesting(cancelled, START - 1n).vested).toBe(0n);
  });

  it("caps mid-stream at the frozen amount", () => {
    expect(projectVesting(cancelled, START + 50n).vested).toBe(FROZEN);
  });

  it("caps after the end at the frozen amount", () => {
    const result = projectVesting(cancelled, END + 1_000n);
    expect(result.vested).toBe(FROZEN);
    expect(result.withdrawable).toBe(FROZEN);
  });
});

describe("parseDatetimeLocal", () => {
  it("returns null for empty input", () => {
    expect(parseDatetimeLocal("")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseDatetimeLocal("not-a-date")).toBeNull();
  });

  it("parses a valid datetime-local string to Unix seconds", () => {
    // "2024-01-01T00:00" parsed as local time; just check it's a bigint
    const result = parseDatetimeLocal("2024-01-01T00:00");
    expect(typeof result).toBe("bigint");
    expect(result).not.toBeNull();
  });
});
