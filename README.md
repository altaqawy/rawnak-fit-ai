# RAWNAK FIT AI

**Live Virtual Try-On · Browser AR · Mobile & Desktop**

A standalone RAWNAK Tools experiment for a live virtual fitting mirror. Uses browser camera streams with local MediaPipe body / face / hand landmarks to draw illustrative product overlays. It has **no per-frame image-generation token costs** and does not upload the video feed.

> **Alpha prototype, not photorealistic clothing simulation.** Accessories and garments are illustrative 2D overlays. Accurate sizing, garment draping, product imagery, occlusion and 3D are planned upgrades.

## Open the application

- **Main UI:** [index.html](./index.html)
- **Tracking + AR code:** [src/app.js](./src/app.js)
- **Styles:** [src/styles.css](./src/styles.css)
- **Camera-only diagnostic:** [diagnostics/camera-only.html](./diagnostics/camera-only.html)
- **Troubleshooting:** [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- **Roadmap:** [docs/ROADMAP.md](./docs/ROADMAP.md)

## Try locally

This version is static HTML / CSS / JS. No `npm install` or build step is required.

```sh
python -m http.server 5173
```

Open `http://localhost:5173/` on desktop. **Mobile browsers require an HTTPS URL** for camera permissions; direct access via `http://192.168.x.x:5173` usually won't work.

## Publish with GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Set **Source: Deploy from a branch**.
3. Select **Branch: main**, **Folder: /(root)**, then **Save**.
4. When the first deployment completes, visit **https://altaqawy.github.io/rawnak-fit-ai/**.

GitHub Pages status and the camera must be verified after deploying. Do not mistake the expected URL for a confirmed live deployment.

## Camera-stability fix

Older Alpha 0.1 bound camera startup to `await tracker.ensure(...)`: failing a model download shut down an otherwise working camera. The current browser app starts the camera and video **first**, then loads MediaPipe asynchronously. Model failures display a message while keeping camera preview running. There is a **Retry tracking** button without restarting the camera. Changing products should not stop the stream.

## Current features

- Mobile and desktop live browser webcam preview
- On-demand MediaPipe pose, hand, and face model loading from public CDNs
- Illustrative overlays: shirt, jacket, watch, bracelet, glasses, bag, shoes
- Product selection, mirror toggle, PNG screenshot, retry tracking
- Independent camera-only diagnostic page
- Static smoke checks available under `tests/`

## Validation status

Source code has been reviewed for JavaScript syntax and UI element references. **No camera hardware validation** has been completed. The old monorepo's Actions job failed before running any steps; this new repository has not yet established a passing CI workflow. Physical device testing on mobile + desktop is required.

## Privacy and costs

This prototype doesn't send camera frames to our server. The MediaPipe JS/WASM/model assets and web fonts are downloaded from third-party hosts when needed. Future merchant analytics and any uploads require explicit privacy review and consent.

## Development direction

See [roadmap](docs/ROADMAP.md). The `main` branch of **altaqawy/rawnak-fit-ai** is now the source of truth. Future changes should be committed here, not to the original RAWNAK site.
