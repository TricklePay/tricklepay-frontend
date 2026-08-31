import { describe, it, expect, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T) => [initial, vi.fn()],
    useEffect: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/wallet-button", () => ({
  WalletButton: () => ({ type: "MockWalletButton", props: {} }),
}));

import { Header } from "./header";

describe("Header", () => {
  it("renders the site title", () => {
    const el = Header();
    expect(JSON.stringify(el)).toContain("TricklePay");
  });

  it("renders the wallet control", () => {
    const el = Header();
    expect(JSON.stringify(el)).toContain("MockWalletButton");
  });
});
