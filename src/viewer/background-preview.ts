import {
  type WasmBridgeOptions,
  resolveAnimationFrames as defaultResolveAnimationFrames,
} from "../wasm/bridge.ts";
import {
  loadSpriteSheet as defaultLoadSpriteSheet,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/sff-bridge.ts";
import type { SffWasmBridgeOptions } from "../wasm/sff-bridge.ts";
import type { Sprite } from "../wasm/sff-types.ts";
import type {
  BGAnimation,
  BGElement,
  SpriteRef,
  StageData,
} from "../wasm/types.ts";
// BG element browser + background preview renderer (backlog item 004): a
// side list of every configured BG element next to a composed, live
// canvas preview — the first pixel-level rendering feature in this app.
// Composition math (coordinate mapping, draw order, placeholder sizing) is
// pure and lives in background-composition.ts; this file is the DOM/canvas
// orchestration layer on top of it. See
// .vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md.
//
// A stage with zero elements replaces the whole list+canvas layout with an
// explicit empty state (never a blank canvas indistinguishable from
// loading/broken — per plan consultation). Sprite metadata (for axis/size,
// and to classify a reference valid/invalid) and pixel data are both
// fetched once, in parallel, via the `sff` WASM bridge; a batched
// `resolveSpritePixels` call decodes every distinct sprite reference in one
// round trip rather than one call per element (the same batching
// convention `lifebar-editor`'s own sprite decoding already established).
//
// Selecting a row re-draws the composition with that element's bounds
// outlined on top — additive, not a dim-the-rest treatment (per plan
// consultation: this scene already uses placeholders/errors as part of its
// visual vocabulary, so a subtractive highlight would read as another
// layer failing rather than a selection).
import {
  type AnimationFrameStatus,
  type DrawCommand,
  INITIAL_PLAYBACK_STATE,
  type PlaybackState,
  type ResolvedSpritePixels,
  advancePlayback,
  buildDrawPlan,
  classifyAnimationElements,
  collectSpriteRequests,
  spriteRequestKey,
} from "./background-composition.ts";

export interface BackgroundPreviewOptions {
  /** Decodes sprite sheet metadata via the WASM bridge. Defaults to the real bridge; injectable for testing. */
  loadSpriteSheet?: typeof defaultLoadSpriteSheet;
  /** Decodes sprite pixels via the WASM bridge. Defaults to the real bridge; injectable for testing. */
  resolveSpritePixels?: typeof defaultResolveSpritePixels;
  /** Forwarded to both `sff` WASM bridge calls; injectable for testing. */
  bridgeOptions?: SffWasmBridgeOptions;
  /** Resolves the current frame of every animated BG element, once per playback tick. Defaults to the real `stage` WASM bridge; injectable for testing. */
  resolveAnimationFrames?: typeof defaultResolveAnimationFrames;
  /** Forwarded to `resolveAnimationFrames`; injectable for testing. */
  stageBridgeOptions?: WasmBridgeOptions;
  /** Executes a draw plan on the canvas. Defaults to the real canvas 2D draw; injectable for testing. */
  drawComposition?: (
    canvas: HTMLCanvasElement,
    plan: DrawCommand[],
    selectedElementIndex: number | null,
  ) => void;
  /** Schedules the next playback tick. Defaults to the real global; injectable for deterministic testing. */
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  /** Cancels a scheduled playback tick. Defaults to the real global; injectable for deterministic testing. */
  cancelAnimationFrame?: (handle: number) => void;
}

function elementStatusLabel(
  element: BGElement,
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
  animationStatus: AnimationFrameStatus | undefined,
): string {
  if (element.type === "anim") {
    if (!animationStatus || animationStatus.kind === "no-animation") {
      return "no matching animation block";
    }
    if (animationStatus.kind === "unresolved-sprite") {
      return "resolved sprite is out of range";
    }
    return "";
  }
  const key = spriteRequestKey(element.sprite.group, element.sprite.image);
  return spriteMetaByKey.has(key) ? "" : "invalid sprite reference";
}

// Cancels a previous call's playback loop when `renderBackgroundPreview` is
// invoked again on the same root (e.g. loading a different stage without a
// page reload) — otherwise the old loop would keep running invisibly
// against a detached canvas, issuing WASM calls forever.
const stopPlaybackByRoot = new WeakMap<HTMLElement, () => void>();

export function renderBackgroundPreview(
  root: HTMLElement,
  stage: StageData | null,
  sffBytes: Uint8Array | null,
  options: BackgroundPreviewOptions = {},
): void {
  stopPlaybackByRoot.get(root)?.();
  stopPlaybackByRoot.delete(root);

  root.replaceChildren();
  if (stage === null) return;
  // Captured as its own binding (not just narrowed) so the nested `finish`
  // function declaration below keeps the non-null type — TS narrowing from
  // the early return above doesn't survive into a nested function over the
  // wider-typed parameter.
  const loadedStage = stage;

  const elements = loadedStage.elements ?? [];
  if (elements.length === 0) {
    const empty = document.createElement("p");
    empty.className = "background-preview__empty";
    empty.textContent = "No BG elements configured.";
    root.appendChild(empty);
    return;
  }

  const loadSpriteSheetFn = options.loadSpriteSheet ?? defaultLoadSpriteSheet;
  const resolveSpritePixelsFn =
    options.resolveSpritePixels ?? defaultResolveSpritePixels;
  const drawComposition = options.drawComposition ?? defaultDrawComposition;

  const panel = document.createElement("div");
  panel.className = "background-preview";

  const list = document.createElement("div");
  list.className = "background-preview__list";
  const status = document.createElement("p");
  status.className = "background-preview__status";
  status.setAttribute("role", "status");
  status.textContent = "Decoding sprites…";
  list.appendChild(status);

  const viewport = document.createElement("wuik-viewport");
  viewport.className = "background-preview__viewport";
  viewport.style.aspectRatio = `${loadedStage.bgDef.localCoordWidth} / ${loadedStage.bgDef.localCoordHeight}`;
  const canvas = document.createElement("canvas");
  canvas.className = "background-preview__canvas";
  canvas.hidden = true;
  viewport.appendChild(canvas);

  panel.append(list, viewport);
  root.appendChild(panel);

  const requestAnimationFrameFn =
    options.requestAnimationFrame ??
    globalThis.requestAnimationFrame.bind(globalThis);
  const cancelAnimationFrameFn =
    options.cancelAnimationFrame ??
    globalThis.cancelAnimationFrame.bind(globalThis);
  const resolveAnimationFramesFn =
    options.resolveAnimationFrames ?? defaultResolveAnimationFrames;

  const animatedElementIndices = elements
    .map((element, index) => (element.type === "anim" ? index : null))
    .filter((index): index is number => index !== null);

  let selectedElementIndex: number | null = null;
  let plan: DrawCommand[] = [];
  let spriteMetaByKey = new Map<string, Sprite>();
  let pixelsByKey = new Map<string, ResolvedSpritePixels>();
  let resolvedSpriteByElementIndex = new Map<number, SpriteRef>();
  let animationStatusByElementIndex: ReadonlyMap<number, AnimationFrameStatus> =
    new Map();
  let rowStatusSpansByIndex = new Map<number, HTMLElement>();
  let playbackState: PlaybackState = INITIAL_PLAYBACK_STATE;
  let isPlaying = false;
  let lastFrameTimestamp: number | null = null;
  let rafHandle: number | null = null;

  const sffBytesNonNull = sffBytes ?? new Uint8Array();

  function rebuildPlanAndDraw(): void {
    plan = buildDrawPlan(
      elements,
      spriteMetaByKey,
      pixelsByKey,
      loadedStage.bgDef.localCoordWidth,
      { x: playbackState.cameraX, y: 0 },
      animationStatusByElementIndex,
    );
    drawComposition(canvas, plan, selectedElementIndex);
  }

  function updateAnimRowLabels(): void {
    for (const index of animatedElementIndices) {
      const span = rowStatusSpansByIndex.get(index);
      if (!span) continue;
      const element = elements[index] as BGElement;
      const label = elementStatusLabel(
        element,
        spriteMetaByKey,
        animationStatusByElementIndex.get(index),
      );
      span.textContent = label ? ` · ${label}` : "";
    }
  }

  // Resolves every animated element that actually has a matching animation
  // block, in one batched call (see stage's own docs/wasm.md) for the tick
  // `playbackState` is currently at. An element with no matching block is
  // never sent to the WASM bridge at all — there is nothing for it to
  // resolve, and `classifyAnimationElements` already reports it as
  // "no-animation" independent of any resolution attempt. On a whole-call
  // failure (rejection or a typed `{ok:false}`), the previous resolution is
  // left untouched (stale-but-valid) rather than crashing the playback loop
  // or flashing every animated element to "broken" for one transient error.
  async function resolveAnimationStatusesForCurrentTick(): Promise<void> {
    const requestable = animatedElementIndices
      .map((index) => ({
        index,
        animation:
          loadedStage.animations?.[
            String((elements[index] as BGElement).actionNumber)
          ],
      }))
      .filter(
        (entry): entry is { index: number; animation: BGAnimation } =>
          entry.animation !== undefined,
      );

    if (requestable.length > 0) {
      const elapsedTicksInt = Math.floor(playbackState.elapsedTicksExact);
      try {
        const result = await resolveAnimationFramesFn(
          requestable.map((entry) => ({
            animation: entry.animation,
            elapsedTicks: elapsedTicksInt,
          })),
          options.stageBridgeOptions,
        );
        if (result.ok) {
          const next = new Map(resolvedSpriteByElementIndex);
          requestable.forEach((entry, i) => {
            const sprite = result.sprites[i];
            if (sprite) next.set(entry.index, sprite);
          });
          resolvedSpriteByElementIndex = next;
        }
      } catch {
        // The WASM module itself couldn't start/respond this tick — fall
        // through to classification with whatever was already resolved.
      }
    }

    animationStatusByElementIndex = classifyAnimationElements(
      elements,
      loadedStage.animations,
      resolvedSpriteByElementIndex,
      spriteMetaByKey,
    );
  }

  async function tick(timestamp: number): Promise<void> {
    if (!isPlaying) return;
    const deltaMs =
      lastFrameTimestamp === null ? 0 : timestamp - lastFrameTimestamp;
    lastFrameTimestamp = timestamp;
    playbackState = advancePlayback(playbackState, deltaMs);

    await resolveAnimationStatusesForCurrentTick();
    rebuildPlanAndDraw();
    updateAnimRowLabels();

    // Re-check isPlaying: Pause may have been clicked while the await above
    // was in flight — never schedule one extra frame after pausing.
    if (isPlaying) {
      rafHandle = requestAnimationFrameFn((t) => void tick(t));
    }
  }

  const playPauseButton = document.createElement("wuik-button");
  playPauseButton.setAttribute("variant", "secondary");
  playPauseButton.textContent = "Play";
  playPauseButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playPauseButton.textContent = isPlaying ? "Pause" : "Play";
    if (isPlaying) {
      // Reset so a resume never counts the paused wall-clock gap as elapsed
      // playback time — the very next tick's own delta is treated as 0.
      lastFrameTimestamp = null;
      rafHandle = requestAnimationFrameFn((t) => void tick(t));
    } else if (rafHandle !== null) {
      cancelAnimationFrameFn(rafHandle);
      rafHandle = null;
    }
  });

  stopPlaybackByRoot.set(root, () => {
    isPlaying = false;
    if (rafHandle !== null) cancelAnimationFrameFn(rafHandle);
    rafHandle = null;
  });

  async function finish(
    sheetResult: Awaited<ReturnType<typeof defaultLoadSpriteSheet>> | null,
    pixelResults: Awaited<ReturnType<typeof defaultResolveSpritePixels>>,
  ): Promise<void> {
    spriteMetaByKey = new Map<string, Sprite>();
    if (sheetResult?.ok) {
      for (const group of sheetResult.spriteGroups) {
        for (const sprite of group.sprites) {
          spriteMetaByKey.set(
            spriteRequestKey(sprite.group, sprite.image),
            sprite,
          );
        }
      }
    }

    pixelsByKey = new Map<string, ResolvedSpritePixels>();
    const requests = collectSpriteRequests(elements, loadedStage.animations);
    requests.forEach(([group, image], index) => {
      const result = pixelResults[index];
      if (result?.ok) {
        pixelsByKey.set(spriteRequestKey(group, image), {
          pixels: result.pixels,
          width: result.width,
          height: result.height,
        });
      }
    });

    // Resolves tick 0 so an animated element shows its first frame
    // immediately, before Play is ever clicked — matches how a static
    // element's sprite is already visible on first render.
    await resolveAnimationStatusesForCurrentTick();

    status.remove();
    const built = buildList(
      elements,
      spriteMetaByKey,
      animationStatusByElementIndex,
      (index) => {
        selectedElementIndex = index;
        highlightRow(list, index);
        drawComposition(canvas, plan, selectedElementIndex);
      },
    );
    rowStatusSpansByIndex = built.statusSpansByIndex;
    list.appendChild(built.list);

    const controls = document.createElement("div");
    controls.className = "background-preview__controls";
    controls.appendChild(playPauseButton);
    list.appendChild(controls);

    canvas.width = loadedStage.bgDef.localCoordWidth;
    canvas.height = loadedStage.bgDef.localCoordHeight;
    canvas.hidden = false;
    rebuildPlanAndDraw();
    resetViewportToFit(viewport);
  }

  Promise.all([
    loadSpriteSheetFn(sffBytesNonNull, options.bridgeOptions),
    resolveSpritePixelsFn(
      sffBytesNonNull,
      collectSpriteRequests(elements, loadedStage.animations),
      null,
      options.bridgeOptions,
    ),
  ])
    .then(([sheetResult, pixelResults]) => finish(sheetResult, pixelResults))
    .catch(() => {
      // The WASM module itself couldn't start (missing/not-yet-downloaded
      // assets, a network error) — a different failure mode from a
      // module-reported parse error, which `loadSpriteSheet`/
      // `resolveSpritePixels` already represent as a typed `{ok:false}`
      // result rather than a rejection. Degrade the same way a fully
      // unresolved sheet would (every reference becomes a placeholder)
      // instead of leaving the screen stuck on "Decoding sprites…" forever.
      finish(null, []);
    });
}

