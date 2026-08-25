import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import { renderStageFileInput } from "./stage-file-input-view.ts";

const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testBridgeOptions: WasmBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "stage.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "..", "wasm", "testdata");
const sampleDefText = readFileSync(
  path.join(testdataDir, "sample.def"),
  "utf-8",
);

function makeFile(name: string, contents = "x"): File {
  return new File([contents], name);
}

function withRelativePath(file: File, relativePath: string): File {
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

function fakeFileEntry(fullPath: string, file: File) {
  return {
    isFile: true,
    isDirectory: false,
    fullPath,
    file: (success: (file: File) => void) => success(file),
  };
}

/** jsdom's DragEvent does not implement DataTransfer, so it is stubbed directly. */
function dispatchDrop(target: Element, entries: unknown[]): void {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })),
    },
  });
  target.dispatchEvent(event);
}

function picker(root: HTMLElement): HTMLInputElement {
  return root.querySelector('input[type="file"]') as HTMLInputElement;
}

function status(root: HTMLElement): HTMLElement {
  return root.querySelector('[role="status"]') as HTMLElement;
}

function dropZone(root: HTMLElement): HTMLElement {
  return root.querySelector(".stage-file-input__dropzone") as HTMLElement;
}

async function selectViaPicker(
  root: HTMLElement,
  files: File[],
): Promise<void> {
  const input = picker(root);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() => {
    if (status(root).textContent?.includes("Reading")) {
      throw new Error("still loading");
    }
  });
}

describe("renderStageFileInput", () => {
  beforeEach(() => {
    resetWasmBridgeForTests();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a folder-specific prompt in the idle state, not a generic file prompt", () => {
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded: vi.fn(),
      bridgeOptions: testBridgeOptions,
    });

    expect(root.textContent?.toLowerCase()).toContain("folder");
    expect(picker(root).getAttribute("webkitdirectory")).not.toBeNull();
  });

  it("auto-loads and reports success when exactly one candidate is picked, with its sprite sheet resolved", async () => {
    const onLoaded = vi.fn();
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded,
      bridgeOptions: testBridgeOptions,
    });

    await selectViaPicker(root, [
      withRelativePath(makeFile("stage.def", sampleDefText), "pack/stage.def"),
      withRelativePath(makeFile("stage0.sff", "sff-bytes"), "pack/stage0.sff"),
    ]);

    expect(onLoaded).toHaveBeenCalledTimes(1);
    const [result] = onLoaded.mock.calls[0];
    expect(result.fileName).toBe("stage.def");
    expect(result.sffFileName).toBe("stage0.sff");
    expect(status(root).textContent).toContain("stage.def");
    expect(status(root).textContent).toContain("stage0.sff");
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(false);
  });

  it("prompts the user when several .def candidates are found, then loads the chosen one", async () => {
    const onLoaded = vi.fn();
    const root = document.createElement("div");
    renderStageFileInput(root, { onLoaded, bridgeOptions: testBridgeOptions });

    await selectViaPicker(root, [
      withRelativePath(makeFile("stage.def", sampleDefText), "pack/stage.def"),
      withRelativePath(makeFile("alt.def", sampleDefText), "pack/alt.def"),
      withRelativePath(makeFile("stage0.sff", "sff-bytes"), "pack/stage0.sff"),
    ]);

    expect(status(root).textContent).toContain("2");
    const radios = root.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(2);

    radios[0].dispatchEvent(new Event("click", { bubbles: true }));
    const confirmButton = root.querySelector(
      '[data-action="confirm-selection"]',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    confirmButton.dispatchEvent(new Event("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(onLoaded).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a clear error and a recovery action when no .def file is found", async () => {
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded: vi.fn(),
      bridgeOptions: testBridgeOptions,
    });

    await selectViaPicker(root, [
      withRelativePath(makeFile("readme.txt"), "pack/readme.txt"),
    ]);

    expect(status(root).textContent?.toLowerCase()).toContain(".def");
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(true);
    const resetButton = root.querySelector(
      '[data-action="reset"]',
    ) as HTMLButtonElement;
    expect(resetButton.hidden).toBe(false);
  });

  it("names the exact referenced file when the sprite sheet can't be found anywhere in the folder", async () => {
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded: vi.fn(),
      bridgeOptions: testBridgeOptions,
    });

    await selectViaPicker(root, [
      withRelativePath(makeFile("stage.def", sampleDefText), "pack/stage.def"),
    ]);

    expect(status(root).textContent).toContain("stage0.sff");
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(true);
  });

  it("reports ambiguity when more than one file matches the referenced sprite sheet name", async () => {
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded: vi.fn(),
      bridgeOptions: testBridgeOptions,
    });

    await selectViaPicker(root, [
      withRelativePath(makeFile("stage.def", sampleDefText), "pack/stage.def"),
      withRelativePath(makeFile("stage0.sff", "a"), "pack/a/stage0.sff"),
      withRelativePath(makeFile("stage0.sff", "b"), "pack/b/stage0.sff"),
    ]);

    expect(status(root).textContent?.toLowerCase()).toContain("stage0.sff");
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(true);
  });

  it("gathers dropped folder contents and loads the stage the same way as the picker", async () => {
    const onLoaded = vi.fn();
    const root = document.createElement("div");
    renderStageFileInput(root, { onLoaded, bridgeOptions: testBridgeOptions });

    dispatchDrop(dropZone(root), [
      fakeFileEntry("/pack/stage.def", makeFile("stage.def", sampleDefText)),
      fakeFileEntry("/pack/stage0.sff", makeFile("stage0.sff", "sff-bytes")),
    ]);

    await vi.waitFor(() => {
      expect(onLoaded).toHaveBeenCalledTimes(1);
    });
  });

  it("fully clears a previous error before a newly picked folder starts loading", async () => {
    const root = document.createElement("div");
    renderStageFileInput(root, {
      onLoaded: vi.fn(),
      bridgeOptions: testBridgeOptions,
    });

    await selectViaPicker(root, [
      withRelativePath(makeFile("readme.txt"), "pack/readme.txt"),
    ]);
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(true);

    const resetButton = root.querySelector(
      '[data-action="reset"]',
    ) as HTMLButtonElement;
    resetButton.dispatchEvent(new Event("click", { bubbles: true }));

    expect(status(root).textContent).toBe("");
    expect(
      status(root).classList.contains("stage-file-input__status--error"),
    ).toBe(false);
  });
});
