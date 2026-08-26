# Module: app
**Role:** Application entry point — builds the app's `web-ui-kit` root frame (toolbar + the stage file input as main content), wires a successful load to the characteristics panel and the BG element browser + background preview, and mounts it into the DOM.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `renderApp(root: HTMLElement, version: string, options?: RenderAppOptions): void`, `appVersion: string`
**Depends on:** `modules/input.md`, `modules/viewer.md`, `modules/sff-wasm.md`
