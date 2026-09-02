---
status: todo
---
# Apply BGdef xscale/yscale in background composition

## Description
A "hi-res" stage authors its BG sprite art larger than its own `localcoord` and relies on `[StageInfo]`'s `xscale`/`yscale` (e.g. `Dengeki_Subway.def`: `xscale=.35, yscale=.35`) to scale it back down at draw time. `background-composition.ts`'s coordinate/size math (`stageXToCanvasX`, `computeSpriteTopLeft`, `buildDrawPlan`'s placeholder/sprite sizing) never applies any such factor — every sprite is drawn at its raw decoded pixel size. For a stage scaled ~0.35x, that means every element renders roughly 8x its intended on-canvas area, so the composed preview shows nothing recognizable: one oversized, cropped element fills/overflows the visible canvas and everything else lands off-canvas — reading to a user as a completely blank/broken preview rather than an oversized one.

## Acceptance Criteria
- [ ] `stage`'s `BGdef.XScale`/`YScale` (see `stage` backlog item 012, a hard dependency of this item) reaches `StageData` through the WASM bridge/type mapping.
- [ ] `background-composition.ts` scales both a sprite/placeholder's position and its drawn width/height by `bgDef.xScale`/`bgDef.yScale` before producing a `DrawCommand`, for `"normal"`, `"parallax"`, and `"anim"` elements alike.
- [ ] A stage whose `[StageInfo]` omits `xscale`/`yscale` (the common case, default 1,1) renders pixel-identical to today — this item changes nothing for the majority of the corpus.
- [ ] Loading `Dengeki_Subway.def` (from the local real-stage corpus, see `docs/testing.md`/`stage`'s `.vibe/fixture-sources.md`) now shows a coherent, correctly-scaled composed scene instead of one oversized fragment.
- [ ] Covered by a unit test on the composition math (synthetic non-1.0 scale) and, per backlog item 010, a real-corpus rendering-bounds regression test.

## Notes
Blocked on `stage` backlog item `012-parse-stageinfo-xscale-yscale-into-bgdef.md` landing and its WASM release being repinned here (see this repo's own WASM version-pin convention). Found via a user-reported "no preview" bug while testing `Dengeki_Subway` — a genuine 2D (non-3D) stage, distinct from the separate `cvs2aomori` 3D-model-asset-not-auto-loaded issue investigated in the same session.
