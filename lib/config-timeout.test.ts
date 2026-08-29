import { describe, expect, it, afterEach, vi } from "vitest";

// config.ts reads process.env once at module load, so each case needs a fresh
// module registry rather than a mutated export.
async function loadConfig(timeout?: string) {
  vi.resetModules();
  if (timeout === undefined) {
    vi.stubEnv("NEXT_PUBLIC_API_TIMEOUT_MS", "");
  } else {
    vi.stubEnv("NEXT_PUBLIC_API_TIMEOUT_MS", timeout);
  }
  return (await import("./config")).config;
}

describe("config.apiTimeoutMs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 10 seconds when the variable is unset", async () => {
    const config = await loadConfig();
    expect(config.apiTimeoutMs).toBe(10_000);
  });

  it("uses the configured value", async () => {
    const config = await loadConfig("2500");
    expect(config.apiTimeoutMs).toBe(2500);
  });

  it("treats 0 as no timeout", async () => {
    const config = await loadConfig("0");
    expect(config.apiTimeoutMs).toBe(0);
  });

  it("rejects a non-numeric value at startup", async () => {
    await expect(loadConfig("soon")).rejects.toThrow(
      /NEXT_PUBLIC_API_TIMEOUT_MS "soon" is not valid/,
    );
  });

  it("rejects a negative value", async () => {
    await expect(loadConfig("-1")).rejects.toThrow(/must be a whole number of milliseconds/);
  });

  it("rejects a fractional value", async () => {
    await expect(loadConfig("1500.5")).rejects.toThrow(/is not valid/);
  });
});
