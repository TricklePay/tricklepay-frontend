import { test, expect, type Page } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import type { StreamEvent } from "../types/stream";

import { API_URL, TOKEN_ID, stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// The detail page's event history, fed by a stubbed GET /streams/:id/events:
// ordering, labels, amounts, explorer links, and the empty and error states.

const RECIPIENT = Keypair.random().publicKey();

const HASH_CREATED = "1".repeat(64);
const HASH_WITHDRAWN = "2".repeat(64);
const HASH_CANCELLED = "3".repeat(64);

const explorerUrl = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

const EVENTS: StreamEvent[] = [
  {
    eventId: "0000000000000101-0000000001",
    kind: "created",
    streamId: "1",
    ledger: 101,
    txHash: HASH_CREATED,
    sender: TEST_ADDRESS,
    recipient: RECIPIENT,
    token: TOKEN_ID,
    totalAmount: "1000000000",
    closedAt: "1700000000",
  },
  {
    eventId: "0000000000000102-0000000001",
    kind: "withdrawn",
    streamId: "1",
    ledger: 102,
    txHash: HASH_WITHDRAWN,
    recipient: RECIPIENT,
    amount: "250000000",
    closedAt: "1700000100",
  },
  {
    eventId: "0000000000000103-0000000001",
    kind: "cancelled",
    streamId: "1",
    ledger: 103,
    txHash: HASH_CANCELLED,
    sender: TEST_ADDRESS,
    recipient: RECIPIENT,
    recipientAmount: "250000000",
    senderRefund: "500000000",
    closedAt: "1700000200",
  },
];

// `beforeGoto` runs after the shared stubs are installed. Playwright runs the
// most recently registered route first, so a route added there can override them.
async function openStream(
  page: Page,
  store: StreamStore,
  beforeGoto?: (page: Page) => Promise<void>,
) {
  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });
  await beforeGoto?.(page);
  await page.goto("/streams/1");
  await expect(page.getByRole("heading", { name: "Stream #1" })).toBeVisible();
}

test.describe("stream event history", () => {
  test("lists created, withdrawn and cancelled events in order with amounts and links", async ({
    page,
  }) => {
    await openStream(page, {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: RECIPIENT })],
      events: { "1": EVENTS },
    });

    const history = page.getByRole("region", { name: "Event history" });
    const rows = history.getByRole("listitem");
    await expect(rows).toHaveCount(3);

    // Chain order is preserved, and each row carries its label and ledger.
    await expect(rows.nth(0)).toContainText("Created");
    await expect(rows.nth(0)).toContainText("Ledger #101");
    await expect(rows.nth(1)).toContainText("Withdrawn");
    await expect(rows.nth(1)).toContainText("Ledger #102");
    await expect(rows.nth(2)).toContainText("Cancelled");
    await expect(rows.nth(2)).toContainText("Ledger #103");

    // Amounts: 7-decimal base units render as whole tokens.
    await expect(rows.nth(0)).toContainText("100");
    await expect(rows.nth(1)).toContainText("25");
    await expect(rows.nth(2)).toContainText("25 claimable by recipient · 50 refunded to sender");

    // Each row links out to its transaction.
    await expect(rows.nth(0).getByRole("link")).toHaveAttribute("href", explorerUrl(HASH_CREATED));
    await expect(rows.nth(1).getByRole("link")).toHaveAttribute("href", explorerUrl(HASH_WITHDRAWN));
    await expect(rows.nth(2).getByRole("link")).toHaveAttribute("href", explorerUrl(HASH_CANCELLED));
  });

  test("shows the empty state when the stream has no events", async ({ page }) => {
    await openStream(page, {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: RECIPIENT })],
    });

    const history = page.getByRole("region", { name: "Event history" });
    await expect(history.getByText("No events recorded for this stream yet.")).toBeVisible();
    await expect(history.getByRole("listitem")).toHaveCount(0);
  });

  test("shows an error with a retry that loads the events", async ({ page }) => {
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: RECIPIENT })],
      events: { "1": EVENTS },
    };

    // Every events request fails until the test flips `failing`, then requests
    // fall through to the shared stub (route.fallback). A flag rather than a
    // request count, since a dev-mode remount can send the request twice.
    let failing = true;
    await openStream(page, store, async (p) => {
      await p.route(`${API_URL}/streams/1/events`, async (route) => {
        if (failing) {
          return route.fulfill({
            status: 500,
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            body: JSON.stringify({ error: "Events backend unavailable" }),
          });
        }
        return route.fallback();
      });
    });

    const history = page.getByRole("region", { name: "Event history" });
    await expect(history.getByRole("alert")).toHaveText("Events backend unavailable");
    await expect(history.getByRole("listitem")).toHaveCount(0);

    failing = false;
    await history.getByRole("button", { name: "Retry" }).click();

    await expect(history.getByRole("listitem")).toHaveCount(3);
    await expect(history.getByRole("alert")).toHaveCount(0);
    await expect(history.getByRole("listitem").first()).toContainText("Created");
  });
});
