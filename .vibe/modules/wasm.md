# Module: wasm
**Role:** Bridge to the `stage` WebAssembly module — loads it client-side and exposes typed `loadStage`/`resolveAnimationFrames` wrappers, plus the `StageData` TypeScript vocabulary, each returning a typed result instead of throwing.
**Files:** `src/wasm/bridge.ts`, `src/wasm/types.ts`
**Exports:** `loadStage(defBytes: Uint8Array, options?: WasmBridgeOptions): Promise<StageResult>`, `resolveAnimationFrames(requests: AnimationFrameRequest[], options?: WasmBridgeOptions): Promise<ResolveAnimationFramesResult>`, `resetWasmBridgeForTests(): void`, `WasmBridgeOptions`, `AnimationFrameRequest`, `ResolveAnimationFramesResult`, `StageData` (now including `name`/`author`/`animations`), `StageResult`, `BGElement`, `BGElementType`, `BGAnimation`, `BGAnimFrame`, `SpriteRef`, `BGdef`, `CameraBounds`, `StageBoundaries`, `Model`, `Scaling`, `PlayerStartZ`
**Depends on:** (none — talks directly to the `stage.wasm`/`wasm_exec.js` globals fetched from `public/wasm/`)
