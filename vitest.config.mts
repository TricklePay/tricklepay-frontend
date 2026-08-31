import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Unit tests cover the pure modules in lib/. Playwright owns e2e/.
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "components/**/*.test.tsx", "hooks/**/*.test.ts"],
    environment: "node",
    env: {
      NEXT_PUBLIC_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    },
  },
});
