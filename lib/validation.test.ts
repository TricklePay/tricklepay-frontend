import { describe, it, expect } from "vitest";
import {
  isValidStellarAddress,
  isValidContractAddress,
  parseAmount,
  toUnix,
  validateStreamDates,
} from "./validation";

// Known valid test keys
const VALID_G_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const VALID_C_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const INVALID_ADDRESS = "INVALID_STELLAR_ADDRESS_STRING";

describe("lib/validation", () => {
  describe("isValidStellarAddress", () => {
    it("returns true for a valid G... public key", () => {
      expect(isValidStellarAddress(VALID_G_ADDRESS)).toBe(true);
    });

    it("returns true for a valid C... contract address", () => {
      expect(isValidStellarAddress(VALID_C_CONTRACT)).toBe(true);
    });

    it("returns false for an empty or invalid address string", () => {
      expect(isValidStellarAddress("")).toBe(false);
      expect(isValidStellarAddress(INVALID_ADDRESS)).toBe(false);
    });
  });

  describe("isValidContractAddress", () => {
    it("returns true for a valid C... contract address", () => {
      expect(isValidContractAddress(VALID_C_CONTRACT)).toBe(true);
    });

    it("returns false for a G... public key (not a contract)", () => {
      expect(isValidContractAddress(VALID_G_ADDRESS)).toBe(false);
    });

    it("returns false for an empty or invalid address string", () => {
      expect(isValidContractAddress("")).toBe(false);
      expect(isValidContractAddress(INVALID_ADDRESS)).toBe(false);
    });
  });

  describe("parseAmount", () => {
    it("parses whole integer amount into 7-decimal base units", () => {
      expect(parseAmount("100")).toBe(1_000_000_000n);
      expect(parseAmount("1")).toBe(10_000_000n);
    });

    it("parses decimal amounts correctly", () => {
      expect(parseAmount("1.5")).toBe(15_000_000n);
      expect(parseAmount("0.0000001")).toBe(1n);
      expect(parseAmount("100.1234567")).toBe(1_001_234_567n);
    });

    it("throws when amount is empty or whitespace", () => {
      expect(() => parseAmount("")).toThrow("Amount is required.");
      expect(() => parseAmount("   ")).toThrow("Amount is required.");
    });

    it("throws for negative amounts", () => {
      expect(() => parseAmount("-10")).toThrow("Amount must be a positive number");
      expect(() => parseAmount("-0.5")).toThrow("Amount must be a positive number");
    });

    it("throws for scientific notation and non-numeric formats", () => {
      expect(() => parseAmount("1e5")).toThrow("Amount must be a positive number");
      expect(() => parseAmount("1.2.3")).toThrow("Amount must be a positive number");
      expect(() => parseAmount("abc")).toThrow("Amount must be a positive number");
    });

    it("throws when fractional precision exceeds 7 decimals", () => {
      expect(() => parseAmount("1.12345678")).toThrow(
        "Amount cannot have more than 7 decimal places.",
      );
    });

    it("throws when parsed base unit amount is zero", () => {
      expect(() => parseAmount("0")).toThrow("Amount must be greater than zero.");
      expect(() => parseAmount("0.0000000")).toThrow("Amount must be greater than zero.");
    });
  });

  describe("toUnix", () => {
    it("converts datetime-local string to Unix seconds", () => {
      const dateStr = "2026-08-27T12:00";
      const expected = BigInt(Math.floor(new Date(dateStr).getTime() / 1000));
      expect(toUnix(dateStr)).toBe(expected);
    });

    it("throws for invalid date input string", () => {
      expect(() => toUnix("invalid-date")).toThrow("Invalid date input.");
    });
  });

  describe("validateStreamDates", () => {
    const validStart = "2026-08-27T10:00";
    const validEnd = "2026-08-27T12:00";
    const validCliff = "2026-08-27T11:00";

    it("returns no errors for valid start, end, and cliff dates", () => {
      const result = validateStreamDates(validStart, validEnd, validCliff);
      expect(result.endError).toBeUndefined();
      expect(result.cliffError).toBeUndefined();
    });

    it("returns endError if end is before or equal to start", () => {
      const result = validateStreamDates(validEnd, validStart);
      expect(result.endError).toBe("End must be after start.");
    });

    it("returns cliffError if cliff is outside the start and end range", () => {
      const resultBefore = validateStreamDates(validStart, validEnd, "2026-08-27T09:00");
      expect(resultBefore.cliffError).toBe("Cliff must fall between start and end.");

      const resultAfter = validateStreamDates(validStart, validEnd, "2026-08-27T13:00");
      expect(resultAfter.cliffError).toBe("Cliff must fall between start and end.");
    });
  });
});
