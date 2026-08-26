---
date: 2026-08-27
status: accepted
---
# Background preview: coordinate mapping, draw order, and out-of-scope element treatment

**Context:** The background preview (backlog item 004) must compose every BG element onto one canvas at its "configured position and layer order," but neither the backlog item nor `stage`'s own docs state a pixel-mapping formula, a precise draw-order rule beyond "front/back," or how to treat an `"anim"` element (no static sprite reference at all) versus a genuinely broken sprite reference.

**Decision:**
- **Coordinate mapping**: a stage's local coordinate space (`BGdef.localCoordWidth/Height`) has its origin at horizontal-center, top — derived from `stage`'s own documented convention for `ZOffset` ("ground level's vertical distance from **the top** of the local coordinate space"). Canvas pixel `(localCoordWidth/2 + x, y)` for stage coordinate `(x, y)`.
- **Sprite placement**: a decoded sprite's own axis (pivot) point is placed at the element's `(startX, startY)` — top-left draw position = `(startX - axisX, startY - axisY)` — the same pivot-relative-to-image-origin relationship `character-viewer-web`'s animation player already uses for its own Clsn-box-relative-to-sprite-image math (`computeClsnRect`), applied here in the opposite direction (placing an image by its pivot, not placing a box relative to an already-placed image).
- **Draw order**: elements are drawn back-to-front by a **stable** sort on `layerNo` ascending (0 before 1) — elements sharing a `layerNo` keep their original array order relative to each other, matching `.def` file order and mirroring how MUGEN itself composes same-layer elements.
- **`"anim"` elements are not drawn** (no static sprite reference exists to draw — resolving `.air`-driven animation playback is explicitly a separate, later item) but are listed normally, distinct from a broken reference: no error/placeholder tile, no "invalid" flag, just absent from the canvas. A `"normal"`/`"parallax"` element whose `(group, image)` reference doesn't resolve against the loaded sheet **is** flagged invalid and gets the placeholder tile — these are different meanings (an intentional scope gap vs. a real data problem) and must not share a visual treatment (per plan consultation).
- **Missing sprite sheet data needed for placement (axis) as well as pixels**: fetched via two calls to `sff`'s own WASM module — `load` (metadata: width/height/axis per sprite, used to classify each reference valid/invalid before drawing) and `resolveSprites` (batched pixel decode for only the elements that resolved). Same dual-WASM-bridge architecture `stage-editor`'s own `.vibe/decisions/001` already established for its sprite-reference-validation bridge, ported here read-only (no `save`-side use).

**Reason:** Every one of these needed a concrete answer to implement anything at all; each is grounded in either `stage`'s own documented data model, an already-reviewed sibling pattern (Clsn-box placement math), or this item's own plan consultation (out-of-scope vs. broken-reference visual distinction) rather than invented from nothing.

**Rejected alternatives:**
- **Treat a missing sprite and an `"anim"` element identically (both get the placeholder tile)**: rejected — plan consultation flagged this as actively misleading; a user needs to tell "not built yet" apart from "your stage file references something that doesn't exist."
- **Canvas origin at the local coordinate space's own top-left (no horizontal centering)**: rejected — MUGEN's own camera/stage convention centers horizontally (camera bounds are typically symmetric around 0); a top-left origin would misplace every element relative to how the format's own authors think about position.
