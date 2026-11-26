import { describe, expect, it } from "vitest";

import { parseDecimalAmount, type AmountParseErrorMessages } from "@/lib/amount-parser";

const messages: AmountParseErrorMessages = {
  required: "required-message",
  negative: "negative-message",
  invalid: "invalid-message",
  precision: (decimals) => `precision-message-${decimals}`,
};

describe("parseDecimalAmount results", () => {
  it.each([
    ["whole number, 7 decimals", "1", 7, 10_000_000n],
    ["fraction, 7 decimals", "12.5", 7, 125_000_000n],
    ["smallest unit, 7 decimals", "0.0000001", 7, 1n],
    ["surrounding whitespace, 7 decimals", " 7 ", 7, 70_000_000n],
    ["leading zeros, 7 decimals", "007.5", 7, 75_000_000n],
    ["whole number, 18 decimals", "1", 18, 10n ** 18n],
    ["smallest unit, 18 decimals", "0.000000000000000001", 18, 1n],
    ["full precision, 18 decimals", "1.123456789012345678", 18, 1_123_456_789_012_345_678n],
    ["zero decimals", "5", 0, 5n],
    [
      "very large value, 7 decimals",
      "922337203685477580700.1234567",
      7,
      922337203685477580700n * 10n ** 7n + 1_234_567n,
    ],
    [
      "very large value, 18 decimals",
      "340282366920938463463374607431768211455",
      18,
      340282366920938463463374607431768211455n * 10n ** 18n,
    ],
  ] as const)("parses %s", (_label, input, decimals, expected) => {
    const result = parseDecimalAmount(input, decimals, messages);
    expect(typeof result).toBe("bigint");
    expect(result).toBe(expected);
  });
});

describe("parseDecimalAmount errors", () => {
  it.each([
    ["empty input", "", 7, "required-message"],
    ["whitespace only", "   ", 18, "required-message"],
    ["minus prefix", "-1", 7, "negative-message"],
    ["minus only", "-", 18, "negative-message"],
    ["negative fraction", "-0.5", 7, "negative-message"],
    ["leading decimal point", ".5", 7, "invalid-message"],
    ["trailing decimal point", "5.", 18, "invalid-message"],
    ["letters", "abc", 7, "invalid-message"],
    ["exponent notation", "1e5", 18, "invalid-message"],
    ["two decimal points", "1.2.3", 7, "invalid-message"],
    ["more digits than 7 decimals", "1.12345678", 7, "precision-message-7"],
    ["more digits than 18 decimals", "0.1234567890123456789", 18, "precision-message-18"],
    ["fraction with zero decimals", "5.1", 0, "precision-message-0"],
    ["zero-only fraction with zero decimals", "5.0", 0, "precision-message-0"],
  ] as const)("rejects %s", (_label, input, decimals, message) => {
    expect(() => parseDecimalAmount(input, decimals, messages)).toThrow(message);
  });
});
