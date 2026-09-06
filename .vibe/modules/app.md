# Module: app
**Role:** Application entry point — builds the app's `web-ui-kit` root frame (toolbar, with a `<wuik-locale-switcher>` per backlog item 008, plus the stage file input as main content), wires a successful load to the characteristics panel and the BG element browser + background preview, and mounts it into the DOM. Bootstraps i18n (`initAppI18n`) before the first render; a top-level `onLocaleChange` subscription re-translates the switcher's label and re-renders the characteristics panel (which owns no live state of its own) on a live language switch.
**Files:** `src/main.ts`, `src/version.ts`, `src/style.css`
**Exports:** `renderApp(root: HTMLElement, version: string, options?: RenderAppOptions): void`, `appVersion: string`
**Depends on:** `modules/input.md`, `modules/viewer.md`, `modules/sff-wasm.md`, `modules/i18n.md`
