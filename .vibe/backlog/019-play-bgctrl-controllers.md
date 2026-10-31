---
status: todo
---
# Play BGCtrl controller effects in the stage preview

## Description
Stages that rely on BGCtrl controllers currently look static or wrong. Once stage resolves controller state per tick, drive layer visibility, offsets and animations from it in the preview.

## Acceptance Criteria
- [ ] A stage with BGCtrl controllers animates as in the reference engine
- [ ] Playback can be paused and reset
- [ ] Stages without controllers behave exactly as today

## Notes
Cross-repo: waits for stage#016 (Resolve controller-driven layer state) and a published stage WASM version.
