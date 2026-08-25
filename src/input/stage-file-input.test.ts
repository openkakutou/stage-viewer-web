import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetWasmBridgeForTests } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
import type { GatheredFile } from "./folder-entries.ts";
import {
  loadStageFromChosenEntry,
  loadStageFromFolderFiles,
  resolveCandidates,
} from "./stage-file-input.ts";

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
const sampleDefBytes = new Uint8Array(
  readFileSync(path.join(testdataDir, "sample.def")),
);

function gathered(
  name: string,
  relativePath: string,
  bytes: Uint8Array,
): GatheredFile {
  return {
    file: new File([bytes as BufferSource], name),
    relativePath,
  };
}

function defFile(name: string, relativePath = name): GatheredFile {
  return gathered(name, relativePath, sampleDefBytes);
}

function sffFile(name: string, relativePath = name): GatheredFile {
  // sample.def's [BGDef] "spr" references "stage0.sff" — content is never
  // decoded by this item (that's a later WASM capability), so arbitrary
  // bytes are enough to exercise name resolution and byte pass-through.
  return gathered(name, relativePath, new Uint8Array([1, 2, 3, 4]));
}

beforeEach(() => {
  resetWasmBridgeForTests();
});

describe("resolveCandidates", () => {
  it("reports no-files for an empty folder", () => {
    expect(resolveCandidates([])).toEqual({ status: "no-files" });
  });

  it("reports no-candidate when nothing looks like a .def file", () => {
    const result = resolveCandidates([sffFile("stage0.sff")]);
    expect(result).toEqual({ status: "no-candidate" });
  });

  it("auto-resolves the single .def candidate", () => {
    const entry = defFile("stage.def");
    const result = resolveCandidates([entry, sffFile("stage0.sff")]);
    expect(result).toEqual({ status: "success", entry });
  });

  it("asks the user to pick when several .def files are present", () => {
    const a = defFile("stage.def");
    const b = defFile("alt.def");
    const result = resolveCandidates([a, b]);
    expect(result).toEqual({
      status: "needs-selection",
      candidates: [a, b],
    });
  });
});

describe("loadStageFromFolderFiles — nominal path", () => {
  it("loads the stage and resolves the referenced sprite sheet by exact name", async () => {
    const def = defFile("stage.def");
    const sff = sffFile("stage0.sff");

    const result = await loadStageFromFolderFiles([def, sff], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.fileName).toBe("stage.def");
    expect(result.stage.bgDef.spriteFile).toBe("stage0.sff");
    expect(result.sffFileName).toBe("stage0.sff");
    expect(result.sffBytes).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("resolves the referenced sprite sheet from a nested subfolder", async () => {
    const def = defFile("stage.def");
    const sff = sffFile("stage0.sff", "sprites/stage0.sff");

    const result = await loadStageFromFolderFiles([def, sff], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.sffRelativePath).toBe("sprites/stage0.sff");
  });

  it("falls back to a case-insensitive match when no exact name matches", async () => {
    const def = defFile("stage.def");
    const sff = sffFile("STAGE0.SFF");

    const result = await loadStageFromFolderFiles([def, sff], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.sffFileName).toBe("STAGE0.SFF");
  });

  it("prefers an exact-case match over a differently-cased one when both exist", async () => {
    const def = defFile("stage.def");
    const exact = sffFile("stage0.sff", "a/stage0.sff");
    const differentCase = sffFile("STAGE0.SFF", "b/STAGE0.SFF");

    const result = await loadStageFromFolderFiles([def, differentCase, exact], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.sffRelativePath).toBe("a/stage0.sff");
  });
});

describe("loadStageFromFolderFiles — candidate resolution passthrough", () => {
  it("returns no-files for an empty folder", async () => {
    const result = await loadStageFromFolderFiles([], {
      bridgeOptions: testBridgeOptions,
    });
    expect(result).toEqual({ status: "no-files" });
  });

  it("returns no-candidate when no .def file is present", async () => {
    const result = await loadStageFromFolderFiles([sffFile("stage0.sff")], {
      bridgeOptions: testBridgeOptions,
    });
    expect(result).toEqual({ status: "no-candidate" });
  });

  it("returns needs-selection without reading anything when several .def files are present", async () => {
    const a = defFile("stage.def");
    const b = defFile("alt.def");
    const result = await loadStageFromFolderFiles([a, b], {
      bridgeOptions: testBridgeOptions,
    });
    expect(result).toEqual({ status: "needs-selection", candidates: [a, b] });
  });
});

describe("loadStageFromChosenEntry — error paths", () => {
  it("returns a typed parse-error for a malformed .def, not a thrown exception", async () => {
    const malformed = gathered(
      "stage.def",
      "stage.def",
      new Uint8Array(new TextEncoder().encode("[BGDef\nspr = x\n")),
    );

    const result = await loadStageFromChosenEntry(malformed, [malformed], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result.status).toBe("parse-error");
    if (result.status !== "parse-error")
      throw new Error("expected parse-error");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("returns a typed read-error when the .def bytes can't be read", async () => {
    const def = defFile("stage.def");

    const result = await loadStageFromChosenEntry(def, [def], {
      bridgeOptions: testBridgeOptions,
      readFileBytes: async () => {
        throw new Error("disk error");
      },
    });

    expect(result).toEqual({
      status: "read-error",
      fileName: "stage.def",
      message: "disk error",
    });
  });

  it("reports the exact referenced name when the sprite sheet is nowhere in the folder", async () => {
    const def = defFile("stage.def");

    const result = await loadStageFromChosenEntry(def, [def], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result).toEqual({
      status: "sprite-not-found",
      fileName: "stage.def",
      referencedName: "stage0.sff",
    });
  });

  it("reports a named (empty) reference when the stage has no sprite sheet key at all", async () => {
    // A zero-value Stage is valid per `stage`'s own docs — a `.def` with no
    // [BGDef] "spr" key parses successfully with an empty spriteFile,
    // rather than erroring. Nothing was actually referenced to resolve.
    const bare = gathered(
      "stage.def",
      "stage.def",
      new Uint8Array(new TextEncoder().encode("[Info]\nname = Bare Stage\n")),
    );

    const result = await loadStageFromChosenEntry(bare, [bare], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result).toEqual({
      status: "sprite-not-found",
      fileName: "stage.def",
      referencedName: "",
    });
  });

  it("reports ambiguity when more than one file matches the referenced name", async () => {
    const def = defFile("stage.def");
    const first = sffFile("stage0.sff", "a/stage0.sff");
    const second = sffFile("stage0.sff", "b/stage0.sff");

    const result = await loadStageFromChosenEntry(def, [def, first, second], {
      bridgeOptions: testBridgeOptions,
    });

    expect(result).toEqual({
      status: "sprite-ambiguous",
      fileName: "stage.def",
      referencedName: "stage0.sff",
      candidates: [first, second],
    });
  });

  it("returns a typed sprite-read-error when the resolved sprite file's bytes can't be read", async () => {
    const def = defFile("stage.def");
    const sff = sffFile("stage0.sff");

    const result = await loadStageFromChosenEntry(def, [def, sff], {
      bridgeOptions: testBridgeOptions,
      readFileBytes: async (file) => {
        if (file.name === "stage0.sff") throw new Error("disk error");
        return sampleDefBytes;
      },
    });

    expect(result).toEqual({
      status: "sprite-read-error",
      fileName: "stage.def",
      sffFileName: "stage0.sff",
      message: "disk error",
    });
  });
});
