---
status: todo
---
# Real-stage-corpus rendering sanity test

## Description
This repo's fixture-driven WASM tests all run against small, hand-picked or synthetic `.def`/`.sff` fixtures — there is no equivalent of the `stage` repo's own `STAGE_CORPUS_DIR`-gated `TestCorpusCompat_RealDefFiles_ParseSuccessRate`, which scans a local folder of real, unmodified stages (`~/workspace/ikemen-quick-versus/stages/`, 58 files, see `stage`'s `.vibe/fixture-sources.md`). That corpus test only proves a file *parses*, though — it never proves the parsed result *renders sensibly*, which is exactly the class of bug this item exists to catch: `Dengeki_Subway.def` parses without error today, and its BG elements list correctly, but the composed preview is a blank/broken-looking mess because the composition math draws every sprite at roughly 8x its intended on-canvas size (see the sibling `stage`/`stage-viewer-web` items on `[StageInfo]` `xscale`/`yscale`). That specific bug was only found because a user happened to load this exact real file and notice the empty-looking canvas — nothing in the test suite would have flagged it, and nothing would catch the next bug shaped like it (any real file whose composed result is nonsensical for a reason no synthetic fixture happens to exercise).

## Acceptance Criteria
- [ ] A new test, gated on the same `STAGE_CORPUS_DIR` env var `stage` already uses (unset ⇒ skipped, never runs in CI, documented the same way in this repo's `docs/testing.md`), walks every real stage folder in the corpus.
- [ ] For each stage, it loads the `.def` + `.sff` through the real WASM bridges (as the existing fixture-driven tests already do) and runs the result through the real `buildDrawPlan` composition logic — no canvas/DOM needed, since that logic is already pure.
- [ ] For each `"normal"`/`"parallax"`/`"anim"` element that resolves to a real sprite (not a broken reference), asserts its computed draw bounds are within a generous but meaningful margin of the stage's own `localCoordWidth`/`localCoordHeight` (e.g. flags an element whose width/height is an order of magnitude larger than the local coordinate space, or whose position lands nowhere near the visible camera range) — this is the check that would have caught the `xscale`/`yscale` bug.
- [ ] A stage that fails this sanity check is reported by name (not just a bare pass/fail count), the same way `stage`'s own corpus test reports failing file paths, so a future regression is actionable without re-deriving which file broke.
- [ ] `docs/testing.md` gets a new section documenting this test, mirroring how `stage`'s `.vibe/fixture-sources.md` documents its own corpus scan.
- [ ] Run once against the current corpus as part of this item's own verification, confirming it does flag `Dengeki_Subway` before the `xscale`/`yscale` fix lands, and passes clean once that fix (backlog item 009) is in.

## Notes
This is a testing-methodology item, not a rendering fix — it exists so the next bug in this shape is caught by a test run instead of by a user manually loading one specific real file and noticing something looks off. Best sequenced *before* or alongside item 009 (apply `xscale`/`yscale` in composition), so it can demonstrate red→green on that exact fix.
