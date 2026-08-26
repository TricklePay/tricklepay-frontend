import { describe, expect, it } from "vitest";
import { parseHumanAmount, withdrawalAmountError } from "@/lib/amount";

// 10 tokens of withdrawable balance, in 7-decimal base units.
const WITHDRAWABLE = 100_000_000n;

describe("parseHumanAmount", () => {
  it("parses whole and fractional amounts into base units", () => {
    expect(parseHumanAmount("1")).toBe(10_000_000n);
    expect(parseHumanAmount("12.5")).toBe(125_000_000n);
    expect(parseHumanAmount("0.0000001")).toBe(1n);
    expect(parseHumanAmount(" 7 ")).toBe(70_000_000n);
  });

  it("pads short fractions rather than truncating", () => {
    expect(parseHumanAmount("1.25")).toBe(12_500_000n);
  });

  it("rejects an empty amount", () => {
    expect(() => parseHumanAmount("")).toThrow("Enter an amount.");
    expect(() => parseHumanAmount("   ")).toThrow("Enter an amount.");
  });

  it("rejects negative amounts", () => {
    expect(() => parseHumanAmount("-5")).toThrow("Amount cannot be negative.");
    expect(() => parseHumanAmount("-0.01")).toThrow("Amount cannot be negative.");
  });

  it("rejects non-numeric and malformed values", () => {
    for (const bad of ["abc", "1e5", "1.2.3", "12,", "+5", "0x10", "5%"]) {
      expect(() => parseHumanAmount(bad)).toThrow("Enter a valid amount (e.g. 12.5).");
    }
  });

  it("rejects excess precision beyond 7 decimal places", () => {
    expect(() => parseHumanAmount("1.12345678")).toThrow(
      "Amount cannot have more than 7 decimal places.",
    );
    expect(parseHumanAmount("1.1234567")).toBe(11_234_567n);
  });
});

describe("withdrawalAmountError", () => {
  it("accepts a valid partial amount", () => {
    expect(withdrawalAmountError("10", WITHDRAWABLE)).toBeNull();
    expect(withdrawalAmountError("0.5", WITHDRAWABLE)).toBeNull();
    expect(withdrawalAmountError("9.9999999", WITHDRAWABLE)).toBeNull();
  });

  it("accepts the exact withdrawable balance", () => {
    expect(withdrawalAmountError("10", WITHDRAWABLE)).toBeNull();
  });

  it("reports zero amounts", () => {
    expect(withdrawalAmountError("0", WITHDRAWABLE)).toBe("Amount must be greater than zero.");
    expect(withdrawalAmountError("0.0000000", WITHDRAWABLE)).toBe(
      "Amount must be greater than zero.",
    );
  });

  it("reports negative amounts", () => {
    expect(withdrawalAmountError("-3", WITHDRAWABLE)).toBe("Amount cannot be negative.");
  });

  it("reports empty and malformed input", () => {
    expect(withdrawalAmountError("", WITHDRAWABLE)).toBe("Enter an amount.");
    expect(withdrawalAmountError("abc", WITHDRAWABLE)).toBe("Enter a valid amount (e.g. 12.5).");
    expect(withdrawalAmountError("1.2.3", WITHDRAWABLE)).toBe("Enter a valid amount (e.g. 12.5).");
  });

  it("reports amounts above the withdrawable balance with the limit", () => {
    expect(withdrawalAmountError("10.0000001", WITHDRAWABLE)).toBe(
      "Amount exceeds withdrawable balance (10).",
    );
    expect(withdrawalAmountError("99", WITHDRAWABLE)).toBe(
      "Amount exceeds withdrawable balance (10).",
    );
  });

  it("reports excess precision before the balance check", () => {
    expect(withdrawalAmountError("20.000000001", WITHDRAWABLE)).toBe(
      "Amount cannot have more than 7 decimal places.",
    );
  });

  it("formats the withdrawable figure to seven decimals", () => {
    expect(withdrawalAmountError("1", 1234567n)).toBe(
      "Amount exceeds withdrawable balance (0.1234567).",
    );
  });
});
