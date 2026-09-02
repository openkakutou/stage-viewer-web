import { loadStage as defaultLoadStage } from "../wasm/bridge.ts";
import type { WasmBridgeOptions } from "../wasm/bridge.ts";
// Combines candidate detection (which gathered file is the stage's own
// `.def`) with reading it and loading it through the WASM bridge, then
// resolving the sprite sheet it references from the same already-gathered
// folder listing — see backlog item 002 and
// .vibe/decisions/001-sprite-sheet-resolved-by-basename-with-case-insensitive-fallback.md
// for the resolution rules. Mirrors `lifebar-viewer-web`'s own
// `lifebar-folder-input.ts` shape (candidate resolution → read → parse),
// extended with this item's own stricter, named-error sprite-sheet
// resolution instead of that sibling's silent-if-unresolved one. Per
// backlog item 006, also resolves the stage's optional 3D model/`.hdr`
// environment (never load-blocking, unlike the sprite sheet — see
// ./model-assets.ts).
import type { StageData } from "../wasm/types.ts";
import {
  type BasenameResolution,
  resolveFileByBasename,
} from "./basename-resolution.ts";
export { resolveFileByBasename } from "./basename-resolution.ts";
export type { BasenameResolution } from "./basename-resolution.ts";
import { readFileAsBytes } from "./file-bytes.ts";
export { readFileAsBytes } from "./file-bytes.ts";
import type { GatheredFile } from "./folder-entries.ts";
import {
  type ModelAssetsResolution,
  resolveModelAssets,
} from "./model-assets.ts";

export type CandidateResolution =
  | { status: "no-files" }
  | { status: "no-candidate" }
  | { status: "success"; entry: GatheredFile }
  | { status: "needs-selection"; candidates: GatheredFile[] };

function isCandidateDefFile(gathered: GatheredFile): boolean {
  return gathered.file.name.toLowerCase().endsWith(".def");
}

/**
 * Decides what to do with the files gathered from a folder selection: none
 * gathered at all, none matching the `.def` heuristic, exactly one match
 * (auto-load), or several (the caller must ask the user to pick one).
 */
export function resolveCandidates(
  files: readonly GatheredFile[],
): CandidateResolution {
  if (files.length === 0) {
    return { status: "no-files" };
  }
  const candidates = files.filter(isCandidateDefFile);
  if (candidates.length === 0) {
    return { status: "no-candidate" };
  }
  if (candidates.length === 1) {
    return { status: "success", entry: candidates[0] };
  }
  return { status: "needs-selection", candidates };
}

export type SpriteSheetResolution = BasenameResolution;

/** Resolves the stage's referenced sprite sheet — see `resolveFileByBasename`. */
export function resolveSpriteSheet(
  referencedSpriteFile: string,
  files: readonly GatheredFile[],
): SpriteSheetResolution {
  return resolveFileByBasename(referencedSpriteFile, files);
}

export type StageFolderInputResult =
  | {
      status: "success";
      fileName: string;
      relativePath: string;
      stage: StageData;
      defBytes: Uint8Array;
      sffFileName: string;
      sffRelativePath: string;
      sffBytes: Uint8Array;
      /**
       * The stage's optional 3D model + `.hdr` environment lighting,
       * resolved from the same folder listing — never a load-blocking
       * failure the way the sprite sheet above is: a missing/ambiguous/
       * unreadable model or environment file still yields an overall
       * `"success"` result here, with the failure carried inside this
       * field for the 3D preview to show as its own placeholder. See
       * backlog item 006 and .vibe/decisions/005.
       */
      modelAssets: ModelAssetsResolution;
    }
  | { status: "no-files" }
  | { status: "no-candidate" }
  | { status: "needs-selection"; candidates: GatheredFile[] }
  | { status: "read-error"; fileName: string; message: string }
  | { status: "parse-error"; fileName: string; message: string }
  | { status: "sprite-not-found"; fileName: string; referencedName: string }
  | {
      status: "sprite-ambiguous";
      fileName: string;
      referencedName: string;
      candidates: GatheredFile[];
    }
  | {
      status: "sprite-read-error";
      fileName: string;
      sffFileName: string;
      message: string;
    };

