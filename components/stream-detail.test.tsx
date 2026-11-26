/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamDetail } from "@/components/stream-detail";
import { useWallet } from "@/components/wallet-provider";
import { useAccrual } from "@/hooks/use-accrual";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { formatTime, formatTokenAmount } from "@/lib/format";
import { formatSchedule, NO_CLIFF_LABEL } from "@/lib/schedule";
import { clearTokenDecimalsCache, readTokenDecimals, setCachedTokenDecimals } from "@/lib/token-decimals";
import type { StreamEvent, StreamView } from "@/types/stream";
import type { WalletState } from "@/types/wallet";

vi.mock("@/lib/token-decimals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/token-decimals")>()),
  readTokenDecimals: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/hooks/use-accrual", () => ({
  useAccrual: vi.fn(),
}));

// StreamActions has its own coverage (stream-actions.test.tsx). Here it's
// stubbed down to the one thing StreamDetail is responsible for: handing it
// the connected wallet address so the right party's controls can appear.
vi.mock("@/components/stream-actions", () => ({
  StreamActions: ({ stream, walletAddress }: { stream: StreamView; walletAddress: string | null }) => {
    if (!walletAddress) return null;
    if (walletAddress !== stream.sender && walletAddress !== stream.recipient) return null;
    return <div data-testid="stream-actions" data-wallet={walletAddress} />;
  },
}));

const NO_WALLET: WalletState = {
  address: null,
  network: null,
  connecting: false,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const STREAM: StreamView = {
  id: "123",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: "10000000",
  withdrawn: "0",
  vested: "5000000",
  withdrawable: "5000000",
  locked: "5000000",
  startTime: "1700000000",
  endTime: "1700003600",
  cliffTime: "1700000000",
  cancelled: false,
  status: "streaming",
  progress: 5000,
};

describe("StreamDetail", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.mocked(readTokenDecimals).mockResolvedValue(7);
    vi.mocked(useAccrual).mockReturnValue({ vested: 5_000_000n, withdrawable: 5_000_000n });
    vi.mocked(useWallet).mockReturnValue(NO_WALLET);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.mocked(readTokenDecimals).mockReset();
    clearTokenDecimalsCache();
  });

  it.each([
    ["CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST", 6, "1250000", "1.25"],
    ["CAJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBERTS", 18, "2750000000000000000", "2.75"],
  ])("updates the detail total after reading decimals for %s (%i)", async (token, decimals, raw, amount) => {
    let resolveDecimals!: (decimals: number) => void;
    vi.mocked(readTokenDecimals).mockReturnValue(new Promise((resolve) => {
      resolveDecimals = resolve;
    }));

    act(() => root.render(<StreamDetail stream={{ ...STREAM, token, totalAmount: raw }} onComplete={vi.fn()} />));
    expect(container.textContent).not.toContain(`of ${amount} total`);

    await act(async () => {
      setCachedTokenDecimals(token, decimals);
      resolveDecimals(decimals);
    });
    expect(container.textContent).toContain(`of ${amount} total`);
  });

  it("renders the schedule and the balances", async () => {
    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    const text = container.textContent ?? "";
    const schedule = formatSchedule(STREAM);

    // Balances: withdrawable now, plus vested-of-total.
    expect(text).toContain(formatTokenAmount("5000000", STREAM.token));
    expect(text).toContain(formatTokenAmount(STREAM.totalAmount, STREAM.token));

    // Schedule: start, end, and cliff, in the same wording lib/schedule produces.
    expect(text).toContain(schedule.start.local);
    expect(text).toContain(schedule.end.local);
    expect(text).toContain(NO_CLIFF_LABEL);
  });

  it("passes the connected wallet through so that party's actions appear", async () => {
    vi.mocked(useWallet).mockReturnValue({ ...NO_WALLET, address: STREAM.recipient });

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    const actions = container.querySelector('[data-testid="stream-actions"]');
    expect(actions).not.toBeNull();
    expect(actions?.getAttribute("data-wallet")).toBe(STREAM.recipient);
  });

  it("shows no actions when no wallet is connected", async () => {
    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    expect(container.querySelector('[data-testid="stream-actions"]')).toBeNull();
  });

  it("renders stream data read-only with no action controls for an unrelated third-party wallet", async () => {
    const unrelatedWallet = "GCCZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
    vi.mocked(useWallet).mockReturnValue({ ...NO_WALLET, address: unrelatedWallet });

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    const text = container.textContent ?? "";
    const schedule = formatSchedule(STREAM);

    // Stream data still renders
    expect(text).toContain(`Stream #${STREAM.id}`);
    expect(text).toContain(formatTokenAmount("5000000", STREAM.token));
    expect(text).toContain(formatTokenAmount(STREAM.totalAmount, STREAM.token));
    expect(text).toContain(schedule.start.local);

    // No action controls render for unrelated wallet
    expect(container.querySelector('[data-testid="stream-actions"]')).toBeNull();
  });

  it("shows the Duplicate stream button to the sender", async () => {
    vi.mocked(useWallet).mockReturnValue({ ...NO_WALLET, address: STREAM.sender });

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Duplicate stream"),
    );
    expect(button).toBeDefined();
  });

  it("hides the Duplicate stream button from a wallet that is not the sender", async () => {
    const unrelatedWallet = "GCCZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
    vi.mocked(useWallet).mockReturnValue({ ...NO_WALLET, address: unrelatedWallet });

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} />);
    });

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Duplicate stream"),
    );
    expect(button).toBeUndefined();
  });

  it("renders event history loading, empty, error, and populated states", async () => {
    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} eventsLoading />);
    });
    expect(container.textContent).toContain("Loading event history…");

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} events={[]} />);
    });
    expect(container.textContent).toContain("No events recorded for this stream yet.");

    await act(async () => {
      root.render(
        <StreamDetail
          stream={STREAM}
          onComplete={vi.fn()}
          eventsError="Could not load event history"
        />,
      );
    });
    expect(container.textContent).toContain("Could not load event history");

    const events: StreamEvent[] = [
      {
        eventId: "0001-0001",
        kind: "created",
        streamId: STREAM.id,
        ledger: 100,
        txHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        totalAmount: STREAM.totalAmount,
        closedAt: STREAM.startTime,
      },
      {
        eventId: "0002-0001",
        kind: "withdrawn",
        streamId: STREAM.id,
        ledger: 150,
        txHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        amount: "2500000",
        closedAt: "1700001800",
      },
    ];

    await act(async () => {
      root.render(<StreamDetail stream={STREAM} onComplete={vi.fn()} events={events} />);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Event history");
    expect(text).toContain("Created");
    expect(text).toContain("Withdrawn");
    expect(text).toContain(formatTokenAmount("2500000", STREAM.token));
    expect(text).toContain(formatTime("1700001800"));

    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain(txExplorerUrl(events[0].txHash, config.network));
    expect(links).toContain(txExplorerUrl(events[1].txHash, config.network));
  });
});
