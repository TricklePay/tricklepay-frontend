import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

const ENV_KEYS = [
  "NEXT_PUBLIC_NETWORK",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_API_TIMEOUT_MS",
  "NEXT_PUBLIC_CONTRACT_ID",
  "NEXT_PUBLIC_MOCK_API",
] as const;

const saved: Record<string, string | undefined> = {};

// Resets the module registry and sets exactly the given variables before
// importing config, which validates them at import time.
async function loadConfig(env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.NEXT_PUBLIC_CONTRACT_ID = VALID_CONTRACT_ID;
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  return (await import("@/lib/config")).config;
}

describe("client configuration", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.resetModules();
  });

  it("uses testnet defaults when nothing else is set", async () => {
    const config = await loadConfig();
    expect(config.network).toBe("testnet");
    expect(config.apiUrl).toBe("http://localhost:3000");
    expect(config.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(config.apiTimeoutMs).toBe(10_000);
    expect(config.contractId).toBe(VALID_CONTRACT_ID);
  });

  it("rejects an unsupported network", async () => {
    await expect(loadConfig({ NEXT_PUBLIC_NETWORK: "mainet" })).rejects.toThrow(
      'Configuration error: NEXT_PUBLIC_NETWORK "mainet" is not supported. ' +
        'Accepted values are "testnet" and "mainnet".',
    );
  });

  describe("URLs", () => {
    it.each(["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_RPC_URL"] as const)(
      "rejects a malformed %s",
      async (name) => {
        await expect(loadConfig({ [name]: "not-a-url" })).rejects.toThrow(
          `Configuration error: ${name} "not-a-url" is not a valid URL. ` +
            "It must be an absolute URL (for example https://api.example.com).",
        );
      },
    );

    it.each(["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_RPC_URL"] as const)(
      "rejects plain http for a non-local host in %s",
      async (name) => {
        await expect(loadConfig({ [name]: "http://api.example.com" })).rejects.toThrow(
          `Configuration error: ${name} "http://api.example.com" uses plain http:// for a non-local host. ` +
            "Use https:// for non-local deployments (http:// is accepted only for localhost).",
        );
      },
    );

    it.each(["http://localhost:3000", "http://127.0.0.1:8000", "http://[::1]:8000"])(
      "accepts http for the local host %s",
      async (url) => {
        const config = await loadConfig({
          NEXT_PUBLIC_API_URL: url,
          NEXT_PUBLIC_RPC_URL: url,
        });
        expect(config.apiUrl).toBe(url);
        expect(config.rpcUrl).toBe(url);
      },
    );

    it("accepts https for a non-local host", async () => {
      const config = await loadConfig({ NEXT_PUBLIC_API_URL: "https://api.example.com" });
      expect(config.apiUrl).toBe("https://api.example.com");
    });

    it("falls back to the network default RPC URL when the variable is blank", async () => {
      const config = await loadConfig({ NEXT_PUBLIC_NETWORK: "mainnet", NEXT_PUBLIC_RPC_URL: "  " });
      expect(config.rpcUrl).toBe("https://mainnet.sorobanrpc.com");
    });
  });

  describe("API timeout", () => {
    it.each(["abc", "-1", "1.5"])("rejects the invalid timeout %s", async (value) => {
      await expect(loadConfig({ NEXT_PUBLIC_API_TIMEOUT_MS: value })).rejects.toThrow(
        `Configuration error: NEXT_PUBLIC_API_TIMEOUT_MS "${value}" is not valid. ` +
          "It must be a whole number of milliseconds (0 disables the timeout).",
      );
    });

    it("accepts 0 to disable the timeout", async () => {
      const config = await loadConfig({ NEXT_PUBLIC_API_TIMEOUT_MS: "0" });
      expect(config.apiTimeoutMs).toBe(0);
    });

    it("accepts a whole number of milliseconds", async () => {
      const config = await loadConfig({ NEXT_PUBLIC_API_TIMEOUT_MS: "2500" });
      expect(config.apiTimeoutMs).toBe(2500);
    });
  });

  describe("contract id", () => {
    it("rejects a missing contract id", async () => {
      await expect(loadConfig({ NEXT_PUBLIC_CONTRACT_ID: "" })).rejects.toThrow(
        "Configuration error: NEXT_PUBLIC_CONTRACT_ID is not set. " +
          "Add it to your .env file (it starts with C).",
      );
    });

    it("rejects a malformed contract id", async () => {
      await expect(loadConfig({ NEXT_PUBLIC_CONTRACT_ID: "GABC" })).rejects.toThrow(
        'Configuration error: NEXT_PUBLIC_CONTRACT_ID "GABC" is not a valid Stellar contract address. ' +
          "It must be a 56-character string starting with C.",
      );
    });

    it("uses a placeholder contract id in mock mode", async () => {
      const config = await loadConfig({ NEXT_PUBLIC_CONTRACT_ID: "", NEXT_PUBLIC_MOCK_API: "true" });
      expect(config.mockApi).toBe(true);
      expect(config.contractId).toBe(VALID_CONTRACT_ID);
    });
  });
});
