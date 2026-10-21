/* @vitest-environment jsdom */

import * as freighter from "@stellar/freighter-api";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { StreamDetail } from "@/components/stream-detail";
import { WalletButton } from "@/components/wallet-button";
import { WalletProvider } from "@/components/wallet-provider";
import { listStreams } from "@/lib/api";
import { truncateAddress } from "@/lib/format";
import type { StreamView } from "@/types/stream";

// Switching accounts in Freighter must carry the whole app to the new account
// in place: the address badge, the controls a stream offers (they depend on
// whether you are its sender or recipient) and both dashboard lists. This
// renders the real provider and consumers together and drives Freighter's
// account watcher by hand.

const ALICE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const BOB = "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const CAROL = "GCCZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

type WatchCallback = (params: {
  address: string;
  network: string;
  networkPassphrase: string;
  error?: unknown;
}) => void;

// The watcher callbacks currently registered, i.e. the ones not yet stopped.
const watchers = vi.hoisted(() => new Set<{ cb: (p: never) => void }>());

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => ({ isConnected: true })),
  isAllowed: vi.fn(async () => ({ isAllowed: true })),
  getAddress: vi.fn(async () => ({ address: ALICE })),
  getNetwork: vi.fn(async () => ({ network: "TESTNET", networkPassphrase: TESTNET_PASSPHRASE })),
  requestAccess: vi.fn(),
  WatchWalletChanges: class {
    private entry: { cb: (p: never) => void } | null = null;
    watch(cb: (p: never) => void) {
      this.entry = { cb };
      watchers.add(this.entry);
      return {};
    }
    stop() {
      if (this.entry) watchers.delete(this.entry);
    }
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Nothing here signs a transaction; stubbing the contract layer keeps the
// Stellar SDK's transaction machinery out of the test.
vi.mock("@/lib/contract", () => ({
  cancel: vi.fn(),
  withdraw: vi.fn(),
  withdrawAmount: vi.fn(),
  confirmTransaction: vi.fn(),
  TransactionTimeoutError: class extends Error {},
}));

const now = Math.floor(Date.now() / 1000);

function stream(id: string, sender: string, recipient: string): StreamView {
  return {
    id,
    sender,
    recipient,
    token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    totalAmount: "1000000000",
    withdrawn: "0",
    vested: "500000000",
    withdrawable: "500000000",
    locked: "500000000",
    startTime: String(now - 3600),
    endTime: String(now + 3600),
    cliffTime: String(now - 3600),
    cancelled: false,
    status: "streaming",
    progress: 5000,
  };
}

// Bob streams to Alice; Alice streams to Carol. So Alice has one incoming and
// one outgoing stream, while Bob has only the outgoing one he shares with her.
const BOB_TO_ALICE = stream("101", BOB, ALICE);
const ALICE_TO_CAROL = stream("202", ALICE, CAROL);
const ALL_STREAMS = [BOB_TO_ALICE, ALICE_TO_CAROL];

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listStreams: vi.fn(async (params: { sender?: string; recipient?: string }) => {
    const streams = ALL_STREAMS.filter(
      (s) =>
        (params.sender === undefined || s.sender === params.sender) &&
        (params.recipient === undefined || s.recipient === params.recipient),
    );
    return { streams, total: streams.length, limit: 25, offset: 0 };
  }),
}));

function emitAccount(address: string) {
  act(() => {
    for (const { cb } of watchers) {
      (cb as WatchCallback)({ address, network: "TESTNET", networkPassphrase: TESTNET_PASSPHRASE });
    }
  });
}

function renderApp() {
  return render(
    <WalletProvider>
      <WalletButton />
      <Home />
      <StreamDetail stream={BOB_TO_ALICE} onComplete={() => {}} />
    </WalletProvider>,
  );
}

describe("switching wallet accounts", () => {
  beforeEach(() => {
    watchers.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    watchers.clear();
  });

  it("starts watching for account changes once a session is restored", async () => {
    renderApp();
    await screen.findByText(truncateAddress(ALICE));
    expect(watchers.size).toBe(1);
  });

  it("moves the address, role-based controls and stream lists to the new account", async () => {
    renderApp();

    // Alice: her address, the recipient's Withdraw control on Bob's stream,
    // and her own incoming (#101) and outgoing (#202) streams.
    await screen.findByText(truncateAddress(ALICE));
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel stream" })).toBeNull();
    await screen.findByText("#202");

    emitAccount(BOB);

    // The badge follows.
    await screen.findByText(truncateAddress(BOB));
    expect(screen.queryByText(truncateAddress(ALICE))).toBeNull();

    // Bob is the sender of the same stream, so he gets Cancel, not Withdraw.
    expect(screen.getByRole("button", { name: "Cancel stream" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();

    // Both lists are refetched for Bob and re-rendered from his results.
    await waitFor(() => {
      expect(listStreams).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: BOB }),
        expect.anything(),
      );
      expect(listStreams).toHaveBeenCalledWith(
        expect.objectContaining({ sender: BOB }),
        expect.anything(),
      );
    });
    await waitFor(() => expect(screen.queryByText("#202")).toBeNull());
    expect(screen.getByText("No incoming streams.")).toBeTruthy();
    expect(screen.getByText("#101")).toBeTruthy();
  });

  it("follows the switch without a reload or a new connection prompt", async () => {
    renderApp();
    await screen.findByText(truncateAddress(ALICE));

    emitAccount(BOB);
    await screen.findByText(truncateAddress(BOB));

    // The session was restored once on mount and never again: the switch came
    // from the watcher, not from remounting the provider or reconnecting.
    expect(freighter.getAddress).toHaveBeenCalledTimes(1);
    expect(freighter.requestAccess).not.toHaveBeenCalled();
  });

  it("ignores an empty address from a locked wallet", async () => {
    renderApp();
    await screen.findByText(truncateAddress(ALICE));

    emitAccount("");

    expect(screen.getByText(truncateAddress(ALICE))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });

  it("stops watching once the user disconnects", async () => {
    renderApp();
    await screen.findByText(truncateAddress(ALICE));

    act(() => screen.getByRole("button", { name: /Disconnect wallet/ }).click());

    expect(watchers.size).toBe(0);
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeTruthy();
  });
});
