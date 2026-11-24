import { test, expect } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// The offline banner: Playwright's offline mode drives the browser's own
// online/offline events, so this covers the live region and the recovery.

const SENDER = Keypair.random().publicKey();

test.describe("offline banner", () => {
  test("announces going offline and clears on reconnect, with data refreshing afterwards", async ({
    page,
    context,
  }) => {
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: SENDER, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/");

    const incoming = page.locator("section").first();
    await expect(incoming.getByRole("link", { name: /#1/ })).toBeVisible();

    // Online: the live region exists but is empty, with no banner text.
    const offlineText = page.getByText("You are offline.");
    await expect(offlineText).toHaveCount(0);

    // --- Offline ---------------------------------------------------------
    await context.setOffline(true);

    const banner = page.getByRole("status", { name: "You are offline" });
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("aria-live", "polite");
    await expect(banner).toContainText("data will refresh when connectivity returns");

    // The page stays usable: what was already loaded is still on screen.
    await expect(incoming.getByRole("link", { name: /#1/ })).toBeVisible();

    // A stream the backend reports while the browser is offline.
    store.streams = [
      ...store.streams,
      streamingStream({ id: "2", sender: SENDER, recipient: TEST_ADDRESS }),
    ];

    // --- Back online -----------------------------------------------------
    await context.setOffline(false);

    await expect(offlineText).toHaveCount(0);
    await expect(page.getByRole("status", { name: "You are offline" })).toHaveCount(0);

    // Data refreshes once connectivity is back.
    await incoming.getByRole("button", { name: "Refresh incoming streams" }).click();
    await expect(incoming.getByRole("link", { name: /#2/ })).toBeVisible();
    await expect(incoming.getByRole("link", { name: /#1/ })).toBeVisible();
  });
});
