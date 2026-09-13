import { createVisualProjectConfig } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  ...createVisualProjectConfig({
    testDir: "./tests/visual",
    outputDir: "./test-results",
    use: { baseURL: "http://localhost:4173" },
  }),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Self-contained: rebuilds before serving, so `npm run test:visual` is
    // runnable on its own (no separate manual `npm run build` step),
    // mirroring how the fixture-driven WASM tests need no external setup
    // beyond `npm run wasm:download` (see docs/testing.md).
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
