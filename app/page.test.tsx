import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWallet } from "@/components/wallet-provider";
import { useStreamPage } from "@/hooks/use-stream-page";
import type { StreamView } from "@/types/stream";

import Home from "./page";

const searchParamsRef = {
  current: new URLSearchParams(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/hooks/use-stream-page", () => ({
  useStreamPage: vi.fn(),
}));

// Provide basic stubs for components so they don't do real DOM manipulation or fetching
vi.mock("@/components/browser-support-note", () => ({
  BrowserSupportNote: () => <div data-testid="browser-support">Browser Support</div>,
}));

vi.mock("@/components/transaction-notice", () => ({
  TransactionNotice: () => <div data-testid="transaction-notice">Transaction Notice</div>,
}));

vi.mock("@/components/stream-status-legend", () => ({
  StreamStatusLegend: () => <div data-testid="stream-status-legend">Legend</div>,
}));

function mockDisconnected() {
  vi.mocked(useWallet).mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  // Hooks still get called even if disconnected, though their outputs might not be used
  vi.mocked(useStreamPage).mockReturnValue({
    streams: [],
    total: 0,
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    refresh: vi.fn(),
    loadMore: vi.fn(),
  });
}

function mockConnectedWithData() {
  vi.mocked(useWallet).mockReturnValue({
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    network: "testnet",
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  vi.mocked(useStreamPage).mockReturnValue({
    streams: [
      {
        id: "stream-1",
        sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        recipient: "GBBBI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        totalAmount: "10000000",
        withdrawn: "0",
        vested: "0",
        withdrawable: "0",
        locked: "10000000",
        startTime: "1000",
        endTime: "2000",
        cliffTime: "1000",
        cancelled: false,
        status: "streaming",
        progress: 0,
      } as StreamView,
    ],
    total: 1,
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    refresh: vi.fn(),
    loadMore: vi.fn(),
  });
}

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsRef.current = new URLSearchParams();
  });

  it("renders the connect prompt when no wallet is connected", () => {
    mockDisconnected();
    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    expect(htmlString).toContain("Connect your wallet to view incoming and outgoing streams.");
    // stream list shouldn't be rendered
    expect(htmlString).not.toContain("Incoming");
    expect(htmlString).not.toContain("Outgoing");
  });

  it("renders the stream list when wallet is connected and data is loaded", () => {
    mockConnectedWithData();
    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    // It should render the sections
    expect(htmlString).toContain("Incoming");
    expect(htmlString).toContain("Outgoing");
    // Ensure the loading state or connect prompt is NOT rendered
    expect(htmlString).not.toContain("Connect your wallet to view");
    expect(htmlString).not.toContain("Loading incoming streams");
    expect(htmlString).not.toContain("Loading outgoing streams");
  });
it("applies a persisted filter on mount", () => {
    mockConnectedWithData();
    searchParamsRef.current = new URLSearchParams("?filter=outgoing");

    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    expect(htmlString).toContain("Outgoing");
    expect(htmlString).not.toContain("Incoming");
  });

  it("falls back to the default filter when no value is persisted", () => {
    mockConnectedWithData();
    searchParamsRef.current = new URLSearchParams();

    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    expect(htmlString).toContain("Incoming");
    expect(htmlString).toContain("Outgoing");
  });

  describe("streams total (#311)", () => {
    it("displays the total across visible streams clearly labelled", () => {
      mockConnectedWithData();
      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Total across visible streams");
      expect(htmlString).toContain("Total:");
      expect(htmlString).toContain("1 USDC");
    });

    it("respects the active filter by recalculating total for visible streams", () => {
      vi.mocked(useWallet).mockReturnValue({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
        connecting: false,
        error: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      // When a filter yields no matching streams, the total shows 0
      vi.mocked(useStreamPage).mockReturnValue({
        streams: [],
        total: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: null,
        refresh: vi.fn(),
        loadMore: vi.fn(),
      });

      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Total across visible streams");
      expect(htmlString).toContain(">0<");
    });
  });
});