function buildList(
  elements: readonly BGElement[],
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
  animationStatusByElementIndex: ReadonlyMap<number, AnimationFrameStatus>,
  onSelect: (index: number) => void,
): { list: HTMLElement; statusSpansByIndex: Map<number, HTMLElement> } {
  const list = document.createElement("div");
  list.className = "background-preview__rows";
  const statusSpansByIndex = new Map<number, HTMLElement>();

  elements.forEach((element, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "background-preview__row";
    row.dataset.elementIndex = String(index);

    const mainText = [
      element.name || "(unnamed)",
      element.type,
      `layer ${element.layerNo}`,
      `(${element.startX}, ${element.startY})`,
    ].join(" · ");
    row.appendChild(document.createTextNode(mainText));

    const statusLabel = elementStatusLabel(
      element,
      spriteMetaByKey,
      animationStatusByElementIndex.get(index),
    );
    const statusSpan = document.createElement("span");
    statusSpan.className = "background-preview__row-status";
    statusSpan.textContent = statusLabel ? ` · ${statusLabel}` : "";
    row.appendChild(statusSpan);
    statusSpansByIndex.set(index, statusSpan);

    row.addEventListener("click", () => onSelect(index));
    list.appendChild(row);
  });

  return { list, statusSpansByIndex };
}

