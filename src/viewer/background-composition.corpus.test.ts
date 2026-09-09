// Real-stage-corpus rendering sanity test (backlog item 010). Unlike every
// other test in this file's neighborhood, this one runs the full real
// pipeline (stage.wasm -> sff.wasm -> buildDrawPlan) against every `.def`
// file in a local, machine-specific corpus of real, unmodified stages —
// gated on the same `STAGE_CORPUS_DIR` env var the sibling `stage` repo's
// own `corpus_compat_test.go` already uses (unset => skipped, never runs in
// CI or on another machine). See docs/testing.md's "Real-stage-corpus
// rendering sanity test" section for the full rationale, the threshold
// derivation below, and this scan's latest results against the local
// corpus.
//
// `stage`'s own corpus scan only proves a file *parses*. This one proves
// the *parsed result renders sensibly* — the class of bug that let
// `Dengeki_Subway.def` (a real corpus file) parse cleanly while its
// composed preview showed one oversized, cropped fragment instead of a
// coherent scene, because `[StageInfo]`'s `xscale`/`yscale` (backlog item
// 009) wasn't applied in composition. Nothing in the rest of this test
// suite — all hand-picked or synthetic fixtures — would ever have caught
// that; this test exists so the next bug shaped like it is caught by a
// test run instead of by a user noticing an empty-looking canvas.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadStage, resolveAnimationFrames } from "../wasm/bridge.ts";
import { loadSpriteSheet, resolveSpritePixels } from "../wasm/sff-bridge.ts";
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGAnimation, BGElement, SpriteRef } from "../wasm/types.ts";
import {
  type DrawCommand,
  type ResolvedSpritePixels,
  buildDrawPlan,
  classifyAnimationElements,
  collectSpriteRequests,
  spriteRequestKey,
} from "./background-composition.ts";

const STAGE_CORPUS_DIR_ENV = "STAGE_CORPUS_DIR";
const corpusDir = process.env[STAGE_CORPUS_DIR_ENV];

// -----------------------------------------------------------------------
// The bounds-sanity heuristic itself — see docs/testing.md for the full,
// numbers-backed derivation. Kept local to this test file rather than
// exported from background-composition.ts: it's a diagnostic for corpus
// data, not part of the app's actual rendering behavior, mirroring how
// `stage`'s own corpus_compat_test.go keeps its scan/report logic entirely
// inside the test file rather than the library it exercises.
// -----------------------------------------------------------------------

/**
 * How far past a `[0, spaceSize]` interval a `[min, min+size]` interval
 * extends, as a multiple of `spaceSize` — `0` whenever the two overlap at
 * all, a positive number otherwise (however far past the near edge).
 */
function nonOverlapDistanceRatio(
  min: number,
  size: number,
  spaceSize: number,
): number {
  const max = min + size;
  if (max < 0) return -max / spaceSize;
  if (min > spaceSize) return (min - spaceSize) / spaceSize;
  return 0;
}

/**
 * A `[StageInfo]` `localcoord` this repo has never seen populated: `stage`
 * leaves `LocalCoordWidth`/`LocalCoordHeight` at the Go zero value `0` when
 * a `.def`'s `[StageInfo]` section omits `localcoord` entirely (confirmed
 * against 7 real corpus files during this item's own development — see
 * docs/testing.md). A zero-size local coordinate space is nonsensical on
 * its own regardless of any element: `background-preview.ts` sizes its
 * canvas directly from these fields, so this collapses the whole preview
 * to a literal 0x0 canvas.
 */
function isLocalCoordDegenerate(
  localCoordWidth: number,
  localCoordHeight: number,
): boolean {
  return localCoordWidth <= 0 || localCoordHeight <= 0;
}

/**
 * `width`/`height` drawn at more than this multiple of the stage's own
 * `localCoordWidth`/`localCoordHeight`, in either dimension, counts as
 * "oversized" — calibrated above the largest ratio any legitimate element
 * reaches anywhere in the real 58-file local corpus (2.22x, a tall parallax
 * cloud layer in `Otherworldly Forest.def`) with comfortable headroom.
 */
const OVERSIZED_RATIO = 3.5;

/**
 * How far a drawn element may extend past the local coordinate rectangle,
 * as a multiple of that dimension's own size, before counting as
 * "offscreen" — calibrated above the largest overshoot any legitimate
 * *oversized* element reaches in the real corpus (well under 1x; see
 * docs/testing.md) while comfortably below the overshoot the historical
 * `xscale`/`yscale` bug reaches on its own affected elements (over 0.6x).
 */
