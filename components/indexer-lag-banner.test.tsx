/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIndexerLag } from "@/lib/api";
import { config } from "@/lib/config";

import { INDEXER_LAG_WARNING_LEDGERS, IndexerLagBanner } from "./indexer-lag-banner";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIndexerLag: vi.fn(),
}));

// A mutable copy so a test can switch mock mode on without touching env vars.
vi.mock("@/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config")>();
  return { ...actual, config: { ...actual.config } };
});

describe("IndexerLagBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(config, { mockApi: false });
    vi.mocked(getIndexerLag).mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderWithLag(lag: number | null) {
    vi.mocked(getIndexerLag).mockResolvedValue(lag);
    await act(async () => {
      root.render(<IndexerLagBanner />);
    });
  }

  const banner = () => container.querySelector('[data-testid="indexer-lag-banner"]');

  it("always renders an empty polite live region when there is no warning", async () => {
    await renderWithLag(null);

    const region = container.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
    expect(banner()).toBeNull();
  });

  it("shows nothing at exactly the threshold", async () => {
    await renderWithLag(INDEXER_LAG_WARNING_LEDGERS);

    expect(INDEXER_LAG_WARNING_LEDGERS).toBe(100);
    expect(banner()).toBeNull();
  });

  it("warns one ledger above the threshold, in whole minutes", async () => {
    await renderWithLag(101);

    // 101 ledgers * 5s / 60s rounds to 8 minutes.
    expect(banner()?.textContent).toContain("about 8 minutes behind the network (101 ledgers)");
  });

  it("formats a large lag with a thousands separator and plural minutes", async () => {
    await renderWithLag(12_000);

    // 12,000 ledgers * 5s / 60s = 1000 minutes.
    expect(banner()?.textContent).toContain(
      `about 1000 minutes behind the network (${(12_000).toLocaleString()} ledgers)`,
    );
  });

  it("makes no status request in mock mode", async () => {
    Object.assign(config, { mockApi: true });

    await renderWithLag(500);

    expect(getIndexerLag).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
  });
});
