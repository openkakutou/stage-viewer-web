import {
  loadSpriteSheet as defaultLoadSpriteSheet,
  resolveSpritePixels as defaultResolveSpritePixels,
} from "../wasm/sff-bridge.ts";
import type { SffWasmBridgeOptions } from "../wasm/sff-bridge.ts";
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGElement, StageData } from "../wasm/types.ts";
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
  type DrawCommand,
  type ResolvedSpritePixels,
  buildDrawPlan,
  collectSpriteRequests,
  spriteRequestKey,
} from "./background-composition.ts";

export interface BackgroundPreviewOptions {
  /** Decodes sprite sheet metadata via the WASM bridge. Defaults to the real bridge; injectable for testing. */
  loadSpriteSheet?: typeof defaultLoadSpriteSheet;
  /** Decodes sprite pixels via the WASM bridge. Defaults to the real bridge; injectable for testing. */
  resolveSpritePixels?: typeof defaultResolveSpritePixels;
  /** Forwarded to both WASM bridge calls; injectable for testing. */
  bridgeOptions?: SffWasmBridgeOptions;
  /** Executes a draw plan on the canvas. Defaults to the real canvas 2D draw; injectable for testing. */
  drawComposition?: (
    canvas: HTMLCanvasElement,
    plan: DrawCommand[],
    selectedElementIndex: number | null,
  ) => void;
}

function elementStatusLabel(
  element: BGElement,
  spriteMetaByKey: ReadonlyMap<string, Sprite>,
): string {
  if (element.type === "anim") return "not rendered (animated)";
  const key = spriteRequestKey(element.sprite.group, element.sprite.image);
  return spriteMetaByKey.has(key) ? "" : "invalid sprite reference";
}

export function renderBackgroundPreview(
  root: HTMLElement,
  stage: StageData | null,
  sffBytes: Uint8Array | null,
  options: BackgroundPreviewOptions = {},
): void {
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

  let selectedElementIndex: number | null = null;
  let plan: DrawCommand[] = [];

  const sffBytesNonNull = sffBytes ?? new Uint8Array();

  function finish(
    sheetResult: Awaited<ReturnType<typeof defaultLoadSpriteSheet>> | null,
    pixelResults: Awaited<ReturnType<typeof defaultResolveSpritePixels>>,
  ): void {
    const spriteMetaByKey = new Map<string, Sprite>();
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

    const pixelsByKey = new Map<string, ResolvedSpritePixels>();
    const requests = collectSpriteRequests(elements);
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

    plan = buildDrawPlan(
      elements,
      spriteMetaByKey,
      pixelsByKey,
      loadedStage.bgDef.localCoordWidth,
    );

    status.remove();
    list.appendChild(
      buildList(elements, spriteMetaByKey, (index) => {
        selectedElementIndex = index;
        highlightRow(list, index);
        drawComposition(canvas, plan, selectedElementIndex);
      }),
    );

    canvas.width = loadedStage.bgDef.localCoordWidth;
    canvas.height = loadedStage.bgDef.localCoordHeight;
    canvas.hidden = false;
    drawComposition(canvas, plan, selectedElementIndex);
    resetViewportToFit(viewport);
  }

  Promise.all([
    loadSpriteSheetFn(sffBytesNonNull, options.bridgeOptions),
    resolveSpritePixelsFn(
      sffBytesNonNull,
      collectSpriteRequests(elements),
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
  onSelect: (index: number) => void,
): HTMLElement {
  const list = document.createElement("div");
  list.className = "background-preview__rows";

  elements.forEach((element, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "background-preview__row";
    row.dataset.elementIndex = String(index);

    const statusLabel = elementStatusLabel(element, spriteMetaByKey);
    const parts = [
      element.name || "(unnamed)",
      element.type,
      `layer ${element.layerNo}`,
      `(${element.startX}, ${element.startY})`,
    ];
    if (statusLabel) parts.push(statusLabel);
    row.textContent = parts.join(" · ");

    row.addEventListener("click", () => onSelect(index));
    list.appendChild(row);
  });

  return list;
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
