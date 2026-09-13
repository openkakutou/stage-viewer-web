---
date: 2026-09-13
status: accepted
---
# Real fixture vendoring for visual regression tests

**Context:** Backlog item 011 needs baseline screenshots of the composed
background preview for a real 2D stage (`Dengeki_Subway`, the exact stage
that exposed the `xscale`/`yscale` bug backlog item 009 fixed) and a real
3D model-based stage. `npm run test:visual` must run in CI, but the real
stage corpus this project already uses for other tests
(`STAGE_CORPUS_DIR`, see `docs/testing.md`) is a machine-specific external
directory, never present in CI.

**Decision:** Vendor two real, unmodified stage folders straight into the
repo under `tests/visual/fixtures/` — `dengeki-subway/` (`.def` + `.sff`,
~5.3MB) and `cvs2london/` (`.def` + `.sff` + `.glb`, ~2.5MB, MIT-licensed
per its own file header) — each trimmed to exactly one `.def` file (the
real folders carry 2–3 round-specific alternate `.def`s each, which would
otherwise trip this app's own "pick one" ambiguous-candidate step, out of
scope here). No other byte is altered.

**Reason:** A CI-running visual test needs the actual bytes present at
test time, not a path to an external corpus. Both fixtures are small
enough to vendor whole, and there is no existing tool in this JS/TS repo
to trim a `.sff`/`.glb` down further (unlike the sibling Go `sff` repo's
own `testdata/gen`, built because its own source files reach ~329MB). This
mirrors this project's own established pattern for real WASM-bridge
fixtures (`sample.def`, `v1-basic.sff`, both real files copied into
`testdata/`) and the sibling `stage` repo's `testdata/README.md` precedent
of vendoring a real, unmodified `.def` (including this exact
`Dengeki_Subway.def`) when no trimming tool exists and the file is small
enough as-is.

**Rejected alternatives:**
- Gate the visual suite on `STAGE_CORPUS_DIR` the way the corpus sanity
  test (item 010) does — rejected: the acceptance criteria requires this
  suite to actually run in CI and fail the build on a diff, which an
  env-var-skipped test can never do.
- Build a `.sff`/`.glb` trimming tool first — rejected as disproportionate
  scope for this item: both fixtures are already small (single-digit MB),
  well short of the sibling `sff` repo's ~329MB problem that justified
  building one there.
- Hand-build synthetic `.def`/`.sff`/`.glb` fixtures instead of real ones
  — rejected: the acceptance criteria explicitly names `Dengeki_Subway` as
  the regression guard for a bug found on that exact real file, and a
  fabricated stand-in would not carry the same evidentiary weight.
