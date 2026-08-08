---
status: todo
depends_on: [002]
---
# BG Element/Layer Browser + Background Preview Renderer

## Description
Once a stage is loaded (item 002), let the user browse every configured BG element and layer (front/back, position, scale, sprite reference) in a list/tree view, and render a live visual preview of the composed background — every BG element drawn at its configured position, scale, and layer order — on a canvas/viewport (using `web-ui-kit`'s shared zoom/pan viewport controls). This is the first pixel-level rendering feature in the app, so it establishes the composition pipeline (BG elements → layered draw order → canvas) that later playback features (item 005) build on.

## Acceptance Criteria
- [ ] Every BG element/layer configured in the loaded stage is listed, showing its key properties (position, scale, layer)
- [ ] The preview renderer draws all BG elements composed in the correct front/back layer order
- [ ] Selecting a BG element in the browser highlights it in the preview
- [ ] A BG element referencing a sprite missing from the loaded sprite sheet renders a clear placeholder/error indicator instead of breaking the whole preview
- [ ] A stage with zero configured BG elements shows an explicit empty state, not a blank canvas indistinguishable from a loading/broken state

## Notes
None.
