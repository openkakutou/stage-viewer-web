import { describe, expect, it } from "vitest";
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
});
