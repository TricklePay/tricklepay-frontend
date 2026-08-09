import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import {
  TOKEN_ID,
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

    await page.getByRole("button", { name: "Create stream" }).click();

    // Redirect to the dashboard is the app's own success signal.
    await expect(page).toHaveURL("/");
    const card = page.getByRole("link", { name: /#1/ }).first();
    await expect(card).toBeVisible();

    // The create call really went through sign -> submit -> confirm.
    expect(chain.methods).toContain("simulateTransaction");
    expect(chain.sendCount).toBe(1);
    const signedAfterCreate = await page.evaluate(
      () => (window as unknown as { __signedTransactions: string[] }).__signedTransactions.length,
    );
    expect(signedAfterCreate).toBe(1);

    // --- Withdraw --------------------------------------------------------
    await card.click();
    await expect(page).toHaveURL(/\/streams\/1$/);
    await expect(page.getByRole("heading", { name: "Stream #1" })).toBeVisible();

    // The detail page shows a withdrawable balance for the connected recipient.
    await expect(page.getByText("Withdrawable now")).toBeVisible();

    // After the withdrawal the backend reports the stream fully drained.
    const withdrawButton = page.getByRole("button", { name: /withdraw/i });
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

    await withdrawButton.click();

    // Two invocations signed and submitted in total: create, then withdraw.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __signedTransactions: string[] }).__signedTransactions.length,
        ),
      )
      .toBe(2);
    expect(chain.sendCount).toBe(2);

    // The withdrawal is reflected in the UI once the stream reloads: 500000000
    // base units of the 7-decimal token renders as 50.
    await expect(page.locator('dt:has-text("Withdrawn") + dd')).toHaveText("50");
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
