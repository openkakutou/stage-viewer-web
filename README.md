# stage-viewer-web

A static web page for visualizing an [OpenKakutou](https://github.com/openkakutou) (MUGEN/Ikemen GO-compatible) stage (background): layers, BG elements, parallax scroll, and animated backgrounds, so a stage's composition can be thoroughly inspected. It reads stage data (`.def`) via a WebAssembly module built from the sibling [`stage`](https://github.com/openkakutou/stage) Go library. Read-only.

<!-- vibe:begin:features -->
This project is in early-stage development. You can already load a stage by picking or dragging in the folder that contains its files — the app reads them, automatically finds the referenced background sprite sheet even in a subfolder or under a slightly different letter case, and clearly names which file is missing if it can't be found. Once loaded, the stage's name, author, camera bounds, and stage boundaries are shown right away — a missing name or author is displayed as "Unknown" instead of a blank field, and the panel states plainly whether the stage is 2D or 3D. Every background element/layer is listed next to a live visual preview of the composed background, drawn in the correct front-to-back order — selecting an element in the list highlights it in the preview, a missing sprite shows a clear placeholder instead of breaking the preview, and a stage with no background elements shows an explicit message.

Planned:

- Animated BG playback preview: parallax scroll and animated background playback over time
<!-- vibe:end:features -->

<!-- vibe:begin:install -->
Requires [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`.

```sh
npm install
```

Verify the install worked by running the test suite:

```sh
npm test
```

To update dependencies to their latest allowed versions:

```sh
npm update
```

Download a specific version of the `stage` library's WebAssembly build (needed to load a stage):

```sh
npm run wasm:download -- v0.9.0
```

Download a specific version of the `sff` library's WebAssembly build (needed to draw the background preview):

```sh
npm run wasm:download:sff -- v0.3.0
```
<!-- vibe:end:install -->

<!-- vibe:begin:usage -->
Start a local dev server with hot reload:

```sh
npm run dev
```

Build the static site for production (output in `dist/`):

```sh
npm run build
```

Preview a production build locally:

```sh
npm run preview
```

Run the test suite:

```sh
npm test
```

Run the linter/formatter (auto-fixes issues in place):

```sh
npm run lint
```
<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->
- [docs/architecture.md](docs/architecture.md) — how the app is put together: the main modules, how a stage's data would flow through them, and its WebAssembly dependency.
- [docs/development.md](docs/development.md) — local dev setup notes, including how to fetch the `stage` library's WebAssembly build.
- [docs/testing.md](docs/testing.md) — how the test suite is structured, including how it exercises the real WebAssembly module and works around test-environment quirks.
<!-- vibe:end:docs-index -->
