---
status: todo
depends_on: [004]
---
# Animated BG Playback Preview

## Description
Extend the background preview renderer (item 004) with time-based playback: parallax scroll deltas applied as the virtual camera moves, and animated BG elements (multi-frame sprites) cycling through their frames over time, matching the `stage` library's resolved parallax/animation state. Add basic playback controls (play/pause, and a way to simulate camera movement) so the preview reflects how the background actually behaves in-game rather than a single static frame.

## Acceptance Criteria
- [ ] Parallax-configured BG elements visibly scroll at a different rate than the base layer as the simulated camera moves
- [ ] Animated BG elements cycle through their configured frames over time at the correct timing
- [ ] Playback can be paused and resumed without visual glitches (e.g. frame skipping or elements jumping)
- [ ] A BG element with malformed/out-of-range animation data (e.g. a frame index beyond the sprite sheet) falls back to a clear error indicator for that element instead of stalling or crashing the whole playback loop

## Notes
Cross-repo blocker, found during implementation (not previously flagged here): animated-frame cycling (AC2/AC4) needs real resolved `.air`-driven frame data for a `BGElementAnim`'s `ActionNumber`, and `stage` could not previously produce or expose it for a real file, for two separate reasons — both now resolved:
1. ~~`stage`'s own `Parse` doesn't read `[Begin Action N]` blocks yet~~ — **resolved**: `stage#009` shipped in `stage` `v0.9.0`.
2. ~~`stage`'s WASM entrypoint (`cmd/wasm/main.go`) has no exposed way to surface `BGAnimation`/`ResolveAnimationFrame` data~~ — **resolved**: `stage#011` shipped `OpenKakutouStage.resolveAnimationFrames` in `stage` `v0.10.0`. This repo's own WASM pin is bumped to it (`.github/workflows/deploy-pages.yml`).

Parallax playback (AC1/AC3) has no such blocker — `BGElement.deltaX`/`deltaY` are already exposed today. Both blockers being resolved, this item is unblocked and back in play.

## Previously blocked
2026-08-28: Depended on `stage#011` (not done at the time) — `stage#009` had already resolved and published as `stage` `v0.9.0`.
2026-08-29: `stage#011` shipped and published as `stage` `v0.10.0` — unblocked, `status` returned to `todo`.