export interface StageFolderInputOptions {
  /** Reads a File's bytes. Defaults to `readFileAsBytes`; injectable for testing. */
  readFileBytes?: (file: File) => Promise<Uint8Array>;
  /** Loads a stage via the WASM bridge. Defaults to the real bridge; injectable for testing. */
  loadStage?: (
    defBytes: Uint8Array,
    options?: WasmBridgeOptions,
  ) => ReturnType<typeof defaultLoadStage>;
  /** Forwarded to the default loadStage; ignored if loadStage is overridden. */
  bridgeOptions?: WasmBridgeOptions;
}

/**
 * Reads and parses a single already-chosen `.def` candidate, then resolves
 * and reads its referenced sprite sheet from `files` (the same folder
 * listing the candidate itself came from).
 */
export async function loadStageFromChosenEntry(
  entry: GatheredFile,
  files: readonly GatheredFile[],
  options: StageFolderInputOptions = {},
): Promise<StageFolderInputResult> {
  const readFileBytes = options.readFileBytes ?? readFileAsBytes;
  const loadStage = options.loadStage ?? defaultLoadStage;
  const fileName = entry.file.name;

  let defBytes: Uint8Array;
  try {
    defBytes = await readFileBytes(entry.file);
  } catch (err) {
    return {
      status: "read-error",
      fileName,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const loaded = await loadStage(defBytes, options.bridgeOptions);
  if (!loaded.ok) {
    return { status: "parse-error", fileName, message: loaded.error };
  }
  const stage = loaded.stage;

  const spriteResolution = resolveSpriteSheet(stage.bgDef.spriteFile, files);
  if (spriteResolution.status === "not-found") {
    return {
      status: "sprite-not-found",
      fileName,
      referencedName: spriteResolution.referencedName,
    };
  }
  if (spriteResolution.status === "ambiguous") {
    return {
      status: "sprite-ambiguous",
      fileName,
      referencedName: spriteResolution.referencedName,
      candidates: spriteResolution.candidates,
    };
  }
  if (spriteResolution.status === "no-reference") {
    // A stage with no [BGDef] "spr" key at all — not a resolution failure,
    // nothing was actually referenced to find. Acceptance criteria only
    // require a named error for a reference that can't be resolved.
    return {
      status: "sprite-not-found",
      fileName,
      referencedName: "",
    };
  }

  const sffEntry = spriteResolution.entry;
  let sffBytes: Uint8Array;
  try {
    sffBytes = await readFileBytes(sffEntry.file);
  } catch (err) {
    return {
      status: "sprite-read-error",
      fileName,
      sffFileName: sffEntry.file.name,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const modelAssets = await resolveModelAssets(stage, files, {
    readFileBytes,
  });

  return {
    status: "success",
    fileName,
    relativePath: entry.relativePath,
    stage,
    defBytes,
    sffFileName: sffEntry.file.name,
    sffRelativePath: sffEntry.relativePath,
    sffBytes,
    modelAssets,
  };
}

/**
 * Resolves which candidate `.def` to use among the files gathered from a
 * folder selection, then — only once a single candidate is settled —
 * reads, parses, and resolves its sprite sheet. `no-files`/`no-candidate`/
 * `needs-selection` short-circuit without reading anything.
 */
export async function loadStageFromFolderFiles(
  files: readonly GatheredFile[],
  options: StageFolderInputOptions = {},
): Promise<StageFolderInputResult> {
  const resolution = resolveCandidates(files);
  if (resolution.status !== "success") {
    return resolution;
  }
  return loadStageFromChosenEntry(resolution.entry, files, options);
}
