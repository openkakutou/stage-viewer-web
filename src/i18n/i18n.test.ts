import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initAppI18n, onLocaleChange, t } from "./i18n.ts";

function setNavigatorLanguage(locale: string): void {
  Object.defineProperty(window.navigator, "language", {
    value: locale,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "languages", {
    value: [locale],
    configurable: true,
  });
}

describe("t / initAppI18n / onLocaleChange", () => {
  const originalLanguage = window.navigator.language;
  const originalLanguages = window.navigator.languages;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "language", {
      value: originalLanguage,
      configurable: true,
    });
    Object.defineProperty(window.navigator, "languages", {
      value: originalLanguages,
      configurable: true,
    });
  });

  it("returns the given default value before this app has called initAppI18n", () => {
    // Must run before any other test in this file calls initAppI18n --
    // web-ui-kit's active-instance singleton is module-scoped, shared by
    // every test in this file, the same ordering constraint web-ui-kit's
    // own i18n.test.ts documents for its equivalent first test.
    expect(t("background.noElements", "No BG elements configured.")).toBe(
      "No BG elements configured.",
    );
  });

  it("returns this app's own real English translation once initAppI18n has resolved", async () => {
    setNavigatorLanguage("en-US");

    const instance = await initAppI18n();

    expect(instance.resolvedLanguage).toBe("en");
    expect(t("background.play", "Play")).toBe("Play");
  });

  it("interpolates {{vars}} into a real translated catalog entry", async () => {
    setNavigatorLanguage("fr-FR");
    await initAppI18n();

    expect(
      t("input.errorReadFile", "Could not read {{fileName}}: {{message}}", {
        fileName: "stage.def",
        message: "boom",
      }),
    ).toBe("Impossible de lire stage.def : boom");
  });

  it("falls back to the given default value, interpolated, for a key missing from every catalog", async () => {
    setNavigatorLanguage("en-US");
    await initAppI18n();

    expect(t("does.not.exist", "Fallback {{value}}", { value: "text" })).toBe(
      "Fallback text",
    );
  });

  it("notifies onLocaleChange subscribers once this app's own instance changes language", async () => {
    setNavigatorLanguage("en-US");
    const instance = await initAppI18n();
    const calls: string[] = [];
    const unsubscribe = onLocaleChange(() => calls.push("changed"));

    await instance.changeLanguage("fr");
    expect(calls).toEqual(["changed"]);

    unsubscribe();
    await instance.changeLanguage("en");
    expect(calls).toEqual(["changed"]);
  });
});
