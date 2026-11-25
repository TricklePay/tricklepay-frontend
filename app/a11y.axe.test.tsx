/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWallet } from "@/components/wallet-provider";
import { useStreamPage } from "@/hooks/use-stream-page";
import { getStream } from "@/lib/api";
import { readTokenDecimals } from "@/lib/token-decimals";
import { axeViolations } from "@/test/axe";
import type { StreamView } from "@/types/stream";

import CreatePage from "./create/page";
import Home from "./page";
import StreamDetailPage from "./streams/[id]/page";

// Page-level axe runs. Components are covered on their own in
// components/a11y.axe.test.tsx; this checks how a whole page fits together.
// Colour contrast needs a real browser, so it lives in e2e/a11y-contrast.spec.ts.
//
// Rule ids listed here are skipped for that page. Add one only with a link to
// the issue that tracks the fix, like:
//   "heading-order", // https://github.com/TricklePay/tricklepay-frontend/issues/<n>
const KNOWN_VIOLATIONS: Record<"dashboard" | "create" | "detail", string[]> = {
  dashboard: [],
  create: [],
  detail: [],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "1" }),
}));

vi.mock("@/components/wallet-provider", () => ({ useWallet: vi.fn() }));
vi.mock("@/hooks/use-stream-page", () => ({ useStreamPage: vi.fn() }));
vi.mock("@/hooks/use-stream-events", () => ({
  useStreamEvents: () => ({ events: [], loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getStream: vi.fn(),
}));
vi.mock("@/lib/token-decimals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/token-decimals")>()),
  readTokenDecimals: vi.fn(),
}));

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBBBI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const STREAM: StreamView = {
  id: "1",
  sender: SENDER,
  recipient: RECIPIENT,
  token: TOKEN,
  totalAmount: "10000000",
  withdrawn: "0",
  vested: "5000000",
  withdrawable: "5000000",
  locked: "5000000",
  startTime: "1000",
  endTime: "2000",
  cliffTime: "1000",
  cancelled: false,
  status: "streaming",
  progress: 5_000,
};

function connectWallet(address: string | null): void {
  vi.mocked(useWallet).mockReturnValue({
    address,
    network: address ? "testnet" : null,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

describe("page-level axe checks", () => {
  beforeEach(() => {
    vi.mocked(readTokenDecimals).mockResolvedValue(7);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("dashboard with streams has no violations", async () => {
    connectWallet(SENDER);
    vi.mocked(useStreamPage).mockReturnValue({
      streams: [STREAM],
      total: 1,
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      requestId: null,
      retryAfter: null,
      consecutiveRefreshFailures: 0,
      refreshWarning: null,
      refresh: vi.fn(),
      loadMore: vi.fn(),
      lastUpdated: null,
    });

    const { container } = render(<Home />);
    expect(await axeViolations(container, KNOWN_VIOLATIONS.dashboard)).toEqual([]);
  });

  it("create page with a connected wallet has no violations", async () => {
    connectWallet(SENDER);

    const { container } = render(<CreatePage />);
    expect(await axeViolations(container, KNOWN_VIOLATIONS.create)).toEqual([]);
  });

  it("stream detail page with data has no violations", async () => {
    connectWallet(RECIPIENT);
    vi.mocked(getStream).mockResolvedValue(STREAM);

    const { container } = render(<StreamDetailPage />);
    await screen.findByRole("heading", { name: "Stream #1" });
    expect(await axeViolations(container, KNOWN_VIOLATIONS.detail)).toEqual([]);
  });
});
