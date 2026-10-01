/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useTheme } from "@/components/theme-provider";
import { useWallet } from "@/components/wallet-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

import RootLayout from "./layout";

// Mock the components that we aren't testing, so they don't do real DOM operations or fetch data
vi.mock("@/components/header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

vi.mock("@/components/skip-link", () => ({
  SkipLink: () => <a data-testid="skip-link">Skip</a>,
}));

function Probe() {
  const { theme } = useTheme();
  const wallet = useWallet();
  return (
    <div data-testid="probe" data-theme={theme} data-wallet-ready={wallet !== undefined}>
      Probe Active
    </div>
  );
}

describe("RootLayout", () => {
  it("renders the header and correctly renders its children", () => {
    const el = RootLayout({ children: <div data-testid="child">Test Child</div> });
    const htmlString = renderToStaticMarkup(el);

    expect(htmlString).toContain("Test Child");
    expect(htmlString).toContain("Header");
    expect(htmlString).toContain("Skip"); // from skip-link mock
  });

  it("wraps the tree in providers", () => {
    const el = RootLayout({ children: <Probe /> });
    const htmlString = renderToStaticMarkup(el);

    // The probe should successfully consume the contexts and render them
    // Assuming default theme is "dark" and wallet context is defined
    expect(htmlString).toContain("Probe Active");
    expect(htmlString).toContain('data-theme="dark"'); // ThemeProvider default
    expect(htmlString).toContain('data-wallet-ready="true"');
  });
});

describe("Theme Bootstrap Script", () => {
  let originalMatchMedia: any;

  beforeEach(() => {
    document.documentElement.className = "";
    window.localStorage.clear();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function evalBootstrapScript() {
    const el = RootLayout({ children: <div /> });
    const htmlString = renderToStaticMarkup(el);
    const scriptMatch = htmlString.match(/<script[^>]*>(.*?)<\/script>/);
    if (!scriptMatch) throw new Error("Could not find bootstrap script");
    
    // Evaluate the inline script string directly in this JSDOM context
    // eslint-disable-next-line no-eval
    eval(scriptMatch[1]);
  }

  function mockMatchMedia(prefersLight: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: prefersLight ? query === "(prefers-color-scheme: light)" : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  it("follows OS preference (light) when nothing is stored", () => {
    mockMatchMedia(true);
    evalBootstrapScript();
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("follows OS preference (dark) when nothing is stored", () => {
    mockMatchMedia(false);
    evalBootstrapScript();
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("overrides OS preference when explicit light choice is stored", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockMatchMedia(false); // OS prefers dark
    evalBootstrapScript();
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("overrides OS preference when explicit dark choice is stored", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockMatchMedia(true); // OS prefers light
    evalBootstrapScript();
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});
