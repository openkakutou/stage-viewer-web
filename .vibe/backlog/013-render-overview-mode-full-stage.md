---
status: todo
depends_on: [012]
---
# Render an Overview Mode Showing the Entire Stage

## Description
Wire `computeStageBoundingBox`/`translateDrawCommands` (item 012) into `background-preview.ts` so the composed background canvas, by default, is sized to the stage's real content extent instead of the fixed `localCoordWidth × localCoordHeight` window — so the whole stage is visible on load, and `<wuik-viewport>`'s existing zoom/pan can actually explore all of it.

Where the draw plan is built and drawn (`finish()` and the rebuild-on-tick path): `plan = buildDrawPlan(...)` stays unchanged → `bbox = computeStageBoundingBox(plan, localCoordWidth, localCoordHeight, loadedStage.cameraBounds, loadedStage.stageBoundaries)` → `translatedPlan = translateDrawCommands(plan, bbox.minX, bbox.minY)` → draw `translatedPlan`.

Canvas sizing and its CSS box must be recalculated together on every mode/load change — **critical**: `<wuik-viewport>.resetToFit()` (`web-ui-kit/src/canvas/viewport.ts`) measures the slotted canvas's **CSS box** (`target.offsetWidth/offsetHeight`), not `canvas.width`/`canvas.height` (the internal drawing resolution). `background-preview.ts` currently drives that CSS box via `stack.style.aspectRatio = "${localCoordWidth} / ${localCoordHeight}"`, set once and never recalculated. Both must be kept in sync:
- `canvas.width = bbox.maxX - bbox.minX`, `canvas.height = bbox.maxY - bbox.minY`
- `stack.style.aspectRatio = "${canvas.width} / ${canvas.height}"`
- call `resetViewportToFit(viewport)` (already called once in `finish()`) again after any resize.

3D stages (`hasModelLayer === true`): `stack` is also the container for the `<wuik-viewport-3d>` 3D layer (its own independent orbit camera, no bounding-box concept). Resizing `stack`'s aspect-ratio for a 2D overview would also reshape the 3D container. For this item, always render a 3D stage in its current fixed-window sizing (equivalent to the existing behavior) — the reported problem is about a 2D stage whose content exceeds `localCoordWidth`/`localCoordHeight`; extending overview mode to 3D stages is out of scope here.

This item makes the overview sizing the *only* rendering path (no toggle yet) — see the follow-up item "Add an overview / game-window view toggle" for restoring the exact original fixed-window rendering as a selectable mode.

## Acceptance Criteria
- [ ] Loading a stage whose elements/`cameraBounds`/`stageBoundaries` exceed `localCoordWidth × localCoordHeight` shows the entire stage content in one view on load (no clipped elements), confirmed in a real browser.
- [ ] Loading a stage whose content fits entirely within `localCoordWidth × localCoordHeight` renders pixel-identical to today's output (regression covered by a `background-preview.test.ts` case).
- [ ] `canvas.width`/`canvas.height` and `stack.style.aspectRatio` are always resized together whenever the draw plan is rebuilt (playback tick, initial load) — never drift apart into a stretched/misaligned canvas.
- [ ] A 3D (`hasModelLayer`) stage continues to render exactly as it does today (fixed `localCoordWidth × localCoordHeight` window, unaffected 3D viewport container).

## Notes
Requires item 012 (`background-bounds.ts`). Real-browser verification is required for this item per this repo's own testing conventions (`.vibe/index.md`): canvas/`<wuik-viewport>` sizing and zoom/pan correctness are never reliable under jsdom alone.
