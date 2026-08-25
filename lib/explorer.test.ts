import { describe, expect, it } from "vitest";
import { txExplorerUrl } from "@/lib/explorer";

describe("txExplorerUrl", () => {
  const hash = "b9d5f2e1c7a04c8e9f3b1d6a5e8c2f7b4a9d0e3c6b8f1a4d7e0c3b6a9f2e5d8c";

  it("links to the testnet explorer for the testnet network", () => {
    expect(txExplorerUrl(hash, "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
  });

  it("links to the public explorer for mainnet", () => {
    expect(txExplorerUrl(hash, "mainnet")).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`,
    );
  });

  it("falls back to testnet for an unrecognised network", () => {
    expect(txExplorerUrl(hash, "futurenet")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
  });
});
