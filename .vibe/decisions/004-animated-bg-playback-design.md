---
date: 2026-08-29
status: accepted
---
# Animated BG playback is time-based, applies the parallax formula uniformly, and narrowly scopes what counts as an animation error

**Context:** Backlog item 005 extends the static background preview (item 004) with parallax scrolling and animated BG element playback, driven by a simulated camera and a Play/Pause control. Several implementation choices were not dictated by the acceptance criteria and needed a deliberate decision, refined by a real-time-rendering and a UX consultation during planning.

**Decision:**
1. **Playback progression is time-based, not callback-count-based.** Each `requestAnimationFrame` callback advances a `PlaybackState` by the real elapsed milliseconds since the previous callback (converted to ticks at a fixed 60 ticks/sec), clamped to a maximum per-step delta. A naive "one callback = one tick" model would run at the wrong speed on any refresh rate other than 60Hz and would "teleport" forward after a backgrounded/throttled tab resumes; the clamp bounds that jump instead.
2. **The parallax formula (mirroring `stage`'s own `ResolveParallaxPosition`) applies to every BG element's position, not just `"parallax"`-typed ones.** `deltaX`/`deltaY` exist on the data model regardless of `type`; a `"normal"` element's delta is simply `0` in practice, so applying the formula uniformly removes a type-based special case rather than adding one.
3. **An animated element's current frame is classified into four states, and only two of them are treated as an error.** `"no-animation"` (the action number has no matching `[Begin Action N]` block) and `"unresolved-sprite"` (the resolved sprite index doesn't exist in the sheet) are genuine data problems this diagnostic viewer surfaces with a placeholder and a distinct row label. `"blank"` — `stage`'s own "nothing to draw this frame" sentinel for a legitimately empty/degenerate animation — is deliberately *not* an error: it draws nothing and shows no label, matching the library's own contract instead of a blanket "anything unusual is an error" rule that would teach users to distrust the indicator once it also fired on a normal empty tick.
4. **Calling `renderBackgroundPreview` again on the same root cancels any previous playback loop first**, via a small `WeakMap<rootElement, stopFn>` registry — otherwise loading a different stage without a page reload would leave the old loop running invisibly against a detached canvas, issuing WASM calls forever.
5. **A tick awaits its animation-frame resolution before drawing and before scheduling the next frame**, rather than a "fire and forget with a re-entrancy guard that skips a busy tick" shape. The guard shape was rejected during review: it lets the camera keep advancing every callback while animated-sprite resolution silently freezes, producing a visible desync between the two kinds of layers instead of one uniformly-skipped frame. Awaiting keeps camera position and animation state always drawn together from the same tick.

**Reason:** Each point above was a real correctness or usability trap identified during expert consultation (real-time-rendering: points 1 and 5; UX: point 3), not a stylistic preference — implementing the naive version of any of them would have shipped a subtly wrong preview.

**Rejected alternatives:**
- *One `requestAnimationFrame` callback = one tick* — rejected: refresh-rate dependent, and no protection against a backgrounded-tab time jump (point 1).
- *A separate "manual camera drag" control instead of ambient auto-pan* — rejected for this item's scope: an ambient, fixed-rate auto-pan while playing is enough to demonstrate parallax, and adds no new interaction surface to test; a manual control can be a later, separately-scoped item if it turns out to be needed.
- *Treating any non-resolving animated frame as an error, including the library's own blank sentinel* — rejected per UX consultation: contradicts the acceptance criteria's own scope (only "malformed/out-of-range" data) and would make a legitimate empty frame indistinguishable from a real bug.
- *A re-entrancy guard that drops a tick's resolution while the camera keeps moving* — rejected per real-time-rendering consultation: produces a visible layer desync rather than a clean skip (point 5).
