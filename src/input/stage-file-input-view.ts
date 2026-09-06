// DOM component for backlog item 002 (stage folder input): folder
// selection is the only input path (a native `<input webkitdirectory>`
// picker plus a drag-and-drop zone), not a single-file picker — see
// this backlog item's own Notes for why. Every interactive control is a
// real native element (file input, radio inputs, buttons) rather than a
// custom `role="button"` div, so keyboard operability comes for free from
// the browser. Mirrors `lifebar-viewer-web`'s own
// `lifebar-folder-input-view.ts` shape, with a stricter status/error set:
// this app hard-errors, by name, when the referenced sprite sheet can't be
// resolved, rather than the sibling's silent-if-unresolved sprite step —
// see .vibe/decisions/001-sprite-sheet-resolved-by-basename-with-case-insensitive-fallback.md.
//
// Backlog item 008 (i18n): the currently-displayed status/error text is
// kept as a small unformatted `StatusDescriptor`, not a pre-formatted
// string, so a live locale change (see .vibe/decisions/006) can re-format
// and redisplay it in the new language without re-running the load/parse
// that produced it — same approach `lifebar-viewer-web` uses for its own
// long-lived folder-input status text.
import { onLocaleChange, t } from "../i18n/i18n.ts";
import type { GatheredFile } from "./folder-entries.ts";
import {
  type DataTransferItemLike,
  filesFromDataTransferItems,
  filesFromWebkitDirectoryFiles,
} from "./folder-entries.ts";
import {
  type StageFolderInputOptions,
  type StageFolderInputResult,
  loadStageFromChosenEntry,
  loadStageFromFolderFiles,
} from "./stage-file-input.ts";

export interface StageFileInputViewOptions {
  /** Called once a folder's stage and its sprite sheet have both loaded successfully. */
  onLoaded: (result: {
    fileName: string;
    relativePath: string;
    stage: import("../wasm/types.ts").StageData;
    defBytes: Uint8Array;
    sffFileName: string;
    sffRelativePath: string;
    sffBytes: Uint8Array;
    modelAssets: import("./model-assets.ts").ModelAssetsResolution;
  }) => void;
  /** Forwarded to the read/parse/resolve layer; injectable for testing. */
  fileOptions?: StageFolderInputOptions;
  /** Shorthand for `fileOptions.bridgeOptions`; ignored if `fileOptions` is also given. */
  bridgeOptions?: StageFolderInputOptions["bridgeOptions"];
}

type Phase = "idle" | "loading" | "needs-selection" | "done";

type ErrorResult = Exclude<
  StageFolderInputResult,
  { status: "success" | "needs-selection" }
>;

type StatusDescriptor =
  | { kind: "none" }
  | { kind: "reading" }
  | { kind: "readingFile"; fileName: string }
  | { kind: "success"; fileName: string; sffFileName: string }
  | { kind: "needsSelection"; count: number }
  | { kind: "error"; result: ErrorResult; source: "picker" | "drop" };

function formatStatus(descriptor: StatusDescriptor): string {
  switch (descriptor.kind) {
    case "none":
      return "";
    case "reading":
      return t("input.reading", "Reading…");
    case "readingFile":
      return t("input.readingFile", "Reading {{fileName}}…", {
        fileName: descriptor.fileName,
      });
    case "success":
      return t(
        "input.success",
        "Loaded {{fileName}}. Sprite sheet: {{sffFileName}}.",
        {
          fileName: descriptor.fileName,
          sffFileName: descriptor.sffFileName,
        },
      );
    case "needsSelection":
      return t(
        "input.needsSelection",
        "Found {{count}} possible stage files — pick which one to load.",
        { count: String(descriptor.count) },
      );
    case "error":
      return formatErrorMessage(descriptor.result, descriptor.source);
  }
}

