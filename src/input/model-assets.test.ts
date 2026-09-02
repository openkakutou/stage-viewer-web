import { describe, expect, it } from "vitest";
import type { BGdef, Model, StageData } from "../wasm/types.ts";
import { readFileAsBytes } from "./file-bytes.ts";
import type { GatheredFile } from "./folder-entries.ts";
import { resolveModelAssets } from "./model-assets.ts";

function gathered(
  name: string,
  bytes: Uint8Array,
  relativePath = name,
): GatheredFile {
  return {
    file: new File([bytes as BufferSource], name),
    relativePath,
  };
}

function bgDef(overrides: Partial<BGdef> = {}): BGdef {
  return {
    spriteFile: "stage0.sff",
    localCoordWidth: 320,
    localCoordHeight: 240,
    zOffset: 0,
    zoomOut: 1,
    zoomIn: 1,
    modelFile: "",
    near: 1,
    far: 1000,
    fov: 45,
    yShift: 0,
    ...overrides,
  };
}

function model(overrides: Partial<Model> = {}): Model {
  return {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    environment: "",
    environmentIntensity: 1,
    ...overrides,
  };
}

function stage(overrides: Partial<StageData> = {}): StageData {
  return {
    name: "",
    author: "",
    bgDef: bgDef(),
    elements: null,
    animations: null,
    cameraBounds: { left: 0, right: 0, high: 0, low: 0 },
    stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
    model: model(),
    scaling: {
      depthToScreen: 1,
      topZ: 0,
      bottomZ: 0,
      topScale: 1,
      bottomScale: 1,
    },
    playerStartZ: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0 },
    ...overrides,
  };
}

const modelBytes = new Uint8Array([1, 2, 3]);
const hdrBytes = new Uint8Array([4, 5, 6]);

describe("resolveModelAssets", () => {
  it("reports 'none' for a stage with no [Model] data, without reading any file", async () => {
    let readCount = 0;
    const result = await resolveModelAssets(stage(), [], {
      readFileBytes: async () => {
        readCount++;
        return new Uint8Array();
      },
    });
    expect(result).toEqual({ status: "none" });
    expect(readCount).toBe(0);
  });

  it("resolves and reads the model file when referenced, with no environment reference", async () => {
    const files = [gathered("mystage.glb", modelBytes)];
    const result = await resolveModelAssets(
      stage({ bgDef: bgDef({ modelFile: "mystage.glb" }) }),
      files,
      { readFileBytes: readFileAsBytes },
    );
    expect(result).toEqual({
      status: "success",
      modelBytes,
      modelFileName: "mystage.glb",
      environmentBytes: null,
      environmentFileName: null,
    });
  });

  it("resolves and reads both the model and its referenced .hdr environment", async () => {
    const files = [
      gathered("mystage.glb", modelBytes),
      gathered("env.hdr", hdrBytes),
    ];
    const result = await resolveModelAssets(
      stage({
        bgDef: bgDef({ modelFile: "mystage.glb" }),
        model: model({ environment: "env.hdr" }),
      }),
      files,
      { readFileBytes: readFileAsBytes },
    );
    expect(result).toEqual({
      status: "success",
      modelBytes,
      modelFileName: "mystage.glb",
      environmentBytes: hdrBytes,
      environmentFileName: "env.hdr",
    });
  });

  it("resolves a model referenced with a different case than the file on disk", async () => {
    const files = [gathered("MyStage.GLB", modelBytes)];
    const result = await resolveModelAssets(
      stage({ bgDef: bgDef({ modelFile: "mystage.glb" }) }),
      files,
      { readFileBytes: readFileAsBytes },
    );
    expect(result.status).toBe("success");
  });

  it("reports model-not-found when the referenced model isn't in the folder", async () => {
    const result = await resolveModelAssets(
      stage({ bgDef: bgDef({ modelFile: "missing.glb" }) }),
      [],
    );
    expect(result).toEqual({
      status: "model-not-found",
      referencedName: "missing.glb",
    });
  });

  it("reports model-ambiguous when more than one file matches the model's basename", async () => {
    const files = [
      gathered("mystage.glb", modelBytes, "a/mystage.glb"),
      gathered("mystage.glb", modelBytes, "b/mystage.glb"),
    ];
    const result = await resolveModelAssets(
      stage({ bgDef: bgDef({ modelFile: "mystage.glb" }) }),
      files,
    );
    expect(result.status).toBe("model-ambiguous");
  });

  it("reports model-read-error without touching the environment when the model file can't be read", async () => {
    const files = [
      gathered("mystage.glb", modelBytes),
      gathered("env.hdr", hdrBytes),
    ];
    let envRead = false;
    const result = await resolveModelAssets(
      stage({
        bgDef: bgDef({ modelFile: "mystage.glb" }),
        model: model({ environment: "env.hdr" }),
      }),
      files,
      {
        readFileBytes: async (file) => {
          if (file.name === "env.hdr") envRead = true;
          if (file.name === "mystage.glb") throw new Error("disk error");
          return readFileAsBytes(file);
        },
      },
    );
    expect(result).toEqual({
      status: "model-read-error",
      fileName: "mystage.glb",
      message: "disk error",
    });
    expect(envRead).toBe(false);
  });

  it("reports environment-not-found when the model resolves but the .hdr reference doesn't", async () => {
    const files = [gathered("mystage.glb", modelBytes)];
    const result = await resolveModelAssets(
      stage({
        bgDef: bgDef({ modelFile: "mystage.glb" }),
        model: model({ environment: "missing.hdr" }),
      }),
      files,
      { readFileBytes: readFileAsBytes },
    );
    expect(result).toEqual({
      status: "environment-not-found",
      referencedName: "missing.hdr",
    });
  });

  it("reports environment-ambiguous when more than one file matches the .hdr basename", async () => {
    const files = [
      gathered("mystage.glb", modelBytes),
      gathered("env.hdr", hdrBytes, "a/env.hdr"),
      gathered("env.hdr", hdrBytes, "b/env.hdr"),
    ];
    const result = await resolveModelAssets(
      stage({
        bgDef: bgDef({ modelFile: "mystage.glb" }),
        model: model({ environment: "env.hdr" }),
      }),
      files,
      { readFileBytes: readFileAsBytes },
    );
    expect(result.status).toBe("environment-ambiguous");
  });

  it("reports environment-read-error when the .hdr file resolves but can't be read", async () => {
    const files = [
      gathered("mystage.glb", modelBytes),
      gathered("env.hdr", hdrBytes),
    ];
    const result = await resolveModelAssets(
      stage({
        bgDef: bgDef({ modelFile: "mystage.glb" }),
        model: model({ environment: "env.hdr" }),
      }),
      files,
      {
        readFileBytes: async (file) => {
          if (file.name === "env.hdr") throw new Error("disk error");
          return readFileAsBytes(file);
        },
      },
    );
    expect(result).toEqual({
      status: "environment-read-error",
      fileName: "env.hdr",
      message: "disk error",
    });
  });
});
