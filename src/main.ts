import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import type { WuikLocaleSwitcherElement } from "@openkakutou/web-ui-kit";
import { getI18n, initAppI18n, onLocaleChange, t } from "./i18n/i18n.ts";
import { renderStageFileInput } from "./input/stage-file-input-view.ts";
import type { StageFolderInputOptions } from "./input/stage-file-input.ts";
import { appVersion } from "./version.ts";
import { renderBackgroundPreview } from "./viewer/background-preview.ts";
import { renderCharacteristicsPanel } from "./viewer/characteristics-panel.ts";
import type { SffWasmBridgeOptions } from "./wasm/sff-bridge.ts";
import type { StageData } from "./wasm/types.ts";

// The app's own brand name -- a proper noun, deliberately never translated,
// same convention as the sibling `lifebar-viewer-web` app's own
// .vibe/decisions/007-i18n-integration-approach.md.
const APP_TITLE = "Stage Viewer";

export interface RenderAppOptions {
  /** Forwarded to the file input's WASM bridge; injectable for testing. */
  bridgeOptions?: StageFolderInputOptions["bridgeOptions"];
  /** Forwarded to the `sff` WASM bridge (background preview sprite decode); injectable for testing. */
  sffBridgeOptions?: SffWasmBridgeOptions;
}

// `renderApp` is only ever really invoked once per page (from `mount()`),
// but tests call it repeatedly on the same or a fresh root -- torn down at
// the top of every call, before a fresh one is made, so a locale-change
// subscription from a previous call never accumulates or fires against
// content no longer on the page. Mirrors `lifebar-viewer-web`'s own
// replace-not-accumulate handling of a render-owned live subscription.
let currentUnsubscribeLocaleChange: (() => void) | undefined;

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
  currentUnsubscribeLocaleChange?.();
  currentUnsubscribeLocaleChange = undefined;
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  toolbar.appendChild(title);

  const localeSwitcher = document.createElement(
    "wuik-locale-switcher",
  ) as unknown as WuikLocaleSwitcherElement;
  localeSwitcher.className = "locale-switcher";
  localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
  localeSwitcher.i18n = getI18n();
  toolbar.appendChild(localeSwitcher);

  shell.appendChild(toolbar);

  const main = document.createElement("main");
  const characteristicsContainer = document.createElement("div");
  const backgroundPreviewContainer = document.createElement("div");
  // Persisted across a locale change so the characteristics panel (a pure,
  // stateless-DOM rebuild from this data — unlike the background/model
  // preview, which re-translate their own already-visible text in place
  // internally) can simply be re-rendered from the same data in the new
  // language, rather than requiring the user to reload the stage.
  let loadedStage: StageData | null = null;
  renderStageFileInput(main, {
    onLoaded: (result) => {
      loadedStage = result.stage;
      renderCharacteristicsPanel(characteristicsContainer, result.stage);
      renderBackgroundPreview(
        backgroundPreviewContainer,
        result.stage,
        result.sffBytes,
        {
          bridgeOptions: options.sffBridgeOptions,
          modelAssets: result.modelAssets,
        },
      );
    },
    bridgeOptions: options.bridgeOptions,
  });
  main.append(characteristicsContainer, backgroundPreviewContainer);
  shell.appendChild(main);

  root.appendChild(shell);

  // Live locale switching (backlog item 008): the folder input and the
  // background/model preview re-translate their own already-visible text
  // internally (each owns a subscription scoped to its own root); this
  // top-level subscription only needs to update the switcher's own
  // translated accessible label and re-render the characteristics panel,
  // which carries no live/async state of its own to preserve.
  currentUnsubscribeLocaleChange = onLocaleChange(() => {
    localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
    renderCharacteristicsPanel(characteristicsContainer, loadedStage);
  });
}

async function mount(): Promise<void> {
  await initAppI18n();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    renderApp(app, appVersion);
  }
}

if (document.readyState === "complete") {
  void mount();
} else {
  window.addEventListener("load", () => void mount(), { once: true });
}
