// Pure composition logic for the background preview (backlog item 004) —
// no DOM, no canvas, no WASM calls: coordinate mapping, draw order, and
// sprite request collection, each independently testable. See
// .vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md
// for the reasoning behind every formula here.
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGAnimation, BGElement, SpriteRef } from "../wasm/types.ts";

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
 * Mirrors `stage`'s own `ResolveParallaxPosition` exactly: offsets an
 * element's raw configured position by how far the simulated camera has
 * moved, scaled by that element's own delta ratio. Applies uniformly to
 * every element type — `deltaX`/`deltaY` exist on the data model
 * regardless of `type`, and a delta of `0` (the common case for a
 * "normal" element) is a no-op offset, not a special case.
 */
export function resolveParallaxPosition(
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
  cameraX: number,
  cameraY: number,
): { x: number; y: number } {
  return { x: startX + cameraX * deltaX, y: startY + cameraY * deltaY };
}

/** How many simulated MUGEN ticks the playback clock advances per real second — matches the org-wide ~60fps convention (see `mode-quick-versus`'s own frame-budget docs) `.air`/`[Begin Action N]` frame `Time` values are authored against. */
export const TICK_RATE_HZ = 60;

/**
 * Upper bound on how much real time a single playback step advances by,
 * regardless of how long the actual gap between two rendered frames was.
 * Without this, a backgrounded/throttled browser tab resuming after a long
 * gap would make the camera and animation frame index "teleport" forward
 * in one step instead of visibly having been paused.
 */
export const MAX_DELTA_MS = 100;

/** How fast the simulated camera pans (canvas pixels per tick) while playing. */
export const CAMERA_PAN_SPEED_PX_PER_TICK = 2;

/** The animated background preview's playback clock: real-time-based, not tied to how many frames were actually rendered. */
export interface PlaybackState {
  /** Total elapsed ticks since playback started, as a real number — floored to an integer only when sent to `resolveAnimationFrames`. */
  elapsedTicksExact: number;
  cameraX: number;
}

export const INITIAL_PLAYBACK_STATE: PlaybackState = {
  elapsedTicksExact: 0,
  cameraX: 0,
};

/**
 * Advances playback state by `deltaMs` of real elapsed time, clamped to
 * `MAX_DELTA_MS`. Time-based (not "one call = one tick") so playback speed
 * stays correct regardless of the caller's actual callback cadence — see
 * .vibe/decisions/004-animated-bg-playback-design.md.
 */
