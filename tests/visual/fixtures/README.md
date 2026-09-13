# Visual regression fixtures

Real, vendored stage folders used by `tests/visual/*.spec.ts` (backlog item
011). Committed rather than read from the machine-specific
`STAGE_CORPUS_DIR` local corpus (see `docs/testing.md`'s "Real-stage-corpus
rendering sanity test" section) because CI needs them present on every run.

Each folder is trimmed to contain exactly **one** `.def` file, even though
the corpus's real folder has more (round-specific alternate `.def`s) — this
app's own folder input treats more than one `.def` candidate as ambiguous
and shows a "pick one" selection step first (already covered by that
feature's own tests), which is out of scope for these specs. No other byte
is altered.

## `dengeki-subway/`

`Dengeki_Subway.def` + `Dengeki_Subway.sff`, vendored unmodified from a
local Ikemen GO frontend install's `stages/` directory (see
`docs/testing.md`). A real MUGEN 1.1 stage whose `[StageInfo]` sets
`xscale = .35` / `yscale = .35` — the exact stage that once exposed the
composition bug fixed by backlog item 009 (BGdef `xscale`/`yscale` not
applied when drawing). This baseline is the regression guard against that
bug recurring: reverting the fix reproduces a grossly oversized, mostly
off-canvas composed background, which fails this suite's screenshot
comparison.

## `cvs2london/`

`cvs2london.def` + `cvs2london.sff` + `cvs2london.glb`, vendored unmodified
from the same local corpus. A real Ikemen GO 3D model-based stage — its own
`.def` states "This stage and its assets are licensed under MIT." No BG
elements of its own (the 3D model is the entire background), so this
exercises the model-only preview path (backlog item 006) rather than the
2D composition path `dengeki-subway/` covers.

## Regenerating

There is no trimming tool for these binary formats (unlike the sibling Go
`sff` repo's own `testdata/gen`) — both fixtures are small enough
(2.5MB and 5.3MB) to vendor whole. Copy the real files directly from a
local corpus (see `docs/testing.md`) if a fixture ever needs replacing;
never hand-edit or fabricate the copied bytes.
