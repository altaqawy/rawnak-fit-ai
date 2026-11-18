# RAWNAK FIT AI — Alpha 1.1: first separate skinned garment GLB

Date: 2026-11-18  
Repository: `altaqawy/rawnak-fit-ai`

## What changed

Prior experiments built shirt geometry at runtime inside `src/fit-3d-renderer.js`. Every attempt to refine the mathematical radius or add sleeves made the procedural model slightly more detailed but did not create a reusable garment asset.

Alpha 1.1 takes the first production-architecture step: **actual binary GLB asset loading and genuine glTF shoulder skinning**.

- Asset: [reference-tee-v1.glb](../assets/garments/reference-tee-v1.glb)
- Catalog record: [reference-tee-v1.manifest.json](../assets/garments/reference-tee-v1.manifest.json)
- Fixed allowlisted loader: [fit-glb-assets.js](../src/fit-glb-assets.js)
- Renderer integration: [fit-3d-renderer.js](../src/fit-3d-renderer.js)

The independent source asset contains **1,475 vertices**, **2,688 triangles**, and a **three-joint skin** (`RigRoot`, `Shoulder_L`, `Shoulder_R`). The binary is approximately **101 KB**. Each vertex includes position, normal, UV, `JOINTS_0`, and `WEIGHTS_0`. Bone transformations deform the skinned geometry using the glTF 2.0 standard.

This reference is **original procedural/pattern-inspired geometry**, **not generated from the eight synthetic product photographs** and **not a verified reproduction of an actual merchant SKU**. Do not market it as true-size or authentic 360° product geometry.

## Live rendering

```
Merchant/Studio reference product
  -> allowlisted manifest ID RAWNAK-REF-TEE-001
  -> fetch local .glb
  -> official Three.js GLTFLoader (pinned import map)
  -> require SkinnedMesh + named shoulder bones
  -> convert glTF Y-up to camera Y-down
  -> MediaPipe shoulders/elbows -> motion smoothing
  -> update Shoulder_L / Shoulder_R bones
  -> draw skinned mesh with WebGL over camera frame
```

The reference model is loaded **once per renderer instance**, not downloaded or regenerated on every video frame. MediaPipe and the GPU render locally, so the live path does **not** send images to a generative AI API or consume image-generation tokens per frame.

If the GLB fails, the original procedural tee remains available and the viewer **shows the failure status**. The Inspector lets the user explicitly switch to the older procedural version for comparison.

## Try now

1. [GLB and legacy side-by-side comparison, no camera](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee&build=20261118-alpha110). Turn on the `GLB مرجعي` checkbox, rotate and raise sleeves. Turn it off to compare against the old procedural shirt.
2. [Try it on with the camera](https://altaqawy.github.io/rawnak-fit-ai/demo/?build=20261118-alpha110). Select the T-shirt and verify the status says `GLB Reference ✓` after loading before evaluating the pose.
3. Rotate the body and raise one arm, then both. The shoulder joints should move the attached sleeve geometry without moving the torso anchor.
4. Switch to other categories. They remain clearly labeled geometry-only demos rather than exact SKU GLBs.

## New-quality acceptance gates

For the real merchant garment pipeline, a product cannot be marketed as ready or size-accurate until **all** are satisfied:

- Consistent photos of the same real product, front/back/sides and seam details.
- Manufacturer dimensions in centimeters for each SKU and size, garment category and variant.
- Garment model with front/back, actual armholes, seams and texture UVs, verified against source photos.
- Named joints/hierarchy with validated bind pose and normalized skinning weights.
- No gaps/self-intersections under common arm raises; correct face winding, normals and tangent basis.
- Physically meaningful fabric parameters including approximate weight, stretch and stiffness.
- Real-device verification on mobile and desktop, plus explicitly recorded merchant approval.

**Not yet implemented:** fully image-to-GLB reconstruction, Blender-authored garment pattern fitting, per-SKU physical dimensions, advanced cloth-body collision, actual customer-size estimation, semantic person segmentation, commercial merchant tenancy, or guaranteed fit accuracy.

## QA and testing

- `tests/reference-glb.test.mjs`: inspects the GLB binary header, buffer bounds, valid geometry, normalized skin weights, shoulder joints, and noncommercial manifest.
- `tests/static-check.mjs`: pins import maps, loader and source-provenance text.
- GitHub Actions configured, but the user's repository has previously had runner-start failures; verify the actual job logs and real device before claiming runtime success.
- Asset loading requires WebGL and network access for Three.js and MediaPipe libraries; the model file itself is hosted on the same GitHub Pages origin.

## Follow-up engineering

Next milestones should be independent gates, not a single oversized task:

**A.** Import a higher-quality garment designed from a real sewing pattern, with a verified model/photo match.  
**B.** Expand the rig beyond two shoulders: upper arms, torso, hips, bind-pose and sleeve skin weights.  
**C.** Add body garment collision/deformation (mobile tiered XPBD or precomputed garment shapes).  
**D.** Add true person/hand occlusion and independent tracking/render FPS instrumentation.  
**E.** Publish a merchant-approved asset manifest/API only after catalog and file validation.  

References: [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) and [Khronos glTF 2.0 skinning](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
