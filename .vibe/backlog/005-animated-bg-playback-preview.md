---
status: blocked
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
Cross-repo blocker, found during implementation (not previously flagged here): animated-frame cycling (AC2/AC4) needs real resolved `.air`-driven frame data for a `BGElementAnim`'s `ActionNumber`, and `stage` cannot currently produce or expose it for a real file, for two separate reasons —
1. `stage`'s own `Parse` doesn't read `[Begin Action N]` blocks yet, so `BGAnimation`/`BGAnimFrame` (already modeled) are never populated from a real `.def` file — tracked as `stage`'s own backlog item `009` (still `todo`, needs `stage#005` which is already done).
2. Even once `009` lands, `stage`'s WASM entrypoint (`cmd/wasm/main.go`) has no exposed way to surface `BGAnimation`/`ResolveAnimationFrame` data through `OpenKakutouStage.load`'s JSON result at all — `BGElement` only exposes the raw `actionNumber`, nothing maps it to frame data. Now tracked as `stage#011` (depends on `009`).

Parallax playback (AC1/AC3) has no such blocker — `BGElement.deltaX`/`deltaY` are already exposed today. Per this skill's own "no split" rule in autonomous mode, this item isn't partially implemented; it stays `blocked` as a whole until `stage#009` and `stage#011` are both done.

## Blocked
2026-08-28: Depends on `stage#009` and `stage#011` (neither done) — see Notes above.
