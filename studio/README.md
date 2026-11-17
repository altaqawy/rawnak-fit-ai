# RAWNAK AutoFit Studio — Alpha 0.5

**Live page (after GitHub Pages finishes publishing):** https://altaqawy.github.io/rawnak-fit-ai/studio/

**Scope:** First functional merchant-side pipeline for onboarding a product from photographs to a reusable AR asset **preparation plan** and an **illustrative parametric 3D geometry template** for watches, rings, and bangles.

## What works in the first version

- Browser-based multi-photo upload with local thumbnail display (PNG/JPG/WebP, 8 photos max, 10 MB each).
- **Automatic one-time image classification** starts after upload with lazily loaded TensorFlow.js MobileNetV2 (ImageNet). Maps recognized classes into our product categories; uses name and filename hints as fallback, never asserts uncertain prediction as truth.
- Category correction with a manual select; no external vision API secret.
- Approximate dominant color detection (not calibrated to photo color profiles).
- Category engine routing for watch, ring, bangle, glasses, earrings, bags, shoes, T-shirts, hoodies, jackets, dresses.
- Physical measurement input before preparing a product asset.
- **Three.js procedural meshes for watch, ring and bangle**, interactive orbit rotation and estimated material color, as generic shape placeholders rather than reconstructed SKU matches.
- Export local GLB **generic templates** and JSON metadata; in-memory batch preparation queue can be exported to JSON.
- Status flags for categories without a real reconstruction engine (such as bag/shoes/garments); intentionally **no fake generated 3D**.
- Existing customer live mirror is kept separate and unchanged except for navigation to the Studio.

## Run it

On GitHub Pages, open the page above. Locally:

    python -m http.server 5173

Then visit http://localhost:5173/studio/

Needs internet on first AI analysis to download the on-device MobileNet model and, when starting 3D preview, a pinned Three.js ES module. The images are processed in the **browser**, not uploaded by the application. The browser downloads third-party model/JS/font assets.

### Test expected flow

1. Upload photo of a watch. AI analysis begins automatically; if classification is uncertain or incorrect, change the category to **ساعة**.
2. Enter the watch's actual case diameter, e.g. 42 mm. Choose a preview color.
3. Click **بناء النموذج المبدئي 3D**. Drag to rotate the illustrative watch. The photo has not been used to reconstruct its unique dial, clasp or geometry.
4. Export GLB or JSON or add product to local preparation list.
5. Repeat with ring and bangle. For hoodie, bag or shoes, expect **needs-review** rather than a working 3D model.
6. Demo buttons allow inspecting sample geometric templates without merchant photos or measurements; these **must never** be mistaken for verified product twins.

## What is *not* done

- AI generative reconstruction of true 3D geometry from photo(s).
- Isolating the SKU texture/pattern and mapping it faithfully onto garment topology.
- Exact watch dial, carved ring details, bracelet clasp, verified back and side views.
- Clothing sewing-pattern inference, rigging or cloth simulation.
- Persisting products/images to a server or database; refreshing the page loses the in-memory queue.
- Integration of new catalog GLB assets into customer-facing live tracking.

These need a later backend/GPU asset preparation pipeline, a merchant approvals UX and category-specific garment rigging. Do not advertise these as current features.

## Architecture

- [engine.js](engine.js) — lightweight category routing, review policy, metadata and pixel-color estimation. No external dependencies.
- [app.js](app.js) — merchant page, upload lifecycle, TFJS MobileNet classifier, queue and exports.
- [viewer.js](viewer.js) — dynamically loaded Three.js procedural meshes and GLTFExporter.
- [index.html](index.html) + [style.css](style.css) — merchant workspace UI.
- [tests/engine.test.mjs](tests/engine.test.mjs) — Node tests for category routing, confidence and fidelity flags.

**Future provider:** A cloud image-to-3D service should run as a background SKU-preparation job with budget limits and human approval, never on every live camera frame. Never put provider keys in this frontend; use backend environment secrets.

## Costs and privacy

Static site and local Three.js geometry require no per-image-generation API fees. TFJS model download has bandwidth cost, local computing power and CDN dependencies. GPU image-to-3D assets are **not connected or billed** in this version.

## Acceptance criteria

- Browser JS and route tests pass.
- No crash when AI CDN fails; category can be selected manually.
- No crash when WebGL fails; photos, routing and JSON export remain available.
- No image uploaded by application.
- Actual 3D preview and GLB export need browser/device acceptance testing.
- Avoid false claims about exact geometry, sizing or 360° authenticity.
