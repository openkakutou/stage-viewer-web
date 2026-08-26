---
status: done
depends_on: [002]
---
# BG Element/Layer Browser + Background Preview Renderer

## Description
Once a stage is loaded (item 002), let the user browse every configured BG element and layer (front/back, position, scale, sprite reference) in a list/tree view, and render a live visual preview of the composed background — every BG element drawn at its configured position, scale, and layer order — on a canvas/viewport (using `web-ui-kit`'s shared zoom/pan viewport controls). This is the first pixel-level rendering feature in the app, so it establishes the composition pipeline (BG elements → layered draw order → canvas) that later playback features (item 005) build on.

## Acceptance Criteria
- [x] Every BG element/layer configured in the loaded stage is listed, showing its key properties (position, scale, layer)
- [x] The preview renderer draws all BG elements composed in the correct front/back layer order
- [x] Selecting a BG element in the browser highlights it in the preview
- [x] A BG element referencing a sprite missing from the loaded sprite sheet renders a clear placeholder/error indicator instead of breaking the whole preview
- [x] A stage with zero configured BG elements shows an explicit empty state, not a blank canvas indistinguishable from a loading/broken state

## Notes
"Scale" in the Description doesn't correspond to any field `BGElement` actually exposes (no per-element scale factor exists in the data model) — the list shows the properties that actually exist: name, type, layer, position, and sprite-reference validity.

This is a static single-frame composition — every element drawn once at its base position; animated/parallax playback over time is item 005, out of scope here. An `"anim"`-type element (`.air`-driven, no static sprite) is listed but never drawn, kept visually distinct from a broken sprite reference (which gets a placeholder) — see `.vibe/decisions/003-background-preview-composition-and-coordinate-mapping.md`.

`stage`'s own WASM module has no sprite-metadata/pixel surface at all — needed a second, independent WASM bridge to `sff`'s own module (metadata + pixel decode), same dual-WASM-module architecture `stage-editor`'s own `.vibe/decisions/001` established, ported here read-only.

## Blocked
None — this item was never actually blocked.

**Done 2026-08-27:** Implemented, tested (unit + real-browser verification against a real loaded stage with a valid sprite, an invalid reference, an anim element, and the empty-stage case), documented, and shipped.
