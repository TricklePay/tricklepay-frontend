import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StreamActions } from "./stream-actions";
import type { StreamView } from "@/types/stream";

const start = 1_800_000_000;
const stream: StreamView = {
  id: "1", sender: "G-SENDER", recipient: "G-RECIPIENT", token: "USDC",
  totalAmount: "10000000", withdrawn: "0", vested: "0", withdrawable: "0",
  locked: "10000000", startTime: String(start), endTime: String(start + 100),
  cliffTime: String(start + 50), cancelled: false, status: "streaming", progress: 0,
};

function withdrawButton(current: StreamView, seconds: number) {
  vi.spyOn(Date, "now").mockReturnValue(seconds * 1000);
  // Render the real component and accrual hook; do not mock the balance calculation.
  const html = renderToStaticMarkup(
    <StreamActions stream={current} walletAddress={current.recipient} onComplete={() => {}} />,
  );
  const button = html.match(/<button\b[^>]*>Withdraw<\/button>/)?.[0];
  expect(button, "the recipient must see the withdraw control").toBeDefined();
  return button!;
}

afterEach(() => vi.restoreAllMocks());

describe("withdraw control availability", () => {
  it("is disabled before the cliff even when the stream is already streaming", () => {
    expect(withdrawButton(stream, start + 25)).toMatch(/\sdisabled=""/);
  });

  it("is disabled after all vested funds have been withdrawn", () => {
    expect(withdrawButton({ ...stream, withdrawn: stream.totalAmount }, start + 100))
      .toMatch(/\sdisabled=""/);
  });

  it("is enabled at the cliff when vested funds are withdrawable", () => {
    expect(withdrawButton(stream, start + 50)).not.toMatch(/\sdisabled=""/);
  });
});
