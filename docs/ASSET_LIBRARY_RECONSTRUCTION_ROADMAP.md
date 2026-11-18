# RAWNAK FIT AI — Asset Library & Photo-to-3D Hybrid Roadmap

**Research date:** 2026-11-18  
**Stage:** Research and architecture approved for a prototype; **none of the third-party assets or model weights have been imported into the application.**  
**Source registry:** [studio/asset-library-sources.json](../studio/asset-library-sources.json)

## Decision

Replace the strategy "build all garments and accessories with hardcoded procedural geometry" with a **category-aware asset pipeline** that selects a licensed, deformable 3D template, matches it to multiple verified merchant images and exact dimensions, and produces an approved and versioned GLB per SKU/size.

### What this can improve

- Reuse authentic construction topology, UVs, bone skeletons, attachment points and physically plausible material classes.
- Reduce per-product editing compared with sculpting a fresh mesh.
- Preserve real seller colors, logos, seams, buckles and prints by fitting textures and using genuine merchant product images as supervised inputs.
- Run reconstruction once per product; mobile live frames use local MediaPipe + rigging + lightweight GPU rendering.
- Separate **geometry quality** from **body tracking quality**, preventing the same kind of error from being hidden by new camera overlays.

### What it cannot magically solve

- A photograph can't reveal true unseen geometry, physical circumference, cloth stretch, material weight, or exact fit. Inference is provisional until verified.
- A 3D template alone is not an accurate rendering of the product (even if it supports a full 360-degree view).
- Open-source software is not automatically permission to copy and bundle a third-party asset or hosted service weights in a commercial SDK.
- Imported rigid meshes lack garment cloth physics; standard image-to-3D models can give poor open sleeves and incorrect topology.
- The vendor must own or hold the rights for supplied product photos, trademarks and textures.

## Researched reusable foundations

| Foundation | Use | Assessment | Official link |
| --- | --- | --- | --- |
| **GarmentCode** (MIT repository) | Parametric sewing patterns and made-to-measure garment templates | **Priority 1** for clothing templates and pattern editing; still needs garment simulation/export tests | https://github.com/maria-korosteleva/GarmentCode |
| **SwiftTailor** (Qualcomm, BSD-3-Clause-Clear code) | Image or text → PatternMaker sewing pattern → GarmentSewer geometry | **Priority 1 experimental** for clothing image-to-pattern; check all released model weight and dependency permissions separately | https://github.com/Qualcomm-AI-research/garment-gen |
| **PatternGSL** (SIGGRAPH 2026) | Image → editable panel/seam specification → simulation-ready garment | Promising **research-only** until full implementation, weights and legal terms verified | https://lagrangeli.github.io/PatternGSL/ |
| **CLO3D** | Industrial sewing pattern design, simulation and manual inspection | Professional reference/artist tool, optional paid workflow rather than a dependency for every shop | https://www.clo3d.com/ |
| **Meshy Multi-Image API** | Multiple source images → 3D asset and textured GLB | **Priority 1 paid fallback** for watches, bags, glasses, footwear; API supports up to four images per task, more photographs can be used in pre-validation/reference | https://docs.meshy.ai/en/api/multi-image-to-3d |
| **Microsoft TRELLIS.2** (MIT model/code) | Image → generic textured 3D | Good experiment for rigid accessories, but official local requirement is >=24GB NVIDIA VRAM, so not on an ordinary 4GB GPU | https://github.com/microsoft/TRELLIS.2 |
| **COLMAP** | Reconstruct physical objects from many overlapping real photographs | Prefer for rigid handbags/footwear with textured surfaces; shiny metal and transparent stones require different capture/material methods | https://colmap.github.io/ |
| **Poly Haven** (CC0 assets) | HDRI and PBR lighting, some background/reference 3D assets | Eligible for commercial builds where suitable; still not verified as a marketplace source of our needed garment templates | https://polyhaven.com/license |
| **Blendkit** | Additional 3D artist assets | Per-asset CC0 or royalty-free terms. Do not bundle royalty-free raw GLB files without confirming redistribution rights | https://www.blendkit.com/docs/licenses/ |
| **Sketchfab** | Marketplace assets for reference | Particular asset license may prohibit standalone model delivery/extraction. Do not automatically mirror or distribute in an SDK | https://sketchfab.com/licenses |

**Hunyuan3D 2.1** should not be a default commercial dependency pending a full specific-license review. Some official components identify a noncommercial license. https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1

## Category-aware workflows

### Garments — T-shirts, hoodies, dresses, jackets

