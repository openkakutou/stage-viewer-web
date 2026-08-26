import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DownloadError,
  EXIT_CODES,
  downloadWasmRelease,
  main,
} from "./download-sff-wasm.mjs";

/** Builds a minimal fetch-compatible successful response for the given bytes. */
function okResponse(bytes) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

/** Builds a minimal fetch-compatible response for a given HTTP failure status. */
function failResponse(status) {
  return { ok: false, status, arrayBuffer: async () => new ArrayBuffer(0) };
}

let outDir;

beforeEach(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), "download-sff-wasm-test-"));
});

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("downloadWasmRelease (sff defaults)", () => {
  it("downloads sff.wasm and its own wasm_exec.js into the output directory", async () => {
    const wasmBytes = new Uint8Array([1, 2, 3, 4]);
    const jsBytes = new Uint8Array([5, 6, 7]);
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toContain("openkakutou/sff/releases/download/");
      if (url.endsWith("sff.wasm")) return okResponse(wasmBytes);
      if (url.endsWith("wasm_exec.js")) return okResponse(jsBytes);
      throw new Error(`unexpected url: ${url}`);
    });

    const result = await downloadWasmRelease({
      version: "v0.3.0",
      outDir,
      fetchImpl,
      log: { log() {} },
    });

    const wasmOnDisk = await readFile(path.join(outDir, "sff.wasm"));
    const jsOnDisk = await readFile(path.join(outDir, "wasm_exec.js"));
    expect(wasmOnDisk).toEqual(Buffer.from(wasmBytes));
    expect(jsOnDisk).toEqual(Buffer.from(jsBytes));
    expect(result).toEqual([
      path.join(outDir, "sff.wasm"),
      path.join(outDir, "wasm_exec.js"),
    ]);

    const entries = await readdir(outDir);
    expect(entries.sort()).toEqual(["sff.wasm", "wasm_exec.js"]);
  });

  it("rejects with a not-found error naming the tag when the release does not exist", async () => {
    const fetchImpl = vi.fn(async () => failResponse(404));

    await expect(
      downloadWasmRelease({ version: "v99.0.0", outDir, fetchImpl }),
    ).rejects.toMatchObject({
      exitCode: EXIT_CODES.NOT_FOUND,
      message: expect.stringContaining("v99.0.0"),
    });
    expect(await readdir(outDir)).toEqual([]);
  });

  it("rejects with a usage error and makes no network call when the version is missing", async () => {
    const fetchImpl = vi.fn();

    await expect(
      downloadWasmRelease({ outDir, fetchImpl }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.USAGE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("main (CLI wrapper, sff defaults)", () => {
  it("prints this script's own package.json version, not a fetched release tag, on --version", async () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const fetchImpl = vi.fn();

    const exitCode = await main(["--version"], { outDir, fetchImpl });

    expect(exitCode).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stdout.mock.calls[0][0]).toMatch(/^\d+\.\d+\.\d+\n$/);
    stdout.mockRestore();
  });

  it("exits with the download's not-found code and reports the error on stderr", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const fetchImpl = vi.fn(async () => failResponse(404));

    const exitCode = await main(["v99.0.0"], { outDir, fetchImpl });

    expect(exitCode).toBe(EXIT_CODES.NOT_FOUND);
    expect(stderr.mock.calls.some(([chunk]) => chunk.includes("v99.0.0"))).toBe(
      true,
    );
    stderr.mockRestore();
  });
});
