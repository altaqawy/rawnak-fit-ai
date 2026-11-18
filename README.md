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

The public widget selects a category and opens the existing on-device live camera renderer inside a camera-enabled iframe, with a separate-page fallback and an add-to-cart event the host store can handle. **This does not connect exact merchant GLB assets**, authenticate tenant IDs or authorize private store products. The current default preview is an illustrative 3D WebGL mesh, not an authentic merchant SKU digital twin.

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

## Alpha 0.8 — Real-time 3D mesh overlays (2026-11-18)

- [3D Model Inspector — rotate freely, no camera](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html)
- [Try actual 3D demos with body/hand/face tracking](https://altaqawy.github.io/rawnak-fit-ai/demo/)
- [Architecture, code and QA details](docs/AR3D_ALPHA08.md)
- Core: [Three.js 3D renderer](src/fit-3d-renderer.js) and [landmark anchoring](src/fit-3d-pose.js)

The demo now defaults to **actual volumetric mesh geometry** rendered with WebGL/Three.js. Example models include white/silver watch, sage T-shirt, black/gold glasses, brown structured shoulder bag, jacket, bangle and shoes. The geometry is not a flat photograph and can rotate. The image-only Photo AR and old 2D schematic drawing remain optional comparison modes.

The 3D compositor is integrated into the same-frame synchronized mirror pipeline, with reduced watch dial size, body-relative clothing orientation, approximate shoulder-only fallback for a cropped torso (labeled as approximate), and GPU error recovery that does not close the camera. No generative AI is called on every video frame.

**Scope limit:** These 3D models are procedural *templates* inspired by test products; they are **not verified reconstructions of the exact reference photos**. Shirt sleeves are not skeletal-rigged, cloth does not physically flow, and scene geometry does not yet correctly hide behind hands or a human body. Approved per-SKU GLB mesh assets, UV textures, size measurements, occlusion and garment physics are separate milestones.

This release was checked with JavaScript syntax, synthetic tracking-landmark calculations and a mocked 3D scene factory. **Live WebGL on Android and cross-origin merchant iframe remains unverified until the user tests it.**


## Alpha 0.9 — Arm-following garment mesh (2026-11-18)

[Rotate dynamic T-shirt in 3D without camera](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee) · [Live merchant try-on](https://altaqawy.github.io/rawnak-fit-ai/demo/) · [Implementation details and limitations](docs/GARMENT_MOTION_ALPHA09.md)

The T-shirt and jacket now support **real-time sleeve mesh deformation** from MediaPipe shoulder/elbow landmarks, with light spring smoothing. This is a low-poly CPU mesh deformation and **not full fabric physics or skeletal skinning**. The 3D inspector has a sleeve-raise slider to check the movement independently of tracking.

Synchronized mode optionally restores original camera pixels for a foreground forearm where the arm crosses the shirt. The arm mask is a conservative heuristic derived from pose joints, **not reliable segmentation**. The two new live controls (`garment-motion`, `arm-occlusion`) can disable these features independently. The camera remains on-device, without generated AI video frames or recurring model tokens.

Still missing for realistic merchant try-on: measured/approved GLB geometry and UV fabric textures, true body-to-cloth collisions, garment physics, person/arm segmentation and verified actual device QA. **No accurate fitting guarantee.**

Static syntax and pose/motion mock scenarios were verified; WebGL, iframe camera permissions and movement quality on mobile must be checked using real devices.


## Alpha 1.0 — Curved 3D clothing surface

The green T-shirt in Android Inspector was still a flat silhouette extruded into a rigid block. The demo T-shirt and jacket have now been rebuilt with a curved open 3D torso, an actual crew-neck opening, rounded separately animated sleeves, seam details, and a 64px repeating illustrative cotton weave texture.

Open the [touch-friendly 3D Inspector](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee) to drag-rotate/zoom the garment and adjust sleeve angles independently of the camera, or open the [live demo](https://altaqawy.github.io/rawnak-fit-ai/demo/) to test pose attachment.

This improves the **procedural geometry's appearance**, not the accuracy of the generated reference product's front/back design. The garment is not a merchant-approved digital twin or a full cloth-physics simulation. See [Alpha 1.0 implementation + limitations](docs/ROUNDED_GARMENT_ALPHA10.md).


## Alpha 1.1 — Importable GLB and shoulder skinning

The real product-asset path is now separate from the old procedural T-shirt generator:
- [Reference garment GLB](assets/garments/reference-tee-v1.glb) (original demo model, approximately 101 KB)
- [Source manifest and QA gate](assets/garments/reference-tee-v1.manifest.json)
- [GLTFLoader, hardcoded reference allowlist and local in-memory preview import](src/fit-glb-assets.js)
- [Live Three.js shoulder bone/SkinnedMesh renderer](src/fit-3d-renderer.js)
- [Inspector to compare GLB versus previous procedural model](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee&build=20261118-alpha110)
- [Technical limitations and merchant acceptance criteria](docs/RIGGED_GARMENT_ALPHA11.md)

The reference tee includes glTF 2.0 skinning, three joints, and per-vertex bone weights. MediaPipe shoulder/elbow angles now rotate the imported garment bones; this is different from moving separate rigid cylinders. The asset is loaded once per preview session and camera frames are not uploaded for generation.

**Important:** The reference garment is *authored test geometry*, not photo-to-3D reconstruction, not an actual seller SKU, not accurate cloth physics, and not verified sizing. The old procedural model is still available for explicit comparison. The Inspector can also preview a local GLB with `Shoulder_L` and `Shoulder_R` bones without uploading it, but local files are never automatically approved or published.

New CI contract: `node --test tests/reference-glb.test.mjs`; runtime test on actual phone/browser is still required.


## Asset Library pilot — photo intake and reusable 3D routes

[Open RAWNAK Asset Library](https://altaqawy.github.io/rawnak-fit-ai/studio/library.html) · [Implementation notes](docs/ASSET_LIBRARY_PILOT_V01.md) · [Source registry](studio/asset-library-sources.json)

The new merchant-side pilot supports T-shirts, watches and bags. It accepts local images with explicit view tags, validates minimum photo coverage, original pixel resolution, manufacturer dimensions and use-rights confirmation; suggests category-specific reusable modeling routes; estimates a **non-verified product color hint** from a front image; previews a local GLB on the device with orbit controls; and exports a strict metadata-only Asset Draft JSON.

This is **not yet image-to-3D generation**. Third-party reconstruction models and marketplace assets have **not** been imported or run; the vendor's exact product design is not automatically reconstructed. Asset approval stays false until a real SKU GLB has been reviewed and authorized. The original AutoFit Studio now links into the pilot without transferring image files between pages.
