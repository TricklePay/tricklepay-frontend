import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/wallet-button", () => ({
  WalletButton: () => <button>MockWalletButton</button>,
}));
import { Header } from "./header";
import { ThemeProvider } from "./theme-provider";

describe("Header", () => {
  it("renders the site title", () => {
    expect(renderToStaticMarkup(<ThemeProvider><Header /></ThemeProvider>)).toContain("TricklePay");
  });
  it("renders the wallet control", () => {
    expect(renderToStaticMarkup(<ThemeProvider><Header /></ThemeProvider>)).toContain("MockWalletButton");
  });
});
