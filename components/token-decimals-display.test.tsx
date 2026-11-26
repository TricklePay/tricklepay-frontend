/* @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccrual } from "@/hooks/use-accrual";
import { streamsToCsv } from "@/lib/csv";
import { clearTokenDecimalsCache, readTokenDecimals, setCachedTokenDecimals } from "@/lib/token-decimals";
import type { CreateStreamParams } from "@/types/contract";
import type { StreamView } from "@/types/stream";

import { StreamCard } from "./stream-card";
import { StreamDetail } from "./stream-detail";
import { StreamReview } from "./stream-review";
import { StreamTable } from "./stream-table";

vi.mock("@/lib/token-decimals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/token-decimals")>()),
  readTokenDecimals: vi.fn(),
}));

vi.mock("@/hooks/use-token-metadata", () => ({
  useTokenMetadata: () => null,
  useTokensMetadata: () => undefined,
}));

vi.mock("@/hooks/use-accrual", () => ({ useAccrual: vi.fn() }));

vi.mock("@/components/stream-actions", () => ({ StreamActions: () => null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/components/wallet-provider", () => ({
  useWallet: () => ({
    address: null,
    network: null,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// One token with 6 decimals and one with 18. The expected strings are written
// out by hand rather than run through the formatter under test.
const CASES = [
  {
    decimals: 6,
    token: "CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST",
    total: "1250000",
    half: "625000",
    shownTotal: "1.25",
    shownHalf: "0.625",
  },
  {
    decimals: 18,
    token: "CAJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBERTS",
    total: "2750000000000000000",
    half: "1375000000000000000",
    shownTotal: "2.75",
    shownHalf: "1.375",
  },
];

type Case = (typeof CASES)[number];

function streamFor(c: Case): StreamView {
  return {
    id: "7",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: c.token,
    totalAmount: c.total,
    withdrawn: "0",
    vested: c.half,
    withdrawable: c.half,
    locked: c.half,
    startTime: "1700000000",
    endTime: "1700003600",
    cliffTime: "1700000000",
    cancelled: false,
    status: "streaming",
    progress: 5000,
  };
}

function paramsFor(c: Case): CreateStreamParams {
  return {
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: c.token,
    totalAmount: BigInt(c.total),
    startTime: 1_700_000_000n,
    endTime: 1_700_003_600n,
    cliffTime: 1_700_000_000n,
  };
}

function csvCells(c: Case): string[] {
  return streamsToCsv([streamFor(c)]).split("\r\n")[1].split(",");
}

const reviewProps = {
  feeEstimate: { status: "unavailable" } as const,
  balanceCheck: { status: "unavailable" } as const,
  submitting: false,
  onBack: vi.fn(),
  onConfirm: vi.fn(),
};

describe("token decimals in every amount display", () => {
  beforeEach(() => {
    vi.mocked(useAccrual).mockImplementation((stream) => ({
      vested: BigInt(stream.vested),
      withdrawable: BigInt(stream.withdrawable),
    }));
  });

  afterEach(() => {
    cleanup();
    clearTokenDecimalsCache();
    vi.mocked(readTokenDecimals).mockReset();
  });

  describe.each(CASES)("$decimals-decimal token", (c) => {
    beforeEach(() => {
      setCachedTokenDecimals(c.token, c.decimals);
    });

    it("formats the table, card, detail, review and CSV with the token's scale", () => {
      const stream = streamFor(c);

      const table = render(<StreamTable streams={[stream]} />);
      expect(table.container.textContent).toContain(c.shownTotal);
      expect(table.container.textContent).toContain(c.shownHalf);
      table.unmount();

      const card = render(<StreamCard stream={stream} />);
      expect(card.container.textContent).toContain(c.shownTotal);
      expect(card.container.textContent).toContain(c.shownHalf);
      card.unmount();

      const detail = render(<StreamDetail stream={stream} onComplete={vi.fn()} />);
      expect(detail.container.textContent).toContain(`${c.shownHalf} vested of ${c.shownTotal} total`);
      detail.unmount();

      const review = render(<StreamReview params={paramsFor(c)} decimals={c.decimals} {...reviewProps} />);
      expect(review.container.textContent).toContain(c.shownTotal);
      review.unmount();

      expect(csvCells(c).slice(5, 10)).toEqual([c.shownTotal, c.shownHalf, "0", c.shownHalf, c.shownHalf]);
    });
  });

  describe.each(CASES)("late-loaded decimals for the $decimals-decimal token", (c) => {
    it("updates the table, card and detail once the decimals arrive", async () => {
      let resolveDecimals!: (decimals: number) => void;
      vi.mocked(readTokenDecimals).mockReturnValue(
        new Promise((resolve) => {
          resolveDecimals = resolve;
        }),
      );
      const stream = streamFor(c);

      const table = render(<StreamTable streams={[stream]} />);
      const card = render(<StreamCard stream={stream} />);
      const detail = render(<StreamDetail stream={stream} onComplete={vi.fn()} />);
      expect(table.container.textContent).not.toContain(c.shownTotal);
      expect(card.container.textContent).not.toContain(c.shownTotal);
      expect(detail.container.textContent).not.toContain(`of ${c.shownTotal} total`);

      await act(async () => {
        setCachedTokenDecimals(c.token, c.decimals);
        resolveDecimals(c.decimals);
      });

      expect(table.container.textContent).toContain(c.shownTotal);
      expect(card.container.textContent).toContain(c.shownTotal);
      expect(detail.container.textContent).toContain(`of ${c.shownTotal} total`);
    });

    it("updates the review step and the CSV once the decimals are cached", () => {
      const review = render(<StreamReview params={paramsFor(c)} {...reviewProps} />);
      expect(review.container.textContent).not.toContain(c.shownTotal);
      expect(csvCells(c)[5]).not.toBe(c.shownTotal);

      setCachedTokenDecimals(c.token, c.decimals);
      review.rerender(<StreamReview params={paramsFor(c)} {...reviewProps} />);

      expect(review.container.textContent).toContain(c.shownTotal);
      expect(csvCells(c)[5]).toBe(c.shownTotal);
    });
  });
});
