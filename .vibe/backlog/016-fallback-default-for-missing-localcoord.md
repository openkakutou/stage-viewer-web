---
status: todo
---
# Fallback Default For Missing Localcoord

## Description
When a stage's `.def` `[StageInfo]` section omits `localcoord` entirely, the `stage` WASM bridge reports `localCoordWidth`/`localCoordHeight` as `0x0` (the Go zero value) instead of falling back to MUGEN/Ikemen GO's own documented `320,240` default, collapsing the composed background preview to a literal 0x0 canvas for an otherwise valid, real stage. Discovered by backlog item 010's real-stage-corpus rendering sanity scan: 7 real corpus stages hit this (`CC_BEACH`, `EXShadowPokemonGym`, `JB Jungle`, `School`, `XX'CC'SCHOOLYARD'XX`, `XX'GARAGE'XX`, `xxcolonyxx`).

## Acceptance Criteria
- [ ] A stage whose `.def` `[StageInfo]` section omits `localcoord` renders its background preview using the `320x240` default coordinate space instead of collapsing to a 0x0/blank canvas.
- [ ] All 7 real corpus stages currently flagged as degenerate by backlog item 010's corpus rendering sanity scan (`CC_BEACH`, `EXShadowPokemonGym`, `JB Jungle`, `School`, `XX'CC'SCHOOLYARD'XX`, `XX'GARAGE'XX`, `xxcolonyxx`) no longer fail that scan's zero-size local coordinate check.
- [ ] A stage that does specify `localcoord` continues to render with that exact declared coordinate space, unchanged.

## Notes
This repo already has an established pattern for exactly this class of zero-value-when-section-absent landmine: `background-composition.ts`'s `resolveBgScale` (backlog item 009, `xScale`/`yScale`) and `model-camera.ts`'s `resolveCameraParams` (`fov`/`near`/`far`) both guard at the point of use with a `rawValue > 0 ? rawValue : DEFAULT` fallback rather than trusting the raw WASM-reported value. This fix should follow the same idiom for `localCoordWidth`/`localCoordHeight`. Whether the fallback belongs here or in the `stage` Go library itself (so every consumer gets it, not just this app) is worth a quick look before implementing — the two other precedents (009, camera) were both applied on this side, gated at draw time, so that's the likely default unless a reason emerges to push it upstream.
