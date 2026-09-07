---
status: done
---
# Apply BGdef xscale/yscale in background composition

## Description
A "hi-res" stage authors its BG sprite art larger than its own `localcoord` and relies on `[StageInfo]`'s `xscale`/`yscale` (e.g. `Dengeki_Subway.def`: `xscale=.35, yscale=.35`) to scale it back down at draw time. `background-composition.ts`'s coordinate/size math (`stageXToCanvasX`, `computeSpriteTopLeft`, `buildDrawPlan`'s placeholder/sprite sizing) never applies any such factor — every sprite is drawn at its raw decoded pixel size. For a stage scaled ~0.35x, that means every element renders roughly 8x its intended on-canvas area, so the composed preview shows nothing recognizable: one oversized, cropped element fills/overflows the visible canvas and everything else lands off-canvas — reading to a user as a completely blank/broken preview rather than an oversized one.

## Acceptance Criteria
- [x] `stage`'s `BGdef.XScale`/`YScale` (see `stage` backlog item 012, a hard dependency of this item) reaches `StageData` through the WASM bridge/type mapping.
- [x] `background-composition.ts` scales both a sprite/placeholder's position and its drawn width/height by `bgDef.xScale`/`bgDef.yScale` before producing a `DrawCommand`, for `"normal"`, `"parallax"`, and `"anim"` elements alike.
- [x] A stage whose `[StageInfo]` omits `xscale`/`yscale` (the common case, default 1,1) renders pixel-identical to today — this item changes nothing for the majority of the corpus.
- [x] Loading `Dengeki_Subway.def` (from the local real-stage corpus, see `docs/testing.md`/`stage`'s `.vibe/fixture-sources.md`) now shows a coherent, correctly-scaled composed scene instead of one oversized fragment.
- [x] Covered by a unit test on the composition math (synthetic non-1.0 scale) — the real-corpus rendering-bounds regression test itself is backlog item 010's own scope, not this one's.

## Resolution
`stage` backlog item 012 had already landed and released as `v0.12.0` — already this repo's pinned WASM version, and confirmed to expose `xScale`/`yScale` by running the real module. `BGdef.xScale`/`yScale` were added to `types.ts`. `background-composition.ts`'s `buildDrawPlan` gained a `scale: {x, y}` parameter (default `{1, 1}`, so the untouched default path is unaffected) applied to every element's position, axis offset, and drawn sprite/placeholder size; a new `resolveBgScale` guards `stage`'s own documented zero-value landmine (no `[StageInfo]` section leaves `XScale`/`YScale` at the Go zero value `0`, which would otherwise collapse the whole scene to a point) back to `1`. `DrawCommand`'s `"sprite"` variant now separates its scaled drawn `width`/`height` from the decoded pixel buffer's native `pixelWidth`/`pixelHeight`, since the buffer itself can't be resampled by the pure math layer; `background-preview.ts`'s draw step takes a new offscreen-canvas + `drawImage` scaling path only when the two differ, keeping the pre-existing `putImageData` output byte-for-byte identical for an unscaled stage. Verified against the real local corpus: `Dengeki_Subway` (`xscale=.35`/`yscale=.35`) now composes a coherent scene instead of one oversized fragment; `CC_BEACH` (no `xscale`/`yscale`) renders identically before and after the fix (a pre-existing, unrelated sprite-resolution gap on that particular stage, confirmed unaffected).

## Notes
Blocked on `stage` backlog item `012-parse-stageinfo-xscale-yscale-into-bgdef.md` landing and its WASM release being repinned here (see this repo's own WASM version-pin convention). Found via a user-reported "no preview" bug while testing `Dengeki_Subway` — a genuine 2D (non-3D) stage, distinct from the separate `cvs2aomori` 3D-model-asset-not-auto-loaded issue investigated in the same session.
