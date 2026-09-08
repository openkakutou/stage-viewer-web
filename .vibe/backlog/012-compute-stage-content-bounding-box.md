---
status: todo
---
# Compute Stage Content Bounding Box

## Description
The composed background canvas is currently sized in `background-preview.ts` to exactly `bgDef.localCoordWidth × localCoordHeight` — the stage's declared "screen" resolution, not the real extent of its content. Any `BGElement` (normal/anim/parallax layer) whose resolved position falls outside that fixed window is silently clipped by the Canvas 2D API at draw time — it is never painted into the raster at all, so zooming out afterwards can never reveal it (`<wuik-viewport>` only scales the CSS box of the already-rendered canvas).

Add a new pure module, `src/viewer/background-bounds.ts`, computing the real bounding box of everything that should be visible: every drawn `BGElement` (via the `DrawCommand[]` `background-composition.ts`'s `buildDrawPlan` already produces) plus the stage's own declared `cameraBounds`/`stageBoundaries` (`src/wasm/types.ts`, already parsed but currently only shown as text in `characteristics-panel.ts`, never used for rendering).

- `interface BoundingBox { minX: number; maxX: number; minY: number; maxY: number; }`
- `computeStageBoundingBox(commands: DrawCommand[], localCoordWidth: number, localCoordHeight: number, cameraBounds: CameraBounds, stageBoundaries: StageBoundaries): BoundingBox` — works in the same space `buildDrawPlan` already produces (canvas-space, X already transformed by `stageXToCanvasX`):
  - starts from a floor of `[0, localCoordWidth] × [0, localCoordHeight]` (guarantees the raster is never smaller than today, and that "nothing exceeds the window" reproduces today's output pixel-for-pixel);
  - unions with each `DrawCommand`'s own `[x, x+width] × [y, y+height]` (covers normal/anim/parallax/placeholder uniformly, since `buildDrawPlan` has already resolved each case);
  - unions with `stageXToCanvasX(cameraBounds.left/right, localCoordWidth)` in X, `cameraBounds.high`/`low` in Y;
  - unions with `stageXToCanvasX(stageBoundaries.left/right, localCoordWidth)` in X, `stageBoundaries.topBound`/`bottomBound` in Y;
  - defensive: use `Math.min`/`Math.max` of each pair rather than assuming `high > low` or `left < right` — that ordering isn't guaranteed by the `stage` data (only ever shown as raw text elsewhere, no code precedent to copy);
  - rounds outward (`Math.floor` on min, `Math.ceil` on max), since the result feeds `canvas.width`/`canvas.height` (integers) — never clip a pixel to a rounding error.
- `translateDrawCommands(commands: DrawCommand[], dx: number, dy: number): DrawCommand[]` — pure function, returns a new list with `x - dx`, `y - dy` per command. Used to recenter an already-built draw plan onto the bounding box's own origin, without touching `buildDrawPlan` or any already-tested function in `background-composition.ts`.

This item is the pure-logic foundation only — no canvas/DOM wiring yet (see the follow-up item "Render an overview mode showing the entire stage").

## Acceptance Criteria
- [ ] `computeStageBoundingBox` returns exactly `{0, localCoordWidth, 0, localCoordHeight}` when no `DrawCommand`/`cameraBounds`/`stageBoundaries` value exceeds the declared window (byte-for-byte regression parity with today).
- [ ] `computeStageBoundingBox` expands the bounding box correctly when a `DrawCommand`, `cameraBounds`, or `stageBoundaries` value falls outside `[0, localCoordWidth] × [0, localCoordHeight]`, in each direction independently.
- [ ] `computeStageBoundingBox` does not produce an inverted/degenerate box when `cameraBounds`/`stageBoundaries` values are given out of their nominal order (e.g. `high < low`).
- [ ] `translateDrawCommands` returns a new array (input untouched) with every command's `x`/`y` shifted by `-dx`/`-dy`, preserving all other fields.

## Notes
Deliberately kept separate from `stageXToCanvasX`/`buildDrawPlan` in `background-composition.ts` (see `.vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md`) rather than modifying them — those functions are already tested and must stay the exact code path used by the "game window" mode (see the follow-up toggle item), so this stays purely additive.
