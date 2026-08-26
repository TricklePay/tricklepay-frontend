import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import { stubApi, stubChain, streamingStream, TX_HASH, type StreamStore } from "./fixtures/chain";

// Cancelling a stream is destructive and irreversible, so StreamActions makes
// it a two-step action: "Cancel stream" opens an inline confirmation instead
// of cancelling immediately, and the transaction only goes out once the user
// confirms.

test.describe("cancel confirmation", () => {
  test("dismissing the confirmation does not cancel the stream", async ({ page }) => {
    test.slow();
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    const chain = await stubChain(page, { address: TEST_ADDRESS });

    // Arrive via the dashboard, matching how the app is actually navigated
    // (see create-withdraw.spec.ts) rather than a cold load straight into the
    // detail route.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /#1/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /#1/ }).first().click();
    await expect(page).toHaveURL(/\/streams\/1$/);

    const cancelButton = page.getByRole("button", { name: "Cancel stream", exact: true });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // The confirmation replaces the button; no transaction is signed yet.
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(cancelButton).toHaveCount(0);
    expect(chain.sendCount).toBe(0);

    await page.getByRole("button", { name: "Keep streaming" }).click();

    // Backing out restores the original button and nothing was sent.
    await expect(cancelButton).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(chain.sendCount).toBe(0);
  });

  test("confirming cancels the stream", async ({ page }) => {
    test.slow();
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    const chain = await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/");
    await page.getByRole("link", { name: /#1/ }).first().click();
    await expect(page).toHaveURL(/\/streams\/1$/);

    await page.getByRole("button", { name: "Cancel stream", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // The backend reports the stream cancelled once the confirmed cancel lands.
    store.streams = [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        cancelled: true,
        status: "cancelled",
      }),
    ];

    await page.getByRole("button", { name: "Yes, cancel stream" }).click();

    // Signature lands moments before the submission does, so poll the chain
    // counter rather than reading it once the signature shows up.
    await expect.poll(() => chain.sendCount).toBe(1);
    await expect(page.getByRole("button", { name: "Cancel stream", exact: true })).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // The confirmed cancel links out to the transaction on Stellar Expert.
    const explorerLink = page.getByRole("link", { name: /view transaction/i });
    await expect(explorerLink).toBeVisible();
    await expect(explorerLink).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );
    await expect(explorerLink).toHaveAttribute("target", "_blank");
    await expect(explorerLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
