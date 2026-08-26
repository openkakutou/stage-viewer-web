import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadStage, resetWasmBridgeForTests } from "./bridge.ts";
import type { WasmBridgeOptions } from "./bridge.ts";

// The real WASM assets (public/wasm/, gitignored) are fetched via
// `npm run wasm:download -- <version>` before tests run in this
// environment. There is no running dev server under jsdom, so the fetch
// effects are injected as Node-backed stubs instead — see
// character-viewer-web's .vibe/decisions/002-wasm-bridge-loading-and-result-shape.md,
// whose loading strategy this bridge mirrors exactly.
const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const testOptions: WasmBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "stage.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "testdata");
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}

const defBytes = fixture("sample.def");

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("loadStage", () => {
  it("loads and instantiates the WASM module and returns a typed stage for valid input", async () => {
    const result = await loadStage(defBytes, testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");

    expect(result.stage.bgDef.spriteFile).toBe("stage0.sff");
    expect(result.stage.bgDef.zOffset).toBe(220);
    expect(result.stage.elements).toHaveLength(2);
  });

  it("maps every JSON field of a non-trivial BG element to its typed shape", async () => {
    const result = await loadStage(defBytes, testOptions);
    if (!result.ok) throw new Error("expected ok result");

    const parallax = result.stage.elements?.[1];
    expect(parallax).toEqual({
      name: "cloud",
      type: "parallax",
      sprite: { group: 1, image: 0 },
      actionNumber: 0,
      layerNo: 0,
      startX: 10,
      startY: 20,
      deltaX: 0.5,
      deltaY: 0.8,
      tileX: 0,
      tileY: 0,
      tileSpacingX: 0,
      tileSpacingY: 0,
    });
  });

  it("maps the stage's name, and reports a missing author as an empty string", async () => {
    const result = await loadStage(defBytes, testOptions);
    if (!result.ok) throw new Error("expected ok result");

    expect(result.stage.name).toBe("Training Room");
    expect(result.stage.author).toBe("");
  });

  it("maps camera bounds and stage boundaries to their typed shape", async () => {
    const result = await loadStage(defBytes, testOptions);
    if (!result.ok) throw new Error("expected ok result");

    expect(result.stage.cameraBounds).toEqual({
      left: -180,
      right: 180,
      high: -240,
      low: 0,
    });
    expect(result.stage.stageBoundaries.left).toBe(-1000);
    expect(result.stage.stageBoundaries.right).toBe(1000);
  });

  it("returns a typed error, not a thrown exception, for malformed .def bytes", async () => {
    const malformed = new Uint8Array(
      new TextEncoder().encode("[BGDef\nspr = x\n"),
    );

    const result = await loadStage(malformed, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("returns an empty-but-typed stage, not an error, for empty input", async () => {
    // Empty bytes contain no section header at all, so nothing is
    // structurally wrong for the parser to reject — it's a valid,
    // degenerate stage (mirrors `stage`'s own zero-value-is-valid
    // guarantee, see docs/data-model.md), not a malformed one.
    const result = await loadStage(new Uint8Array(0), testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.stage.bgDef.spriteFile).toBe("");
    // A nil Go slice marshals to JSON `null`, not `[]` — see the `elements`
    // field's own doc comment in types.ts.
    expect(result.stage.elements).toBeNull();
  });

  it("still works on a later call after a prior call errored", async () => {
    const malformed = new Uint8Array(
      new TextEncoder().encode("[BGDef\nspr = x\n"),
    );
    const errorResult = await loadStage(malformed, testOptions);
    expect(errorResult.ok).toBe(false);

    const okResult = await loadStage(defBytes, testOptions);
    expect(okResult.ok).toBe(true);
  });

  it("does not re-fetch or re-instantiate the module on a second call", async () => {
    let fetchCount = 0;
    const countingOptions: WasmBridgeOptions = {
      fetchWasmExecSource: async () => {
        fetchCount += 1;
        return testOptions.fetchWasmExecSource?.() ?? "";
      },
      fetchWasmBytes: testOptions.fetchWasmBytes,
    };

    await loadStage(defBytes, countingOptions);
    await loadStage(defBytes, countingOptions);

    expect(fetchCount).toBe(1);
  });
});
