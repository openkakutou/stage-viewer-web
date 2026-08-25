import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import "./style.css";
import { appVersion } from "./version.ts";

const APP_TITLE = "Stage Viewer";

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) in the toolbar and an empty `<main>` content
 * region, ready for the stage file input (backlog item 002) and the
 * screens that follow it. Mirrors `character-viewer-web`'s own scaffold
 * adoption exactly: no sidebar/tabs yet — `<wuik-app-shell>` collapses
 * empty named slots to zero size with no reserved gutter, so omitting them
 * renders nothing broken — deferred until a second real screen exists.
 * Default light theme only (no theme toggle), same as the sibling app.
 */
export function renderApp(root: HTMLElement, version: string): void {
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
  shell.appendChild(main);

  root.appendChild(shell);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