function formatErrorMessage(
  result: ErrorResult,
  source: "picker" | "drop",
): string {
  switch (result.status) {
    case "no-files":
      return source === "drop"
        ? t(
            "input.errorNoFilesDrop",
            "Couldn't read anything from the dropped folder — your browser may not support folder drag-and-drop here. Try the folder picker button instead.",
          )
        : t(
            "input.errorNoFilesPicker",
            "This folder is empty — pick a folder that contains the stage's .def file.",
          );
    case "no-candidate":
      return t(
        "input.errorNoCandidate",
        "No .def file found in this folder — expected one like stage.def.",
      );
    case "read-error":
      return t(
        "input.errorReadFile",
        "Could not read {{fileName}}: {{message}}",
        {
          fileName: result.fileName,
          message: result.message,
        },
      );
    case "parse-error":
      return t(
        "input.errorParseFile",
        "Could not parse {{fileName}}: {{message}}",
        { fileName: result.fileName, message: result.message },
      );
    case "sprite-not-found":
      return result.referencedName === ""
        ? t(
            "input.errorSpriteNotReferenced",
            "{{fileName}} doesn't reference a sprite sheet.",
            { fileName: result.fileName },
          )
        : t(
            "input.errorSpriteNotFound",
            '{{fileName}} references "{{referencedName}}", but that file wasn\'t found anywhere in the folder.',
            {
              fileName: result.fileName,
              referencedName: result.referencedName,
            },
          );
    case "sprite-ambiguous":
      return t(
        "input.errorSpriteAmbiguous",
        '{{fileName}} references "{{referencedName}}", but {{count}} files in the folder share that name — could not tell which one to use.',
        {
          fileName: result.fileName,
          referencedName: result.referencedName,
          count: String(result.candidates.length),
        },
      );
    case "sprite-read-error":
      return t(
        "input.errorSpriteReadFile",
        "Could not read {{sffFileName}}: {{message}}",
        { sffFileName: result.sffFileName, message: result.message },
      );
  }
}

// Cancels a previous call's live locale-change subscription when
// `renderStageFileInput` is invoked again on the same root — same
// "replace, don't accumulate" rule `background-preview.ts`'s own
// `stopPlaybackByRoot` established for its own render-owned subscription.
const stopLocaleSubscriptionByRoot = new WeakMap<HTMLElement, () => void>();

/**
 * Renders the folder-based stage input into `root`, replacing its
 * previous content.
 */
