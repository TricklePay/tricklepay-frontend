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

  it("covers exactly the contract's error discriminants", () => {
    // Mirrors StreamError in the contract's error.rs. 2 is the retired
    // Unauthorized variant, kept for contracts deployed before its removal.
    // If the contract gains or drops a variant, this fails until the table
    // is updated — the mapping drifted out of sync once already.
    expect(Object.keys(CONTRACT_ERROR_MESSAGES).map(Number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("maps NothingToWithdraw (7) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("maps InsufficientBalance (8) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #8)")).toBe(
      "That is more than you can withdraw right now.",
    );
  });

  it("maps StreamNotFound (1) correctly", () => {
    expect(parseContractError("Error(Contract, #1)")).toBe("Stream not found.");
  });

  it("maps InvalidTimeRange (3) correctly", () => {
    expect(parseContractError("Error(Contract, #3)")).toBe(
      "Invalid time range — the stream must start before it ends.",
    );
  });

  it("maps AlreadyCancelled (6) correctly", () => {
    expect(parseContractError("Error(Contract, #6)")).toBe(
      "This stream has already been cancelled.",
    );
  });

  it("maps the codes added after the first deployment", () => {
    expect(parseContractError("Error(Contract, #9)")).toBe(
      "This stream has already completed and can no longer be cancelled.",
    );
    expect(parseContractError("Error(Contract, #10)")).toBe(
      "That amount is too large. The total must not exceed 9223372036854775807.",
    );
  });

  it("still maps Unauthorized (2), which older deployed contracts emit", () => {
    expect(parseContractError("Error(Contract, #2)")).toBe(
      "You are not authorized to perform this action.",
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
      "Invalid time range — the stream must start before it ends.",
    );
  });
});
