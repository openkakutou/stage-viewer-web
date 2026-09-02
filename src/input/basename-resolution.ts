import type { GatheredFile } from "./folder-entries.ts";

// Shared by every folder-input consumer that resolves a `.def`-referenced
// path against the already-gathered folder listing, by basename (the
// sprite sheet, and — per backlog item 006 — an optional 3D model/`.hdr`
// environment file). Kept in its own module so `stage-file-input.ts` and
// `model-assets.ts` can both depend on it without depending on each other.
// See .vibe/decisions/001-sprite-sheet-resolved-by-basename-with-case-insensitive-fallback.md.

/** The last path segment of a `.def`-referenced path, forward or backslash separated. */
function referencedBasename(referencedPath: string): string {
  const normalized = referencedPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1];
}

export type BasenameResolution =
  | { status: "no-reference" }
  | { status: "success"; entry: GatheredFile }
  | { status: "not-found"; referencedName: string }
  | {
      status: "ambiguous";
      referencedName: string;
      candidates: GatheredFile[];
    };

/**
 * Resolves a `.def`-referenced path from the already-gathered folder
 * listing, by basename — exact match first, case-insensitive fallback
 * second (real MUGEN/Ikemen `.def` files routinely reference a different
 * case than the file actually has on disk). More than one match at either
 * level is reported as ambiguous rather than silently picking one.
 */
export function resolveFileByBasename(
  referencedPath: string,
  files: readonly GatheredFile[],
): BasenameResolution {
  if (referencedPath.trim() === "") {
    return { status: "no-reference" };
  }

  const targetBasename = referencedBasename(referencedPath);

  const exact = files.filter((f) => f.file.name === targetBasename);
  if (exact.length === 1) return { status: "success", entry: exact[0] };
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      referencedName: referencedPath,
      candidates: exact,
    };
  }

  const targetLower = targetBasename.toLowerCase();
  const caseInsensitive = files.filter(
    (f) => f.file.name.toLowerCase() === targetLower,
  );
  if (caseInsensitive.length === 1) {
    return { status: "success", entry: caseInsensitive[0] };
  }
  if (caseInsensitive.length > 1) {
    return {
      status: "ambiguous",
      referencedName: referencedPath,
      candidates: caseInsensitive,
    };
  }

  return { status: "not-found", referencedName: referencedPath };
}
