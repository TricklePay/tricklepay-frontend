import { describe, expect, it } from "vitest";

import { normalizeNetwork } from "@/lib/wallet-utils";

describe("normalizeNetwork", () => {
  it("maps testnet labels to testnet", () => {
    expect(normalizeNetwork("TESTNET")).toBe("testnet");
    expect(normalizeNetwork("testnet")).toBe("testnet");
    expect(normalizeNetwork("testnet_sdf")).toBe("testnet");
  });

  it("maps public labels to mainnet", () => {
    expect(normalizeNetwork("PUBLIC")).toBe("mainnet");
    expect(normalizeNetwork("public")).toBe("mainnet");
    expect(normalizeNetwork("public_global")).toBe("mainnet");
  });

  it("lowercases futurenet labels", () => {
    expect(normalizeNetwork("FUTURENET")).toBe("futurenet");
    expect(normalizeNetwork("Futurenet")).toBe("futurenet");
  });

  it("lowercases unknown network labels", () => {
    expect(normalizeNetwork("STANDALONE")).toBe("standalone");
    expect(normalizeNetwork("CUSTOM_NET")).toBe("custom_net");
    expect(normalizeNetwork("")).toBe("");
  });
});
