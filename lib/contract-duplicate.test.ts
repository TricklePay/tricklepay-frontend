import { describe, expect, it } from "vitest";
import { isTransactionPending } from "@/lib/contract";

describe("duplicate transaction submission prevention", () => {
  it("reports no transaction pending initially", () => {
    expect(isTransactionPending()).toBe(false);
  });
});
