/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWallet } from "@/components/wallet-provider";
import { useStreamPage } from "@/hooks/use-stream-page";
import { streamsToCsv } from "@/lib/csv";
import { downloadCsv } from "@/lib/csv-download";
import { DEFAULT_PAGE_SIZE } from "@/lib/page-size";
import type { StreamView } from "@/types/stream";

import Home from "./page";

vi.mock("@/lib/csv-download", () => ({
  downloadCsv: vi.fn(),
}));

const searchParamsRef = {
  current: new URLSearchParams(),
};

const replaceMock = vi.fn((url: string) => {
  const query = url.includes("?") ? url.split("?")[1] : url;
  searchParamsRef.current = new URLSearchParams(query);
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/hooks/use-stream-page", () => ({
  useStreamPage: vi.fn(),
}));

// Provide basic stubs for components so they don't do real DOM manipulation or fetching.
vi.mock("@/components/browser-support-note", () => ({
  BrowserSupportNote: () => (
    <div data-testid="browser-support">Browser Support</div>
  ),
}));

vi.mock("@/components/transaction-notice", () => ({
  TransactionNotice: () => (
    <div data-testid="transaction-notice">Transaction Notice</div>
  ),
}));

vi.mock("@/components/stream-status-legend", () => ({
  StreamStatusLegend: () => (
    <div data-testid="stream-status-legend">Legend</div>
  ),
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

  // Hooks still get called even if disconnected, though their outputs might not be used.
  vi.mocked(useStreamPage).mockReturnValue({
    streams: [],
    total: 0,
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    requestId: null,
    consecutiveRefreshFailures: 0,
    refreshWarning: null,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    lastUpdated: null,
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
    requestId: null,
    consecutiveRefreshFailures: 0,
    refreshWarning: null,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    lastUpdated: null,
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

    expect(htmlString).toContain(
      "Connect your wallet to view incoming and outgoing streams.",
    );

    // Stream list shouldn't be rendered.
    expect(htmlString).not.toContain("Incoming");
    expect(htmlString).not.toContain("Outgoing");
  });

  it("renders the stream list when wallet is connected and data is loaded", () => {
    mockConnectedWithData();

    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    // It should render the sections.
    expect(htmlString).toContain("Incoming");
    expect(htmlString).toContain("Outgoing");

    // Search box accessible label and placeholder describe stream ID, token, and address search.
    expect(htmlString).toContain(
      "Search by stream ID, token, or address",
    );
    expect(htmlString).toContain(
      'placeholder="Search by stream ID, token, or address…"'
    );

    // Ensure the loading state or connect prompt is NOT rendered.
    expect(htmlString).not.toContain("Connect your wallet to view");
    expect(htmlString).not.toContain("Loading incoming streams");
    expect(htmlString).not.toContain("Loading outgoing streams");
  });

  // The page's `filter` parameter is a lifecycle status
  // (pending, streaming, completed, cancelled) or "all".
  // Direction is already split into the Incoming and Outgoing sections,
  // which always render together. Therefore, use a supported status filter.
  it("applies a persisted filter on mount", () => {
    mockConnectedWithData();
    searchParamsRef.current = new URLSearchParams("?filter=streaming");

    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    expect(useStreamPage).toHaveBeenCalledWith(
      "recipient",
      expect.any(String),
      "streaming",
      DEFAULT_PAGE_SIZE,
    );

    expect(useStreamPage).toHaveBeenCalledWith(
      "sender",
      expect.any(String),
      "streaming",
      DEFAULT_PAGE_SIZE,
    );

    expect(htmlString).toMatch(/aria-pressed="true"[^>]*>\s*Streaming/);
    expect(htmlString).toContain('aria-label="Clear filter"');
  });

  it("treats an unsupported filter value as all", () => {
    mockConnectedWithData();
    searchParamsRef.current = new URLSearchParams("?filter=outgoing");

    const htmlString = renderToStaticMarkup(Home());

    expect(useStreamPage).toHaveBeenCalledWith(
      "recipient",
      expect.any(String),
      "all",
      DEFAULT_PAGE_SIZE,
    );

    expect(htmlString).not.toContain('aria-label="Clear filter"');
  });

  it("falls back to the default filter when no value is persisted", () => {
    mockConnectedWithData();
    searchParamsRef.current = new URLSearchParams();

    const el = Home();
    const htmlString = renderToStaticMarkup(el);

    expect(htmlString).toContain("Incoming");
    expect(htmlString).toContain("Outgoing");
  });

  it("renders the Updated freshness label after a successful load and calls downloadCsv when Export CSV is clicked (#493)", () => {
    mockConnectedWithData();
    const loadedAt = Date.now() - 15_000;
    vi.mocked(useStreamPage).mockReturnValue({
      ...vi.mocked(useStreamPage).mock.results[0]?.value,
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
      requestId: null,
      consecutiveRefreshFailures: 0,
      refreshWarning: null,
      refresh: vi.fn(),
      loadMore: vi.fn(),
      lastUpdated: loadedAt,
    });

    render(Home());

    const updatedLabels = screen.getAllByText(/^Updated\s+/i);
    expect(updatedLabels.length).toBe(2);

    const exportIncomingBtn = screen.getByRole("button", {
      name: "Export loaded incoming streams as CSV",
    });
    fireEvent.click(exportIncomingBtn);

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    expect(downloadCsv).toHaveBeenCalledWith(
      "tricklepay-incoming-streams.csv",
      expect.stringContaining("stream-1"),
    );
  });

  describe("streams total (#311)", () => {
    it("displays the total across visible streams clearly labelled", () => {
      mockConnectedWithData();

      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Total across visible streams");
      expect(htmlString).toContain("Total:");
      expect(htmlString).toContain("1 XLM");
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

      // When a filter yields no matching streams, the total shows 0.
      vi.mocked(useStreamPage).mockReturnValue({
        streams: [],
        total: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: null,
        requestId: null,
        consecutiveRefreshFailures: 0,
        refreshWarning: null,
        refresh: vi.fn(),
        loadMore: vi.fn(),
        lastUpdated: null,
      });

      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Total across visible streams");
      expect(htmlString).toContain(">0<");
    });

    it("displays error message and copyable request ID when an API error occurs", () => {
      vi.mocked(useWallet).mockReturnValue({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
        connecting: false,
        error: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      vi.mocked(useStreamPage).mockReturnValue({
        streams: [],
        total: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: "Database connection failed",
        requestId: "req-err-789",
        consecutiveRefreshFailures: 0,
        refreshWarning: null,
        refresh: vi.fn(),
        loadMore: vi.fn(),
        lastUpdated: null,
      });

      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Database connection failed");
      expect(htmlString).toContain("req-err-789");
      expect(htmlString).toContain("Copy request id");
    });

    it("displays polite status message and retry action when background refreshes fail consecutively", () => {
      vi.mocked(useWallet).mockReturnValue({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
        connecting: false,
        error: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      vi.mocked(useStreamPage).mockReturnValue({
        streams: [],
        total: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: null,
        requestId: null,
        consecutiveRefreshFailures: 3,
        refreshWarning: "Data may be out of date.",
        refresh: vi.fn(),
        loadMore: vi.fn(),
        lastUpdated: Date.now() - 60_000,
      });

      const el = Home();
      const htmlString = renderToStaticMarkup(el);

      expect(htmlString).toContain("Data may be out of date.");
      expect(htmlString).toContain("Retry");
    });
  });

  describe("Export CSV (#504)", () => {
    it("renders the export button with loaded rows tooltip and accessible label", () => {
      mockConnectedWithData();
      render(Home());

      const exportButtons = screen.getAllByRole("button", { name: /export loaded/i });
      expect(exportButtons.length).toBeGreaterThan(0);
      for (const button of exportButtons) {
        expect(button.getAttribute("title")).toBe("Exports loaded rows");
        expect(button.textContent).toContain("Export CSV");
      }
    });

    it("searches, sorts, exports and compares the CSV with the visible list in order", () => {
      const stream1: StreamView = {
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
      };

      const stream2FilteredOut: StreamView = {
        id: "stream-2",
        sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        recipient: "GCCC9999999999999999999999999999999999999999999999999999",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        totalAmount: "50000000",
        withdrawn: "0",
        vested: "0",
        withdrawable: "0",
        locked: "50000000",
        startTime: "1000",
        endTime: "3000",
        cliffTime: "1000",
        cancelled: false,
        status: "streaming",
        progress: 0,
      };

      const stream3: StreamView = {
        id: "stream-3",
        sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        recipient: "GBBBI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        totalAmount: "30000000",
        withdrawn: "0",
        vested: "0",
        withdrawable: "0",
        locked: "30000000",
        startTime: "1000",
        endTime: "4000",
        cliffTime: "1000",
        cancelled: false,
        status: "streaming",
        progress: 0,
      };

      vi.mocked(useWallet).mockReturnValue({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        network: "testnet",
        connecting: false,
        error: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      vi.mocked(useStreamPage).mockReturnValue({
        streams: [stream1, stream2FilteredOut, stream3],
        total: 3,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: null,
        requestId: null,
        consecutiveRefreshFailures: 0,
        refreshWarning: null,
        refresh: vi.fn(),
        loadMore: vi.fn(),
        lastUpdated: null,
      });

      const { rerender } = render(Home());

      // 1. Search for recipient "GBBBI" (matches stream1 and stream3, filters out stream2)
      const searchInput = screen.getByPlaceholderText(
        "Search by stream ID, token, or address…",
      );
      fireEvent.change(searchInput, { target: { value: "GBBBI" } });

      // 2. Sort by amount largest first (stream3 with 30 XLM should precede stream1 with 10 XLM)
      const sortSelect = screen.getByLabelText(/^Sort/i);
      fireEvent.change(sortSelect, { target: { value: "amount-largest" } });
      rerender(Home());

      // 3. Click the outgoing export button
      const exportOutgoingBtn = screen.getByRole("button", {
        name: "Export loaded outgoing streams as CSV",
      });
      fireEvent.click(exportOutgoingBtn);

      // 4. Verify downloadCsv was called with exact visible rows in sorted order
      expect(downloadCsv).toHaveBeenCalledTimes(1);
      const [filename, exportedCsv] = vi.mocked(downloadCsv).mock.calls[0];

      expect(filename).toBe("tricklepay-outgoing-streams.csv");

      const expectedCsv = streamsToCsv([stream3, stream1]);
      expect(exportedCsv).toBe(expectedCsv);

      // Filtered-out stream is excluded
      expect(exportedCsv).not.toContain("stream-2");
      expect(exportedCsv).not.toContain("GCCC9999");

      // Preserves sorted order: stream-3 appears before stream-1
      const stream1Index = exportedCsv.indexOf("stream-1");
      const stream3Index = exportedCsv.indexOf("stream-3");
      expect(stream3Index).toBeGreaterThan(-1);
      expect(stream1Index).toBeGreaterThan(-1);
      expect(stream3Index).toBeLessThan(stream1Index);
    });

    it("disables the export button when visible rows is empty", () => {
      mockConnectedWithData();
      render(Home());

      const searchInput = screen.getByPlaceholderText(
        "Search by stream ID, token, or address…",
      );
      fireEvent.change(searchInput, { target: { value: "NONEXISTENT_STREAM_QUERY" } });

      const exportButtons = screen.getAllByRole("button", { name: /export loaded/i });
      for (const button of exportButtons) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    });
  });
});