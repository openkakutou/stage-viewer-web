# Module: app
**Role:** Application entry point — builds the app's `web-ui-kit` root frame (toolbar + empty main content) and mounts it into the DOM.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `renderApp(root: HTMLElement, version: string): void`, `appVersion: string`
**Depends on:** `modules/wasm.md` (not yet called from here — wired up once the file input, backlog item 002, lands)
