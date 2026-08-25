---
date: 2026-08-25
status: accepted
---
# Referenced sprite sheet is resolved by basename (path/separator stripped), exact match first, case-insensitive fallback second

**Context:** Backlog item 002 requires locating the `.sff` file a loaded stage's `.def` references, by the exact filename read from the parsed data — not guessed by extension alone — searching any subfolder depth of the picked folder, and reporting a named error if it truly can't be found. `stage`'s `BGdef.spriteFile` is the raw string from the `.def`'s `[BGDef]` "spr" key, which real-world MUGEN/Ikemen files write inconsistently: as a bare filename, with a relative path, with backslash separators (Windows-authored), and — per the sibling `character` repo's own real-corpus findings (`character`'s `.vibe/backlog/done/050-character-load-resolves-referenced-files-case-sensitively.md`, 12 of 717 real files affected) — sometimes in a different letter case than the actual file on disk, a legacy of MUGEN historically running on case-insensitive Windows filesystems.

**Decision:**
- Only the final path segment (basename) of `spriteFile` is used for matching — any directory prefix, forward slash, or backslash it carries is stripped, since the folder structure the browser exposes has no guaranteed relationship to the string a `.def` author wrote.
- Resolution tries an exact basename match against every gathered file first (fast path, matches the common case with no behavior change).
- If no exact match is found, it falls back to a case-insensitive basename match before giving up.
- If more than one gathered file shares the resolved basename (exact or case-insensitively), resolution reports it as ambiguous rather than silently picking one — a wrong silent pick would load the wrong sprite sheet with no visible sign anything went wrong.
- Only a match at neither level is reported as the item's own "referenced file missing" error, naming the exact string `spriteFile` held (not just the stripped basename), so the message stays traceable to what the `.def` actually said.

**Reason:** Mirrors an already-evidenced real-world failure mode in this exact org (case mismatches, and separately backslash-path handling in `character`'s own item 049) rather than assuming a browser-gathered folder listing will match a `.def`'s string byte-for-byte. Exact-match-first keeps the common case a single pass with no extra work; the fallback only runs when needed.

**Rejected alternatives:**
- *Exact string match only, no fallback* — rejected: would reproduce the exact bug class `character`'s item 050 already found and fixed in a sibling parser, for a corpus of real files this org has already observed hitting it.
- *Silently resolve to the first match on ambiguity* — rejected: this item's acceptance criteria treat "not the file the stage actually uses" as the specific failure to avoid; picking one of several same-named files silently reintroduces that risk instead of surfacing it.
- *Full relative-path matching (reconstruct `spriteFile`'s own directory structure and require it to match)* — rejected: the acceptance criteria explicitly call for basename resolution ("searching subfolder depth as needed"), and a real `.def`'s path string has no reliable relationship to how a user's local folder is actually organized.
