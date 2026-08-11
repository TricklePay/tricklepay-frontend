import { describe, expect, it } from "vitest";
import {
  CONTRACT_ERROR_MESSAGES,
  GENERIC_FAILURE,
  parseContractError,
} from "@/lib/contract-errors";

describe("parseContractError", () => {
  it("returns the mapped message for every known error code", () => {
    const knownCodes = Object.keys(CONTRACT_ERROR_MESSAGES).map(Number);
    expect(knownCodes.length).toBeGreaterThan(0);

    for (const code of knownCodes) {
      const result = parseContractError(`Error(Contract, #${code})`);
      expect(result).toBe(CONTRACT_ERROR_MESSAGES[code]);
    }
  });

  it("maps NothingToWithdraw (7) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("maps InsufficientBalance (8) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #8)")).toBe(
      "The sender's account has insufficient balance to fund this stream.",
    );
  });

  it("maps AlreadyCancelled (1) correctly", () => {
    expect(parseContractError("Error(Contract, #1)")).toBe(
      "This stream has already been cancelled.",
    );
  });

  it("maps NotRecipient (3) correctly", () => {
    expect(parseContractError("Error(Contract, #3)")).toBe(
      "Only the recipient can perform this action.",
    );
  });

  it("returns a fallback with the raw code for unmapped codes", () => {
    expect(parseContractError("Error(Contract, #99)")).toBe(
      `${GENERIC_FAILURE} (error code 99)`,
    );
    expect(parseContractError("Error(Contract, #0)")).toBe(
      `${GENERIC_FAILURE} (error code 0)`,
    );
  });

  it("returns the generic failure message when no error token is present", () => {
    expect(parseContractError("something went wrong")).toBe(GENERIC_FAILURE);
    expect(parseContractError("")).toBe(GENERIC_FAILURE);
    expect(parseContractError("InvokeHostFunctionTrapped")).toBe(GENERIC_FAILURE);
  });

  it("handles whitespace variations inside the error token", () => {
    // The regex allows optional whitespace between the comma and hash
    expect(parseContractError("Error(Contract,#7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
    expect(parseContractError("Error(Contract,  #7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("extracts the code when the token is embedded inside a longer message", () => {
    const embeddedMsg =
      "HostError: invocation trapped — Error(Contract, #7) at function withdraw";
    expect(parseContractError(embeddedMsg)).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("uses the first matching code when multiple tokens appear", () => {
    // Unlikely in practice, but regex returns the first match
    const multiMsg = "Error(Contract, #3) then Error(Contract, #4)";
    expect(parseContractError(multiMsg)).toBe(
      "Only the recipient can perform this action.",
    );
  });
});
