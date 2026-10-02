import { test, expect } from "@playwright/test";

test("persists the selected theme after reload", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("trickle-theme")) {
      window.localStorage.setItem("trickle-theme", "dark");
    }
  });

  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Switch to light theme" });
  await expect(page.locator("html")).not.toHaveClass(/light/);

  await toggle.click();

  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("trickle-theme"))).toBe("light");

  await page.reload();

  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
});