export function advancePlayback(
  state: PlaybackState,
  deltaMs: number,
): PlaybackState {
  const clampedDeltaMs = Math.min(Math.max(deltaMs, 0), MAX_DELTA_MS);
  const deltaTicks = (clampedDeltaMs / 1000) * TICK_RATE_HZ;
  return {
    elapsedTicksExact: state.elapsedTicksExact + deltaTicks,
    cameraX: state.cameraX + deltaTicks * CAMERA_PAN_SPEED_PX_PER_TICK,
  };
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
 * compose the scene: a `"normal"`/`"parallax"` element's own static
 * reference, plus — once `animations` is supplied (backlog item 005) —
 * every frame's sprite referenced by an `"anim"` element's matching
 * `[Begin Action N]` block, since any of those frames may be the one
 * currently showing. An `"anim"` element whose action number has no
 * matching block contributes nothing (there is nothing to decode).
 * Deduplicated, so a reference shared by several elements or frames only
 * decodes once.
 */
export function collectSpriteRequests(
  elements: readonly BGElement[],
  animations: Readonly<Record<string, BGAnimation>> | null = null,
): [number, number][] {
  const seen = new Set<string>();
  const requests: [number, number][] = [];
  const add = (group: number, image: number): void => {
    const key = spriteRequestKey(group, image);
    if (seen.has(key)) return;
    seen.add(key);
    requests.push([group, image]);
  };

  for (const element of elements) {
    if (element.type === "normal" || element.type === "parallax") {
      add(element.sprite.group, element.sprite.image);
      continue;
    }
    if (element.type === "anim") {
      const anim = animations?.[String(element.actionNumber)];
      if (!anim) continue;
      for (const frame of anim.frames)
        add(frame.sprite.group, frame.sprite.image);
    }
  }
  return requests;
}

/**
 * Which sprite an `"anim"` element should currently show, classified for
 * both drawing and row-label purposes. `"no-animation"` and
 * `"unresolved-sprite"` are genuine data problems (this diagnostic
 * viewer's job is surfacing them) and always render a placeholder;
 * `"blank"` is `stage`'s own "nothing to draw this frame" sentinel for a
 * legitimately empty/degenerate animation — not an error, drawn as
 * nothing at all. See .vibe/decisions/004-animated-bg-playback-design.md.
 */
export type AnimationFrameStatus =
  | { kind: "no-animation" }
  | { kind: "blank" }
  | { kind: "unresolved-sprite"; sprite: SpriteRef }
  | { kind: "resolved"; sprite: SpriteRef };

/**
 * Classifies every `"anim"` element's current frame in one pass. Only
 * `"anim"` elements get an entry — `"normal"`/`"parallax"` elements have no
 * animation state to classify.
 */
export function classifyAnimationElements(
  elements: readonly BGElement[],
  animations: Readonly<Record<string, BGAnimation>> | null,
  resolvedSpriteByElementIndex: ReadonlyMap<number, SpriteRef>,
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
): ReadonlyMap<number, AnimationFrameStatus> {
  const statuses = new Map<number, AnimationFrameStatus>();

  elements.forEach((element, elementIndex) => {
    if (element.type !== "anim") return;

    const hasMatchingAnimation = Boolean(
      animations?.[String(element.actionNumber)],
    );
    if (!hasMatchingAnimation) {
      statuses.set(elementIndex, { kind: "no-animation" });
      return;
    }

    const sprite = resolvedSpriteByElementIndex.get(elementIndex);
    if (sprite === undefined) {
      statuses.set(elementIndex, { kind: "no-animation" });
      return;
    }
    if (sprite.group < 0 || sprite.image < 0) {
      statuses.set(elementIndex, { kind: "blank" });
      return;
    }
    const isInSheet = spriteMetaByKey.has(
      spriteRequestKey(sprite.group, sprite.image),
    );
    statuses.set(
      elementIndex,
      isInSheet
        ? { kind: "resolved", sprite }
        : { kind: "unresolved-sprite", sprite },
    );
  });

  return statuses;
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
 * Every element's position is offset by the simulated camera via
 * `resolveParallaxPosition` (a no-op when `camera` is the default origin).
 * A `"normal"`/`"parallax"` element always draws its own static reference.
 * An `"anim"` element's `animationStatusByElementIndex` entry decides its
 * outcome: `"no-animation"` (including no entry at all — resolution simply
 * hasn't happened yet) draws a fixed placeholder; `"blank"` (the library's
 * own "nothing to draw this frame" sentinel) draws nothing; `"resolved"`
 * and `"unresolved-sprite"` both carry a concrete sprite reference and fall
 * through to the same resolution as a static element's reference below —
 * `"unresolved-sprite"` naturally lands on the "meta === undefined"
 * placeholder branch, same visual treatment a broken static reference gets.
 *
 * A reference (static or animation-resolved) that:
 * - resolves in both `spriteMetaByKey` (axis/size) and `pixelsByKey`
 *   (decoded pixels) → a `"sprite"` command, correctly axis-offset;
 * - resolves in `spriteMetaByKey` but not `pixelsByKey` (metadata says it
 *   exists, but the pixel decode itself failed) → a `"placeholder"`
 *   command sized/positioned from the real metadata, still axis-offset;
 * - resolves in neither (the sheet has no such sprite at all) →  a
 *   fixed-size `"placeholder"` command centered on the element's
 *   camera-offset position (no axis to offset by, since no metadata exists).
 */
export function buildDrawPlan(
  elements: readonly BGElement[],
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
  pixelsByKey: ReadonlyMap<string, ResolvedSpritePixels>,
  localCoordWidth: number,
  camera: { x: number; y: number } = { x: 0, y: 0 },
  animationStatusByElementIndex: ReadonlyMap<
    number,
    AnimationFrameStatus
  > = new Map(),
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
    if (
      element.type !== "normal" &&
      element.type !== "parallax" &&
      element.type !== "anim"
    ) {
      continue;
    }

    const position = resolveParallaxPosition(
      element.startX,
      element.startY,
      element.deltaX,
      element.deltaY,
      camera.x,
      camera.y,
    );

    let spriteRef: SpriteRef;
    if (element.type === "anim") {
      const status = animationStatusByElementIndex.get(elementIndex);
      if (!status || status.kind === "no-animation") {
        commands.push({
          kind: "placeholder",
          elementIndex,
          x:
            stageXToCanvasX(position.x, localCoordWidth) - PLACEHOLDER_SIZE / 2,
          y: position.y - PLACEHOLDER_SIZE / 2,
          width: PLACEHOLDER_SIZE,
          height: PLACEHOLDER_SIZE,
        });
        continue;
      }
      if (status.kind === "blank") continue;
      spriteRef = status.sprite;
    } else {
      spriteRef = element.sprite;
    }

    const key = spriteRequestKey(spriteRef.group, spriteRef.image);
    const meta = spriteMetaByKey.get(key);

    if (meta === undefined) {
      commands.push({
        kind: "placeholder",
        elementIndex,
        x: stageXToCanvasX(position.x, localCoordWidth) - PLACEHOLDER_SIZE / 2,
        y: position.y - PLACEHOLDER_SIZE / 2,
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
      });
      continue;
    }

    const topLeft = computeSpriteTopLeft(
      position.x,
      position.y,
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
