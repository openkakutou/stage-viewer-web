import { describe, expect, it } from "vitest";
import {
  filesFromDataTransferItems,
  filesFromWebkitDirectoryFiles,
} from "./folder-entries.ts";
import type {
  DirectoryEntryLike,
  EntryLike,
  FileEntryLike,
} from "./folder-entries.ts";

function fakeFile(name: string): File {
  return new File(["content"], name, { type: "text/plain" });
}

function fakeFileEntry(fullPath: string, file: File): FileEntryLike {
  return {
    isFile: true,
    isDirectory: false,
    fullPath,
    file: (success) => success(file),
  };
}

function fakeDirectoryEntry(
  fullPath: string,
  children: EntryLike[],
): DirectoryEntryLike {
  let delivered = false;
  return {
    isFile: false,
    isDirectory: true,
    fullPath,
    createReader: () => ({
      readEntries: (success) => {
        // A real FileSystemDirectoryReader must be called repeatedly and
        // eventually returns an empty array — simulated here with a
        // one-shot flag so a second call (as a correct caller must make)
        // sees the batch is exhausted.
        if (delivered) {
          success([]);
          return;
        }
        delivered = true;
        success(children);
      },
    }),
  };
}

function fakeDataTransferItem(entry: EntryLike | null) {
  return { webkitGetAsEntry: () => entry };
}

describe("filesFromWebkitDirectoryFiles", () => {
  it("derives each file's relative path from webkitRelativePath", () => {
    const file = fakeFile("stage.def");
    Object.defineProperty(file, "webkitRelativePath", {
      value: "my-stage/stage.def",
    });

    const result = filesFromWebkitDirectoryFiles([file]);

    expect(result).toEqual([{ file, relativePath: "my-stage/stage.def" }]);
  });

  it("falls back to the plain file name when webkitRelativePath is empty", () => {
    const file = fakeFile("stage.def");

    const result = filesFromWebkitDirectoryFiles([file]);

    expect(result).toEqual([{ file, relativePath: "stage.def" }]);
  });

  it("returns an empty list for an empty input", () => {
    expect(filesFromWebkitDirectoryFiles([])).toEqual([]);
  });
});

describe("filesFromDataTransferItems", () => {
  it("collects a single dropped file entry", async () => {
    const file = fakeFile("stage.def");
    const items = [fakeDataTransferItem(fakeFileEntry("/stage.def", file))];

    const result = await filesFromDataTransferItems(items);

    expect(result).toEqual([{ file, relativePath: "stage.def" }]);
  });

  it("recursively walks a directory entry, flattening nested files", async () => {
    const sprite = fakeFile("stage0.sff");
    const def = fakeFile("stage.def");
    const nested = fakeDirectoryEntry("/my-stage/sprites", [
      fakeFileEntry("/my-stage/sprites/stage0.sff", sprite),
    ]);
    const root = fakeDirectoryEntry("/my-stage", [
      fakeFileEntry("/my-stage/stage.def", def),
      nested,
    ]);
    const items = [fakeDataTransferItem(root)];

    const result = await filesFromDataTransferItems(items);

    expect(result).toEqual(
      expect.arrayContaining([
        { file: def, relativePath: "my-stage/stage.def" },
        { file: sprite, relativePath: "my-stage/sprites/stage0.sff" },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("skips an item that yields no entry (e.g. a non-file drag source)", async () => {
    const result = await filesFromDataTransferItems([
      fakeDataTransferItem(null),
    ]);

    expect(result).toEqual([]);
  });

  it("returns an empty list when nothing was dropped", async () => {
    expect(await filesFromDataTransferItems([])).toEqual([]);
  });
});
