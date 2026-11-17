# ADR-0002 — Automated category-specific 3D catalog preparation

**Status:** Proposed architecture, not a feature currently running in the live site.  
**Updated:** 2026-11-17.

## Goal

Merchant uploads ordinary product photos and the system automatically selects a preparation engine, generates or modifies a reusable 3D asset, calibrates its scale and attachment, requests approval of uncertain features, and caches the asset for all future shopper try-on sessions.

**No single model can faithfully reconstruct the unseen back, true dimensions, cloth behavior, jewelry detail or a proper wearable rig from one photograph.** Do not market speculative rear design as a merchant-verified 360-degree view.

## Shared importer flow

1. Sync product catalog or upload photos. Trust merchant category/SKU where available; predict only when missing. Merchant can override.
2. Run quality checks, background removal when appropriate, and visual attribute extraction.
3. Route to specialized per-category processing, using template first when the design is compatible; otherwise use AI-generated candidate meshes.
4. Ask only for missing material evidence (back, side, sole or clasp view, manufacturer measurements), when it changes product fidelity.
5. Generate fitted GLB/GLTF and PBR materials, separate rigid and moving parts, normalize to real measurements.
6. Assign wearable attachment profile. Garments additionally need rigging, shape deformation and selective cloth physics.
7. Render a rotating QA preview; merchant accepts or corrects. Flag missing/unverified geometry.
8. Cache by SKU, geometry shape, color and asset version. Browser displays saved geometry over the camera with local AR, without per-frame generative image calls.

## Engine routing matrix

| Category | Preferred low-cost engine | When unique 3D is necessary | Attachment | Essential physical metadata |
| --- | --- | --- | --- | --- |
| T-shirt, hoodie, shirt, jacket | Reusable garment pattern + textures + size-specific deformation | Unusual cuts, collars, sleeves | Body rig + cloth + segmentation | Shoulder, chest, sleeve, body length by size |
| Dress, skirt, loose garment | Pattern-and-drape generator | Special drape, multi-layer cloth | Body rig / collision | Waist, bust, length, size and fabric type |
| Ring | Parametric band diameter/profile and optional stone setting | Complex sculpture, unusual gemstone cluster | Finger segment hand-tracking | Ring size, width, stone size |
| Wristwatch | Parametric case/strap and dial-image texture | Unique case/strap geometry | Wrist axis, palm direction | Case diameter, thickness, strap width |
| Bangle, bracelet | Parametric band / chain segments | Carved, braided or elaborate designs | Wrist / forearm orientation | Inner diameter, thickness, length |
| Glasses | Frame family and lens/temple pieces | Novel frames / hinges | Face and nose/ears | Lens width, bridge, temple |
| Earring | Simple template or 3D reconstructed pair | Detailed sculpted earrings | Ear anchors | Drop length and width |
| Handbag | Image-to-3D with body/handles/strap separated | Most unique bags | Shoulder, hand, crossbody | Bag H/W/D, strap length |
| Shoes | Image-to-3D and shoe family templates | Detailed silhouette and outsole | Foot orientation + ankle | Sole length, shoe size |

Different colors or labels sharing a geometry should reuse the same base mesh: changed UV/PBR texture does not require regenerating 3D.

## Photos, review and fidelity

- **One clear image:** potentially adequate for a simple parametric shape or approximate 3D concept. Unknown surfaces are not authentic product data.
- **Front and back:** improves clothing texture fidelity and rear identification; still not guaranteed accurate dimensions.
- **Front + back + left/right or a slow orbit video:** better for structured object reconstruction and identifying geometry changes.
- **CAD, genuine 3D, sewing patterns:** strongest source for accurate shape, drape and true 360° when available.
- Store a visibility indicator: front-only, approximate-360 or merchant-verified-360. Also track readiness and QA confidence.

## Technologies considered

- [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2) provides image-to-3D with textured PBR and open-surface geometry; official installation requires Linux and at least 24GB NVIDIA GPU memory. Model and code MIT, but check separate dependency licenses. Run as a cloud/one-time SKU generation job, not in the live browser camera.
- [GarmentCrafter](https://www.cmu.edu/xrtc/news/2026/feb/news-article.html) is research on single-image editable garment reconstruction, not a verified production API.
- [Dress-1-to-3](https://dress-1-to-3.github.io/) researches reconstructing simulation-ready separated garments and sewing patterns. Generic image-to-3D meshes are NOT automatically cloth-ready.
- [Snap Garment Transfer](https://docs.lensstudio.com/develop/capabilities/ar/try-on/garment-transfer) is an alternative *frontal live image transfer* path. Its documentation expects a frontal image of a person wearing the garment rather than only an isolated garment. Do not confuse this with a verified 3D back surface.
- [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) tracks 21 hand keypoints but cannot provide exact finger circumference from an RGB webcam.
- Tencent Hunyuan3D-2.1 has conditions and geographic restrictions in its [Community License](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE); do not assume it is suitable for a globally available commercial service without legal review.

## Asset and workflow API contract

Each prepared asset should have: storeId; sku; category; engine; sourcePhotoKeys; measurementsCm; materialTags; attachProfile; modelGlb; textureUrls; status (draft/processing/needs-review/missing-views/ready); viewCertification (front-only/approximate-360/merchant-verified-360); confidence; merchantApprovedAt; assetVersion; variationOf.

Each preparation engine implements common stages: analyzeProduct, prepareGeometry, attachMetadata, validateIdentity, optimizeForWeb, and exportAsset. Expensive generation happens when SKU geometry first changes; merely switching a shirt color or watch dial reuses geometry where possible.

## Proposed phased delivery

1. Build merchant upload screen, classification router and review/status database.
2. Build watch and ring parametric generators and use working live hand tracking to demonstrate watch/ring rotation.
3. Build one hoodie template with pattern/rig and verify continuous front-side-back motion; improve body occlusion.
4. Plug generic cloud image-to-3D preprocessing into bags/shoes/complex jewelry; QA for exact details and scale.
5. Bulk imports, variant reuse, mobile performance, cache budgets and merchant analytics.

**Commercial truth-in-preview:** never promise 100% accuracy, true-to-size fit or verified 360° when source data does not support it. The live camera should always remain usable even if asset preparation or tracking fails.

The current Alpha 0.4 implementation is unchanged by this design document.
