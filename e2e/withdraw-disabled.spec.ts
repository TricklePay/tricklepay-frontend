import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";

test.describe("withdraw disabled state", () => {
  test("disables withdraw controls before the cliff with nothing vested", async ({ page }) => {
    test.slow();
    const now = Math.floor(Date.now() / 1000);
    const store: StreamStore = {
      streams: [
        streamingStream({
          id: "1",
          sender: TEST_ADDRESS,
          recipient: TEST_ADDRESS,
          // The stream has started but not reached its cliff yet.
          startTime: String(now - 60),
          cliffTime: String(now + 3_600),
          endTime: String(now + 7_200),
          vested: "0",
          withdrawable: "0",
          locked: "1000000000",
          progress: 0,
        }),
      ],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/");
    await page.getByRole("link", { name: /#1/ }).first().click();
    await expect(page).toHaveURL(/\/streams\/1$/);

    const withdrawButton = page.getByRole("button", { name: "Withdraw", exact: true });
    const amountInput = page.getByRole("textbox", { name: "Withdrawal amount" });
    const maxButton = page.getByRole("button", { name: "Set maximum withdraw amount" });

    await expect(withdrawButton).toBeDisabled();
    await expect(amountInput).toBeDisabled();
    await expect(maxButton).toBeDisabled();

    // The reason is surfaced so the disabled state does not look like a bug.
    const reason = page.locator("#withdraw-blocked-reason");
    await expect(reason).toBeVisible();
    await expect(reason).toContainText("Locked until the cliff");

    // No transaction was attempted.
    expect((await page.context().pages())[0].url()).toMatch(/\/streams\/1$/);
  });
});
