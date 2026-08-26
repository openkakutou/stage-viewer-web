---
status: todo
depends_on: [002]
---
# Characteristics Panel

## Description
Once a stage is loaded through the file input (item 002) and the WASM bridge (item 001), display its identifying and structural characteristics as the first visible view: stage name/author, camera bounds, and boundaries. This is the first end-to-end vertical slice of the app — it proves the full load pipeline (file input → WASM bridge → typed data → UI) works before any visual background rendering is attempted.

## Acceptance Criteria
- [ ] After loading a valid stage, the panel displays its name and author
- [ ] The panel displays the stage's camera bounds
- [ ] The panel displays the stage's boundaries
- [ ] A stage missing optional metadata (e.g. no author set) displays that explicitly (e.g. "Unknown"), not a blank or broken section

## Notes
None.

## Blocked
2026-08-26: Two of the four acceptance criteria ("displays its name and author") cannot be satisfied — the `stage` library's data model has no field for a stage's name or author at all; `[Info]` is explicitly recognized-but-discarded (see `stage`'s own item 002 implementation note). Filed as `stage`'s own backlog item `011-expose-stage-name-and-author-from-info-section.md`. Blocked on that landing and a `stage` release publishing it (WASM pin bump), per the org's version-pinning policy (roadmap `.vibe/decisions/016`) — not just the item being `status: done`.

**Resolved 2026-08-26:** `stage` item 011 is done, released as `v0.8.0`, and this repo's WASM pin is bumped to it — back in play.
