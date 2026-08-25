import { describe, expect, it } from "vitest";
import { TransactionTimeoutError } from "@/lib/contract";

describe("TransactionTimeoutError", () => {
  it("stores transaction hash and descriptive timeout message", () => {
    const dummyHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const err = new TransactionTimeoutError(dummyHash);

    expect(err.name).toBe("TransactionTimeoutError");
    expect(err.txHash).toBe(dummyHash);
    expect(err.message).toBe("Timed out waiting for confirmation.");
  });

  it("allows custom message overrides", () => {
    const dummyHash = "0xabc123";
    const customMsg = "Custom timeout message";
    const err = new TransactionTimeoutError(dummyHash, customMsg);

    expect(err.txHash).toBe(dummyHash);
    expect(err.message).toBe(customMsg);
  });
});