const OFFSCREEN_MARGIN_RATIO = 0.25;

/**
 * Flags a resolved sprite's computed draw bounds as nonsensical relative to
 * the stage's own local coordinate space. Neither an oversized element nor
 * an offscreen-at-rest element is unusual on its own in real content (a
 * background layer wider than the visible screen, or a parallax layer
 * positioned to scroll into view later, are both completely normal) — the
 * two together is the actual signature of a broken scale factor, since a
 * missing scale multiplies both an element's position *and* its size by
 * the same erroneous amount. This is exactly the check that would have
 * caught backlog item 009's `xscale`/`yscale` bug: reproducing
 * `Dengeki_Subway.def`'s composition without its `0.35`/`0.35` scale
 * applied reaches up to 6.4x oversized *and* up to 1.06x offscreen on the
 * same elements, comfortably clearing both thresholds together, while no
 * real corpus file does so today (see docs/testing.md for the full
 * numbers).
 */
function isDrawBoundsNonsensical(
  command: DrawCommand & { kind: "sprite" },
  localCoordWidth: number,
  localCoordHeight: number,
): boolean {
  const sizeRatio = Math.max(
    command.width / localCoordWidth,
    command.height / localCoordHeight,
  );
  if (sizeRatio <= OVERSIZED_RATIO) return false;

  const overshootX = nonOverlapDistanceRatio(
    command.x,
    command.width,
    localCoordWidth,
  );
  const overshootY = nonOverlapDistanceRatio(
    command.y,
    command.height,
    localCoordHeight,
  );
  return (
    overshootX > OFFSCREEN_MARGIN_RATIO || overshootY > OFFSCREEN_MARGIN_RATIO
  );
}

describe("isDrawBoundsNonsensical", () => {
  const localCoordWidth = 320;
  const localCoordHeight = 240;

  it("does not flag a normally-sized, on-canvas sprite", () => {
    const command: DrawCommand & { kind: "sprite" } = {
      kind: "sprite",
      elementIndex: 0,
      x: 40,
      y: 20,
      width: 240,
      height: 180,
      pixelWidth: 240,
      pixelHeight: 180,
      pixels: new Uint8Array(0),
    };

    expect(
      isDrawBoundsNonsensical(command, localCoordWidth, localCoordHeight),
    ).toBe(false);
  });

  it("does not flag a large parallax layer that is oversized but stays on-canvas (real corpus shape)", () => {
    // Mirrors Otherworldly Forest.def's own tallest cloud parallax layer:
    // legitimately taller than the local coordinate space (2.22x), and
    // parked above the canvas at rest, but well within this check's
    // offscreen margin.
    const command: DrawCommand & { kind: "sprite" } = {
      kind: "sprite",
      elementIndex: 4,
      x: 47,
      y: -190,
      width: 427,
      height: 400,
      pixelWidth: 427,
      pixelHeight: 400,
      pixels: new Uint8Array(0),
    };

    expect(
      isDrawBoundsNonsensical(command, localCoordWidth, localCoordHeight),
    ).toBe(false);
  });

  it("flags an element reproducing the historical xscale/yscale bug (oversized and offscreen together)", () => {
    // Dengeki_Subway.def's own "ground" element, composed with its
    // 0.35/0.35 [StageInfo] scale *not* applied — the exact real-world
    // regression backlog item 009 fixed and this test exists to catch a
    // future repeat of.
    const command: DrawCommand & { kind: "sprite" } = {
      kind: "sprite",
      elementIndex: 9,
      x: -864,
      y: 460,
      width: 2048,
      height: 1024,
      pixelWidth: 2048,
      pixelHeight: 1024,
      pixels: new Uint8Array(0),
    };

    expect(
      isDrawBoundsNonsensical(command, localCoordWidth, localCoordHeight),
    ).toBe(true);
  });

  it("does not flag an oversized element that is also off canvas, when both stay under this check's thresholds", () => {
    // An element every bit as oversized as the flagged case above, but
    // only modestly offscreen — below OFFSCREEN_MARGIN_RATIO, so on its
    // own this isn't the compounded shape the check targets.
    const command: DrawCommand & { kind: "sprite" } = {
      kind: "sprite",
      elementIndex: 1,
      x: 0,
      y: 0,
      width: 2000,
      height: 200,
      pixelWidth: 2000,
      pixelHeight: 200,
      pixels: new Uint8Array(0),
    };

    expect(
      isDrawBoundsNonsensical(command, localCoordWidth, localCoordHeight),
    ).toBe(false);
  });
});

