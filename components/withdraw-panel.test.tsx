import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockedReason } from "@/lib/stream-actions";
import { vestedAmount, withdrawableAmount } from "@/lib/vesting";
import type { StreamView } from "@/types/stream";

import { WithdrawPanel } from "./withdraw-panel";

const NOW = 1_700_000_000;

// Started 100 seconds ago, but the cliff is still 100 seconds away: the stream
// reads as "streaming" while nothing can be withdrawn yet.
const beforeCliff: StreamView = {
  id: "1",
  sender: "G-SENDER",
  recipient: "G-RECIPIENT",
  token: "C-TOKEN",
  totalAmount: "1000000000",
  withdrawn: "0",
  vested: "0",
  withdrawable: "0",
  locked: "1000000000",
  startTime: String(NOW - 100),
  endTime: String(NOW + 1_000),
  cliffTime: String(NOW + 100),
  cancelled: false,
  status: "streaming",
  progress: 0,
};

// Same derivation as useAccrual, at the pinned clock.
function withdrawableNow(stream: StreamView): bigint {
  const vested = vestedAmount(
    BigInt(stream.totalAmount),
    BigInt(stream.startTime),
    BigInt(stream.endTime),
    BigInt(stream.cliffTime),
    BigInt(NOW),
  );
  return withdrawableAmount(vested, BigInt(stream.withdrawn));
}

// Renders the panel the way StreamActions does for the recipient.
function renderPanel(stream: StreamView): ReactElement {
  const withdrawable = withdrawableNow(stream);
  return WithdrawPanel({
    withdrawable,
    token: stream.token,
    amountInput: "0",
    amountError: null,
    blockedReason: withdrawable === 0n ? blockedReason(stream) : null,
    busy: false,
    withdrawing: false,
    onAmountChange: () => {},
    onAmountBlur: () => {},
    onSetMax: () => {},
    onWithdraw: () => {},
  });
}

function findAll(node: ReactNode, match: (el: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, match));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const el = node as ReactElement<{ children?: ReactNode }>;
  return [...(match(el) ? [el] : []), ...findAll(el.props.children, match)];
}

function textOf(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function withdrawButton(tree: ReactElement): ReactElement<{ disabled?: boolean }> {
  const [button] = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "Withdraw",
  );
  expect(button).toBeDefined();
  return button as ReactElement<{ disabled?: boolean }>;
}

describe("WithdrawPanel with nothing vested", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has nothing withdrawable before the cliff", () => {
    expect(withdrawableNow(beforeCliff)).toBe(0n);
  });

  it("disables the withdraw button before the cliff", () => {
    expect(withdrawButton(renderPanel(beforeCliff)).props.disabled).toBe(true);
  });

  it("disables the amount field and Max shortcut before the cliff", () => {
    const tree = renderPanel(beforeCliff);
    const [input] = findAll(tree, (el) => el.type === "input");
    const [max] = findAll(tree, (el) => el.type === "button" && textOf(el).trim() === "Max");
    expect((input as ReactElement<{ disabled?: boolean }>).props.disabled).toBe(true);
    expect((max as ReactElement<{ disabled?: boolean }>).props.disabled).toBe(true);
  });

  it("explains the cliff instead of offering the Set max hint", () => {
    const text = textOf(renderPanel(beforeCliff));
    expect(text).toContain("Locked until the cliff");
    expect(text).not.toContain("Set max");
  });

  it("enables the withdraw button once something has vested", () => {
    const afterCliff = { ...beforeCliff, cliffTime: String(NOW - 50) };
    expect(withdrawableNow(afterCliff)).toBeGreaterThan(0n);
    expect(withdrawButton(renderPanel(afterCliff)).props.disabled).toBe(false);
  });
});