1. Product intake: verified images including a front/back view, side views, close-ups, real size chart and fabric type.
2. AI categorize: crew neck vs V-neck, set-in vs raglan sleeve, loose vs slim fit, seam position, printable motifs, pockets, buttons.
3. Choose GarmentCode parametric template. Optionally generate/adjust panel patterns with SwiftTailor or PatternGSL research.
4. Validate sewn **panel connectivity**. Build a garment from front/back/sleeve panels with actual armhole curves, not cylinders or a flat extrusion.
5. Fit seam lengths and circumference against merchant dimensions; inspect front/back/side renders against photos.
6. Generate UV and materials; use product photos for texture/projection only where geometry supports them.
7. Add skeleton & skinning (torso, shoulders, upper/lower arms), then desktop cloth pre-simulation and mobile-aware simplified skinning and cloth deformation.
8. Export optimized GLB, record fit quality and merchant approval.

### Watches, rings, bangles, glasses, earrings

- Prefer reusable **parametric components** (watch case/dial/strap; ring band/stone/prongs; glasses frame/lenses/hinges; bangle/closure).
- Read exact manufacturer measurements to lock scale.
- Use multi-image 3D generation for detailing, followed by geometry/material cleanup.
- For reflective metals and gemstones, product-specific surface finish, environment maps, physical lens/stone material and close-up verification matter more than triangle count.
- Finger/ear tracking must be implemented independently from wrist/face/shoulder tracking; not all accessory categories are implemented in the current live mirror.

### Bags, shoes

- For real physical samples, evaluate overlapping-photo photogrammetry (COLMAP) and multi-image generation.
- Use separate attachment components: bag body/straps/clasp, shoe upper/sole/laces, and separate motion constraints for handles and flexible straps.
- Validate inferred thickness/depth and hardware against real dimensions, not camera pixel width.
- Current Alpha 1.1 camera code is **illustrative**, not verified object-specific shape matching.

## Photography and measurement instructions

Keep the existing category-specific [capture profiles](../studio/capture-profiles.js) as the system-of-record: they already specify reference capture requirements by category, photo quality, soft even illumination, material classes and millimeter/centimeter sizing.

The **minimum for an AI preview is not the same as a verified 3D reconstruction**. For instance, Meshy Multi-Image's current API accepts **1–4 photos** in one generation request, but the store can require more to review backside, dimensions and texture details. Existing Studio verified capture ranges from around 16–40 images depending on category. A high-quality photogrammetry pass may need many more overlapping images.

Suggested pilot: 1 real merchant tee in three variants + 1 real watch + 1 bag. Collect the approved product photos, SKU and measurements. Use the same locked camera/lighting conditions for benchmark screenshots.

## Asset registry and system contracts

Use **two levels**:

**A. Template Registry** (reusable assets; license and version controlled):

- `templateId`, `category`, `topologyFamily`, `source`, `sourceLicense`, `permissions`
- `glbTemplateUrl` only after human approval
- `bones`, `UVSet`, `requiredMeasurementFields`, `supportedDeformations`
- `version`, `sha256`, `author`, `attribution`

**B. Product Asset Record** (one product-specific output, separate from template):

- `merchantId`, `SKU`, `variant`, `templateId`
- `sourcePhotos[]`, `captureChecklist`, `merchantMeasurements`, `materialProperties`
- `generatedModelUrl`, `cleanedGLB`, `renderCheckImages[]`
- `licenseVerified`, `merchantApproved`, `scaleVerified`, `fitSimulationVerified`, `qualityScore`
- `processingCost`, `generatorVersion`, `status`, `assetHash`

Keep states `intake` → `candidate` → `generated` → `geometry_review` → `approved` → `published`; no preview should say “exact SKU”, “real fit” or “full 360 accurate product” while unapproved.

## Device and cost architecture

**One-off prep per SKU:** submit merchant images and measurements to a model preparation worker; optionally use a paid GPU or credit API, then compress and cache verified GLB. This has a variable cost only when generating a new asset or variation.

**Per shopper session:** reuse the already published GLB in Three.js; track face/pose/hand with MediaPipe on device; animate locally with zero diffusion API calls per frame.

**GitHub Pages is only a demo:** it can host static GLBs and the Inspector, but cannot safely store production API keys, private merchant uploads, background GPU reconstruction jobs, queue limits or authenticated merchant approval. Implement those behind a separate protected processing service when the pilot proves quality.

## Recommended milestone order

- P0: template source curation + licensing checks; source and product schema, validation and UI status
- P1: one genuine T-shirt garment pattern through GarmentCode/SwiftTailor → UV/rigged GLB → merchant dimensions
- P2: benchmark high-quality watch image → Meshy multi-image / parametric model → verify detailed watch face
- P3: bag photogrammetry / multi-image → strap/body rig
- P4: on-device live rendering, segmentation, cloth/strap motion, perf tuning, and merchant SDK activation

**Stop conditions:** no production release if supplied reference image details are materially invented or missing, actual physical size cannot be verified, high-level topology is invalid, source licensing is unclear, or camera FPS isn't practical on a real phone.
