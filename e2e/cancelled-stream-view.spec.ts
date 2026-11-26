import { test, expect, type Page } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { cancelledStream, stubApi, stubChain, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// A cancelled stream keeps a claimable balance for the recipient. Both sides
// open the same page, so the amounts must match and only the recipient gets an
// action.

const OTHER = Keypair.random().publicKey();

async function open(page: Page, store: StreamStore): Promise<void> {
  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });
  await page.goto("/streams/1");
}

async function expectSettledAmounts(page: Page): Promise<void> {
  const status = page.getByRole("heading", { name: "Stream #1" }).locator("xpath=following-sibling::span");
  await expect(status).toHaveText("cancelled");
  await expect(page.getByRole("note")).toContainText("Stream cancelled");
  await expect(page.locator('p:has-text("Remaining withdrawable") + p')).toHaveText("30");
  await expect(page.locator('dt:has-text("Withdrawn") + dd')).toHaveText("20");
  await expect(page.locator('dt:has-text("Returned to sender") + dd')).toHaveText("50");
}

test.describe("viewing a cancelled stream", () => {
  test("recipient sees the claimable balance and an enabled withdraw", async ({ page }) => {
    const store: StreamStore = {
      streams: [cancelledStream({ id: "1", sender: OTHER, recipient: TEST_ADDRESS })],
    };
    await open(page, store);

    await expectSettledAmounts(page);
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel stream", exact: true })).toHaveCount(0);
  });

  test("sender sees the same amounts and no actions", async ({ page }) => {
    const store: StreamStore = {
      streams: [cancelledStream({ id: "1", sender: TEST_ADDRESS, recipient: OTHER })],
    };
    await open(page, store);

    await expectSettledAmounts(page);
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel stream", exact: true })).toHaveCount(0);
  });
});
