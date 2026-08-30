import { test, expect } from "@playwright/test";
import { stubApi, streamingStream, type StreamStore } from "./fixtures/chain";

test.describe("copy button", () => {
  // Grant clipboard permissions to the browser context so clipboard.writeText works
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("writes to the clipboard and shows a confirmation", async ({ page }) => {
    const stream = streamingStream();
    const store: StreamStore = { streams: [stream] };
    await stubApi(page, store);

    await page.goto("/streams/1");

    // The page shows the sender address next to a copy button.
    const copyButton = page.getByRole("button", { name: "Copy From" });
    await expect(copyButton).toBeVisible();

    await copyButton.click();

    // Check clipboard contents
    const clipboardText = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboardText).toEqual(stream.sender);

    // Check confirmation state appears
    await expect(page.getByRole("button", { name: "Copied From" })).toBeVisible();
    await expect(page.getByText("Copied From to clipboard")).toBeVisible();

    // Check confirmation state clears (it clears after 1500ms)
    await expect(page.getByRole("button", { name: "Copy From" })).toBeVisible({ timeout: 2500 });
  });
});
