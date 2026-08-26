// Pure composition logic for the background preview (backlog item 004) —
// no DOM, no canvas, no WASM calls: coordinate mapping, draw order, and
// sprite request collection, each independently testable. See
// .vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md
// for the reasoning behind every formula here.
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGElement } from "../wasm/types.ts";

/**
 * Maps a stage-space X coordinate to a canvas pixel X coordinate. A stage's
 * local coordinate space has its origin at horizontal-center, top (derived
 * from `stage`'s own documented `ZOffset` convention — see the ADR above),
 * so stage x=0 lands at half the local coordinate width.
 */
export function stageXToCanvasX(x: number, localCoordWidth: number): number {
  return localCoordWidth / 2 + x;
}

/**
 * The top-left canvas position to draw a decoded sprite at, so that the
 * sprite's own axis (pivot) point lands exactly on the element's
 * configured `(startX, startY)` position — the same pivot-relative-to-
 * image-origin relationship `character-viewer-web`'s animation player
 * already uses for Clsn-box placement, applied here in the opposite
 * direction (placing an image by its pivot, not placing a box relative to
 * an already-placed image).
 */
export function computeSpriteTopLeft(
  startX: number,
  startY: number,
  axisX: number,
  axisY: number,
): { x: number; y: number } {
  return { x: startX - axisX, y: startY - axisY };
}

/**
 * Orders BG elements back-to-front for composition: a stable sort on
 * `layerNo` ascending (0 behind, 1 in front) — elements sharing a layer
 * keep their original relative order, matching `.def` file order and how
 * MUGEN itself composes same-layer elements. Never mutates the input.
 */
export function sortElementsForComposition(
  elements: readonly BGElement[],
): BGElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.layerNo - b.element.layerNo || a.index - b.index)
    .map(({ element }) => element);
}

/** A stable key for a `(group, image)` sprite reference pair. */
export function spriteRequestKey(group: number, image: number): string {
  return `${group},${image}`;
}

/**
 * Collects one request per distinct sprite reference actually needed to
 * compose the scene: only `"normal"`/`"parallax"` elements have a static
 * sprite reference — an `"anim"` element's `.air`-driven animation isn't
 * resolved by this item (see the ADR above), so it contributes no request.
 * Deduplicated, so two elements sharing the same reference only decode it
 * once.
 */
export function collectSpriteRequests(
  elements: readonly BGElement[],
): [number, number][] {
  const seen = new Set<string>();
  const requests: [number, number][] = [];
  for (const element of elements) {
    if (element.type !== "normal" && element.type !== "parallax") continue;
    const key = spriteRequestKey(element.sprite.group, element.sprite.image);
    if (seen.has(key)) continue;
    seen.add(key);
    requests.push([element.sprite.group, element.sprite.image]);
  }
  return requests;
}

/** A resolved sprite's actual decoded pixels, at its own native resolution. */
export interface ResolvedSpritePixels {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/** Fixed placeholder box size (canvas pixels) for a reference the sheet has no metadata for at all. */
export const PLACEHOLDER_SIZE = 32;

/** One instruction to draw either a decoded sprite or a placeholder tile at a canvas position. */
export type DrawCommand =
  | {
      kind: "sprite";
      /** Index into the original (unsorted) elements array — ties a command back to its list row. */
      elementIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      pixels: Uint8Array;
    }
  | {
      kind: "placeholder";
      elementIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

/**
 * Builds the ordered list of draw instructions for the composed scene — pure
 * data, no canvas/DOM involved, so the composition logic is fully testable
 * without a real (or stubbed) 2D rendering context.
 *
 * An `"anim"` element contributes no command at all (see the ADR above — not
 * a placeholder, since it isn't a broken reference, just an out-of-scope
 * one). A `"normal"`/`"parallax"` element's reference:
 * - resolves in both `spriteMetaByKey` (axis/size) and `pixelsByKey`
 *   (decoded pixels) → a `"sprite"` command, correctly axis-offset;
 * - resolves in `spriteMetaByKey` but not `pixelsByKey` (metadata says it
 *   exists, but the pixel decode itself failed) → a `"placeholder"`
 *   command sized/positioned from the real metadata, still axis-offset;
 * - resolves in neither (the sheet has no such sprite at all) →  a
 *   fixed-size `"placeholder"` command centered on the element's raw
 *   position (no axis to offset by, since no metadata exists).
 */
export function buildDrawPlan(
  elements: readonly BGElement[],
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
  pixelsByKey: ReadonlyMap<string, ResolvedSpritePixels>,
  localCoordWidth: number,
): DrawCommand[] {
  const ordered = elements
    .map((element, elementIndex) => ({ element, elementIndex }))
    .sort(
      (a, b) =>
        a.element.layerNo - b.element.layerNo ||
        a.elementIndex - b.elementIndex,
    );

  const commands: DrawCommand[] = [];
  for (const { element, elementIndex } of ordered) {
    if (element.type !== "normal" && element.type !== "parallax") continue;

    const key = spriteRequestKey(element.sprite.group, element.sprite.image);
    const meta = spriteMetaByKey.get(key);

    if (meta === undefined) {
      commands.push({
        kind: "placeholder",
        elementIndex,
        x:
          stageXToCanvasX(element.startX, localCoordWidth) -
          PLACEHOLDER_SIZE / 2,
        y: element.startY - PLACEHOLDER_SIZE / 2,
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
      });
      continue;
    }

    const topLeft = computeSpriteTopLeft(
      element.startX,
      element.startY,
      meta.axisX,
      meta.axisY,
    );
    const x = stageXToCanvasX(topLeft.x, localCoordWidth);
    const y = topLeft.y;
    const resolved = pixelsByKey.get(key);

    if (resolved === undefined) {
      commands.push({
        kind: "placeholder",
        elementIndex,
        x,
        y,
        width: meta.width,
        height: meta.height,
      });
      continue;
    }

    commands.push({
      kind: "sprite",
      elementIndex,
      x,
      y,
      width: resolved.width,
      height: resolved.height,
      pixels: resolved.pixels,
    });
  }
  return commands;
}
