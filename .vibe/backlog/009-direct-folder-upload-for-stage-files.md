---
status: todo
depends_on: [002]
---
# Direct Folder Upload for Stage Files

## Description
Add a folder-selection option alongside the file picker/drag-and-drop from item 002: let the user select or drop an entire folder containing the stage's `.def` file and its referenced sprite sheet (`.sff`), without having to pick or drop each file one by one. The `.def` file is the entry point: it is identified within the folder first (prompting for disambiguation if the folder holds more than one candidate), then parsed to read which `.sff` filename it actually references — that specific file is located within the folder by that name (recursing into subfolders as needed), not guessed by extension alone. A folder can otherwise contain more than one `.sff` (e.g. leftover/alternate sheets) without one being mistaken for the one the stage actually uses. The resolved bytes are fed into the same WASM bridge item 002 already uses. This targets the common case of a stage distributed as a plain folder rather than individual files.

## Acceptance Criteria
- [ ] If the folder contains exactly one `.def` file, it is used automatically as the entry point
- [ ] If the folder contains multiple `.def` files, the user is prompted to pick which one to load, instead of the app silently choosing one
- [ ] The referenced `.sff` file is located by the filename the chosen `.def` actually references (searching subfolder depth as needed), not by matching "any file with this extension"
- [ ] A file the `.def` references but that cannot be found anywhere in the folder shows a clear error state naming which referenced file is missing, same UX as item 002's missing-file case

## Notes
Browser support: click-to-browse folder selection uses the non-standard but widely supported `<input webkitdirectory>` attribute; drag-and-drop of a folder requires walking `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader` instead of the flat `FileList` used by item 002. Reading which filename the `.def` references requires parsing its `[Files]`-equivalent section — check whether the WASM bridge (item 001/002) already exposes this, or whether a minimal local text parse of just that section is needed ahead of the full "bytes in → WASM bridge" load call item 002 established; either way, don't duplicate the stage parser's own `.def` parser logic here. Open question to resolve during implementation, not before.
