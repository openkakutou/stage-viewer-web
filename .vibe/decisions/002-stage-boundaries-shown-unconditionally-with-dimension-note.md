---
date: 2026-08-26
status: accepted
---
# Stage boundaries shown unconditionally, with an explicit 2D/3D note

**Context:** The characteristics panel (backlog item 003) must display the stage's boundaries, which include two fields (`topBound`/`bottomBound`) that only carry meaning for a 3D, model-based stage — for a 2D stage they are always zero, per `stage`'s own `BGdef.ModelFile`-emptiness convention for "is this stage 3D."

**Decision:** Show all four boundary fields (`left`/`right`/`topBound`/`bottomBound`) unconditionally, and state plainly, next to them, whether the loaded stage is 2D or 3D — derived the same way `stage` itself derives it (`bgDef.modelFile` non-empty), never from the bound values being zero.

**Reason:** Hiding the two fields for a 2D stage would silently vary the panel's shape depending on stage type, and a user comparing a 2D and a 3D stage would have no visible cue why. Deriving "3D" from the bound values themselves (e.g. "non-zero means 3D") would be wrong — a 2D stage's zero bounds are a value that happens to be zero, not evidence of dimensionality, and a model-based stage could in principle also have zero bounds. Stating the dimension explicitly lets a zero `topBound`/`bottomBound` read as "not applicable" instead of "broken/missing data."

**Rejected alternatives:** Hiding `topBound`/`bottomBound` entirely for a 2D stage (rejected: inconsistent panel shape, no visible explanation). Inferring 3D-ness from the bound values instead of `bgDef.modelFile` (rejected: conflates a legitimate zero value with absence of the concept).