function highlightRow(list: HTMLElement, selectedIndex: number): void {
  for (const row of list.querySelectorAll<HTMLElement>(
    ".background-preview__row",
  )) {
    if (Number(row.dataset.elementIndex) === selectedIndex) {
      row.setAttribute("aria-current", "true");
    } else {
      row.removeAttribute("aria-current");
    }
  }
}

/**
 * Calls a `<wuik-viewport>` element's `resetToFit()` if it's actually the
 * real, registered custom element — a plain jsdom `HTMLElement` (this
 * project's test environment never registers `@openkakutou/web-ui-kit`'s
 * custom elements) has no such method, so this is a silent no-op there;
 * the real behavior is verified by a real-browser runtime pass instead.
 */
function resetViewportToFit(viewport: HTMLElement): void {
  (viewport as unknown as { resetToFit?: () => void }).resetToFit?.();
}

/**
 * Draws every command in `plan` onto `canvas`, in order (back to front —
 * `plan` is already sorted by `buildDrawPlan`), then outlines the selected
 * element's bounds on top, if any. `getContext("2d")` returning `null` (a
 * real, if rare, browser condition, and this project's jsdom environment
 * under some configurations) degrades to doing nothing rather than
 * throwing.
 */
export function defaultDrawComposition(
  canvas: HTMLCanvasElement,
  plan: DrawCommand[],
  selectedElementIndex: number | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const surfaceColor =
    getComputedStyle(canvas).getPropertyValue("--wuik-color-surface").trim() ||
    "#e5e5e5";
  ctx.fillStyle = surfaceColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const command of plan) {
    if (command.kind === "sprite") {
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(command.pixels),
          command.width,
          command.height,
        ),
        command.x,
        command.y,
      );
    } else {
      drawPlaceholder(ctx, command);
    }
  }

  const selected = plan.find((c) => c.elementIndex === selectedElementIndex);
  if (selected) drawSelectionOutline(ctx, selected);
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  command: Extract<DrawCommand, { kind: "placeholder" }>,
): void {
  const danger =
    getComputedStyle(ctx.canvas)
      .getPropertyValue("--wuik-color-danger")
      .trim() || "#c0392b";
  ctx.save();
  ctx.strokeStyle = danger;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(command.x, command.y, command.width, command.height);
  ctx.beginPath();
  ctx.moveTo(command.x, command.y);
  ctx.lineTo(command.x + command.width, command.y + command.height);
  ctx.moveTo(command.x + command.width, command.y);
  ctx.lineTo(command.x, command.y + command.height);
  ctx.stroke();
  ctx.restore();
}

function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  command: DrawCommand,
): void {
  const accent =
    getComputedStyle(ctx.canvas)
      .getPropertyValue("--wuik-color-accent")
      .trim() || "#2d7dd2";
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(
    command.x - 1,
    command.y - 1,
    command.width + 2,
    command.height + 2,
  );
  ctx.restore();
}
