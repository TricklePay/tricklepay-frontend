import { afterEach, describe, expect, it, vi } from "vitest";

describe("contract configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails clearly when NEXT_PUBLIC_CONTRACT_ID is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ID", "");
    await expect(import("./config")).rejects.toThrow(
      /NEXT_PUBLIC_CONTRACT_ID is not set/,
    );
  });
});
