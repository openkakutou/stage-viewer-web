import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { renderStageFileInput } from "./input/stage-file-input-view.ts";
import type { StageFolderInputOptions } from "./input/stage-file-input.ts";
import { appVersion } from "./version.ts";

const APP_TITLE = "Stage Viewer";

export interface RenderAppOptions {
  /** Forwarded to the file input's WASM bridge; injectable for testing. */
  bridgeOptions?: StageFolderInputOptions["bridgeOptions"];
}

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) in the toolbar and the stage file input
 * (backlog item 002) as `<main>` content. Mirrors `character-viewer-web`'s
 * own scaffold adoption: no sidebar/tabs yet — `<wuik-app-shell>` collapses
 * empty named slots to zero size with no reserved gutter, so omitting them
 * renders nothing broken — deferred until a second real screen exists.
 * Default light theme only (no theme toggle), same as the sibling app.
 */
export function renderApp(
  root: HTMLElement,
  version: string,
  options: RenderAppOptions = {},
): void {
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  toolbar.appendChild(title);
  shell.appendChild(toolbar);

  const main = document.createElement("main");
  renderStageFileInput(main, {
    // No consumer exists yet for a loaded stage — the characteristics
    // panel and other viewer screens (backlog items 003+) are what
    // actually renders it. This item's own job stops at loading.
    onLoaded: () => {},
    bridgeOptions: options.bridgeOptions,
  });
  shell.appendChild(main);

  root.appendChild(shell);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
