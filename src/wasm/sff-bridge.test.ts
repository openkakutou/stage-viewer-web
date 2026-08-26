import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSpriteSheet,
  resetSffWasmBridgeForTests,
  resolveSpritePixels,
} from "./sff-bridge.ts";
import type { SffWasmBridgeOptions } from "./sff-bridge.ts";

// The real WASM assets (public/wasm/sff/, gitignored) are fetched via
// `npm run wasm:download:sff -- <version>` before tests run in this
// environment — a separate subdirectory from `stage`'s own assets, see
// .vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md.
const sffWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
  "sff",
);
const testOptions: SffWasmBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(sffWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(sffWasmDir, "sff.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "testdata");
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}

function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

const sffBytes = fixture("v1-basic.sff");

beforeEach(() => {
  resetSffWasmBridgeForTests();
});

describe("loadSpriteSheet", () => {
  it("loads and instantiates the WASM module and returns typed sprite groups for valid input", async () => {
    const result = await loadSpriteSheet(sffBytes, testOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.spriteGroups).toEqual([
      {
        index: 0,
        sprites: [
          {
            group: 0,
            image: 0,
            width: 57,
            height: 103,
            axisX: 25,
            axisY: 99,
            palette: 0,
          },
        ],
      },
    ]);
  });

  it("returns a typed error instead of throwing when the bytes are malformed", async () => {
    const garbageBytes = textBytes("this is not a valid .sff file");

    const result = await loadSpriteSheet(garbageBytes, testOptions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("resolveSpritePixels", () => {
  it("decodes real pixel data for a valid sprite request", async () => {
    const [result] = await resolveSpritePixels(
      sffBytes,
      [[0, 0]],
      null,
      testOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.width).toBe(57);
    expect(result.height).toBe(103);
    expect(result.pixels.length).toBe(57 * 103 * 4);
  });

  it("reports a per-request error for a sprite absent from the sheet, without failing the whole batch", async () => {
    const [missing, present] = await resolveSpritePixels(
      sffBytes,
      [
        [9, 9],
        [0, 0],
      ],
      null,
      testOptions,
    );

    expect(missing.ok).toBe(false);
    expect(present.ok).toBe(true);
  });
});
