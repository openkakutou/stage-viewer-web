import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { renderStageFileInput } from "./input/stage-file-input-view.ts";
import type { StageFolderInputOptions } from "./input/stage-file-input.ts";
import { appVersion } from "./version.ts";
import { renderBackgroundPreview } from "./viewer/background-preview.ts";
import { renderCharacteristicsPanel } from "./viewer/characteristics-panel.ts";
import type { SffWasmBridgeOptions } from "./wasm/sff-bridge.ts";

const APP_TITLE = "Stage Viewer";

export interface RenderAppOptions {
  /** Forwarded to the file input's WASM bridge; injectable for testing. */
  bridgeOptions?: StageFolderInputOptions["bridgeOptions"];
  /** Forwarded to the `sff` WASM bridge (background preview sprite decode); injectable for testing. */
  sffBridgeOptions?: SffWasmBridgeOptions;
}

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) in the toolbar, the stage file input (backlog
 * item 002), the characteristics panel (backlog item 003), and the BG
 * element browser + background preview (backlog item 004) as `<main>`
 * content, appearing automatically once a stage loads. Mirrors
 * `character-viewer-web`'s own scaffold adoption: no sidebar/tabs yet —
 * `<wuik-app-shell>` collapses empty named slots to zero size with no
 * reserved gutter, so omitting them renders nothing broken — deferred
 * until a screen needs its own navigation.
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
  const characteristicsContainer = document.createElement("div");
  const backgroundPreviewContainer = document.createElement("div");
  renderStageFileInput(main, {
    onLoaded: (result) => {
      renderCharacteristicsPanel(characteristicsContainer, result.stage);
      renderBackgroundPreview(
        backgroundPreviewContainer,
        result.stage,
        result.sffBytes,
        { bridgeOptions: options.sffBridgeOptions },
      );
    },
    bridgeOptions: options.bridgeOptions,
  });
  main.append(characteristicsContainer, backgroundPreviewContainer);
  shell.appendChild(main);

  root.appendChild(shell);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
