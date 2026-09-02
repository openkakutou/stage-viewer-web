---
status: done
depends_on: [004]
---
# 3D Model-Based Stage Preview Renderer

## Description
Extend the background preview renderer (item 004) to render Ikemen GO 3D model-based stages (see the roadmap's `.vibe/decisions/014`): load the glTF model and `.hdr` lighting file referenced by the stage's `[Model]` data once `stage`'s WASM build exposes it (`stage` backlog item 008), and render it via `web-ui-kit`'s new shared 3D viewport control (`web-ui-kit` item 007). A stage can mix 2D BG elements and a 3D model — both must compose correctly in the same preview.

## Acceptance Criteria
- [ ] A stage with `[Model]` data renders the referenced 3D model, positioned/scaled per its `Offset`/`Scale` data
- [ ] The model's `.hdr` environment lighting is applied to the render
- [ ] A stage mixing 2D BG elements and a 3D model composes both correctly in one preview
- [ ] A missing or failed-to-load model/`.hdr` asset shows a clear placeholder/error indicator instead of breaking the whole preview, mirroring item 004's handling of a missing sprite
- [ ] No skeletal/armature animation is attempted — models with armatures render in their base pose, matching Ikemen GO's own current limitation (do not build animation playback that the source engine itself doesn't support)
- [ ] A stage with no `[Model]` data behaves exactly as before this item (no regression to the 2D-only preview)

## Notes
Cross-repo dependency, not expressible via this repo's own `depends_on`: also needs `stage` backlog item `008` (parses the `[Model]`/`[Camera]`/`[Scaling]` data) and `web-ui-kit` backlog item `007` (shared 3D viewport control).
