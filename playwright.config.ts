import { createVisualProjectConfig } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  ...createVisualProjectConfig({
    testDir: "./tests/visual",
    outputDir: "./test-results",
    use: { baseURL: "http://localhost:4173" },
    // Above the shared preset's implicit 5s default: each spec here loads
    // two real WASM modules (stage + sff) through the actual folder-picker
    // input and, for the 3D fixture, decodes/renders a real glTF model —
    // real work, not a stub. Seen timing out on `.background-preview__stack`
    // becoming visible under CPU contention (a `toBeVisible()` with nothing
    // decode-dependent gating it) even though a rerun with no other change
    // passed comfortably in under 2s — a real margin problem, not a wrong
    // assertion.
    expect: { timeout: 15_000 },
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
