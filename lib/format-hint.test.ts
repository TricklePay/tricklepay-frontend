import { describe, expect, it } from "vitest";
import { formatMaxWithdrawHint } from "@/lib/format";

describe("formatMaxWithdrawHint", () => {
  it("formats base unit amounts into maximum withdrawable hint text", () => {
    expect(formatMaxWithdrawHint("100000000")).toBe("Maximum withdrawable amount: 10");
    expect(formatMaxWithdrawHint("10000000")).toBe("Maximum withdrawable amount: 1");
    expect(formatMaxWithdrawHint("12500000")).toBe("Maximum withdrawable amount: 1.25");
  });

  it("handles zero withdrawable balance", () => {
    expect(formatMaxWithdrawHint("0")).toBe("Maximum withdrawable amount: 0");
  });
});
