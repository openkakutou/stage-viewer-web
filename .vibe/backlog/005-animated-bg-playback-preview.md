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
None.
