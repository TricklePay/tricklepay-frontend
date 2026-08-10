import { defineConfig, devices } from "@playwright/test";

// The app reads NEXT_PUBLIC_* at build time, so the dev server is started with
// the values the fixtures intercept. Both hosts are unreachable by design:
// every request to them is fulfilled by page.route, and anything that escapes
// the stubs fails loudly instead of silently hitting a real network.
const env = {
  NEXT_PUBLIC_API_URL: "http://localhost:3000",
  NEXT_PUBLIC_RPC_URL: "http://localhost:8000/soroban/rpc",
  NEXT_PUBLIC_NETWORK: "testnet",
  NEXT_PUBLIC_CONTRACT_ID: "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  // The dev server compiles routes on demand, so a worker that is first to a
  // route waits on that build. With several workers navigating at once, that
  // plus a sign -> submit -> confirm round trip overruns the 5s default and
  // shows up as a flake rather than a real failure.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env,
  },
});
