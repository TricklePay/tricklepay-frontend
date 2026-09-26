import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/wallet-provider", () => ({ useWallet: vi.fn() }));

import { useWallet } from "@/components/wallet-provider";
import type { WalletState } from "@/types/wallet";

import CreatePage from "./page";

function walletState(overrides: Partial<WalletState>): WalletState {
  return {
    address: null,
    network: null,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe("CreatePage", () => {
  it("renders the form for a connected wallet", () => {
    vi.mocked(useWallet).mockReturnValue(
      walletState({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
      }),
    );

    const html = renderToStaticMarkup(createElement(CreatePage));

    expect(html).toContain("Recipient address");
    expect(html).not.toContain("Connect your wallet to create a stream.");
  });

  it("shows a connect prompt when no wallet is connected", () => {
    vi.mocked(useWallet).mockReturnValue(walletState({}));

    const html = renderToStaticMarkup(createElement(CreatePage));

    expect(html).toContain("Connect your wallet to create a stream.");
    expect(html).not.toContain("Recipient address");
  });
});
