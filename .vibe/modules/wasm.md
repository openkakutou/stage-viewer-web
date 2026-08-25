# Module: wasm
**Role:** Bridge to the `stage` WebAssembly module — loads it client-side and exposes a typed `loadStage` wrapper, plus the `StageData` TypeScript vocabulary, each returning a typed result instead of throwing.
**Files:** `src/wasm/bridge.ts`, `src/wasm/types.ts`
**Exports:** `loadStage(defBytes: Uint8Array, options?: WasmBridgeOptions): Promise<StageResult>`, `resetWasmBridgeForTests(): void`, `WasmBridgeOptions`, `StageData`, `StageResult`, `BGElement`, `BGElementType`, `SpriteRef`, `BGdef`, `CameraBounds`, `StageBoundaries`, `Model`, `Scaling`, `PlayerStartZ`
**Depends on:** (none — talks directly to the `stage.wasm`/`wasm_exec.js` globals fetched from `public/wasm/`)
