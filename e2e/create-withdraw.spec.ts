import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import {
  TOKEN_ID,
  TX_HASH,
  stubApi,
  stubChain,
  streamingStream,
  type StreamStore,
} from "./fixtures/chain";

// The create -> withdraw happy path, end to end through the real UI against a
// faked wallet and chain. See e2e/README.md for the boundaries of this test.

test.describe("create then withdraw", () => {
  test("creates a stream, then withdraws from it", async ({ page }) => {
    const store: StreamStore = { streams: [] };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    const chain = await stubChain(page, { address: TEST_ADDRESS });

    // --- The wallet is restored from Freighter on load -------------------
    await page.goto("/");
    await expect(page.getByRole("button", { name: /GAAZ|\.\.\./ })).toBeVisible();

    // Empty dashboard to begin with.
    await expect(page.getByText("No incoming streams.")).toBeVisible();
    await expect(page.getByText("No outgoing streams.")).toBeVisible();

    // --- Create ----------------------------------------------------------
    await page.goto("/create");

    const start = new Date(Date.now() - 60_000);
    const end = new Date(Date.now() + 60_000);

    await page.getByLabel("Recipient address").fill(TEST_ADDRESS);
    await page.getByLabel("Token contract id").fill(TOKEN_ID);
    await page.getByLabel("Amount").fill("100");
    await page.getByLabel("Start").fill(toLocalInput(start));
    await page.getByLabel("End", { exact: true }).fill(toLocalInput(end));

    // The form redirects to the dashboard on success, so make the stream the
    // backend will now report visible before submitting.
    store.streams = [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        startTime: String(Math.floor(start.getTime() / 1000)),
        endTime: String(Math.floor(end.getTime() / 1000)),
        cliffTime: String(Math.floor(start.getTime() / 1000)),
      }),
    ];

    // Submitting the form opens a review step instead of signing right away.
    await page.getByRole("button", { name: "Review stream" }).click();

    const review = page.getByRole("region", { name: "Review stream" });
    await expect(review).toBeVisible();
    await expect(review).toContainText(truncate(TEST_ADDRESS));
    await expect(review).toContainText(truncate(TOKEN_ID));
    await expect(review).toContainText("100");

    // Reviewing signs nothing: no simulation or submission has happened yet.
    expect(chain.methods).not.toContain("simulateTransaction");
    expect(chain.sendCount).toBe(0);

    // Back returns to the form without losing any entered value.
    await review.getByRole("button", { name: "Back to edit" }).click();
    await expect(page.getByLabel("Recipient address")).toHaveValue(TEST_ADDRESS);
    await expect(page.getByLabel("Token contract id")).toHaveValue(TOKEN_ID);
    await expect(page.getByLabel("Amount")).toHaveValue("100");
    await expect(page.getByLabel("Start")).toHaveValue(toLocalInput(start));
    await expect(page.getByLabel("End", { exact: true })).toHaveValue(toLocalInput(end));

    // Re-entering review and confirming proceeds through the wallet flow.
    await page.getByRole("button", { name: "Review stream" }).click();
    await page
      .getByRole("region", { name: "Review stream" })
      .getByRole("button", { name: "Confirm & create" })
      .click();

    // Redirect to the dashboard is the app's own success signal.
    await expect(page).toHaveURL("/");
    const card = page.getByRole("link", { name: /#1/ }).first();
    await expect(card).toBeVisible();

    // A dismissible success notice appears once, linking out to the tx.
    const notice = page.getByRole("status");
    await expect(notice).toContainText("Stream created.");
    await expect(notice.getByRole("link", { name: /view transaction/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );

    // The create call really went through sign -> submit -> confirm. Read the
    // recorded signature before the reload below: reinstalling the wallet stub
    // on reload starts a fresh recording.
    expect(chain.methods).toContain("simulateTransaction");
    expect(chain.sendCount).toBe(1);
    const signedAfterCreate = await page.evaluate(
      () => (window as unknown as { __signedTransactions: string[] }).__signedTransactions.length,
    );
    expect(signedAfterCreate).toBe(1);

    // Dismissing removes it, and a refresh never repeats it.
    await notice.getByRole("button", { name: "Dismiss notice" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("status")).toHaveCount(0);

    // --- Withdraw --------------------------------------------------------
    await card.click();
    await expect(page).toHaveURL(/\/streams\/1$/);
    await expect(page.getByRole("heading", { name: "Stream #1" })).toBeVisible();

    // The detail page shows a withdrawable balance for the connected recipient.
    await expect(page.getByText("Withdrawable now")).toBeVisible();

    // After the withdrawal the backend reports the stream fully drained.
    // Exact name: /withdraw/i would also hit the Max and "Set max" buttons.
    const withdrawButton = page.getByRole("button", { name: "Withdraw", exact: true });
    await expect(withdrawButton).toBeEnabled();

    store.streams = [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        withdrawn: "500000000",
        withdrawable: "0",
      }),
    ];

    // Count signatures from here, not from page load: the reload above
    // reinstalled the wallet stub and started a fresh recording.
    const signedBeforeWithdraw = await page.evaluate(
      () => (window as unknown as { __signedTransactions: string[] }).__signedTransactions.length,
    );

    await withdrawButton.click();

    // One more signature, and the submission follows moments later — poll the
    // chain counter instead of reading it once the signature shows up.
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __signedTransactions: string[] }).__signedTransactions.length,
        ),
      )
      .toBe(signedBeforeWithdraw + 1);
    await expect.poll(() => chain.sendCount).toBe(2);

    // The withdrawal is reflected in the UI once the stream reloads: 500000000
    // base units of the 7-decimal token renders as 50.
    await expect(page.locator('dt:has-text("Withdrawn") + dd')).toHaveText("50");

    // The withdrawal links out to the transaction on Stellar Expert.
    const explorerLink = page.getByRole("link", { name: /view transaction/i });
    await expect(explorerLink).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );
  });
});

// `datetime-local` inputs take local wall-clock time, not an ISO instant.
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// Same truncation the review applies to long Stellar addresses.
function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
