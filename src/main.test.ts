import { describe, expect, it } from "vitest";
import { initAppI18n } from "./i18n/i18n.ts";
import { renderApp } from "./main.ts";

describe("renderApp", () => {
  it("mounts a wuik-app-shell root frame with a toolbar title including the version", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    const shell = root.querySelector("wuik-app-shell");
    expect(shell).not.toBeNull();

    const toolbar = shell?.querySelector('[slot="toolbar"]');
    expect(toolbar?.tagName.toLowerCase()).toBe("wuik-toolbar");
    expect(toolbar?.getAttribute("role")).toBe("banner");
    expect(toolbar?.textContent).toBe("Stage Viewer — v0.1.0");

    const main = shell?.querySelector("main");
    expect(main).not.toBeNull();
  });

  it("renders the stage file input inside the main content area", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("does not slot anything into the sidebar region", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    expect(root.querySelector('[slot="sidebar"]')).toBeNull();
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");
    renderApp(root, "0.2.0");

    expect(root.querySelectorAll("wuik-app-shell")).toHaveLength(1);
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
      "Stage Viewer — v0.2.0",
    );
  });

  it("renders without throwing and keeps a valid structure when given an empty version string", () => {
    const root = document.createElement("div");

    expect(() => renderApp(root, "")).not.toThrow();
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
      "Stage Viewer — v",
    );
  });

  it("renders a locale switcher in the toolbar, labelled for accessibility", () => {
    const root = document.createElement("div");

    renderApp(root, "0.1.0");

    const switcher = root.querySelector("wuik-locale-switcher");
    expect(switcher).not.toBeNull();
    expect(switcher?.getAttribute("label")).toBe("Language");
    // Shadow-DOM content never contributes to the host's own light-DOM
    // textContent, so the toolbar's exact-text assertions above are
    // unaffected by the switcher living inside it.
    expect(root.querySelector('[slot="toolbar"]')?.contains(switcher)).toBe(
      true,
    );
  });

  it("re-translates the locale switcher's label on a live locale change", async () => {
    const instance = await initAppI18n();
    await instance.changeLanguage("en");
    const root = document.createElement("div");
    renderApp(root, "0.1.0");

    await instance.changeLanguage("fr");

    const switcher = root.querySelector("wuik-locale-switcher");
    expect(switcher?.getAttribute("label")).toBe("Langue");

    await instance.changeLanguage("en");
  });
});
