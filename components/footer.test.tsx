import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TESTNET_CONTRACT, MAINNET_CONTRACT, mockConfig } = vi.hoisted(() => {
  const TESTNET_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
  const MAINNET_CONTRACT = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZID";
  const mockConfig = {
    contractId: TESTNET_CONTRACT,
    network: "testnet",
  };
  return { TESTNET_CONTRACT, MAINNET_CONTRACT, mockConfig };
});

vi.mock("@/lib/config", () => ({ config: mockConfig }));

import { Footer } from "./footer";

function render(): string {
  return renderToStaticMarkup(<Footer />);
}

describe("Footer", () => {
  beforeEach(() => {
    mockConfig.contractId = TESTNET_CONTRACT;
    mockConfig.network = "testnet";
  });

  it("displays the configured contract id", () => {
    const html = render();
    expect(html).toContain(TESTNET_CONTRACT);
  });

  it("links to the explorer using the configured network (testnet)", () => {
    const html = render();
    expect(html).toContain("stellar.expert/explorer/testnet/contract");
    expect(html).toContain(TESTNET_CONTRACT);
  });

  it("links to the explorer using the mainnet segment for mainnet", () => {
    mockConfig.network = "mainnet";
    mockConfig.contractId = MAINNET_CONTRACT;
    const html = render();
    expect(html).toContain("stellar.expert/explorer/public/contract");
    expect(html).toContain(MAINNET_CONTRACT);
  });
});
