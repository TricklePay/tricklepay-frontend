import { test, expect, type Page } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { TOKEN_ID, stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// Duplicating a stream: the sender's button writes a form draft and opens the
// create page, which restores it with the schedule shifted to start now.

const RECIPIENT = Keypair.random().publicKey();

const DAY_SECONDS = 86_400;
const HOUR_MS = 3_600_000;

// A 10 day stream that began a day ago, with a cliff two days after its start.
function sourceStream() {
  const start = Math.floor(Date.now() / 1000) - DAY_SECONDS;
  return streamingStream({
    id: "1",
    sender: TEST_ADDRESS,
    recipient: RECIPIENT,
    token: TOKEN_ID,
    totalAmount: "1000000000",
    startTime: String(start),
    endTime: String(start + 10 * DAY_SECONDS),
    cliffTime: String(start + 2 * DAY_SECONDS),
  });
}

async function openStream(page: Page, walletAddress: string, store: StreamStore) {
  await page.addInitScript(installFreighterStub, { address: walletAddress });
  await stubApi(page, store);
  const chain = await stubChain(page, { address: walletAddress });
  await page.goto("/streams/1");
  await expect(page.getByRole("heading", { name: "Stream #1" })).toBeVisible();
  return chain;
}

// `datetime-local` values are wall-clock time; read them as UTC so two of them
// can be subtracted without the browser's own timezone getting involved.
function wallClockMs(value: string): number {
  return Date.parse(`${value}:00Z`);
}

test.describe("duplicate a stream", () => {
  test("prefills the create form from the stream with a shifted schedule", async ({ page }) => {
    await openStream(page, TEST_ADDRESS, { streams: [sourceStream()] });

    await page.getByRole("button", { name: "Duplicate stream" }).click();
    await expect(page).toHaveURL(/\/create$/);

    // Recipient, token and amount are copied as they were.
    await expect(page.locator("#field-recipient")).toHaveValue(RECIPIENT);
    await expect(page.locator("#field-token")).toHaveValue(TOKEN_ID);
    await expect(page.locator("#field-amount")).toHaveValue("100");

    // The schedule is shifted to start now, keeping the 10 day duration.
    await expect(page.locator("#field-durationAmount")).toHaveValue("10");
    const start = await page.locator("#field-start").inputValue();
    const end = await page.locator("#field-end").inputValue();
    const cliff = await page.locator("#field-cliff").inputValue();
    expect(start).not.toBe("");

    // Start is the current minute (two minutes of slack for a slow run) and
    // the duration and cliff offset match the original, give or take a DST hour.
    const nowWallClockMs = Date.now() - new Date().getTimezoneOffset() * 60_000;
    expect(Math.abs(wallClockMs(start) - nowWallClockMs)).toBeLessThan(2 * 60_000);
    expect(
      Math.abs(wallClockMs(end) - wallClockMs(start) - 10 * DAY_SECONDS * 1000),
    ).toBeLessThanOrEqual(HOUR_MS);
    expect(
      Math.abs(wallClockMs(cliff) - wallClockMs(start) - 2 * DAY_SECONDS * 1000),
    ).toBeLessThanOrEqual(HOUR_MS);
  });

  test("is not offered to the recipient of the stream", async ({ page }) => {
    await openStream(page, RECIPIENT, { streams: [sourceStream()] });

    // The recipient's own control proves the wallet is connected as them.
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Duplicate stream" })).toHaveCount(0);
  });

  test("lets the sender edit the draft and submit it", async ({ page }) => {
    const chain = await openStream(page, TEST_ADDRESS, { streams: [sourceStream()] });

    await page.getByRole("button", { name: "Duplicate stream" }).click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.locator("#field-amount")).toHaveValue("100");

    await page.locator("#field-amount").fill("120");
    await page.getByRole("button", { name: "Review stream" }).click();

    const review = page.getByRole("region", { name: "Review stream" });
    await expect(review).toBeVisible();
    await expect(review).toContainText("120");

    await review.getByRole("button", { name: "Confirm & create" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("status").filter({ hasText: "Stream created." })).toBeVisible();
    expect(chain.sendCount).toBe(1);
  });
});
