---
date: 2026-09-18
status: accepted
---
# Overview-mode canvas resize is gated, not unconditional, per draw

**Context:** Backlog item 013 wires `computeStageBoundingBox`/`translateDrawCommands`
(item 012) into `background-preview.ts`'s `rebuildPlanAndDraw()`, which runs
on every draw — the initial load and every playback tick alike — because a
parallax element's canvas position depends on the live, playback-driven
`cameraX`, so the bounding box can, in principle, change tick to tick.

**Decision:** `rebuildPlanAndDraw()` recomputes the bounding box on every
call (cheap: the underlying math is already `O(elements)`, no heavier than
the draw itself), but only *writes* `canvas.width`/`canvas.height`/
`stack.style.aspectRatio` and re-invokes `<wuik-viewport>`'s `resetToFit()`
when the newly computed integer extent actually differs from the
previously applied one. A stable-bbox stage (the common case) resizes and
re-fits exactly once, on load; a stage whose visible extent genuinely grows
during playback (e.g. a parallax layer scrolling past the previously known
edge) resizes and re-fits again when that happens.

**Reason:** `computeStageBoundingBox` already rounds every edge outward to
an integer (`Math.floor`/`Math.ceil`), so comparing the previous and new
extents as plain integers is exact — no epsilon/jitter handling needed, and
consulting experts flagged this same "reads exact" property as the
condition that makes a per-tick regression check safe. The alternative —
reassigning `canvas.width`/`height` and calling `resetToFit()`
unconditionally every tick — would cancel a user's manual zoom/pan on every
single playback frame, defeating the point of exposing `<wuik-viewport>`'s
zoom/pan for a stage whose whole point is that it doesn't fit on screen at
once, and (per the realtime-rendering consult) forces the canvas backing
store and the host layout to be rebuilt every frame even when nothing
about the visible extent changed.

**Rejected alternatives:**
- Resize and re-fit unconditionally on every draw — rejected: resets the
  user's zoom/pan on every playback tick, and repeatedly drops/reallocates
  the canvas backing store and forces a `<wuik-viewport>`/stack layout pass
  for no visible reason on the (typical) stable-bbox tick.
- Resize/re-fit once on load only, never again during playback — rejected:
  a parallax layer whose extent genuinely grows past the initial bbox
  during playback would clip again exactly the way this item exists to
  fix, just with a delay instead of never.
- Debounce/coalesce resize checks over a time window instead of comparing
  the previous vs. current integer extent directly — rejected as
  unnecessary complexity: the extent is already integer and stable
  wherever the visible content is actually stable, so a direct equality
  check needs no debounce to avoid flapping.
</content>