describe("isLocalCoordDegenerate", () => {
  it("flags a zero-value localCoordWidth/Height", () => {
    expect(isLocalCoordDegenerate(0, 0)).toBe(true);
  });

  it("flags only one dimension being zero", () => {
    expect(isLocalCoordDegenerate(320, 0)).toBe(true);
  });

  it("does not flag a normal, positive local coordinate space", () => {
    expect(isLocalCoordDegenerate(320, 240)).toBe(false);
  });
});

// -----------------------------------------------------------------------
// The corpus scan itself.
// -----------------------------------------------------------------------

function findDefFilesRecursively(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findDefFilesRecursively(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".def")) {
      found.push(entryPath);
    }
  }
  return found.sort();
}

/**
 * Resolves a `.def`-referenced sprite sheet filename against the files
 * actually present in the same directory, by basename — exact match first,
 * case-insensitive fallback second. Mirrors `basename-resolution.ts`'s own
 * rule (see `.vibe/decisions/001`), reimplemented directly against
 * `node:fs` here rather than reused: that module resolves against
 * already-gathered `GatheredFile`/browser `File` objects, which this
 * Node-side corpus walk never has.
 */
function resolveSiblingFileByBasename(
  dir: string,
  referencedName: string,
): { status: "found"; path: string } | { status: "not-found" } {
  const siblings = readdirSync(dir);
  const exact = siblings.filter((f) => f === referencedName);
  if (exact.length === 1)
    return { status: "found", path: path.join(dir, exact[0]) };

  const lower = referencedName.toLowerCase();
  const caseInsensitive = siblings.filter((f) => f.toLowerCase() === lower);
  if (caseInsensitive.length === 1) {
    return { status: "found", path: path.join(dir, caseInsensitive[0]) };
  }
  return { status: "not-found" };
}

type StageCheckOutcome =
  | { status: "skipped"; reason: string }
  | { status: "ok" }
  | { status: "failed"; problems: string[] };

const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const stageBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "stage.wasm"))),
};
const sffWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
  "sff",
);
const sffBridgeOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(sffWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(sffWasmDir, "sff.wasm"))),
};

