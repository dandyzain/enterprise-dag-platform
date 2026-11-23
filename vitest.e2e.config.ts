import { defineConfig } from "vitest/config";
import path from "node:path";

/** HTTP smoke tests against a running server: TEST_APP_URL=http://localhost:3000 pnpm test:e2e */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
