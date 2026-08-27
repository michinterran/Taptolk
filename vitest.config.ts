import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["packages/*/src/**/*.ts", "scripts/wcj/**/*.mjs"],
      reporter: ["text", "json-summary"],
    },
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts", "scripts/**/*.test.ts"],
    passWithNoTests: false,
  },
});
