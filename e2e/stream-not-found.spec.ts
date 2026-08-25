import { test, expect } from "@playwright/test";
import { stubApi, type StreamStore } from "./fixtures/chain";

// A stream id with no backing record (bad link, wrong network, typo) used to
// render a single line of grey text with no way back. This covers the
// friendlier version: a heading, an explanation naming the id, and a link to
// the dashboard.

test.describe("stream not found", () => {
  test("shows a heading, an explanation, and a way back", async ({ page }) => {
    const store: StreamStore = { streams: [] };
    await stubApi(page, store);

    await page.goto("/streams/999");

    await expect(page.getByRole("heading", { name: "Stream not found" })).toBeVisible();
    await expect(page.getByText(/couldn.t find a stream with id .999./)).toBeVisible();

    await page.getByRole("link", { name: "Go to your streams" }).click();
    await expect(page).toHaveURL("/");
  });
});
