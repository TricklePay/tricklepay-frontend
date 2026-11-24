import { describe, expect, it } from "vitest";

import { vestedAmount, withdrawableAmount } from "@/lib/vesting";
import vectors from "@/test/fixtures/vesting-vectors.json";

// Shared with the backend so the two mirrors of the contract's vesting math
// cannot drift apart. See docs/vesting-vectors.md for where the file comes from
// and how to update it.

interface Vector {
  id: string;
  note: string;
  totalAmount: string;
  startTime: string;
  endTime: string;
  cliffTime: string;
  now: string;
  vested: string;
}

const cases = vectors as Vector[];

describe("vesting vectors", () => {
  it("has vectors to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  describe.each(cases)("$id", (v) => {
    const vested = (): bigint =>
      vestedAmount(
        BigInt(v.totalAmount),
        BigInt(v.startTime),
        BigInt(v.endTime),
        BigInt(v.cliffTime),
        BigInt(v.now),
      );

    it("vestedAmount matches the expected value", () => {
      expect(vested()).toBe(BigInt(v.vested));
    });

    it("withdrawableAmount is the vested amount minus what was withdrawn", () => {
      const expected = BigInt(v.vested);
      expect(withdrawableAmount(vested(), 0n)).toBe(expected);
      expect(withdrawableAmount(vested(), expected / 2n)).toBe(expected - expected / 2n);
      expect(withdrawableAmount(vested(), expected)).toBe(0n);
      expect(withdrawableAmount(vested(), expected + 1n)).toBe(0n);
    });
  });
});
