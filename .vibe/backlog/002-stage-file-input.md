---
status: todo
depends_on: [001]
---
# Stage File Input

## Description
Since this is a static site with no backend, the user must supply a stage's files directly from their machine. Add a file input (standard multi-file picker and/or drag-and-drop) that lets the user select or drop a stage's `.def` file along with its referenced sprite sheet (`.sff`) file, reads each as a byte buffer, and feeds them into the WASM bridge (item 001).

## Acceptance Criteria
- [ ] User can select the `.def` and referenced sprite sheet files via a file picker, or drag-and-drop them onto a drop zone
- [ ] Selected files are read as byte buffers and passed to the WASM bridge's load call
- [ ] A missing required file (e.g. only the `.def` provided, no sprite sheet) shows a clear error state naming which file is missing, instead of calling the bridge with incomplete data
- [ ] An unreadable/corrupt file selection shows a clear error state instead of crashing the page

## Notes
None.
