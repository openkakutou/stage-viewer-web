import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForVisualReady } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { expect, test } from "@playwright/test";

/**
 * Baseline screenshots of this app's real composed output (backlog item
 * 011), loaded from real, vendored stage fixtures (see
 * `tests/visual/fixtures/README.md`) through the actual folder-picker
 * input — the same `<input webkitdirectory>` path a real user drives,
 * not a synthetic bypass of the loading flow.
 */

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

async function loadStageFixture(
  page: import("@playwright/test").Page,
  folderName: string,
): Promise<void> {
  await page.goto("/");
  await page
    .locator("#stage-folder-picker")
    .setInputFiles(path.join(FIXTURES_DIR, folderName));
}

test("2D real stage (Dengeki_Subway, xscale/yscale) composed background preview matches its baseline", async ({
  page,
}) => {
  await loadStageFixture(page, "dengeki-subway");

  const stack = page.locator(".background-preview__stack");
  await expect(stack).toBeVisible();
  // The 2D composition canvas is hidden until sprite decode finishes
  // (background-preview.ts) — waiting for it directly, rather than a fixed
  // delay, is what makes this deterministic regardless of decode speed.
  await expect(stack.locator(".background-preview__canvas")).toBeVisible();

  await waitForVisualReady(page);
  await expect(stack).toHaveScreenshot("dengeki-subway-background.png");
});

test("3D model-based real stage (cvs2london) preview matches its baseline", async ({
  page,
}) => {
  await loadStageFixture(page, "cvs2london");

  const stack = page.locator(".background-preview__stack");
  await expect(stack).toBeVisible();
  await expect(stack.locator(".model-preview__canvas")).toBeVisible();

  await waitForVisualReady(page);
  await expect(stack).toHaveScreenshot("cvs2london-model.png");
});
