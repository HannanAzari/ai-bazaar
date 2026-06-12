import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Lightweight unit tests for the demo libs. Node environment with a small
// localStorage shim (test/setup.ts) — no jsdom needed.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});
