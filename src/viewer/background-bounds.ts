// Pure bounding-box math for the composed background preview (backlog item
// 012) — no DOM/canvas dependency, fully unit-testable on its own. This is
// deliberately kept separate from `stageXToCanvasX`/`buildDrawPlan` in
// `background-composition.ts` (see
// .vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md)
// rather than modifying them: those functions are already tested and stay
// the exact code path used by the "game window" mode (a later item), so
// this module is purely additive — the "overview mode" follow-up item
// wires it into the canvas/DOM.
import type { CameraBounds, StageBoundaries } from "../wasm/types.ts";
import type { DrawCommand } from "./background-composition.ts";
import { stageXToCanvasX } from "./background-composition.ts";

/** An axis-aligned box in the same canvas space `buildDrawPlan` already produces (X already transformed by `stageXToCanvasX`). */
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Computes the real bounding box of everything that should be visible in
 * the composed background preview: every drawn `DrawCommand` (normal/anim/
 * parallax/placeholder — `buildDrawPlan` has already resolved each case, so
 * they're unioned uniformly by their own `[x, x+width] × [y, y+height]`),
 * plus the stage's own declared `cameraBounds`/`stageBoundaries`.
 *
 * Always starts from a floor of `[0, localCoordWidth] × [0, localCoordHeight]`
 * — the window `background-preview.ts` sizes the canvas to today — so the
 * result can never be smaller than today's output, and reproduces it
 * byte-for-byte pixel-wise when nothing actually exceeds that window.
 *
 * `cameraBounds`/`stageBoundaries` are not guaranteed ordered (`high` isn't
 * guaranteed greater than `low`, nor `left` less than `right`) by the
 * `stage` data itself — only ever shown as raw text elsewhere, no code
 * precedent to copy — so each pair is unioned via `Math.min`/`Math.max`
 * rather than trusted as-is, to avoid an inverted/degenerate box.
 *
 * Rounds outward (`Math.floor` on the min edges, `Math.ceil` on the max
 * edges), since the result feeds `canvas.width`/`canvas.height` (integers)
 * — never clip a pixel to a rounding error.
 */
export function computeStageBoundingBox(
  commands: readonly DrawCommand[],
  localCoordWidth: number,
  localCoordHeight: number,
  cameraBounds: CameraBounds,
  stageBoundaries: StageBoundaries,
): BoundingBox {
  let minX = 0;
  let maxX = localCoordWidth;
  let minY = 0;
  let maxY = localCoordHeight;

  const unionX = (a: number, b: number): void => {
    minX = Math.min(minX, a, b);
    maxX = Math.max(maxX, a, b);
  };
  const unionY = (a: number, b: number): void => {
    minY = Math.min(minY, a, b);
    maxY = Math.max(maxY, a, b);
  };

  for (const command of commands) {
    unionX(command.x, command.x + command.width);
    unionY(command.y, command.y + command.height);
  }

  unionX(
    stageXToCanvasX(cameraBounds.left, localCoordWidth),
    stageXToCanvasX(cameraBounds.right, localCoordWidth),
  );
  unionY(cameraBounds.high, cameraBounds.low);

  unionX(
    stageXToCanvasX(stageBoundaries.left, localCoordWidth),
    stageXToCanvasX(stageBoundaries.right, localCoordWidth),
  );
  unionY(stageBoundaries.topBound, stageBoundaries.bottomBound);

  return {
    minX: Math.floor(minX),
    maxX: Math.ceil(maxX),
    minY: Math.floor(minY),
    maxY: Math.ceil(maxY),
  };
}

/**
 * Returns a new list of draw commands with every command's `x`/`y` shifted
 * by `-dx`/`-dy` — used to recenter an already-built draw plan onto a
 * bounding box's own origin, without touching `buildDrawPlan` or any
 * already-tested function in `background-composition.ts`. Pure: the input
 * array and its elements are never mutated.
 */
export function translateDrawCommands(
  commands: readonly DrawCommand[],
  dx: number,
  dy: number,
): DrawCommand[] {
  return commands.map((command) => ({
    ...command,
    x: command.x - dx,
    y: command.y - dy,
  }));
}
