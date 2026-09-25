import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json sets jsx:"preserve" for Next.js, but vitest/vite need an
  // explicit transform. The oxc option overrides the tsconfig value so JSX in
  // source files and test files is compiled to React.createElement calls.
  // runtime:"automatic" matches Next.js's own JSX transform (no React import needed).
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Unit tests cover pure modules in lib/, components/, and hooks/. Playwright owns e2e/.
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "hooks/**/*.test.ts",
      "hooks/**/*.test.tsx",
    ],
    environment: "node",
    env: {
      NEXT_PUBLIC_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    },
  },
});
