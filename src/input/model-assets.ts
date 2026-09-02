// Backlog item 006: resolves the two optional files an Ikemen GO 3D
// model-based stage references from its already-gathered folder listing --
// the glTF model itself (`bgDef.modelFile`) and its `.hdr` environment
// lighting (`model.environment`) -- reusing the same basename resolution
// rule (exact match, case-insensitive fallback, ambiguous-if-more-than-one)
// the sprite sheet already established (see
// ./basename-resolution.ts's resolveFileByBasename and
// .vibe/decisions/001).
//
// Deliberately never blocking: unlike the sprite sheet (a hard load error
// per item 002/003), a stage with no [Model] data at all reports "none"
// with zero file reads, and a missing/ambiguous/unreadable model or `.hdr`
// only produces a typed failure result for the caller (the 3D preview
// renderer) to show as its own placeholder/error state -- the rest of the
// app (characteristics panel, 2D BG preview) is unaffected either way. See
// .vibe/decisions/005-3d-model-preview-design.md, point 9.
import type { StageData } from "../wasm/types.ts";
import { resolveFileByBasename } from "./basename-resolution.ts";
import { readFileAsBytes as defaultReadFileAsBytes } from "./file-bytes.ts";
import type { GatheredFile } from "./folder-entries.ts";

export type ModelAssetsResolution =
  | { status: "none" }
  | {
      status: "success";
      modelBytes: Uint8Array;
      modelFileName: string;
      environmentBytes: Uint8Array | null;
      environmentFileName: string | null;
    }
  | { status: "model-not-found"; referencedName: string }
  | {
      status: "model-ambiguous";
      referencedName: string;
      candidates: GatheredFile[];
    }
  | { status: "model-read-error"; fileName: string; message: string }
  | { status: "environment-not-found"; referencedName: string }
  | {
      status: "environment-ambiguous";
      referencedName: string;
      candidates: GatheredFile[];
    }
  | { status: "environment-read-error"; fileName: string; message: string };

export interface ResolveModelAssetsOptions {
  /** Reads a File's bytes. Defaults to the shared file-input reader; injectable for testing. */
  readFileBytes?: (file: File) => Promise<Uint8Array>;
}

/**
 * Resolves (and reads) `stage`'s referenced 3D model and, if any, its
 * `.hdr` environment lighting from `files` -- the same already-gathered
 * folder listing the stage's own `.def`/sprite sheet were loaded from.
 */
export async function resolveModelAssets(
  stage: StageData,
  files: readonly GatheredFile[],
  options: ResolveModelAssetsOptions = {},
): Promise<ModelAssetsResolution> {
  if (stage.bgDef.modelFile === "") {
    return { status: "none" };
  }
  const readFileBytes = options.readFileBytes ?? defaultReadFileAsBytes;

  const modelResolution = resolveFileByBasename(stage.bgDef.modelFile, files);
  if (
    modelResolution.status === "not-found" ||
    modelResolution.status === "no-reference"
  ) {
    return { status: "model-not-found", referencedName: stage.bgDef.modelFile };
  }
  if (modelResolution.status === "ambiguous") {
    return {
      status: "model-ambiguous",
      referencedName: stage.bgDef.modelFile,
      candidates: modelResolution.candidates,
    };
  }

  let modelBytes: Uint8Array;
  try {
    modelBytes = await readFileBytes(modelResolution.entry.file);
  } catch (err) {
    return {
      status: "model-read-error",
      fileName: modelResolution.entry.file.name,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const environmentRef = stage.model.environment;
  if (environmentRef === "") {
    return {
      status: "success",
      modelBytes,
      modelFileName: modelResolution.entry.file.name,
      environmentBytes: null,
      environmentFileName: null,
    };
  }

  const environmentResolution = resolveFileByBasename(environmentRef, files);
  if (
    environmentResolution.status === "not-found" ||
    environmentResolution.status === "no-reference"
  ) {
    return { status: "environment-not-found", referencedName: environmentRef };
  }
  if (environmentResolution.status === "ambiguous") {
    return {
      status: "environment-ambiguous",
      referencedName: environmentRef,
      candidates: environmentResolution.candidates,
    };
  }

  let environmentBytes: Uint8Array;
  try {
    environmentBytes = await readFileBytes(environmentResolution.entry.file);
  } catch (err) {
    return {
      status: "environment-read-error",
      fileName: environmentResolution.entry.file.name,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    status: "success",
    modelBytes,
    modelFileName: modelResolution.entry.file.name,
    environmentBytes,
    environmentFileName: environmentResolution.entry.file.name,
  };
}
