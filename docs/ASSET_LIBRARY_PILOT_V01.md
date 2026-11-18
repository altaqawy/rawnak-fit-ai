# RAWNAK FIT — Asset Library Pilot v0.1

**Implemented:** 2026-11-18  
**Entry:** [studio/library.html](../studio/library.html)  
**Status:** Browser-only working intake, photo QA, visual color hint and local GLB review; **external AI reconstruction, commercial model library import and product approval are NOT connected**.

## What you can do right now

1. Open AutoFit Studio and click **استكمال المنتج في مكتبة قوالب 3D** (name, category and SKU are passed as text-only query params; photos stay in the current browser page).
2. Choose a **T-shirt**, **watch**, or **bag** pilot.
3. Add merchant-owned product photos (PNG/JPEG/WEBP, up to 48, <=10 MB each) and explicitly label their angles: front, rear, left/right, top, inside, details, diagonal.
4. Enter real manufacturer dimensions in cm/mm. Confirm product category and the rights to use the images.
5. Observe a readiness report showing incomplete angle coverage, photos below the recommended preview count, low pixel resolution and missing physical measurements. **A 100% readiness score means metadata completeness, not 3D model fidelity or certification.**
6. Select a *front* photo and click **تحليل اللون**. A local canvas estimates a foreground color hint using corner-background comparison and a quantized histogram. This low/medium-confidence color is never automatically approved and may be wrong for metallic watches, transparent products and busy backgrounds.
7. Open a local **GLB** (up to 20 MB) in a Three.js OrbitControls preview. 3D is loaded in memory only. The page rejects external resource references, unsupported required extensions, more than 60 meshes, or more than 250K estimated triangles. No uploaded model is automatically a published asset. The page also links to the reference rigged garment inspector.
8. Export an **Asset Draft JSON**, containing SKU, selected template and source route, image angle/dimension *metadata*, measured values, visual color hint and review blockers. **Raw photo pixels and GLB bytes are not in the JSON**.

## Implemented files

- `studio/asset-pipeline.js` — strict intake rules, distinct category routing, safe draft schema and non-approval contract.
- `studio/photo-style.js` — local color-hint extraction from front image.
- `studio/library.js` — UI, files and object-URL lifecycle, validation, local GLB viewer and manifest export.
- `studio/library.html`, `studio/library.css` — responsive UI.
- `studio/asset-library-sources.json` — 9 researched tools/resources, 11 categories, license cautions.
- `studio/tests/asset-pipeline.test.mjs` and `studio/tests/photo-style.test.mjs` — route/rights/readiness and photo-hint regressions.
- `studio/index.html`, `studio/app.js` — direct navigation from existing AutoFit Studio.

## Route selection: pilots only

| Category | Recommended starting template | Workflow | Third-party integration |
| --- | --- | --- | --- |
| T-shirt | `crew-neck-set-in-sleeve` | Pattern/rig (GarmentCode, explore SwiftTailor) | Not connected |
| Watch | `round-case-two-part-strap` | Parametric components + multi-view material/detail model | Not connected |
| Bag | `structured-shoulder-bag` | Multi-view reconstruction + separate body/strap | Not connected |

No third-party mesh or model weights have been copied into the project. A provider's open-source code license does not necessarily grant redistribution rights for model weights or marketplace assets.

## Missing before accurate product try-on

- Real merchant reference pictures and dimensions for three pilot SKUs.
- A reliable garment pattern/geometry creation process, validated front/back/sleeve topology, multi-size garment fitting.
- Paid image-to-3D provider backend (if needed), secure API keys, job queue, budgets, failure handling.
- Asset license checks and authorization for distributing derived GLBs.
- Automated rendering front/back/side comparison to the actual SKU, plus merchant approval.
- Catalog persistence, image storage policy and privacy/consent rules.
- Mobile WebGL + camera device testing; skeleton/cloth physics and occlusion remain experimental.

**Do not claim**: photo-to-3D generation complete, 100% fit, merchant-approved geometry, or that the AI inferred the garment size from a photograph.

## Verification

Run `node --test studio/tests/*.test.mjs` and `node --check studio/library.js`. The GitHub Actions workflow has a Studio test step but repository runners previously sometimes failed before test execution. Browser/real-device testing remains necessary.

**Live pilot:** https://altaqawy.github.io/rawnak-fit-ai/studio/library.html
