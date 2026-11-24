/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/wallet-button", () => ({
  WalletButton: () => <div data-testid="wallet-button">Wallet</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>,
}));

vi.mock("@/components/api-status", () => ({
  ApiStatus: () => <div data-testid="api-status">API</div>,
}));

vi.mock("@/components/network-badge", () => ({
  NetworkBadge: () => <div data-testid="network-badge">testnet</div>,
}));

import { Header } from "./header";

describe("Header", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders the site title and controls", async () => {
    await act(async () => {
      root.render(<Header />);
    });

    expect(container.textContent).toContain("TricklePay");
    expect(container.querySelector('[data-testid="wallet-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-toggle"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="network-badge"]')).not.toBeNull();
  });

  it("marks the active route in desktop navigation with aria-current='page'", async () => {
    mockUsePathname.mockReturnValue("/create");

    await act(async () => {
      root.render(<Header />);
    });

    const mainNav = container.querySelector('nav[aria-label="Main navigation"]');
    expect(mainNav).not.toBeNull();

    const activeLink = mainNav?.querySelector('a[aria-current="page"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.getAttribute("href")).toBe("/create");
    expect(activeLink?.textContent).toBe("New stream");
  });

  it("marks the active route in mobile navigation with aria-current='page'", async () => {
    mockUsePathname.mockReturnValue("/create");

    await act(async () => {
      root.render(<Header />);
    });

    const toggleButton = container.querySelector('button[aria-controls="mobile-nav"]');
    expect(toggleButton).not.toBeNull();

    await act(async () => {
      (toggleButton as HTMLButtonElement).click();
    });

    const mobileNav = container.querySelector('nav[aria-label="Mobile navigation"]');
    expect(mobileNav).not.toBeNull();

    const activeLink = mobileNav?.querySelector('a[aria-current="page"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.getAttribute("href")).toBe("/create");

    const inactiveLinks = mobileNav?.querySelectorAll('a:not([aria-current="page"])');
    expect(inactiveLinks?.length).toBeGreaterThan(0);
    expect(Array.from(inactiveLinks || []).some((l) => l.getAttribute("href") === "/")).toBe(true);
  });

  it("asserts only the current route link has aria-current='page' when navigating to home", async () => {
    mockUsePathname.mockReturnValue("/");

    await act(async () => {
      root.render(<Header />);
    });

    const toggleButton = container.querySelector('button[aria-controls="mobile-nav"]');
    await act(async () => {
      (toggleButton as HTMLButtonElement).click();
    });

    const mobileNav = container.querySelector('nav[aria-label="Mobile navigation"]');
    const activeLink = mobileNav?.querySelector('a[aria-current="page"]');
    expect(activeLink?.getAttribute("href")).toBe("/");
    expect(activeLink?.textContent).toBe("Streams");

    const nonActiveLink = mobileNav?.querySelector('a[href="/create"]');
    expect(nonActiveLink?.getAttribute("aria-current")).toBeNull();
  });

  it("moves focus to the first mobile link on open and closes on Escape back to the toggle", async () => {
    await act(async () => {
      root.render(<Header />);
    });

    const toggleButton = container.querySelector(
      'button[aria-controls="mobile-nav"]',
    ) as HTMLButtonElement;
    await act(async () => {
      toggleButton.click();
    });

    const firstLink = container.querySelector('nav[aria-label="Mobile navigation"] a');
    expect(document.activeElement).toBe(firstLink);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector('nav[aria-label="Mobile navigation"]')).toBeNull();
    expect(document.activeElement).toBe(toggleButton);
  });
});
