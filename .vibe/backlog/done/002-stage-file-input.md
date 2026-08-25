---
status: done
depends_on: [001]
---
# Stage File Input

## Description
Since this is a static site with no backend, the user must supply a stage's files directly from their machine. Folder selection is the **only** input path: the user selects or drops an entire folder containing the stage's `.def` file and its referenced sprite sheet (`.sff`) — picking files one by one was considered and dropped, since picking a single file can never grant the browser access to sibling files anyway (see Notes). The `.def` file is the entry point: if the folder contains exactly one, it's used automatically; if it contains more than one, the user is prompted to pick which one to load. The chosen `.def` is then parsed to read which `.sff` filename it actually references, and that specific file is located within the folder by that name (recursing into subfolders as needed) — not guessed by extension alone, so a folder holding more than one `.sff` (leftover/alternate sheets) isn't mistaken for the one the stage actually uses. The resolved bytes are fed into the WASM bridge (item 001).

## Acceptance Criteria
- [ ] User can select a folder via a directory picker, or drag-and-drop a folder
- [ ] If the folder contains exactly one `.def` file, it is used automatically as the entry point
- [ ] If the folder contains multiple `.def` files, the user is prompted to pick which one to load, instead of the app silently choosing one
- [ ] The referenced `.sff` file is located by the filename the chosen `.def` actually references (searching subfolder depth as needed), not by matching "any file with this extension"
- [ ] A file the `.def` references but that cannot be found anywhere in the folder shows a clear error state naming which referenced file is missing

## Notes
Web platform constraint driving this design: picking a single file never grants access to sibling files — neither `<input type="file">` nor the File System Access API's `FileSystemFileHandle` exposes a parent directory, by deliberate browser sandboxing. "Just pick the `.def`, the app finds the rest" cannot work in a browser without an explicit folder-level permission grant; folder selection is the only way to reach that UX here. (This project has no desktop build planned, unlike `stage-editor` — this constraint applies unconditionally.)

Browser support: `<input webkitdirectory>` (Chrome/Firefox/Safari) with `webkitRelativePath` per `File`, or `DataTransferItem.webkitGetAsEntry()` + `FileSystemDirectoryReader.readEntries()` for drag-and-drop — both yield the full folder listing up front, so resolving the referenced `.sff` is a synchronous lookup against an already-built name→bytes table, not an async per-file search. Reading which filename the `.def` references requires parsing its `[Files]`-equivalent section — check whether the WASM bridge (item 001) already exposes this, or whether a minimal local text parse of just that section is needed ahead of the full load call; either way, don't duplicate the stage parser's own `.def` parser logic here. Open question to resolve during implementation, not before.