export function renderStageFileInput(
  root: HTMLElement,
  options: StageFileInputViewOptions,
): void {
  stopLocaleSubscriptionByRoot.get(root)?.();
  stopLocaleSubscriptionByRoot.delete(root);
  root.replaceChildren();

  const fileOptions: StageFolderInputOptions = {
    ...options.fileOptions,
    bridgeOptions: options.fileOptions?.bridgeOptions ?? options.bridgeOptions,
  };

  let phase: Phase = "idle";
  let currentStatus: StatusDescriptor = { kind: "none" };
  let isError = false;
  let lastSource: "picker" | "drop" = "picker";
  let selectedIndex: number | null = null;
  let lastGatheredFiles: GatheredFile[] = [];

  const panel = document.createElement("div");
  panel.className = "stage-file-input";

  const dropZone = document.createElement("div");
  dropZone.className = "stage-file-input__dropzone";

  const label = document.createElement("label");
  label.className = "stage-file-input__label";
  label.htmlFor = "stage-folder-picker";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.id = "stage-folder-picker";
  picker.setAttribute("webkitdirectory", "");
  picker.multiple = true;

  const hint = document.createElement("p");
  hint.className = "stage-file-input__hint";

  dropZone.append(label, picker, hint);

  const selectionContainer = document.createElement("div");
  selectionContainer.className = "stage-file-input__selection";
  selectionContainer.hidden = true;

  const status = document.createElement("div");
  status.className = "stage-file-input__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "stage-file-input__reset";
  resetButton.dataset.action = "reset";
  resetButton.hidden = true;

  panel.append(dropZone, selectionContainer, status, resetButton);
  root.appendChild(panel);

  // Elements created by `renderSelection`, kept for a live locale change to
  // update their text in place without rebuilding the list itself (which
  // would drop the user's in-progress radio selection).
  let selectionPrompt: HTMLElement | null = null;
  let selectionGroup: HTMLElement | null = null;
  let selectionConfirmButton: HTMLButtonElement | null = null;

  function renderStaticTexts(): void {
    label.textContent = t(
      "input.folderLabel",
      "Select a stage folder (containing its .def file, e.g. stage.def)",
    );
    hint.textContent = t(
      "input.dropHint",
      "…or drag and drop a stage folder here",
    );
    resetButton.textContent = t(
      "input.resetButton",
      "Choose a different folder",
    );
    selectionPrompt?.replaceChildren(
      document.createTextNode(
        t("input.selectionPrompt", "Which file is the stage?"),
      ),
    );
    selectionGroup?.setAttribute(
      "aria-label",
      t("input.candidateGroupLabel", "Candidate stage files"),
    );
    if (selectionConfirmButton) {
      selectionConfirmButton.textContent = t(
        "input.confirmSelection",
        "Load selected file",
      );
    }
  }

  function render(): void {
    picker.disabled = phase === "loading";
    dropZone.classList.toggle(
      "stage-file-input__dropzone--loading",
      phase === "loading",
    );
    status.classList.toggle("stage-file-input__status--error", isError);
    status.textContent = formatStatus(currentStatus);
    resetButton.hidden = phase === "idle" || phase === "loading";
    selectionContainer.hidden = phase !== "needs-selection";
  }

  function resetToIdle(): void {
    phase = "idle";
    currentStatus = { kind: "none" };
    isError = false;
    selectedIndex = null;
    picker.value = "";
    selectionContainer.replaceChildren();
    selectionPrompt = null;
    selectionGroup = null;
    selectionConfirmButton = null;
    render();
  }

  function renderSelection(candidates: GatheredFile[]): void {
    selectionContainer.replaceChildren();
    selectedIndex = null;

    const prompt = document.createElement("p");
    prompt.textContent = t("input.selectionPrompt", "Which file is the stage?");
    selectionPrompt = prompt;

    const group = document.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute(
      "aria-label",
      t("input.candidateGroupLabel", "Candidate stage files"),
    );
    selectionGroup = group;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.dataset.action = "confirm-selection";
    confirmButton.textContent = t(
      "input.confirmSelection",
      "Load selected file",
    );
    confirmButton.disabled = true;
    selectionConfirmButton = confirmButton;

    candidates.forEach((candidate, index) => {
      const optionLabel = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "stage-candidate";
      input.value = String(index);
      // A jsdom quirk: `.click()` on a radio reliably toggles `.checked`
      // but doesn't reliably synthesize a "change" event under this
      // project's pinned jsdom — read the selection from "click" instead,
      // the same workaround `character-viewer-web`'s animation player and
      // `lifebar-viewer-web`'s folder input use.
      input.addEventListener("click", () => {
        selectedIndex = index;
        confirmButton.disabled = false;
      });
      optionLabel.append(
        input,
        document.createTextNode(` ${candidate.relativePath}`),
      );
      group.appendChild(optionLabel);
    });

    confirmButton.addEventListener("click", () => {
      if (selectedIndex === null) return;
      const chosen = candidates[selectedIndex];
      phase = "loading";
      currentStatus = { kind: "readingFile", fileName: chosen.file.name };
      isError = false;
      render();
      void finishLoading(
        loadStageFromChosenEntry(chosen, lastGatheredFiles, fileOptions),
      );
    });

    selectionContainer.append(prompt, group, confirmButton);
  }

  async function finishLoading(
    resultPromise: Promise<StageFolderInputResult>,
  ): Promise<void> {
    const result = await resultPromise;

    if (result.status === "success") {
      phase = "done";
      isError = false;
      currentStatus = {
        kind: "success",
        fileName: result.fileName,
        sffFileName: result.sffFileName,
      };
      render();
      options.onLoaded(result);
      return;
    }

    if (result.status === "needs-selection") {
      phase = "needs-selection";
      isError = false;
      currentStatus = {
        kind: "needsSelection",
        count: result.candidates.length,
      };
      renderSelection(result.candidates);
      render();
      return;
    }

    phase = "done";
    isError = true;
    currentStatus = { kind: "error", result, source: lastSource };
    render();
  }

  function handleGathered(
    files: GatheredFile[],
    source: "picker" | "drop",
  ): void {
    lastSource = source;
    lastGatheredFiles = files;
    phase = "loading";
    currentStatus = { kind: "reading" };
    isError = false;
    selectionContainer.replaceChildren();
    selectionPrompt = null;
    selectionGroup = null;
    selectionConfirmButton = null;
    render();
    void finishLoading(loadStageFromFolderFiles(files, fileOptions));
  }

  picker.addEventListener("change", () => {
    const files = picker.files ? Array.from(picker.files) : [];
    handleGathered(filesFromWebkitDirectoryFiles(files), "picker");
  });

  resetButton.addEventListener("click", resetToIdle);

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropZone.classList.add("stage-file-input__dropzone--dragging");
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("stage-file-input__dropzone--dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("stage-file-input__dropzone--dragging");
    const dataTransfer = (event as DragEvent).dataTransfer as {
      items?: ArrayLike<DataTransferItemLike>;
    } | null;
    const items = dataTransfer?.items ? Array.from(dataTransfer.items) : [];
    void filesFromDataTransferItems(items).then((files) =>
      handleGathered(files, "drop"),
    );
  });

  renderStaticTexts();
  render();

  // Live locale switching (backlog item 008): re-formats the currently
  // displayed status/error text from its stored descriptor, plus every
  // static label/hint/button text, in the new language — no reload, no
  // loss of the current phase/selection state.
  stopLocaleSubscriptionByRoot.set(
    root,
    onLocaleChange(() => {
      renderStaticTexts();
      render();
    }),
  );
}
