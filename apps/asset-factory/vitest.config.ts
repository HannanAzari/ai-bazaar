import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the factory's pure libs. Node environment with a small
// localStorage shim (test/setup.ts), mirroring the main app's harness.
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
