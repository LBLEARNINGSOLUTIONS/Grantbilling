import { defineConfig } from "vitest/config";

// jsdom gives the tests browser globals (File, FileReader, Blob) so the CSV
// pipeline — which parses a File via PapaParse — runs end-to-end in tests.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
