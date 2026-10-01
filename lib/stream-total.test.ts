import { describe, expect, it } from "vitest";

import type { StreamView } from "@/types/stream";

import { computeStreamTotals, formatStreamsTotal } from "./stream-total";

const USDC_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const UNKNOWN_TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

function makeStream(overrides: Partial<StreamView> = {}): StreamView {
  return {
    id: "1",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: USDC_TOKEN,
    totalAmount: "10000000", // 1 USDC (7 decimals)
    withdrawn: "0",
    vested: "0",
    withdrawable: "0",
    locked: "10000000",
    startTime: "1000",
    endTime: "2000",
    cliffTime: "1000",
    cancelled: false,
    status: "streaming",
    progress: 0,
    ...overrides,
  };
}

describe("stream-total", () => {
  describe("computeStreamTotals", () => {
    it("returns empty array when given an empty stream list", () => {
      expect(computeStreamTotals([])).toEqual([]);
    });

    it("aggregates multiple streams with the same token", () => {
      const streams = [
        makeStream({ totalAmount: "10000000" }), // 1 USDC
        makeStream({ totalAmount: "25000000" }), // 2.5 USDC
      ];

      const totals = computeStreamTotals(streams);
      expect(totals).toHaveLength(1);
      expect(totals[0].token).toBe(USDC_TOKEN);
      expect(totals[0].total).toBe(35000000n);
      expect(totals[0].formatted).toBe("3.5 USDC");
    });

    it("aggregates streams with different tokens separately", () => {
      const streams = [
        makeStream({ token: USDC_TOKEN, totalAmount: "10000000" }), // 1 USDC
        makeStream({ token: UNKNOWN_TOKEN, totalAmount: "50000000" }), // 5 (unknown)
      ];

      const totals = computeStreamTotals(streams);
      expect(totals).toHaveLength(2);
      expect(totals.find((t) => t.token === USDC_TOKEN)?.formatted).toBe("1 USDC");
      expect(totals.find((t) => t.token === UNKNOWN_TOKEN)?.formatted).toBe("5");
    });

    it("safely ignores malformed or missing totalAmount values", () => {
      const streams = [
        makeStream({ totalAmount: "10000000" }),
        makeStream({ totalAmount: undefined as unknown as string }),
        makeStream({ totalAmount: "invalid" }),
        makeStream({ totalAmount: "0" }),
      ];

      const totals = computeStreamTotals(streams);
      expect(totals).toHaveLength(1);
      expect(totals[0].formatted).toBe("1 USDC");
    });
  });

  describe("formatStreamsTotal", () => {
    it("returns '0' when no streams are provided", () => {
      expect(formatStreamsTotal([])).toBe("0");
    });

    it("formats a single stream total with its token symbol", () => {
      const streams = [makeStream({ totalAmount: "50000000" })]; // 5 USDC
      expect(formatStreamsTotal(streams)).toBe("5 USDC");
    });

    it("formats sum of multiple streams of same token", () => {
      const streams = [
        makeStream({ totalAmount: "50000000" }),  // 5 USDC
        makeStream({ totalAmount: "150000000" }), // 15 USDC
      ];
      expect(formatStreamsTotal(streams)).toBe("20 USDC");
    });

    it("formats multi-token totals as comma-separated list", () => {
      const streams = [
        makeStream({ token: USDC_TOKEN, totalAmount: "10000000" }),
        makeStream({ token: UNKNOWN_TOKEN, totalAmount: "20000000" }),
      ];
      expect(formatStreamsTotal(streams)).toBe("1 USDC, 2");
    });
  });
});
