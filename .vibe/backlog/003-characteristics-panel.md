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
