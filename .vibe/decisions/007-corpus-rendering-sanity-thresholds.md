---
date: 2026-09-09
status: accepted
---
# Real-stage-corpus rendering sanity thresholds combine size and position

**Context:** Backlog item 010 needed a rule to flag a real corpus stage whose composed `buildDrawPlan` output is nonsensical relative to its own `localCoordWidth`/`localCoordHeight` — specifically, a rule that would have caught backlog item 009's `xscale`/`yscale` composition bug (`Dengeki_Subway.def` drawing every sprite ~2.86x oversized per axis with no scale applied).

**Decision:** An element is flagged only when it is *both* oversized (drawn size exceeds 3.5x the local coordinate space in either dimension) *and* offscreen at rest (extends more than 0.25x past the local coordinate rectangle on either axis) — never on either condition alone. Thresholds were derived empirically by scanning the real 58-file local corpus (`STAGE_CORPUS_DIR`), not guessed.

**Reason:** Measuring the real corpus showed neither a pure size threshold nor a pure position threshold can safely separate real bugs from legitimate content: `Church Beach.def`'s own floor sprite is legitimately drawn at 6.67x the local coordinate space (larger, per-axis, than `Dengeki_Subway.def`'s unscaled 6.4x/6.32x bug reproduction), and `Otherworldly Forest.def`'s own cloud parallax layer is legitimately parked 1.375x past the canvas at rest — either threshold set low enough to catch the historical bug would false-positive on one of these real files. Combining both conditions works because they share a common cause in the failure mode being targeted: a missing scale factor multiplies an element's position *and* its size by the same erroneous amount, so the two conditions compound only in the broken case. Reproducing `Dengeki_Subway.def`'s composition without its `0.35`/`0.35` scale reaches up to 6.4x oversized and up to 1.06x offscreen on the same elements, clearing both thresholds together with comfortable headroom over the real corpus's worst legitimate cases (2.22x size, 1.375x offscreen, never on the same element).

**Rejected alternatives:**
- A single "order of magnitude" (10x) size-only threshold, as loosely suggested by the backlog item's own phrasing — rejected because the real historical bug never reaches 10x on any single dimension (max 6.4x), so this literal reading would never have caught it.
- A pure position/offscreen-margin check — rejected because the real historical bug's worst offending elements only reach 0.6x–1.06x past the canvas, well within legitimate corpus elements' own offscreen range (up to 1.375x) when considered without their size.
