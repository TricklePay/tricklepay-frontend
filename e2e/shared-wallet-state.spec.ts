import { test, expect, type Page } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";

// Regression cover for issue #1, "Share one wallet state instead of four".
//
// Before the fix, useWallet was a plain hook holding useState, so each of the
// four call sites got its own isolated copy and ran its own Freighter restore
// effect. Disconnecting in the header cleared only the header's copy: the page
// went on listing streams and rendering action buttons for a wallet that was,
// as far as the header was concerned, no longer connected.
//
// Both assertions below fail on that version and pass once a single provider in
// app/layout.tsx owns the state. See e2e/README.md.

const walletRequests = (page: Page) =>
  page.evaluate(() => (window as unknown as { __walletRequests: string[] }).__walletRequests);

test.describe("shared wallet state", () => {
  test("disconnecting in the header clears every consumer", async ({ page }) => {
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/");

    // Connected: the header shows the address and the dashboard lists streams.
    const disconnect = page.getByRole("button", { name: /\.\.\./ });
    await expect(disconnect).toBeVisible();
    await expect(page.getByRole("link", { name: /#1/ }).first()).toBeVisible();

    await disconnect.click();

    // The header reverts...
    await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();

    // ...and so does the page. This is the half that was broken: the dashboard
    // kept its own address and went on rendering the stream list.
    await expect(
      page.getByText("Connect your wallet to view incoming and outgoing streams."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /#1/ })).toHaveCount(0);
  });

  test("disconnecting hides the action buttons on a stream detail page", async ({ page }) => {
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/streams/1");

    // Recipient and sender are the same account here, so both actions render.
    await expect(page.getByRole("button", { name: "Withdraw" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();

    await page.getByRole("button", { name: /\.\.\./ }).click();

    // StreamActions renders nothing without an address, so a disconnect that
    // actually propagates removes both buttons.
    await expect(page.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });

  test("probes Freighter once per load, not once per consumer", async ({ page }) => {
    const store: StreamStore = {
      streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
    };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    // The dashboard mounts two consumers: the header button and the page.
    await page.goto("/");
    await expect(page.getByRole("button", { name: /\.\.\./ })).toBeVisible();

    await expect
      .poll(async () =>
        (await walletRequests(page)).filter((t) => t === "REQUEST_CONNECTION_STATUS").length,
      )
      .toBe(1);

    // The create page mounts two as well: the header button and the form.
    await page.goto("/create");
    await expect(page.getByRole("button", { name: "Create stream" })).toBeVisible();

    await expect
      .poll(async () =>
        (await walletRequests(page)).filter((t) => t === "REQUEST_CONNECTION_STATUS").length,
      )
      .toBe(1);
  });
});
