# RAWNAK FIT AI

**Live Virtual Try-On · Browser AR · Mobile & Desktop**

A standalone RAWNAK Tools experiment for a live virtual fitting mirror. Uses browser camera streams with local MediaPipe body / face / hand landmarks to draw illustrative product overlays. It has **no per-frame image-generation token costs** and does not upload the video feed.

> **Alpha prototype, not photorealistic clothing simulation.** Accessories and garments are illustrative 2D overlays. Accurate sizing, garment draping, product imagery, occlusion and 3D are planned upgrades.

## Open the application

- **Main UI:** [index.html](./index.html)
- **Tracking + AR code:** [src/app.js](./src/app.js)
- **Styles:** [src/styles.css](./src/styles.css)
- **Camera-only diagnostic:** [diagnostics/camera-only.html](./diagnostics/camera-only.html)
- **MediaPipe diagnostics (no camera needed):** [diagnostics/tracking.html](./diagnostics/tracking.html)
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
- On-demand MediaPipe pose, hand, and face model loading (pinned 0.10.21, official `vision_bundle.mjs` ESM, jsDelivr/unpkg fallback)
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

## Tracking incident — November 17, 2026

The user supplied a camera-only diagnostic: secure context `true`, camera track `live`, 640×480 at 30 FPS. The main page showed `Tracking error`. **This confirms webcam permissions and preview work, not that the ML tracker works.** The 60 FPS telemetry in the UI measures rendering frames rather than ML inference.

Updated the app to prefer the [official MediaPipe ESM bundle](https://developers.google.com/edge/mediapipe/solutions/setup_web) at `@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs`, matching WASM version, with unpkg fallback and detailed error reporting. Also corrected FaceLandmarker result access from `result.landmarks` to `result.faceLandmarks`.

If tracking still fails, open **[model diagnostics](diagnostics/tracking.html)** on GitHub Pages, click the model buttons, and copy the report. The webcam stays live on AI failure. Real-device tracking success still requires confirmation.

## Alpha 0.4 — Synchronized Live Mirror

**Why:** The browser camera can render at ~40–60 FPS while the previous model only ran at ~10 inferences/second (95 ms throttle). That means overlays lagged behind current video frames.

**New selectable modes:**

- **Synchronized with AI (default):** Take a canvas snapshot of a camera frame, run the currently chosen landmark model **on the snapshot**, then compose the snapshot and that exact frame's landmark overlay in one output canvas. If model loading fails or no analyzed frame is available, show the raw camera preview. The source webcam remains local and open. Target inference interval is 45 ms, but actual FPS depends on hardware/model speed. Drops frames rather than building a backlog.
- **Fast live preview:** Show the camera video at its native speed and update overlays as inference finishes. Its target interval is 65 ms; landmarks use a faster smoothing coefficient to reduce delay.

**Important:** Synchronized mode matches the input camera image with its corresponding model output, but it **does not** guarantee 100% accurate landmark placement, fit, photorealistic material appearance, or fluid 60 FPS AR. Processing still runs synchronously on the browser's main thread. Improvements requiring workers and 3D cloth simulation are separate milestones. Nothing is sent to a generative AI endpoint for per-frame processing.

**Verify deployment:** The header should show `ALPHA 0.4 · FRAME SYNC`, and telemetry should show `JS 2026.11.17.040` plus distinct `Synced FPS` and `AI Hz` counters. If this build label isn't visible, allow Pages deployment to finish and hard-reload.

**Smoke tests:** `node tests/static-check.mjs` and `node tests/frame-sync.smoke.mjs`. The second uses a mocked camera and model; **real-device quality and latency remain unverified**.


## New — RAWNAK AutoFit Studio (merchant pipeline Alpha 0.5)

[Open AutoFit Studio](https://altaqawy.github.io/rawnak-fit-ai/studio/) · [Studio source & limitations](studio/README.md)

Merchant product onboarding runs in a **separate** `/studio/` route, leaving the live camera engine intact.

- Upload multiple product photos; lightweight MobileNet classification runs locally on-device as a **fallible category suggestion**, with filename fallback and manual correction.
- Extract an approximate color; enter the merchant's real product measurement.
- Prepare **generic parametric** watch, ring and bangle geometry with Three.js. Rotate in 3D and export GLB or JSON metadata.
- Other categories (garments, glasses, shoes, bags) are routed to their planned preparation engine and marked **needs-review**; image-to-3D and simulated cloth are *not yet implemented*.
- No store database / image upload; preparation queue exists in browser memory and exports JSON.

No per-frame generative AI credits are consumed. For exact SKU geometry, future generation and merchant verification are required.



## First merchant integration (public SDK demo)

- [Interactive storefront SDK demo](https://altaqawy.github.io/rawnak-fit-ai/demo/)
- [SDK installation and limitations](sdk/README.md)
- [Web Component source](sdk/rawnak-fit.js)
- [Next.js/React example wrapper](sdk/react/RawnakTryOnButton.tsx)

The public widget selects a category and opens the existing on-device live camera renderer inside a camera-enabled iframe, with a separate-page fallback and an add-to-cart event the host store can handle. **This does not connect exact merchant GLB assets**, authenticate tenant IDs or authorize private store products. The current preview is illustrative 2D AR.

Do not paste the future production endpoint documented in the architecture into sites yet. For actual commercial integration, build a secure SKU/variant manifest, merchant domain allowlists and a verified asset approval pipeline.

### QA caveat

GitHub Actions job runs have sometimes reported failure with runner ID 0 and no executed steps, so a failed red badge is **not enough to infer that the code test failed**. The browser/iframe camera still requires validation on real desktop and mobile devices. See [SDK test](tests/sdk.smoke.mjs).


## Alpha 0.6 — Synthetic product photo lab (2026-11-18)

[Open four-product demo store](https://altaqawy.github.io/rawnak-fit-ai/demo/) · [See real processing steps and current result](https://altaqawy.github.io/rawnak-fit-ai/demo/process.html?sku=WATCH-DEMO-01) · [Import sample photos to AutoFit Studio](https://altaqawy.github.io/rawnak-fit-ai/studio/?fixture=WATCH-DEMO-01)

The public repository includes **eight generated test-product photos** (two for each of watch, sage T-shirt, black/gold eyeglasses and brown bag), resized to WebP in `demo/assets/` and four transparent product cutouts.

- `demo/gallery.js`: front + alternate angle galleries for every product in the demo merchant site.
- `demo/process.html` + `process.js`: visible stages with actual photo-loading checks, local pixel-color extraction and opt-in MobileNet classification; displays category-template part metadata, photo-count requirements, cutout result, and missing true 3D reconstruction honestly.
- `studio/?fixture=SKU`: fetches the two real demo images from GitHub to AutoFit Studio automatically; no fake sizes supplied.
- `src/app.js`: an **experimental Photo AR 2D overlay** places the corresponding transparent image on hand, face or body keypoints for these four demo SKUs. The viewer can switch to the older generic AR drawing. This is not verified 3D fitting; the product stays a front photo while the shopper turns.
- `tests/demo-products.test.mjs`: checks SKU mapping, WebP assets and cutouts, source pipeline UI and the renderer allowlist.

**Limits:** AI-created images aren't merchant photos, a second generated angle doesn't establish real 3D geometry, camera frames remain local, and no accurate fit, 3D rotation, occlusion or cloth simulation is promised. Real browser tests and mobile QA are still needed.