async function checkStageFile(defPath: string): Promise<StageCheckOutcome> {
  const defBytes = new Uint8Array(readFileSync(defPath));
  const result = await loadStage(defBytes, stageBridgeOptions);
  if (!result.ok) {
    // A real parse failure is `stage`'s own corpus scan's concern, not
    // this one's — this test only judges a *successfully parsed* stage's
    // rendering, so it skips rather than fails here.
    return { status: "skipped", reason: `failed to parse: ${result.error}` };
  }
  const stage = result.stage;

  if (
    isLocalCoordDegenerate(
      stage.bgDef.localCoordWidth,
      stage.bgDef.localCoordHeight,
    )
  ) {
    return {
      status: "failed",
      problems: [
        `localCoordWidth/localCoordHeight is ${stage.bgDef.localCoordWidth}x${stage.bgDef.localCoordHeight} — a zero-size local coordinate space collapses the whole composed preview to nothing`,
      ],
    };
  }

  const referencedSprite = stage.bgDef.spriteFile;
  if (!referencedSprite) {
    return { status: "skipped", reason: "no sprite sheet reference" };
  }
  const sffLookup = resolveSiblingFileByBasename(
    path.dirname(defPath),
    referencedSprite,
  );
  if (sffLookup.status === "not-found") {
    return {
      status: "skipped",
      reason: `sprite sheet "${referencedSprite}" not found (or ambiguous) alongside the .def`,
    };
  }
  const sffBytes = new Uint8Array(readFileSync(sffLookup.path));
  const sheetResult = await loadSpriteSheet(sffBytes, sffBridgeOptions);
  if (!sheetResult.ok) {
    return {
      status: "skipped",
      reason: `sprite sheet failed to load: ${sheetResult.error}`,
    };
  }

  const elements: readonly BGElement[] = stage.elements ?? [];
  if (elements.length === 0) {
    return { status: "ok" };
  }

  const spriteMetaByKey = new Map<string, Sprite>();
  for (const group of sheetResult.spriteGroups) {
    for (const sprite of group.sprites) {
      spriteMetaByKey.set(spriteRequestKey(sprite.group, sprite.image), sprite);
    }
  }

  const requests = collectSpriteRequests(elements, stage.animations);
  const pixelResults = await resolveSpritePixels(
    sffBytes,
    requests,
    null,
    sffBridgeOptions,
  );
  const pixelsByKey = new Map<string, ResolvedSpritePixels>();
  requests.forEach(([group, image], index) => {
    const pixelResult = pixelResults[index];
    if (pixelResult?.ok) {
      pixelsByKey.set(spriteRequestKey(group, image), {
        pixels: pixelResult.pixels,
        width: pixelResult.width,
        height: pixelResult.height,
      });
    }
  });

  // Resolve tick 0 for every "anim" element with a matching animation
  // block, mirroring background-preview.ts's own first-render behavior —
  // a real stage's animated element must show a sensible frame immediately,
  // not just once Play is clicked.
  const resolvedSpriteByElementIndex = new Map<number, SpriteRef>();
  const requestable = elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.type === "anim")
    .map(({ element, index }) => ({
      index,
      animation: stage.animations?.[String(element.actionNumber)],
    }))
    .filter(
      (entry): entry is { index: number; animation: BGAnimation } =>
        entry.animation !== undefined,
    );
  if (requestable.length > 0) {
    try {
      const animResult = await resolveAnimationFrames(
        requestable.map((entry) => ({
          animation: entry.animation,
          elapsedTicks: 0,
        })),
        stageBridgeOptions,
      );
      if (animResult.ok) {
        requestable.forEach((entry, i) => {
          const sprite = animResult.sprites[i];
          if (sprite) resolvedSpriteByElementIndex.set(entry.index, sprite);
        });
      }
    } catch {
      // Degrades the same way background-preview.ts does: leave whatever
      // was already resolved (nothing, at tick 0) rather than failing the
      // whole scan over a transient WASM-call failure.
    }
  }

  const animationStatusByElementIndex = classifyAnimationElements(
    elements,
    stage.animations,
    resolvedSpriteByElementIndex,
    spriteMetaByKey,
  );

  const plan = buildDrawPlan(
    elements,
    spriteMetaByKey,
    pixelsByKey,
    stage.bgDef.localCoordWidth,
    { x: 0, y: 0 },
    animationStatusByElementIndex,
    { x: stage.bgDef.xScale, y: stage.bgDef.yScale },
  );

  const problems: string[] = [];
  for (const command of plan) {
    if (command.kind !== "sprite") continue; // a broken/unresolved reference — not "a real sprite", out of scope here
    if (
      isDrawBoundsNonsensical(
        command,
        stage.bgDef.localCoordWidth,
        stage.bgDef.localCoordHeight,
      )
    ) {
      const element = elements[command.elementIndex];
      problems.push(
        `element "${element?.name ?? command.elementIndex}" (index ${command.elementIndex}): drawn at ${command.width}x${command.height} px, position (${command.x}, ${command.y}), vs. local coord ${stage.bgDef.localCoordWidth}x${stage.bgDef.localCoordHeight}`,
      );
    }
  }

  return problems.length > 0
    ? { status: "failed", problems }
    : { status: "ok" };
}

describe("real stage corpus rendering sanity scan", () => {
  it.skipIf(!corpusDir)(
    "flags any real corpus stage whose composed draw plan is nonsensical relative to its own local coordinate space",
    async () => {
      const defFiles = findDefFilesRecursively(corpusDir as string);
      expect(defFiles.length).toBeGreaterThan(0);

      const skipped: string[] = [];
      const failed: string[] = [];
      let checked = 0;

      for (const defPath of defFiles) {
        const outcome = await checkStageFile(defPath);
        const label = path.relative(corpusDir as string, defPath);
        if (outcome.status === "skipped") {
          skipped.push(`${label}: ${outcome.reason}`);
        } else {
          checked++;
          if (outcome.status === "failed") {
            failed.push(`${label}:\n  ${outcome.problems.join("\n  ")}`);
          }
        }
      }

      console.log(
        `corpus rendering sanity scan: ${defFiles.length} .def files under ${corpusDir} — ${checked} checked, ${skipped.length} skipped, ${failed.length} failed`,
      );
      if (skipped.length > 0) {
        console.log(`skipped:\n${skipped.join("\n")}`);
      }

      if (failed.length > 0) {
        throw new Error(
          `${failed.length} real corpus stage(s) produced a nonsensical composed draw plan:\n${failed.join("\n")}`,
        );
      }
    },
    120000,
  );
});
